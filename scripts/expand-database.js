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
 *   node scripts/expand-database.js --limit 10    → processa só 10 plantas
 *   node scripts/expand-database.js --dry-run     → imprime sem salvar
 *
 * Saída:
 *   scripts/output/new-plants.json               ← revisão humana
 *   scripts/output/new-plants-gemini-prompt.txt  ← cola no Gemini
 *
 * Fluxo completo:
 *   1. Rode este script
 *   2. Revise new-plants.json (corrija nomes populares se necessário)
 *   3. Cole new-plants-gemini-prompt.txt no Gemini
 *   4. Gemini devolve JSON com wateringFrequencyDays, careHint...
 *   5. Mescle as entradas aprovadas em frontend/src/data/PlantDatabase.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── Configuração ────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, 'output');
const JSON_OUT   = path.join(OUTPUT_DIR, 'new-plants.json');
const PROMPT_OUT = path.join(OUTPUT_DIR, 'new-plants-gemini-prompt.txt');

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT   = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : Infinity; })();
const DELAY_MS = 400; // respeita rate limit das duas APIs

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
  return new Promise((resolve, reject) => {
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
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
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

  // Nomes vernáculos PT
  const ptNames = verns
    .filter(v => (v.language_vernacularname || '').toLowerCase().includes('portugu'))
    .map(v => titleCase(v.vernacularname || ''))
    .filter(Boolean);

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

  console.log(`\n✅ ${results.length} plantas coletadas | ❌ ${failed.length} falhas`);
  if (failed.length) console.log('   Falhas:', failed.join(', '));

  if (DRY_RUN) {
    console.log('\n--- DRY RUN (primeiras 3) ---');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
    return;
  }

  fs.writeFileSync(JSON_OUT,   JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(PROMPT_OUT, buildGeminiPrompt(results),       'utf8');

  console.log(`\n📄 ${path.basename(JSON_OUT)}   → ${JSON_OUT}`);
  console.log(`📝 ${path.basename(PROMPT_OUT)} → ${PROMPT_OUT}`);
  console.log(`
─────────────────────────────────────────────────────────────
Próximos passos:

1. Revise new-plants.json — corrija commonNamePt se necessário
2. Cole new-plants-gemini-prompt.txt no Gemini (ou via API)
   Gemini devolve JSON com wateringFrequencyDays, fertilizingFrequencyDays,
   origin refinada, habit refinado e careHint em português
3. Mescle as entradas aprovadas em:
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
