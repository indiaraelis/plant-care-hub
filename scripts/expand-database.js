#!/usr/bin/env node
/**
 * expand-database.js
 *
 * Consulta JBRJ (Flora do Brasil 2020) + GBIF para obter dados taxonômicos
 * de plantas domésticas comuns no Brasil, depois gera um prompt Gemini para
 * enriquecer com dados de cuidado (rega, adubação, dica em PT).
 *
 * Fontes:
 *   JBRJ  — https://servicos.jbrj.gov.br/v2/flora/taxon/{nome}
 *            família, formas de vida, nomes vernáculos PT, estabelecimento
 *   GBIF  — https://api.gbif.org/v1/species/match?name={nome}
 *            fallback para família + taxonomia quando JBRJ não retorna
 *
 * Ambas gratuitas, sem chave, licença aberta.
 *
 * Uso:
 *   node scripts/expand-database.js
 *   node scripts/expand-database.js --limit 10      → processa só 10 plantas
 *   node scripts/expand-database.js --dry-run       → imprime sem salvar
 *   node scripts/expand-database.js --gemini        → chama Gemini API direto
 *
 * Saída:
 *   scripts/output/new-plants.json                 ← taxonomia (JBRJ + GBIF)
 *   scripts/output/new-plants-gemini-prompt.txt    ← prompt para colar manualmente
 *   scripts/output/new-plants-enriched.json        ← resultado final com dados Gemini
 *
 * Fluxo completo:
 *   Opção A (manual):  rodar sem --gemini → revisar JSON → colar prompt no Gemini
 *   Opção B (auto):    rodar com --gemini → revisar new-plants-enriched.json
 *   Em ambos: mesclar entradas aprovadas em frontend/src/data/PlantDatabase.js
 *
 * GEMINI_API_KEY: lido de backend/.env automaticamente se existir, ou de process.env.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── Configuração ────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, 'output');
const JSON_OUT   = path.join(OUTPUT_DIR, 'new-plants.json');
const PROMPT_OUT = path.join(OUTPUT_DIR, 'new-plants-gemini-prompt.txt');

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const USE_GEMINI  = args.includes('--gemini');
const LIMIT       = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : Infinity; })();
const DELAY_MS    = 400;  // respeita rate limit das duas APIs
const GEMINI_BATCH = 10; // plantas por chamada ao Gemini
const GEMINI_BATCH_DELAY = 5000; // 5s entre batches → fica bem abaixo de 15 req/min

// Lê GEMINI_API_KEY de backend/.env ou process.env
function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
  return line ? line.split('=')[1].trim() : null;
}

// ─── Lista de plantas ────────────────────────────────────────────────────────
// Edite conforme os gaps que você identificar no uso real do app.
// "hint" é o nome popular que vai aparecer se JBRJ não tiver vernáculo PT.

const PLANTS_TO_FETCH = [
  // Folhagens tropicais
  { query: 'Philodendron hederaceum',    hint: 'Filodendro' },
  { query: 'Philodendron bipinnatifidum',hint: 'Filodendro-pé-de-elefante' },
  { query: 'Anthurium andraeanum',       hint: 'Antúrio' },
  { query: 'Spathiphyllum wallisii',     hint: 'Espada-de-Oxalá / Lírio-da-paz' },
  { query: 'Aglaonema commutatum',       hint: 'Aglaonema' },
  { query: 'Dieffenbachia seguine',      hint: 'Copo-de-leite-do-mato' },
  { query: 'Caladium bicolor',           hint: 'Caládio' },
  { query: 'Alocasia amazonica',         hint: 'Alocásia' },
  { query: 'Colocasia esculenta',        hint: 'Taro / Inhame' },
  { query: 'Tradescantia zebrina',       hint: 'Coração-roxo / Trapoeraba' },
  { query: 'Tradescantia pallida',       hint: 'Coração-roxo-escuro' },
  { query: 'Chlorophytum comosum',       hint: 'Clorofito / Fitinha' },
  { query: 'Asplenium nidus',            hint: 'Samambaia-ninho' },
  { query: 'Nephrolepis exaltata',       hint: 'Samambaia-americana' },
  { query: 'Adiantum capillus-veneris',  hint: 'Avenca' },
  // Suculentas e cactos
  { query: 'Echeveria elegans',          hint: 'Echeveria' },
  { query: 'Sedum morganianum',          hint: 'Burro-de-rabo' },
  { query: 'Crassula ovata',             hint: 'Jade / Árvore-da-fortuna' },
  { query: 'Haworthia attenuata',        hint: 'Hawortia' },
  { query: 'Aloe vera',                  hint: 'Babosa' },
  { query: 'Opuntia ficus-indica',       hint: 'Palma / Figo-da-índia' },
  { query: 'Cereus jamacaru',            hint: 'Mandacaru' },
  { query: 'Zamioculcas zamiifolia',     hint: 'Zamioculca / ZZ Plant' },
  { query: 'Euphorbia tirucalli',        hint: 'Dedo-de-moça / Avelós' },
  // Ficus e aráceas
  { query: 'Ficus lyrata',              hint: 'Figo-lira' },
  { query: 'Ficus elastica',            hint: 'Borracha' },
  { query: 'Ficus benjamina',           hint: 'Ficus-chorão' },
  { query: 'Schefflera actinophylla',   hint: 'Cheflera' },
  { query: 'Epipremnum aureum',         hint: 'Jiboia / Pothos' },
  // Flores e ornamentais
  { query: 'Impatiens walleriana',      hint: 'Beijo' },
  { query: 'Begonia semperflorens',     hint: 'Begônia' },
  { query: 'Hibiscus rosa-sinensis',    hint: 'Hibisco' },
  { query: 'Ixora coccinea',            hint: 'Ixora' },
  { query: 'Catharanthus roseus',       hint: 'Vinca / Boa-noite' },
  { query: 'Pelargonium hortorum',      hint: 'Gerânio' },
  { query: 'Viola tricolor',            hint: 'Amor-perfeito' },
  { query: 'Tagetes patula',            hint: 'Cravo-de-defunto' },
  { query: 'Helianthus annuus',         hint: 'Girassol' },
  { query: 'Rosa chinensis',            hint: 'Roseira' },
  { query: 'Lavandula angustifolia',    hint: 'Lavanda' },
  { query: 'Kalanchoe blossfeldiana',   hint: 'Calanchoê' },
  { query: 'Schlumbergera truncata',    hint: 'Flor-de-maio' },
  // Ervas aromáticas
  { query: 'Ocimum basilicum',          hint: 'Manjericão' },
  { query: 'Mentha spicata',            hint: 'Hortelã' },
  { query: 'Origanum vulgare',          hint: 'Orégano' },
  { query: 'Rosmarinus officinalis',    hint: 'Alecrim' },
  { query: 'Thymus vulgaris',           hint: 'Tomilho' },
  { query: 'Cymbopogon citratus',       hint: 'Capim-limão / Capim-cidreira' },
  { query: 'Lippia alba',               hint: 'Erva-cidreira' },
  // Palmeiras e cicas
  { query: 'Dypsis lutescens',          hint: 'Palmeira-areca' },
  { query: 'Rhapis excelsa',            hint: 'Palmeira-ráfis' },
  { query: 'Cycas revoluta',            hint: 'Cica' },
  { query: 'Beaucarnea recurvata',      hint: 'Pata-de-elefante' },
  { query: 'Yucca elephantipes',        hint: 'Iuca' },
  // Trepadeiras e pendentes
  { query: 'Hoya carnosa',              hint: 'Hoya / Flor-de-cera' },
  { query: 'Ceropegia woodii',          hint: 'Corações-em-corrente' },
  { query: 'Scindapsus pictus',         hint: 'Pothos-argento' },
  { query: 'Thunbergia alata',          hint: 'Olho-de-poeta' },
  // Populares
  { query: 'Pachira aquatica',          hint: 'Munguba / Árvore-da-fortuna' },
  { query: 'Strelitzia reginae',        hint: 'Ave-do-paraíso' },
  { query: 'Heliconia psittacorum',     hint: 'Bico-de-papagaio' },
  { query: 'Plumeria rubra',            hint: 'Jasmim-manga' },
  { query: 'Brunfelsia uniflora',       hint: 'Manacá' },
  { query: 'Camellia japonica',         hint: 'Camélia' },
  { query: 'Gardenia jasminoides',      hint: 'Gardênia' },
  { query: 'Jasminum sambac',           hint: 'Jasmim' },
  { query: 'Bougainvillea spectabilis', hint: 'Buganvílea' },
];

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

function get(url) {
  const fetchPromise = new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'plant-care-hub/1.0 (github.com/indiaraelis/plant-care-hub)' } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (!data.trim()) { resolve(null); return; }
          try { resolve(JSON.parse(data)); }
          catch { resolve(null); }
        });
        res.on('error', () => resolve(null));
      }
    );
    req.on('error', () => resolve(null));
  });
  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 8000));
  return Promise.race([fetchPromise, timeoutPromise]);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, '_').slice(0, 60);
}

// ─── JBRJ ────────────────────────────────────────────────────────────────────

async function jbrjTaxon(scientificName) {
  const url = `https://servicos.jbrj.gov.br/v2/flora/taxon/${encodeURIComponent(scientificName)}`;
  const data = await get(url);
  if (!Array.isArray(data) || data.length === 0) return null;

  const item = data[0];
  const taxon = item.taxon || {};
  const sp    = item.specie_profile || {};
  const dist  = item.distribuition  || [];
  const verns = item.vernacular_name || [];

  // Nomes vernáculos PT — filtra valores inválidos (muito curtos, inglês, números)
  const ptNames = verns
    .filter(v => (v.language_vernacularname || '').toLowerCase().includes('portugu'))
    .map(v => titleCase((v.vernacularname || '').trim()))
    .filter(n => n.length >= 3 && /[a-záéíóúâêîôûãõàç]/i.test(n) && !/^(yes|no|true|false|null)$/i.test(n));

  // Formas de vida
  const lifeForms = sp.lifeForm || [];

  // Estabelecimento no Brasil
  const establishments = [...new Set(dist.map(d => d.establishmentmeans).filter(Boolean))];

  return {
    family:          taxon.family || null,
    order:           taxon.order  || null,
    lifeForms,
    establishments,  // NATIVA, CULTIVADA, EXOTICA, etc.
    ptNames,
    source: 'JBRJ',
  };
}

// ─── GBIF ────────────────────────────────────────────────────────────────────

async function gbifMatch(scientificName) {
  const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}&kingdom=Plantae&verbose=false`;
  const d = await get(url);
  if (!d || d.matchType === 'NONE' || !d.usageKey) return null;
  return {
    usageKey:       d.usageKey,
    family:         d.family  || null,
    scientificName: d.species || d.scientificName || scientificName,
    source: 'GBIF',
  };
}

async function gbifVernacularPt(usageKey) {
  const url = `https://api.gbif.org/v1/species/${usageKey}/vernacularNames?limit=50`;
  const d = await get(url);
  return (d?.results || [])
    .filter(v => v.language === 'por' || v.language === 'pt')
    .map(v => titleCase(v.vernacularName || ''))
    .filter(Boolean);
}

// ─── Derivar habit a partir dos dados ────────────────────────────────────────

function deriveHabit(lifeForms, scientificName, hint) {
  if (lifeForms.length > 0) {
    const lf = lifeForms.join(', ');
    if (/suculenta/i.test(lf)) return 'Suculenta';
    if (/erva/i.test(lf) && /suculenta/i.test(lf)) return 'Erva suculenta';
    if (/cacto/i.test(lf)) return 'Cacto';
    if (/palmeira|palm/i.test(lf)) return 'Palmeira';
    if (/trepadeira/i.test(lf)) return 'Trepadeira';
    if (/arbusto/i.test(lf)) return 'Arbustiva';
    if (/árvore|arvore/i.test(lf)) return 'Arbórea';
    if (/erva/i.test(lf)) return 'Herbácea';
    if (/epífita/i.test(lf)) return 'Epífita';
    return lf;
  }
  // Heurística por nome quando JBRJ não informou
  const n = (scientificName + ' ' + hint).toLowerCase();
  if (/opuntia|cereus|cacto/.test(n))             return 'Cacto';
  if (/aloe|echeveria|sedum|crassula|haworthia|zamioculcas|kalanchoe/.test(n)) return 'Suculenta';
  if (/nephrolepis|adiantum|asplenium/.test(n))   return 'Samambaia';
  if (/palm|cycas|yucca|beaucarnea/.test(n))      return 'Palmeira / cica';
  if (/hoya|ceropegia|thunbergia|bougainvillea/.test(n)) return 'Trepadeira';
  if (/basil|mentha|origanum|rosmarinus|thymus|cymbopogon|lippia/.test(n)) return 'Herbácea aromática';
  if (/ficus|schefflera|pachira|strelitzia/.test(n)) return 'Arbustiva / arbórea';
  return 'Tropical ornamental';
}

function deriveOrigin(establishments) {
  if (!establishments.length) return 'Exótica cultivada';
  if (establishments.includes('NATIVA')) return 'Nativa do Brasil';
  if (establishments.includes('CULTIVADA')) return 'Exótica cultivada no Brasil';
  if (establishments.includes('EXOTICA') || establishments.includes('NATURALIZADA')) return 'Exótica naturalizada';
  return establishments.join(', ');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const list = PLANTS_TO_FETCH.slice(0, LIMIT);
  console.log(`\n🌱 expand-database.js — ${list.length} plantas | fontes: JBRJ + GBIF\n`);
  if (DRY_RUN) console.log('⚠️  DRY RUN — nenhum arquivo será salvo\n');

  if (!DRY_RUN) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  const failed  = [];

  for (let i = 0; i < list.length; i++) {
    const { query, hint } = list[i];
    process.stdout.write(`  [${i + 1}/${list.length}] ${query}...`);

    try {
      // ── JBRJ primeiro ──────────────────────────────────────────────────────
      const jbrj = await jbrjTaxon(query);
      await delay(DELAY_MS);

      // ── GBIF como complemento / fallback ───────────────────────────────────
      const gbif = await gbifMatch(query);
      await delay(DELAY_MS);

      const gbifPtNames = (gbif && (!jbrj || jbrj.ptNames.length === 0))
        ? await gbifVernacularPt(gbif.usageKey)
        : [];
      if (gbif) await delay(DELAY_MS);

      // ── Mescla ─────────────────────────────────────────────────────────────
      const family       = jbrj?.family || gbif?.family || 'Não informado';
      const lifeForms    = jbrj?.lifeForms || [];
      const allPtNames   = [...new Set([...(jbrj?.ptNames || []), ...gbifPtNames])];
      const primaryName  = allPtNames[0] || hint;
      const alternatives = allPtNames.slice(1).filter(n => n !== primaryName);
      const origin       = jbrj ? deriveOrigin(jbrj.establishments) : 'Exótica cultivada';
      const habit        = deriveHabit(lifeForms, query, hint);
      const sciName      = gbif?.scientificName || query;
      const dataSource   = jbrj ? (gbif ? 'JBRJ+GBIF' : 'JBRJ') : (gbif ? 'GBIF' : null);

      if (!dataSource) {
        console.log(' ✗ não encontrada em nenhuma fonte');
        failed.push(query);
        continue;
      }

      results.push({
        id:                 slugify(sciName),
        scientificName:     sciName,
        commonNamePt:       primaryName,
        alternativeNamesPt: alternatives,
        family,
        origin,
        habit,
        source:             dataSource,
        needsGeminiReview:  true,
        imageUrl:           null,
      });

      console.log(` ✓  ${primaryName} (${family}) [${dataSource}]`);
    } catch (err) {
      console.log(` ✗ erro: ${err.message}`);
      failed.push(query);
    }
  }

  // ── Resumo de qualidade ───────────────────────────────────────────────────
  const bySource = {
    'JBRJ+GBIF': results.filter(r => r.source === 'JBRJ+GBIF'),
    'JBRJ':      results.filter(r => r.source === 'JBRJ'),
    'GBIF':      results.filter(r => r.source === 'GBIF'),
  };
  console.log(`\n✅ ${results.length} plantas coletadas | ❌ ${failed.length} falhas`);
  console.log(`   Qualidade das fontes:`);
  console.log(`   • JBRJ+GBIF (dados botânicos + taxonômicos): ${bySource['JBRJ+GBIF'].length + bySource['JBRJ'].length}`);
  console.log(`   • GBIF-only (habit/origin por heurística — revisar com mais atenção): ${bySource['GBIF'].length}`);
  if (bySource['GBIF'].length > 0) {
    console.log('     ' + bySource['GBIF'].map(r => r.commonNamePt).join(', '));
  }
  if (failed.length) console.log('   ❌ Falhas:', failed.join(', '));

  if (DRY_RUN) {
    console.log('\n--- DRY RUN (primeiras 3) ---');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
    return;
  }

  fs.writeFileSync(JSON_OUT,   JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(PROMPT_OUT, buildGeminiPrompt(results),       'utf8');
  console.log(`\n📄 ${path.basename(JSON_OUT)}   → ${JSON_OUT}`);
  console.log(`📝 ${path.basename(PROMPT_OUT)} → ${PROMPT_OUT}`);

  if (USE_GEMINI) {
    await enrichWithGemini(results);
  } else {
    console.log(`
─────────────────────────────────────────────────────────────
Próximos passos (manual):
  1. Revise new-plants.json — corrija commonNamePt se necessário
  2. Cole new-plants-gemini-prompt.txt no Gemini
  3. Mescle as entradas em frontend/src/data/PlantDatabase.js

Ou rode com --gemini para enriquecimento automático:
  node scripts/expand-database.js --gemini
─────────────────────────────────────────────────────────────
`);
  }
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

function geminiPost(key, prompt) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  return new Promise((resolve, reject) => {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`);
    const req = https.request(
      { hostname: url.hostname, path: url.pathname + url.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function enrichWithGemini(plants) {
  const key = loadGeminiKey();
  if (!key) {
    console.error('\n⚠️  GEMINI_API_KEY não encontrada. Configure em backend/.env ou como variável de ambiente.');
    return;
  }

  const enriched = [];
  const batches = [];
  for (let i = 0; i < plants.length; i += GEMINI_BATCH) batches.push(plants.slice(i, i + GEMINI_BATCH));

  console.log(`\n🤖 Chamando Gemini — ${batches.length} batch${batches.length !== 1 ? 'es' : ''} de até ${GEMINI_BATCH} plantas...\n`);

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    process.stdout.write(`  Batch ${b + 1}/${batches.length} (${batch.length} plantas)...`);
    try {
      const prompt = buildGeminiPrompt(batch);
      const res    = await geminiPost(key, prompt);
      const text   = res?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Gemini pode devolver o JSON com ou sem markdown fence
      const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(clean);

      // Mescla dados Gemini nos registros originais
      for (const entry of parsed) {
        const orig = batch.find(p => p.id === entry.id);
        if (!orig) continue;
        enriched.push({
          ...orig,
          origin:                   entry.origin      || orig.origin,
          habit:                    entry.habit       || orig.habit,
          wateringFrequencyDays:    entry.wateringFrequencyDays    ?? null,
          fertilizingFrequencyDays: entry.fertilizingFrequencyDays ?? null,
          careHint:                 entry.careHint    || null,
          needsGeminiReview: false,
        });
      }
      console.log(` ✓`);
    } catch (err) {
      console.log(` ✗ ${err.message}`);
      // Adiciona batch original sem enriquecimento para não perder os dados
      batch.forEach(p => enriched.push({ ...p, geminiError: true }));
    }

    if (b < batches.length - 1) {
      process.stdout.write(`  Aguardando ${GEMINI_BATCH_DELAY / 1000}s...\n`);
      await delay(GEMINI_BATCH_DELAY);
    }
  }

  const enrichedOut = path.join(OUTPUT_DIR, 'new-plants-enriched.json');
  fs.writeFileSync(enrichedOut, JSON.stringify(enriched, null, 2), 'utf8');
  const ok  = enriched.filter(p => !p.geminiError).length;
  const err = enriched.filter(p =>  p.geminiError).length;
  console.log(`\n✅ Enriquecimento: ${ok} ok | ⚠️  ${err} com erro Gemini`);
  console.log(`📄 new-plants-enriched.json → ${enrichedOut}`);
  console.log(`
─────────────────────────────────────────────────────────────
Próximos passos:
  1. Revise new-plants-enriched.json (foco nas entradas com geminiError:true)
  2. Mescle as entradas aprovadas em:
     frontend/src/data/PlantDatabase.js  (array mergedPlants)
─────────────────────────────────────────────────────────────
`);
}

// ─── Prompt Gemini ────────────────────────────────────────────────────────────

function buildGeminiPrompt(plants) {
  const list = plants.map((p, i) =>
    `${i + 1}. id="${p.id}" | ${p.commonNamePt} (${p.scientificName}) | família: ${p.family} | hábito: ${p.habit} | origem: ${p.origin}`
  ).join('\n');

  return `Você é especialista em horticultura com foco em plantas cultivadas no Brasil.
Para cada planta abaixo, responda em JSON com os campos:

  - "id": mesmo id fornecido (não altere)
  - "origin": origem geográfica resumida em português (ex: "América Central, amplamente cultivada no Brasil")
  - "habit": hábito preciso em português (ex: "Herbácea trepadeira", "Suculenta roseta", "Arbustiva perene")
  - "wateringFrequencyDays": inteiro — intervalo típico de rega em dias para clima tropical/subtropical
  - "fertilizingFrequencyDays": inteiro (0 se não precisar)
  - "careHint": frase curta (max 120 chars) em português com a dica mais importante de cuidado

Responda SOMENTE com um array JSON válido, sem explicações extras.

Plantas:
${list}

Exemplo de formato esperado:
[
  {
    "id": "aloe_vera",
    "origin": "África do Sul, amplamente cultivada no Brasil",
    "habit": "Suculenta roseta",
    "wateringFrequencyDays": 14,
    "fertilizingFrequencyDays": 60,
    "careHint": "Rega esparsa — deixe o solo secar completamente entre regas para evitar apodrecimento das raízes."
  }
]`;
}

main().catch(err => { console.error('\n❌ Erro fatal:', err.message); process.exit(1); });
