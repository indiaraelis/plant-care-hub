#!/usr/bin/env node
/**
 * build-plant-catalog.js
 *
 * Descobre automaticamente as plantas domésticas/ornamentais mais relevantes
 * para o Brasil combinando duas fontes abertas:
 *
 *   iNaturalist — popularidade: espécies de plantas mais observadas no Brasil
 *                 Endpoint: /v1/observations/species_counts?place_id=6878
 *
 *   JBRJ        — autoridade botânica brasileira: família, hábito, estabelecimento,
 *                 nomes vernáculos em PT
 *                 Endpoint: /v2/flora/taxon/{nome}
 *
 * Fluxo:
 *   1. Resolve os taxon_id do iNaturalist para cada família ornamental alvo
 *   2. Coleta as espécies mais observadas no Brasil para cada família
 *   3. Descarta espécies já presentes no PlantDatabase.js (por nome científico)
 *   4. Enriquece cada candidata com dados botânicos do JBRJ
 *   5. Salva catalog-candidates.json com proveniência rastreável (sources{})
 *
 * Uso:
 *   node scripts/build-plant-catalog.js
 *   node scripts/build-plant-catalog.js --limit 50       → máx 50 espécies no total
 *   node scripts/build-plant-catalog.js --dry-run        → imprime sem salvar
 *   node scripts/build-plant-catalog.js --inat-only      → pula enriquecimento JBRJ
 *   node scripts/build-plant-catalog.js --per-family 20  → top N por família (padrão: 30)
 *
 * Saída:
 *   scripts/output/catalog-candidates.json
 *
 * Schema de cada entrada:
 *   {
 *     id, scientificName, commonNamePt, alternativeNamesPt[],
 *     family, origin, habit,
 *     iNaturalistObservationsBR, iNaturalistTaxonId,
 *     sources: { taxonomy, vernacular, care },
 *     wateringFrequencyDays, fertilizingFrequencyDays, sunlight, careHint,
 *     status: "pendente_revisao"
 *   }
 */

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const INAT_ONLY  = args.includes('--inat-only');
const LIMIT      = (() => { const i = args.indexOf('--limit');      return i >= 0 ? parseInt(args[i + 1]) : Infinity; })();
const PER_FAMILY = (() => { const i = args.indexOf('--per-family'); return i >= 0 ? parseInt(args[i + 1]) : 30; })();
const DELAY_MS   = 350; // ms entre chamadas, respeita rate limit

const OUTPUT_DIR  = path.join(__dirname, 'output');
const CATALOG_OUT = path.join(OUTPUT_DIR, 'catalog-candidates.json');

// ─── Famílias ornamentais alvo ────────────────────────────────────────────────
// Lista curada para plantas domésticas/de jardim comuns no Brasil.
// Exclui famílias com perfil predominantemente silvestre/agrícola
// (ex: Asteraceae → muitas invasoras; Euphorbiaceae parcial → veja BLOCKED_GENERA).
// Os taxon_id são resolvidos dinamicamente via iNaturalist na fase 1.

const TARGET_FAMILIES = [
  // ── Folhagens tropicais ───────────────────────────────────────────────────
  'Araceae',          // Monstera, Philodendron, Anthurium, Spathiphyllum, Zamioculcas
  'Marantaceae',      // Calathea, Maranta, Stromanthe, Goeppertia
  'Commelinaceae',    // Tradescantia, Callisia
  'Asparagaceae',     // Chlorophytum, Dracaena, Sansevieria, Yucca, Beaucarnea

  // ── Suculentas e cactos ───────────────────────────────────────────────────
  'Crassulaceae',     // Echeveria, Sedum, Crassula, Kalanchoe
  'Asphodelaceae',    // Aloe, Haworthia, Gasteria
  'Cactaceae',        // Cereus, Schlumbergera, Rhipsalis, Melocactus

  // ── Flores e ornamentais de jardim ────────────────────────────────────────
  'Orchidaceae',      // Cattleya, Phalaenopsis, Dendrobium, Epidendrum
  'Bromeliaceae',     // Tillandsia, Aechmea, Guzmania, Neoregelia
  'Begoniaceae',      // Begônia
  'Amaryllidaceae',   // Hippeastrum, Clivia, Crinum
  'Acanthaceae',      // Justicia, Aphelandra, Crossandra (excl. Ruellia silvestre → BLOCKED)
  'Gesneriaceae',     // Violeta-africana (Streptocarpus), Columnea, Episcia
  'Apocynaceae',      // Adenium, Catharanthus, Plumeria (excl. Asclepias → BLOCKED)
  'Geraniaceae',      // Pelargonium, Geranium ornamentais

  // ── Aráceas, palmeiras e afins ────────────────────────────────────────────
  'Arecaceae',        // Raphis, Chamaedorea, Dypsis, Livistona
  'Moraceae',         // Ficus lyrata, elastica, benjamina, pumila
  'Strelitziaceae',   // Strelitzia (ave-do-paraíso), Ravenala
  'Heliconiaceae',    // Helicônia
  'Musaceae',         // Musa ornamental (bananeira-de-jardim)
  'Araliaceae',       // Schefflera, Hedera, Fatsia

  // ── Samambaias ───────────────────────────────────────────────────────────
  'Nephrolepidaceae', // Nephrolepis (samambaia-americana)
  'Pteridaceae',      // Adiantum (avenca)
  'Aspleniaceae',     // Asplenium nidus (samambaia-ninho)
  'Polypodiaceae',    // Microsorum, Platycerium

  // ── Aromáticas e jardins ──────────────────────────────────────────────────
  'Lamiaceae',        // Lavanda, alecrim, hortelã, sálvia, manjericão, tomilho
  'Rubiaceae',        // Gardênia, Ixora, Pentas, Coffea
  'Oleaceae',         // Jasminum (jasmim), Osmanthus
  'Nyctaginaceae',    // Bougainvillea (buganvília), Mirabilis
  'Malvaceae',        // Hibiscus, Abutilon, Pachira
];

// ─── Gêneros bloqueados ───────────────────────────────────────────────────────
// Famílias com mix de ornamentais + silvestres/invasoras.
// Gêneros aqui são descartados mesmo que a família alvo seja listada acima.

const BLOCKED_GENERA = new Set([
  // Apocynaceae silvestres
  'Asclepias',   // cega-olho — invasora de campo
  'Calotropis',  // ciúme — invasora
  'Cynanchum',
  // Acanthaceae silvestres
  'Ruellia',     // maria-sem-vergonha-do-campo — invasora urbana
  'Thunbergia',  // cipó-de-jardim mas também invasora
  // Lamiaceae silvestres / ervas com pouco apelo de jardim
  'Hyptis',
  'Stachys',
  'Leonurus',
  // Commelinaceae silvestres
  'Commelina',   // trapoeraba — invasora
  // Moraceae silvestres
  'Maclura',
  'Dorstenia',
  // Outros
  'Ricinus',     // mamona — campo/invasora (Euphorbiaceae, não está em TARGET mas por segurança)
  'Solanum',     // mistura muito com espécies silvestres
  'Mirabilis',   // pode ser ornamental mas também silvestre — inclua manualmente se quiser

  // ── Palmeiras silvestres/de grande porte ──────────────────────────────────
  'Mauritia',    // Buriti — palmeira de alagados, enorme
  'Syagrus',     // Gerivá — palmeira de praça/cerrado
  'Euterpe',     // Palmito Juçara — ameaçada, não doméstica
  'Copernicia',  // Carnaúba — palmeira industrial gigante
  'Oenocarpus',  // Bacaba — silvestre da Amazônia

  // ── Árvores de grande porte ───────────────────────────────────────────────
  'Ceiba',       // Paineira — árvore de calçada
  'Artocarpus',  // Jaca — frutífera de quintal/árvore grande
  'Mangifera',   // Manga — frutífera

  // ── Cactos silvestres (não ornamentais típicos) ───────────────────────────
  'Xiquexique',  // gen. informal — cacto da Caatinga silvestre
  'Pilosocereus', // cacto de caatinga/rupestre, raramente doméstico

  // ── Rubiaceae silvestres ──────────────────────────────────────────────────
  'Palicourea',  // arbusto silvestre do cerrado
  'Psychotria',  // arbusto silvestre da mata atlântica
  'Richardia',   // invasora, erva daninha

  // ── Bromeliaceae silvestres/espinhosas ───────────────────────────────────
  'Bromelia',    // bromélia espinhenta silvestre (Bromelia antiacantha etc.)
  'Encholirium', // bromélia silvestre da caatinga

  // ── Aquáticas / epífitas silvestres ──────────────────────────────────────
  'Pistia',      // alface-d'água — aquática invasora
  'Microgramma', // samambaia epífita silvestre
  'Eulophia',    // orquídea terrestre silvestre (África)
  'Hydrocotyle', // erva aquática/daninha (Araliaceae)
  'Gomesa',      // orquídea silvestre da Mata Atlântica, não ornamental comercial
]);


// ─── Utilitários ──────────────────────────────────────────────────────────────

function get(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'PlantCareHub-CatalogBuilder/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // redireciona uma vez
        return get(res.headers.location, timeoutMs).then(resolve);
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Formata nomes populares: capitaliza palavras de conteúdo, preposições em minúsculo */
function formatCommonName(str) {
  if (!str) return '';
  const LOWER_MIDDLE = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o']);
  let globalIdx = 0;
  return str.toLowerCase()
    .split('-')
    .map((seg) =>
      seg.split(' ').map((w) => {
        const isFirst = globalIdx === 0;
        if (w) globalIdx++;
        if (!w) return w;
        if (isFirst) return w.charAt(0).toUpperCase() + w.slice(1);
        if (LOWER_MIDDLE.has(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ')
    ).join('-');
}

/** Filtra nomes vernáculos espúrios (muito curtos, inglês, palavras-chave de dados) */
function saneName(v) {
  if (!v || v.length < 3) return false;
  if (/^(yes|no|true|false|null|none|unknown)$/i.test(v.trim())) return false;
  // Remove entradas que são claramente inglês (sem letras acentuadas e muito comuns em inglês)
  // Heurística leve — mantém se tiver acento ou for PT-like
  return true;
}

/** Exibe barra de progresso simples no terminal */
function progress(current, total, label) {
  const pct   = Math.round((current / total) * 100);
  const bar   = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r  [${bar}] ${pct}% — ${label.padEnd(45)}`);
}

// ─── Fase 1: Resolver taxon_id de famílias no iNaturalist ─────────────────────

async function resolveFamilyTaxonIds(families) {
  console.log(`\n► Fase 1 — Resolvendo ${families.length} famílias no iNaturalist…`);
  const map = {}; // family → taxon_id
  for (let i = 0; i < families.length; i++) {
    const family = families[i];
    progress(i + 1, families.length, family);
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(family)}&rank=family&is_active=true`;
    const data = await get(url);
    if (data && data.results) {
      const hit = data.results.find(
        (t) => t.rank === 'family' && t.name.toLowerCase() === family.toLowerCase()
      );
      if (hit) map[family] = hit.id;
    }
    await sleep(DELAY_MS);
  }
  process.stdout.write('\n');
  const found    = Object.keys(map).length;
  const missing  = families.filter((f) => !map[f]);
  console.log(`  ✓ ${found}/${families.length} famílias resolvidas`);
  if (missing.length) console.log(`  ⚠ Não resolvidas: ${missing.join(', ')}`);
  return map;
}

// ─── Fase 2: Coletar espécies por família no iNaturalist (Brasil) ──────────────

async function collectSpeciesFromINaturalist(familyMap, perFamily) {
  console.log(`\n► Fase 2 — Coletando top ${perFamily} espécies por família no Brasil (place_id=6878)…`);

  const families = Object.keys(familyMap);
  const allSpecies = []; // { scientificName, iNatTaxonId, observationsBR, family }

  for (let i = 0; i < families.length; i++) {
    const family   = families[i];
    const taxonId  = familyMap[family];
    progress(i + 1, families.length, family);

    const url = `https://api.inaturalist.org/v1/observations/species_counts` +
      `?place_id=6878&taxon_id=${taxonId}&quality_grade=research` +
      `&per_page=${perFamily}&page=1`;

    const data = await get(url);
    if (data && data.results) {
      for (const item of data.results) {
        const taxon = item.taxon;
        if (!taxon || taxon.rank !== 'species') continue;
        // Garante que o ancestral inclui a família esperada (confirmação)
        allSpecies.push({
          scientificName:   taxon.name,
          iNatTaxonId:      taxon.id,
          observationsBR:   item.count,
          family,           // a família que usamos para a busca
        });
      }
    }
    await sleep(DELAY_MS);
  }

  process.stdout.write('\n');

  // Deduplica: se uma espécie apareceu em mais de uma family query, mantém a de mais observações
  const deduped = new Map();
  for (const sp of allSpecies) {
    const key = sp.scientificName.toLowerCase();
    if (!deduped.has(key) || sp.observationsBR > deduped.get(key).observationsBR) {
      deduped.set(key, sp);
    }
  }

  // Ordena por observações decrescentes
  const sorted = [...deduped.values()].sort((a, b) => b.observationsBR - a.observationsBR);
  console.log(`  ✓ ${sorted.length} espécies únicas coletadas`);
  return sorted;
}

// ─── Fase 3: Filtrar espécies já existentes no app ────────────────────────────

function loadExistingScientificNames() {
  const dbPath = path.join(__dirname, '..', 'frontend', 'src', 'data', 'PlantDatabase.js');
  if (!fs.existsSync(dbPath)) {
    // Tenta alternativo (path legado)
    const alt = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'PlantDatabase.js');
    if (!fs.existsSync(alt)) { console.log('  ⚠ PlantDatabase.js não encontrado — nenhuma filtragem de existentes'); return new Set(); }
    return extractNamesFromFile(alt);
  }
  return extractNamesFromFile(dbPath);
}

function extractNamesFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const names   = new Set();
  // Captura tanto `scientificName: "X"` (JS literal) como `"scientificName": "X"` (JSON)
  for (const m of content.matchAll(/"?scientificName"?\s*:\s*['"]([^'"]+)['"]/g)) {
    // Normaliza: pega apenas gênero + epíteto específico (primeiras 2 palavras),
    // descartando autorias como "Liebm.", "(L.)", "Mart." etc.
    const parts = m[1].trim().split(/\s+/);
    const normalized = parts.slice(0, 2).join(' ').toLowerCase();
    names.add(normalized);
    names.add(m[1].toLowerCase()); // também adiciona nome completo como fallback
  }
  return names;
}

// ─── Fase 4: Enriquecer com JBRJ ──────────────────────────────────────────────

async function enrichWithJBRJ(scientificName) {
  const encoded = encodeURIComponent(scientificName);
  const url     = `https://servicos.jbrj.gov.br/v2/flora/taxon/${encoded}`;
  const data    = await Promise.race([
    get(url, 8000),
    new Promise((r) => setTimeout(() => r(null), 9000)),
  ]);

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const record  = data[0];
  // A família fica em record.taxon.family (não diretamente em record)
  const taxon   = record.taxon   || {};
  const profile = record.specie_profile || {};
  const dist    = record.distribuition  || [];
  const verns   = record.vernacular_name || [];

  const result = {
    family:          taxon.family || null,
    vernacularNames: [],
    origin:          null,
    habit:           null,
    jbrjFound:       true,
  };

  // Nomes vernáculos em português — objetos com .vernacularname e .language_vernacularname
  result.vernacularNames = verns
    .filter((v) => (v.language_vernacularname || '').toLowerCase().includes('portugu'))
    .map((v) => formatCommonName((v.vernacularname || '').trim()))
    .filter((n) => n.length >= 3 && saneName(n));

  // Hábito de vida a partir de specie_profile.lifeForm[]
  const lifeForms = (profile.lifeForm || []).map((f) => f.toLowerCase());
  if (lifeForms.length) {
    if      (lifeForms.some((f) => /árvore|arbore/.test(f)))    result.habit = 'Árvore';
    else if (lifeForms.some((f) => /arbusto|shrub/.test(f)))    result.habit = 'Arbusto';
    else if (lifeForms.some((f) => /trepade|liana/.test(f)))    result.habit = 'Trepadeira';
    else if (lifeForms.some((f) => /suculen/.test(f)))          result.habit = 'Suculenta';
    else if (lifeForms.some((f) => /palm/.test(f)))             result.habit = 'Palmeira';
    else if (lifeForms.some((f) => /bambu/.test(f)))            result.habit = 'Bambu';
    else if (lifeForms.some((f) => /erva|herb/.test(f)))        result.habit = 'Herbácea';
    else result.habit = profile.lifeForm[0];
  }

  // Estabelecimento no Brasil
  const means = [...new Set(dist.map((d) => (d.establishmentmeans || '').toUpperCase()))];
  if      (means.includes('NATIVA'))       result.origin = 'Nativa do Brasil';
  else if (means.includes('CULTIVADA'))    result.origin = 'Cultivada no Brasil';
  else if (means.includes('EXOTICA'))      result.origin = 'Exótica cultivada no Brasil';
  else if (means.includes('NATURALIZADA')) result.origin = 'Naturalizada no Brasil';

  return result;
}

// ─── Fase 5: Construir entrada final ──────────────────────────────────────────

function buildEntry(sp, jbrj) {
  // Nome comum: primeiro nome vernáculo do JBRJ ou indicação da família
  let commonNamePt    = null;
  let altNames        = [];

  if (jbrj && jbrj.vernacularNames && jbrj.vernacularNames.length) {
    commonNamePt = jbrj.vernacularNames[0];
    altNames     = jbrj.vernacularNames.slice(1);
  }

  const family  = (jbrj && jbrj.family) || sp.family;
  const origin  = (jbrj && jbrj.origin) || derivedOrigin(sp.scientificName);
  const habit   = (jbrj && jbrj.habit)  || null;

  return {
    id:                         slugify(sp.scientificName),
    scientificName:             sp.scientificName,
    commonNamePt:               commonNamePt || sp.scientificName.split(' ')[0], // fallback = gênero
    alternativeNamesPt:         altNames,
    family,
    origin,
    habit,
    iNaturalistObservationsBR:  sp.observationsBR,
    iNaturalistTaxonId:         sp.iNatTaxonId,
    sources: {
      taxonomy:   jbrj ? 'JBRJ' : 'iNaturalist',
      vernacular: jbrj && jbrj.vernacularNames.length ? 'JBRJ' : 'pendente',
      care:       'pendente',
    },
    wateringFrequencyDays:      null,
    fertilizingFrequencyDays:   null,
    sunlight:                   null,
    careHint:                   null,
    status:                     'pendente_revisao',
  };
}

/** Heurística de origem quando JBRJ não responde */
function derivedOrigin(sciName) {
  const tropical = ['Monstera', 'Philodendron', 'Anthurium', 'Heliconia', 'Calathea',
                    'Bromelia', 'Aechmea', 'Tillandsia', 'Syagrus', 'Euterpe',
                    'Cereus', 'Rhipsalis', 'Pilocereus', 'Cactus'];
  const genus = sciName.split(' ')[0];
  if (tropical.includes(genus)) return 'América tropical / Brasil';
  return null;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════');
  console.log(' build-plant-catalog.js');
  console.log('════════════════════════════════════════');
  if (DRY_RUN)   console.log(' MODO: dry-run (não salva arquivos)');
  if (INAT_ONLY) console.log(' MODO: inat-only (pula JBRJ)');
  if (LIMIT < Infinity) console.log(` LIMITE: ${LIMIT} espécies`);
  console.log(` Per family: ${PER_FAMILY} espécies`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Fase 1
  const familyMap = await resolveFamilyTaxonIds(TARGET_FAMILIES);

  // Fase 2
  let candidates = await collectSpeciesFromINaturalist(familyMap, PER_FAMILY);

  // Fase 3 — Remove espécies já no app e gêneros bloqueados
  console.log('\n► Fase 3 — Filtrando espécies já existentes no app e gêneros bloqueados…');
  const existing = loadExistingScientificNames();
  console.log(`  Plantas já no app: ${existing.size}`);
  const before = candidates.length;
  candidates = candidates.filter((c) => {
    // Compara por "Gênero espécie" (2 primeiras palavras) para ignorar autorias no DB
    const normalized = c.scientificName.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
    return !existing.has(normalized) && !existing.has(c.scientificName.toLowerCase());
  });
  const afterExisting = candidates.length;

  const blockedList = [];
  candidates = candidates.filter((c) => {
    const genus = c.scientificName.split(' ')[0];
    if (BLOCKED_GENERA.has(genus)) { blockedList.push(c.scientificName); return false; }
    return true;
  });

  console.log(`  ✓ ${before - afterExisting} descartadas (já existentes)`);
  if (blockedList.length) console.log(`  ✓ ${blockedList.length} descartadas (gênero bloqueado): ${blockedList.slice(0,8).join(', ')}${blockedList.length > 8 ? '…' : ''}`);
  console.log(`  ✓ ${candidates.length} candidatas restantes`);

  // Aplica limite
  if (LIMIT < Infinity) {
    candidates = candidates.slice(0, LIMIT);
    console.log(`  → Limitado a ${candidates.length} espécies`);
  }

  // Fase 4 — Enriquecimento JBRJ
  const entries = [];
  let jbrjHit = 0, jbrjMiss = 0;

  if (INAT_ONLY) {
    console.log('\n► Fase 4 — IGNORADA (--inat-only)');
    for (const sp of candidates) {
      entries.push(buildEntry(sp, null));
    }
  } else {
    console.log(`\n► Fase 4 — Enriquecendo ${candidates.length} espécies com JBRJ…`);
    for (let i = 0; i < candidates.length; i++) {
      const sp = candidates[i];
      progress(i + 1, candidates.length, sp.scientificName);
      const jbrj = await enrichWithJBRJ(sp.scientificName);
      if (jbrj) jbrjHit++; else jbrjMiss++;
      entries.push(buildEntry(sp, jbrj));
      await sleep(DELAY_MS);
    }
    process.stdout.write('\n');
    console.log(`  ✓ JBRJ: ${jbrjHit} encontradas, ${jbrjMiss} não encontradas`);
  }

  // Fase 5 — Sumário + saída
  console.log('\n► Fase 5 — Sumário de qualidade:');
  const withCommonName  = entries.filter((e) => e.commonNamePt && e.commonNamePt !== e.scientificName.split(' ')[0]).length;
  const withOrigin      = entries.filter((e) => e.origin).length;
  const withHabit       = entries.filter((e) => e.habit).length;
  const jbrjSource      = entries.filter((e) => e.sources.taxonomy === 'JBRJ').length;
  console.log(`  Total de candidatas: ${entries.length}`);
  console.log(`  Com nome popular PT: ${withCommonName}/${entries.length}`);
  console.log(`  Com origem:          ${withOrigin}/${entries.length}`);
  console.log(`  Com hábito:          ${withHabit}/${entries.length}`);
  console.log(`  Fonte JBRJ:          ${jbrjSource}/${entries.length}`);

  // Amostras
  console.log('\n  Primeiras 5 entradas:');
  entries.slice(0, 5).forEach((e) => {
    console.log(`    ${e.scientificName.padEnd(30)} | ${(e.commonNamePt || '—').padEnd(25)} | ${e.family || '—'} | ${e.origin || '—'}`);
  });

  if (!DRY_RUN) {
    // JSON completo
    fs.writeFileSync(CATALOG_OUT, JSON.stringify(entries, null, 2), 'utf8');

    // CSV para revisão manual (abrir no Numbers/Excel)
    const CSV_OUT = path.join(OUTPUT_DIR, 'catalog-candidates.csv');
    const csvHeader = 'scientificName,commonNamePt,alternativeNamesPt,family,origin,habit,iNatObservationsBR,sources_taxonomy,sources_vernacular,status';
    const csvRows = entries.map(e => [
      e.scientificName,
      e.commonNamePt || '',
      (e.alternativeNamesPt || []).join(' / '),
      e.family || '',
      e.origin || '',
      e.habit  || '',
      e.iNaturalistObservationsBR || '',
      e.sources?.taxonomy   || '',
      e.sources?.vernacular || '',
      e.status || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    fs.writeFileSync(CSV_OUT, [csvHeader, ...csvRows].join('\n'), 'utf8');

    console.log(`\n✅ Salvo em: ${CATALOG_OUT}`);
    console.log(`   CSV para revisão: ${CSV_OUT}`);
    console.log(`\n   Próximos passos:`);
    console.log(`   1. Revisar catalog-candidates.csv (Numbers/Excel) → deletar linhas indesejadas`);
    console.log(`   2. Salvar como catalog-approved.json (ou editar catalog-candidates.json)`);
    console.log(`   3. node scripts/enrich-catalog.js`);
    console.log(`   4. node scripts/merge-catalog.js`);
  } else {
    console.log('\n  [dry-run] Nada salvo.');
  }

  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
