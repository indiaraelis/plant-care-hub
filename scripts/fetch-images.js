#!/usr/bin/env node
/**
 * fetch-images.js
 *
 * Busca imagens no iNaturalist para todas as plantas do banco:
 *   - 451 extras: usa iNaturalistTaxonId diretamente  → GET /v1/taxa/{id}
 *   - 130 base:   busca por nome científico            → GET /v1/taxa?q={name}
 *
 * Salva imageUrl em:
 *   - catalog-enriched.json (extras) → merge-catalog.js gera PlantDatabaseExtra.js
 *   - PlantDatabase.js (base)        → patch direto no arquivo JS
 *
 * Uso:
 *   node scripts/fetch-images.js               → full run (extras + base)
 *   node scripts/fetch-images.js --resume      → pula plantas que já têm imageUrl
 *   node scripts/fetch-images.js --extra-only  → só as 451 plantas extra
 *   node scripts/fetch-images.js --base-only   → só as 130 plantas base
 *   node scripts/fetch-images.js --dry-run     → mostra o que faria sem chamar API
 *   node scripts/fetch-images.js --apply       → aplica base-images.json no PlantDatabase.js
 */

'use strict';

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args         = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const RESUME       = args.includes('--resume');
const EXTRA_ONLY   = args.includes('--extra-only');
const BASE_ONLY    = args.includes('--base-only');
const APPLY_ONLY   = args.includes('--apply');

// iNaturalist pede máx ~1 req/s para não autenticado
const DELAY_MS    = 500;

const OUTPUT_DIR   = path.join(__dirname, 'output');
const ENRICHED     = path.join(OUTPUT_DIR, 'catalog-enriched.json');
const BASE_IMAGES  = path.join(OUTPUT_DIR, 'base-images.json');
const DB_FILE      = path.join(__dirname, '..', 'frontend', 'src', 'data', 'PlantDatabase.js');

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'plant-care-hub/1.0 (github.com/plant-care-hub)',
        'Accept':     'application/json',
      },
    };
    let raw = '';
    const req = https.get(url, options, (res) => {
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ ok: false, status: res.statusCode, data: null }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, data: null, error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, status: 408, data: null }); });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── iNaturalist helpers ──────────────────────────────────────────────────────

function extractPhotoUrl(result) {
  if (!result) return null;
  const photo = result.default_photo;
  if (!photo) return null;
  // Prefere medium (440px), cai para square (75px) se não houver
  return photo.medium_url || photo.square_url || null;
}

async function fetchByTaxonId(taxonId) {
  const url = `https://api.inaturalist.org/v1/taxa/${taxonId}`;
  const res = await get(url);
  if (!res.ok || !res.data) return null;
  const result = (res.data.results || [])[0];
  return extractPhotoUrl(result);
}

async function fetchByScientificName(scientificName) {
  // Pula identificações incompletas (sp., spp., gênero só) — não há espécie definida,
  // qualquer match seria de uma espécie arbitrária do gênero, o que é enganoso.
  const parts = scientificName.trim().split(/\s+/);
  if (parts.length < 2) return null; // só gênero
  const secondWord = parts[1].replace(/\.$/, '').toLowerCase();
  if (secondWord === 'sp' || secondWord === 'spp') return null;

  // Remove autores e abreviações infra-específicas (ex: "Annona phaeoclados Mart." → "Annona phaeoclados")
  // Mantém nomes com var./subsp./ssp. desde que busque pela espécie principal
  const clean = scientificName
    .replace(/\s+(var\.|subsp\.|ssp\.|f\.)\s+\S+.*$/, '') // remove rank infra-específico
    .replace(/\s+[A-Z][a-z]*\..*$/, '')                    // remove autores (ex: L., Mart., Jacq.)
    .trim();

  // Exige pelo menos 2 palavras após limpeza
  if (clean.split(/\s+/).length < 2) return null;

  const q = encodeURIComponent(clean);
  const url = `https://api.inaturalist.org/v1/taxa?q=${q}&is_active=true&rank=species,subspecies,variety&per_page=3`;
  const res = await get(url);
  if (!res.ok || !res.data) return null;
  const results = res.data.results || [];

  // Verifica correspondência exata pelo nome binomial limpo (genus + epithet)
  const [genus, epithet] = clean.toLowerCase().split(/\s+/);
  const match = results.find((r) => {
    const rName = (r.name || '').toLowerCase();
    // Match exato ou começa com "genus epithet" exato
    // Aceita: match exato, ou "genus epithet subsp./var./..." (espaço após epithet garante
    // que não casa com espécies cujo epithet é prefixo, ex: "helix" não casa "helixiana")
    return rName === `${genus} ${epithet}` || rName.startsWith(`${genus} ${epithet} `);
  });
  // Se não houver match exato, não aceita "o primeiro resultado" — retorna null
  if (!match) return null;
  return extractPhotoUrl(match);
}

// ─── Patch PlantDatabase.js ───────────────────────────────────────────────────

function applyBasePatch(imagesMap) {
  let content = fs.readFileSync(DB_FILE, 'utf8');
  let patched = 0;
  let skipped = 0;

  for (const [plantId, imageUrl] of Object.entries(imagesMap)) {
    if (!imageUrl) { skipped++; continue; }
    // Encontra o bloco da planta pelo id e substitui "imageUrl": null
    // Padrão seguro: procura "id": "plantId" e o primeiro "imageUrl": null depois
    const idPattern = `"id": "${plantId}"`;
    const idIndex = content.indexOf(idPattern);
    if (idIndex === -1) { skipped++; continue; }

    // Pega o trecho do bloco desta planta (até a próxima chave de fechamento de objeto ou próxima planta)
    const blockEnd = content.indexOf('\n  {', idIndex + 1);
    const blockSlice = blockEnd === -1
      ? content.slice(idIndex)
      : content.slice(idIndex, blockEnd);

    if (!blockSlice.includes('"imageUrl": null')) { skipped++; continue; }

    // Substitui só dentro do bloco desta planta
    const before = content.slice(0, idIndex);
    const block  = blockSlice.replace('"imageUrl": null', `"imageUrl": "${imageUrl}"`);
    const after  = blockEnd === -1 ? '' : content.slice(blockEnd);
    content = before + block + after;
    patched++;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(DB_FILE, content, 'utf8');
  }
  return { patched, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function fetchExtraImages() {
  console.log('\n📸 Buscando imagens para as 451 plantas extra (via taxon ID)...\n');
  const data = JSON.parse(fs.readFileSync(ENRICHED, 'utf8'));

  const toFetch = RESUME
    ? data.filter((p) => !p.imageUrl)
    : data;

  console.log(`   Total: ${data.length} | A buscar: ${toFetch.length} | Já têm imagem: ${data.length - toFetch.length}`);
  if (toFetch.length === 0) { console.log('   Nada para fazer.\n'); return; }

  let found = 0, missing = 0;
  const startTime = Date.now();

  for (let i = 0; i < toFetch.length; i++) {
    const plant = toFetch[i];
    const pct = Math.round(((i + 1) / toFetch.length) * 100);
    process.stdout.write(`\r   [${i + 1}/${toFetch.length}] ${pct}% — ${plant.scientificName.slice(0, 40).padEnd(40)}`);

    if (!DRY_RUN) {
      const url = await fetchByTaxonId(plant.iNaturalistTaxonId);
      // Atualiza o objeto no array principal (toFetch aponta para o mesmo objeto)
      plant.imageUrl = url || null;
      if (url) found++; else missing++;
      await sleep(DELAY_MS);
    } else {
      found++;
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n   ✅ Encontradas: ${found} | Sem imagem: ${missing} | Tempo: ${elapsed}s`);

  if (!DRY_RUN) {
    fs.writeFileSync(ENRICHED, JSON.stringify(data, null, 2), 'utf8');
    console.log(`   💾 Salvo: scripts/output/catalog-enriched.json\n`);
  }
}

async function fetchBaseImages() {
  console.log('\n📸 Buscando imagens para as 130 plantas base (via nome científico)...\n');

  // Extrai as plantas base do PlantDatabase.js
  const content = fs.readFileSync(DB_FILE, 'utf8');
  const plantMatches = [...content.matchAll(/"id":\s*"([^"]+)"[^}]*?"scientificName":\s*"([^"]+)"/gs)];

  // Filtra só os da base (não os que têm iNaturalistTaxonId — esses vêm de extraPlants)
  const existingImages = {};
  const imgMatches = [...content.matchAll(/"id":\s*"([^"]+)"[^}]*?"imageUrl":\s*("([^"]+)"|null)/gs)];
  for (const m of imgMatches) {
    existingImages[m[1]] = m[3] || null;
  }

  // Carrega base-images.json existente se --resume
  let savedImages = {};
  if (RESUME && fs.existsSync(BASE_IMAGES)) {
    savedImages = JSON.parse(fs.readFileSync(BASE_IMAGES, 'utf8'));
  }

  const plants = plantMatches.map((m) => ({ id: m[1], scientificName: m[2] }));
  const toFetch = RESUME
    ? plants.filter((p) => !(savedImages[p.id]))
    : plants;

  console.log(`   Total: ${plants.length} | A buscar: ${toFetch.length} | Já têm imagem: ${plants.length - toFetch.length}`);
  if (toFetch.length === 0) { console.log('   Nada para fazer.\n'); return savedImages; }

  let found = 0, missing = 0;
  const results = { ...savedImages };

  for (let i = 0; i < toFetch.length; i++) {
    const plant = toFetch[i];
    const pct = Math.round(((i + 1) / toFetch.length) * 100);
    process.stdout.write(`\r   [${i + 1}/${toFetch.length}] ${pct}% — ${plant.scientificName.slice(0, 40).padEnd(40)}`);

    if (!DRY_RUN) {
      const url = await fetchByScientificName(plant.scientificName);
      results[plant.id] = url || null;
      if (url) found++; else missing++;

      // Salva progresso a cada 10 plantas
      if ((i + 1) % 10 === 0) {
        fs.writeFileSync(BASE_IMAGES, JSON.stringify(results, null, 2), 'utf8');
      }

      await sleep(DELAY_MS);
    } else {
      results[plant.id] = 'DRY_RUN_URL';
      found++;
    }
  }

  console.log(`\n\n   ✅ Encontradas: ${found} | Sem imagem: ${missing}`);

  if (!DRY_RUN) {
    fs.writeFileSync(BASE_IMAGES, JSON.stringify(results, null, 2), 'utf8');
    console.log(`   💾 Salvo: scripts/output/base-images.json\n`);
  }

  return results;
}

function applyImages(imagesMap) {
  console.log('\n🔧 Aplicando imagens nas plantas base (PlantDatabase.js)...');
  if (DRY_RUN) { console.log('   [dry-run] Nenhuma alteração feita.\n'); return; }
  const { patched, skipped } = applyBasePatch(imagesMap);
  console.log(`   ✅ Aplicadas: ${patched} | Sem imagem/não encontradas: ${skipped}\n`);
}

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  fetch-images.js — Plant Care Hub');
  console.log('══════════════════════════════════════════════');
  if (DRY_RUN) console.log('  ⚠  DRY-RUN — nenhum arquivo será alterado\n');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (APPLY_ONLY) {
    if (!fs.existsSync(BASE_IMAGES)) {
      console.error('  ❌ base-images.json não encontrado. Execute sem --apply primeiro.\n');
      process.exit(1);
    }
    const imagesMap = JSON.parse(fs.readFileSync(BASE_IMAGES, 'utf8'));
    applyImages(imagesMap);
    console.log('  ✅ PlantDatabase.js atualizado.\n');
    return;
  }

  // Fase 1: extras
  if (!BASE_ONLY) {
    await fetchExtraImages();
  }

  // Fase 2: base
  if (!EXTRA_ONLY) {
    const imagesMap = await fetchBaseImages();

    // Fase 3: aplicar patch nas plantas base
    if (!DRY_RUN) {
      applyImages(imagesMap);
    }
  }

  // Fase 4: regenerar PlantDatabaseExtra.js
  if (!BASE_ONLY && !DRY_RUN) {
    console.log('🔄 Regenerando PlantDatabaseExtra.js...');
    const { execSync } = require('child_process');
    try {
      execSync('node scripts/merge-catalog.js --integrate', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    } catch (e) {
      console.error('  ❌ Erro ao regenerar PlantDatabaseExtra.js:', e.message);
    }
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('  Concluído!');
  console.log('══════════════════════════════════════════════\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
