#!/usr/bin/env node
/**
 * expand-database.js
 *
 * Consulta GBIF (gratuito, licença aberta) para obter dados taxonômicos de
 * plantas domésticas comuns no Brasil que ainda não estão na base local.
 *
 * Para cada planta:
 *   1. Busca nome científico aceito + família no GBIF Species Search
 *   2. Busca nomes vernáculos em português no GBIF Vernacular Names
 *   3. Gera JSON no formato do PlantDatabase.js com status "gerado_api"
 *
 * Uso:
 *   node scripts/expand-database.js
 *   node scripts/expand-database.js --limit 10    → processa só 10 plantas
 *   node scripts/expand-database.js --dry-run     → imprime mas não salva
 *
 * Saída: scripts/output/new-plants.json
 *        scripts/output/new-plants-gemini-prompt.txt  ← pronto pra enriquecer com IA
 *
 * Depois de revisar o JSON, copie as entradas para:
 *   frontend/src/data/PlantDatabase.js  (array mergedPlants)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Configuração ───────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, 'output');
const JSON_OUT   = path.join(OUTPUT_DIR, 'new-plants.json');
const PROMPT_OUT = path.join(OUTPUT_DIR, 'new-plants-gemini-prompt.txt');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT   = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : Infinity; })();
const DELAY_MS = 300; // pausa entre requisições p/ não bater rate limit do GBIF

// ─── Plantas a buscar ───────────────────────────────────────────────────────
// Plantas domésticas e jardim muito buscadas no Brasil que podem não estar na base.
// Edite esta lista conforme os gaps que você identificar nos logs do app.

const PLANTS_TO_FETCH = [
  // Folhagens tropicais
  { query: 'Philodendron hederaceum',   hint: 'Filodendro' },
  { query: 'Philodendron bipinnatifidum', hint: 'Filodendro-pé-de-elefante' },
  { query: 'Anthurium andraeanum',      hint: 'Antúrio' },
  { query: 'Spathiphyllum wallisii',    hint: 'Espada-de-Oxalá' },
  { query: 'Aglaonema commutatum',      hint: 'Aglaonema' },
  { query: 'Dieffenbachia seguine',     hint: 'Copo-de-leite-do-mato' },
  { query: 'Caladium bicolor',          hint: 'Caládio' },
  { query: 'Alocasia amazonica',        hint: 'Alocásia' },
  { query: 'Colocasia esculenta',       hint: 'Taro / Inhame' },
  { query: 'Tradescantia zebrina',      hint: 'Wandering Dude / Coração-roxo' },
  { query: 'Tradescantia pallida',      hint: 'Coração-roxo' },
  { query: 'Chlorophytum comosum',      hint: 'Clorofito / Fitinha' },
  { query: 'Asplenium nidus',           hint: 'Samambaia-ninho' },
  { query: 'Nephrolepis exaltata',      hint: 'Samambaia-americana' },
  { query: 'Adiantum capillus-veneris', hint: 'Avenca' },

  // Suculentas e cactos
  { query: 'Echeveria elegans',         hint: 'Echeveria' },
  { query: 'Sedum morganianum',         hint: 'Burro-de-rabo' },
  { query: 'Crassula ovata',            hint: 'Jade / Árvore-da-fortuna' },
  { query: 'Haworthia attenuata',       hint: 'Hawortia' },
  { query: 'Aloe vera',                 hint: 'Babosa' },
  { query: 'Opuntia ficus-indica',      hint: 'Palma / Figo-da-índia' },
  { query: 'Cereus jamacaru',           hint: 'Mandacaru' },
  { query: 'Zamioculcas zamiifolia',    hint: 'Zamioculca / ZZ Plant' },
  { query: 'Euphorbia tirucalli',       hint: 'Dedo-de-moça / Avelós' },

  // Ficus e aráceas populares
  { query: 'Ficus lyrata',             hint: 'Figo-lira' },
  { query: 'Ficus elastica',           hint: 'Borracha' },
  { query: 'Ficus benjamina',          hint: 'Ficus-chorão' },
  { query: 'Schefflera actinophylla',  hint: 'Cheflera' },
  { query: 'Epipremnum aureum',        hint: 'Jiboia / Pothos' },

  // Flores e ornamentais
  { query: 'Impatiens walleriana',     hint: 'Beijo' },
  { query: 'Begonia semperflorens',    hint: 'Begônia' },
  { query: 'Hibiscus rosa-sinensis',   hint: 'Hibisco' },
  { query: 'Ixora coccinea',           hint: 'Ixora' },
  { query: 'Catharanthus roseus',      hint: 'Vinca / Boa-noite' },
  { query: 'Pelargonium hortorum',     hint: 'Gerânio' },
  { query: 'Viola tricolor',           hint: 'Amor-perfeito' },
  { query: 'Tagetes patula',           hint: 'Cravo-de-defunto' },
  { query: 'Helianthus annuus',        hint: 'Girassol' },
  { query: 'Rosa chinensis',           hint: 'Roseira' },
  { query: 'Lavandula angustifolia',   hint: 'Lavanda' },
  { query: 'Kalanchoe blossfeldiana',  hint: 'Calanchoê' },
  { query: 'Schlumbergera truncata',   hint: 'Flor-de-maio' },

  // Ervas aromáticas
  { query: 'Ocimum basilicum',         hint: 'Manjericão' },
  { query: 'Mentha spicata',           hint: 'Hortelã' },
  { query: 'Origanum vulgare',         hint: 'Orégano' },
  { query: 'Rosmarinus officinalis',   hint: 'Alecrim' },
  { query: 'Thymus vulgaris',          hint: 'Tomilho' },
  { query: 'Cymbopogon citratus',      hint: 'Capim-limão / Capim-cidreira' },
  { query: 'Lippia alba',              hint: 'Erva-cidreira' },

  // Palmas e cicas
  { query: 'Dypsis lutescens',         hint: 'Palmeira-areca' },
  { query: 'Rhapis excelsa',           hint: 'Palmeira-ráfis' },
  { query: 'Cycas revoluta',           hint: 'Cica' },
  { query: 'Beaucarnea recurvata',     hint: 'Pata-de-elefante' },
  { query: 'Yucca elephantipes',       hint: 'Iuca' },

  // Trepadeiras e pendentes
  { query: 'Hoya carnosa',             hint: 'Hoya / Flor-de-cera' },
  { query: 'Ceropegia woodii',         hint: 'Corações-em-corrente' },
  { query: 'Scindapsus pictus',        hint: 'Pothos-argento' },
  { query: 'Thunbergia alata',         hint: 'Olho-de-poeta' },

  // Popularíssimas que podem ter gap
  { query: 'Pachira aquatica',         hint: 'Munguba / Árvore-da-fortuna' },
  { query: 'Ravenea rivularis',        hint: 'Palmeira-majestosa' },
  { query: 'Strelitzia reginae',       hint: 'Ave-do-paraíso' },
  { query: 'Heliconia psittacorum',    hint: 'Bico-de-papagaio' },
  { query: 'Plumeria rubra',           hint: 'Jasmim-manga' },
  { query: 'Brunfelsia uniflora',      hint: 'Manacá' },
  { query: 'Camellia japonica',        hint: 'Camélia' },
  { query: 'Gardenia jasminoides',     hint: 'Gardênia' },
  { query: 'Jasminum sambac',          hint: 'Jasmim' },
  { query: 'Bougainvillea spectabilis',hint: 'Buganvílea' },
];

// ─── Helpers HTTP ────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'plant-care-hub/1.0 (github.com/indiaraelis/plant-care-hub)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .slice(0, 60);
}

// ─── GBIF queries ────────────────────────────────────────────────────────────

async function gbifSpecies(query) {
  const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(query)}&kingdom=Plantae&verbose=false`;
  const d = await get(url);
  if (d.matchType === 'NONE' || !d.usageKey) return null;
  return {
    usageKey:      d.usageKey,
    scientificName: d.species || d.scientificName || query,
    family:        d.family || null,
    genus:         d.genus || null,
    rank:          d.rank || null,
    status:        d.status || null,
  };
}

async function gbifVernacularPt(usageKey) {
  const url = `https://api.gbif.org/v1/species/${usageKey}/vernacularNames?limit=50`;
  const d = await get(url);
  const ptNames = (d.results || [])
    .filter(v => v.language === 'por' || v.language === 'pt')
    .map(v => v.vernacularName)
    .filter(Boolean);
  // Remove duplicates, lowercase normalise
  return [...new Set(ptNames.map(n => n.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())))];
}

// Derive habit label from GBIF rank/name (rough heuristic — Gemini will refine)
function deriveHabit(scientificName, hint) {
  const n = (scientificName + ' ' + hint).toLowerCase();
  if (/cactus|cacto|opuntia|cereus|euphorbia tirucalli/.test(n)) return 'Cacto / suculenta';
  if (/aloe|echeveria|sedum|crassula|haworthia|zamioculcas|kalanchoe/.test(n)) return 'Suculenta';
  if (/ferm|samambaia|nephrolepis|adiantum|asplenium/.test(n)) return 'Samambaia';
  if (/orquídea|orchid/.test(n)) return 'Orquídea';
  if (/palma|palmeira|palm|cycas|yucca|beaucarnea/.test(n)) return 'Palmeira / cica';
  if (/trepadeira|hoya|ceropegia|thunbergia|bougainvillea/.test(n)) return 'Trepadeira';
  if (/herb|basil|manjericão|hortelã|orégano|alecrim|tomilho|capim/.test(n)) return 'Herbácea aromática';
  if (/ficus|schefflera|pachira|strelitzia/.test(n)) return 'Arbustiva / arbórea';
  return 'Tropical ornamental';
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 expand-database.js — consultando GBIF para ${Math.min(PLANTS_TO_FETCH.length, LIMIT)} plantas\n`);
  if (DRY_RUN) console.log('⚠️  DRY RUN — nenhum arquivo será salvo\n');

  if (!DRY_RUN) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  const failed  = [];
  const list = PLANTS_TO_FETCH.slice(0, LIMIT);

  for (let i = 0; i < list.length; i++) {
    const { query, hint } = list[i];
    process.stdout.write(`  [${i + 1}/${list.length}] ${query}...`);

    try {
      const species = await gbifSpecies(query);
      if (!species) {
        console.log(' ✗ não encontrado no GBIF');
        failed.push(query);
        await delay(DELAY_MS);
        continue;
      }

      await delay(DELAY_MS);
      const ptNames = await gbifVernacularPt(species.usageKey);
      await delay(DELAY_MS);

      const primaryName = ptNames[0] || hint;
      const alternatives = ptNames.slice(1).filter(n => n !== primaryName);

      const entry = {
        id:                 slugify(species.scientificName),
        scientificName:     species.scientificName,
        commonNamePt:       primaryName,
        alternativeNamesPt: alternatives,
        family:             species.family || 'Não informado',
        origin:             'Exótica cultivada',   // Gemini vai refinar
        habit:              deriveHabit(species.scientificName, hint),
        gbifKey:            species.usageKey,
        source:             'GBIF',
        needsGeminiReview:  true,
        imageUrl:           null,
      };

      results.push(entry);
      console.log(` ✓  ${primaryName} (${species.scientificName})`);
    } catch (err) {
      console.log(` ✗ erro: ${err.message}`);
      failed.push(query);
    }

    await delay(DELAY_MS);
  }

  console.log(`\n✅ ${results.length} plantas coletadas | ❌ ${failed.length} falhas`);
  if (failed.length) console.log('   Falhas:', failed.join(', '));

  if (DRY_RUN) {
    console.log('\n--- DRY RUN resultado (primeiras 3 entradas) ---');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
    return;
  }

  // ── Salva JSON ──────────────────────────────────────────────────────────────
  fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n📄 JSON salvo em: ${JSON_OUT}`);

  // ── Gera prompt Gemini ──────────────────────────────────────────────────────
  const prompt = buildGeminiPrompt(results);
  fs.writeFileSync(PROMPT_OUT, prompt, 'utf8');
  console.log(`📝 Prompt Gemini salvo em: ${PROMPT_OUT}`);

  console.log(`
─────────────────────────────────────────────────────────────
Próximos passos:

1. Revise ${path.basename(JSON_OUT)} — corrija commonNamePt, origin, habit
2. Cole o conteúdo de ${path.basename(PROMPT_OUT)} no Gemini para enriquecer
   com wateringFrequencyDays, fertilizingFrequencyDays e careHint
3. Mescle as entradas aprovadas em:
   frontend/src/data/PlantDatabase.js  (array mergedPlants)
─────────────────────────────────────────────────────────────
`);
}

function buildGeminiPrompt(plants) {
  const list = plants.map((p, i) =>
    `${i + 1}. ${p.commonNamePt} (${p.scientificName}) — família: ${p.family}, hábito: ${p.habit}`
  ).join('\n');

  return `Você é um especialista em horticultura com foco em plantas cultivadas no Brasil.
Para cada planta abaixo, responda em JSON com os campos:
  - "id": mesmo id fornecido
  - "origin": origem geográfica resumida em português (ex: "América Central, cultivada no Brasil")
  - "habit": hábito preciso em português (ex: "Herbácea trepadeira", "Suculenta roseta", "Arbustiva")
  - "wateringFrequencyDays": número inteiro — intervalo recomendado de rega em dias
  - "fertilizingFrequencyDays": número inteiro (0 se não precisar)
  - "careHint": frase curta em português com dica principal de cuidado

Responda SOMENTE com um array JSON válido, sem explicações extras.

Plantas:
${list}

Formato esperado:
[
  {
    "id": "echeveria_elegans",
    "origin": "México, cultivada mundialmente",
    "habit": "Suculenta roseta",
    "wateringFrequencyDays": 14,
    "fertilizingFrequencyDays": 60,
    "careHint": "Evite excesso de água — rega a cada 2 semanas e solo bem drenado."
  },
  ...
]`;
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
