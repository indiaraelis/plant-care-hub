#!/usr/bin/env node
/**
 * enrich-base.js
 *
 * Enriquece as 130 plantas da base original (PlantDatabase.js) com dados
 * de cuidado via Gemini, e aplica o patch diretamente no arquivo JS.
 *
 * As plantas base não passaram pelo enrich-catalog.js porque vivem em JS
 * e não no catalog-enriched.json. Este script trata exatamente esse gap.
 *
 * Uso:
 *   node scripts/enrich-base.js              → enriquece todas as 130
 *   node scripts/enrich-base.js --resume     → pula as que já têm care data em base-care.json
 *   node scripts/enrich-base.js --dry-run    → mostra prompt sem chamar API
 *   node scripts/enrich-base.js --apply      → só aplica base-care.json no PlantDatabase.js
 *   node scripts/enrich-base.js --batch 5    → tamanho do lote (padrão: 10)
 *   node scripts/enrich-base.js --model <id> → força modelo Gemini
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const RESUME     = args.includes('--resume');
const APPLY_ONLY = args.includes('--apply');
const BATCH      = (() => { const i = args.indexOf('--batch'); return i >= 0 ? parseInt(args[i + 1]) : 10; })();
const MODEL_ARG  = (() => { const i = args.indexOf('--model'); return i >= 0 ? args[i + 1] : null; })();

const MODELS_TO_TRY = MODEL_ARG
  ? [MODEL_ARG, 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter((m, i, a) => a.indexOf(m) === i)
  : ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const BATCH_DELAY_MS = 5000;

const OUTPUT_DIR  = path.join(__dirname, 'output');
const CARE_FILE   = path.join(OUTPUT_DIR, 'base-care.json');
const DB_FILE     = path.join(__dirname, '..', 'frontend', 'src', 'data', 'PlantDatabase.js');

// ─── Gemini key ───────────────────────────────────────────────────────────────

function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
  return line ? line.split('=')[1].trim() : null;
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

function post(url, body, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const parsed  = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Gemini helpers ───────────────────────────────────────────────────────────

async function testModel(modelId, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const body = { contents: [{ parts: [{ text: 'Responda apenas: ok' }] }], generationConfig: { temperature: 0, maxOutputTokens: 5 } };
  const data = await post(url, body);
  if (!data) return false;
  if (data.error) {
    const code = String(data.error.code || data.error.status || '');
    if (code === '429' || code.includes('RESOURCE_EXHAUSTED')) return 'quota';
    return false;
  }
  return !!data.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callGemini(prompt, apiKey, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } };
  const data = await post(url, body);
  if (!data) return null;
  if (data.error) {
    const code = String(data.error.code || data.error.status || '');
    if (code === '429' || code.includes('RESOURCE_EXHAUSTED')) return '__QUOTA__';
    console.log(`  ⚠ Erro API [${modelId}]: ${data.error.message || code}`);
    return null;
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function callGeminiWithFallback(prompt, apiKey, currentModelRef) {
  let modelIdx = MODELS_TO_TRY.indexOf(currentModelRef.id);
  if (modelIdx < 0) modelIdx = 0;
  for (let i = modelIdx; i < MODELS_TO_TRY.length; i++) {
    const model = MODELS_TO_TRY[i];
    if (model !== currentModelRef.id) {
      console.log(`  ↪ Trocando para modelo: ${model}`);
      currentModelRef.id = model;
    }
    const result = await callGemini(prompt, apiKey, model);
    if (result === '__QUOTA__') {
      console.log(`  ⚠ Quota esgotada para ${model} — tentando próximo…`);
      continue;
    }
    return result;
  }
  console.log('  ✗ Todos os modelos esgotados.');
  return null;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(plants) {
  const list = plants.map((p, i) =>
    `${i + 1}. ${p.scientificName} (${p.commonNamePt || 'sem nome PT'}) — família: ${p.family || '?'}, hábito: ${p.habit || '?'}, origem: ${p.origin || '?'}`
  ).join('\n');

  return `Você é um especialista em plantas domésticas e ornamentais comuns no Brasil.
Para cada planta abaixo, forneça os dados de cuidado típicos quando cultivada em ambiente doméstico brasileiro (apartamento, casa, jardim).

PLANTAS:
${list}

Responda SOMENTE com um array JSON válido, sem markdown, sem comentários, com exatamente ${plants.length} objetos na mesma ordem:
[
  {
    "wateringFrequencyDays": <número inteiro — a cada quantos dias regar tipicamente>,
    "fertilizingFrequencyDays": <número inteiro — a cada quantos dias adubar, ou null se não precisar>,
    "sunlight": <"Pleno sol" | "Meia sombra" | "Sombra">,
    "careHint": <string em português, 1-2 frases curtas com a dica mais importante de cuidado>
  }
]

Referência de rega: Frequente=2d, Moderado=7d, Quinzenal=14d, Mensal=30d, Bimestral=60d.
Para suculentas/cactos use 14-30d. Para tropicais úmidas (Araceae, Marantaceae) use 5-7d.
Para bromélias epífitas (Tillandsia) use 3-5d de nebulização ou imersão semanal → use 7.`;
}

// ─── Extrair plantas do PlantDatabase.js ──────────────────────────────────────

function extractBasePlants() {
  const content = fs.readFileSync(DB_FILE, 'utf8');
  // Encontra o bloco mergedPlants até o início das funções export
  const start = content.indexOf('const mergedPlants = [');
  const end   = content.indexOf('\nexport const', start);
  const section = content.slice(start, end);

  // Extrai cada objeto planta
  const plants = [];
  const idRegex = /"id":\s*"([^"]+)"/g;
  let m;
  while ((m = idRegex.exec(section)) !== null) {
    const idStart = section.lastIndexOf('{', m.index);
    // Encontra o fechamento balanceado do objeto
    let depth = 0;
    let objEnd = idStart;
    for (let i = idStart; i < section.length; i++) {
      if (section[i] === '{') depth++;
      else if (section[i] === '}') { depth--; if (depth === 0) { objEnd = i + 1; break; } }
    }
    const objStr = section.slice(idStart, objEnd);
    try {
      const plant = JSON.parse(objStr);
      plants.push(plant);
    } catch {
      // bloco inválido — pula
    }
  }
  return plants;
}

// ─── Aplicar patch no PlantDatabase.js ───────────────────────────────────────

function applyCarePatch(careMap) {
  let content = fs.readFileSync(DB_FILE, 'utf8');
  let patched = 0;
  let skipped = 0;

  for (const [plantId, care] of Object.entries(careMap)) {
    if (!care || care.wateringFrequencyDays == null) { skipped++; continue; }

    const idPattern = `"id": "${plantId}"`;
    const idIndex = content.indexOf(idPattern);
    if (idIndex === -1) { skipped++; continue; }

    // Bloco desta planta
    const blockEnd = content.indexOf('\n  {', idIndex + 1);
    const blockSlice = blockEnd === -1 ? content.slice(idIndex) : content.slice(idIndex, blockEnd);

    // Só aplica se ainda não tem wateringFrequencyDays
    if (blockSlice.includes('wateringFrequencyDays')) { skipped++; continue; }

    // Encontra o fechamento do bloco (último "}" antes do próximo {)
    const closingIdx = blockEnd === -1
      ? content.lastIndexOf('}')
      : content.lastIndexOf('}', blockEnd - 1);

    // Monta campos a inserir (com vírgula no final dos existentes — insere antes do })
    const careFields = [
      `    "wateringFrequencyDays": ${care.wateringFrequencyDays}`,
      `    "fertilizingFrequencyDays": ${care.fertilizingFrequencyDays ?? null}`,
      `    "sunlight": ${JSON.stringify(care.sunlight)}`,
      `    "careHint": ${JSON.stringify(care.careHint)}`,
    ].join(',\n');

    // Insere antes do } de fechamento da planta
    content = content.slice(0, closingIdx) + ',\n' + careFields + '\n  ' + content.slice(closingIdx);
    patched++;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(DB_FILE, content, 'utf8');
  }
  return { patched, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  enrich-base.js — Plant Care Hub');
  console.log('══════════════════════════════════════════════');
  if (DRY_RUN)    console.log('  ⚠  DRY-RUN — nenhum arquivo será alterado\n');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Modo --apply ──────────────────────────────────────────────────────────
  if (APPLY_ONLY) {
    if (!fs.existsSync(CARE_FILE)) {
      console.error('  ❌ base-care.json não encontrado. Execute sem --apply primeiro.\n');
      process.exit(1);
    }
    const careMap = JSON.parse(fs.readFileSync(CARE_FILE, 'utf8'));
    const { patched, skipped } = applyCarePatch(careMap);
    console.log(`  ✅ Aplicados: ${patched} | Ignorados: ${skipped}\n`);
    return;
  }

  // ── Extrai plantas base ───────────────────────────────────────────────────
  const allPlants = extractBasePlants();
  console.log(`\n  Plantas base extraídas: ${allPlants.length}`);

  // Carrega progresso anterior se --resume
  let saved = {};
  if (RESUME && fs.existsSync(CARE_FILE)) {
    saved = JSON.parse(fs.readFileSync(CARE_FILE, 'utf8'));
    console.log(`  Retomando — já enriquecidas: ${Object.keys(saved).length}`);
  }

  const toEnrich = RESUME
    ? allPlants.filter(p => !(p.id in saved) || saved[p.id]?.wateringFrequencyDays == null)
    : allPlants;

  console.log(`  A enriquecer: ${toEnrich.length}\n`);

  if (toEnrich.length === 0) {
    console.log('  Nada a fazer.\n');
    // Aplica o que já temos
    const { patched, skipped } = applyCarePatch(saved);
    console.log(`  ✅ Aplicados: ${patched} | Ignorados: ${skipped}\n`);
    return;
  }

  // ── Testa modelos ─────────────────────────────────────────────────────────
  const apiKey = loadGeminiKey();
  if (!apiKey && !DRY_RUN) { console.error('\n❌ GEMINI_API_KEY não encontrada.\n'); process.exit(1); }

  const activeModel = { id: MODELS_TO_TRY[0] };
  if (!DRY_RUN) {
    console.log(`  Testando modelos: ${MODELS_TO_TRY.join(' → ')}`);
    let found = false;
    for (const m of MODELS_TO_TRY) {
      process.stdout.write(`   ${m}… `);
      const ok = await testModel(m, apiKey);
      if (ok === true)    { console.log('✅'); activeModel.id = m; found = true; break; }
      if (ok === 'quota') { console.log('⚠ quota'); continue; }
      console.log('✗');
    }
    if (!found) { console.error('\n❌ Nenhum modelo disponível.\n'); process.exit(1); }
    console.log(`\n  Modelo ativo: ${activeModel.id}\n`);
  }

  // ── Processamento em lotes ────────────────────────────────────────────────
  const results = { ...saved };
  let enriched = 0;
  let failed   = 0;

  for (let i = 0; i < toEnrich.length; i += BATCH) {
    const batch = toEnrich.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(toEnrich.length / BATCH);
    const pct = Math.round(((i + batch.length) / toEnrich.length) * 100);

    process.stdout.write(`  Lote ${batchNum}/${totalBatches} (${pct}%) — ${batch.map(p => p.commonNamePt || p.scientificName.split(' ')[0]).join(', ').slice(0, 60)}…\n`);

    if (DRY_RUN) {
      console.log(buildPrompt(batch));
      batch.forEach(p => { results[p.id] = { wateringFrequencyDays: 7, fertilizingFrequencyDays: 30, sunlight: 'Meia sombra', careHint: '[dry-run]' }; });
      enriched += batch.length;
      continue;
    }

    const prompt = buildPrompt(batch);
    const careData = await callGeminiWithFallback(prompt, apiKey, activeModel);

    if (!careData || !Array.isArray(careData) || careData.length !== batch.length) {
      console.log(`  ✗ Lote ${batchNum} falhou — tentando planta por planta…`);
      // Fallback: enriquece uma por uma
      for (const plant of batch) {
        const singlePrompt = buildPrompt([plant]);
        const single = await callGeminiWithFallback(singlePrompt, apiKey, activeModel);
        if (single?.[0]?.wateringFrequencyDays != null) {
          results[plant.id] = single[0];
          enriched++;
          console.log(`    ✓ ${plant.commonNamePt || plant.scientificName}`);
        } else {
          results[plant.id] = null;
          failed++;
          console.log(`    ✗ ${plant.commonNamePt || plant.scientificName} — sem dados`);
        }
        await sleep(1500);
      }
    } else {
      batch.forEach((plant, idx) => {
        results[plant.id] = careData[idx];
        if (careData[idx]?.wateringFrequencyDays != null) {
          enriched++;
          console.log(`    ✓ ${plant.commonNamePt || plant.scientificName}: rega ${careData[idx].wateringFrequencyDays}d | sol: ${careData[idx].sunlight}`);
        } else {
          results[plant.id] = null;
          failed++;
        }
      });
    }

    // Salva progresso a cada lote
    fs.writeFileSync(CARE_FILE, JSON.stringify(results, null, 2), 'utf8');

    if (i + BATCH < toEnrich.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n  ✅ Enriquecidas: ${enriched} | Falhas: ${failed}`);
  if (!DRY_RUN) {
    fs.writeFileSync(CARE_FILE, JSON.stringify(results, null, 2), 'utf8');
    console.log(`  💾 Salvo: scripts/output/base-care.json\n`);
  }

  // ── Aplica patch no PlantDatabase.js ─────────────────────────────────────
  if (!DRY_RUN) {
    console.log('  🔧 Aplicando cuidados no PlantDatabase.js…');
    const { patched, skipped } = applyCarePatch(results);
    console.log(`  ✅ Aplicados: ${patched} | Ignorados: ${skipped}\n`);
  }

  console.log('══════════════════════════════════════════════');
  console.log('  Concluído!');
  console.log('══════════════════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); });
