#!/usr/bin/env node
/**
 * merge-catalog.js
 *
 * Lê catalog-enriched.json e gera PlantDatabaseExtra.js — um módulo ES
 * separado do PlantDatabase.js existente, fácil de reverter.
 *
 * O arquivo gerado segue o mesmo schema de PlantDatabase.js e pode ser
 * integrado em 2 linhas: basta importá-lo e concatenar o array.
 *
 * Uso:
 *   node scripts/merge-catalog.js
 *   node scripts/merge-catalog.js --input catalog-candidates.json  → sem enriquecimento
 *   node scripts/merge-catalog.js --dry-run                        → mostra resumo sem salvar
 *   node scripts/merge-catalog.js --status aprovado               → filtra por status
 *
 * Saída:
 *   frontend/src/data/PlantDatabaseExtra.js
 *
 * Como integrar (depois de gerar o arquivo):
 *   Em frontend/src/data/PlantDatabase.js, adicione no topo:
 *     import extraPlants from './PlantDatabaseExtra';
 *   E substitua o array nas funções de busca para usar:
 *     [...mergedPlants, ...extraPlants]
 *
 *   Ou use o flag --integrate para fazer isso automaticamente.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const AUTO_MERGE  = args.includes('--integrate');
const STATUS_FILTER = (() => { const i = args.indexOf('--status'); return i >= 0 ? args[i + 1] : null; })();
const INPUT_NAME  = (() => { const i = args.indexOf('--input'); return i >= 0 ? args[i + 1] : 'catalog-enriched.json'; })();

const OUTPUT_DIR   = path.join(__dirname, 'output');
const INPUT_FILE   = path.join(OUTPUT_DIR, INPUT_NAME);
const EXTRA_FILE   = path.join(__dirname, '..', 'frontend', 'src', 'data', 'PlantDatabaseExtra.js');
const DB_FILE      = path.join(__dirname, '..', 'frontend', 'src', 'data', 'PlantDatabase.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

/** Normaliza uma entrada do catalog para o schema do PlantDatabase */
function normalizeEntry(p) {
  return {
    id:                       p.id || slugify(p.scientificName),
    scientificName:           p.scientificName,
    commonNamePt:             p.commonNamePt || p.scientificName.split(' ')[0],
    alternativeNamesPt:       p.alternativeNamesPt || [],
    family:                   p.family     || null,
    origin:                   p.origin     || null,
    habit:                    p.habit      || 'Não informado',
    wateringFrequencyDays:    p.wateringFrequencyDays    ?? null,
    fertilizingFrequencyDays: p.fertilizingFrequencyDays ?? null,
    sunlight:                 p.sunlight   || null,
    careHint:                 p.careHint   || null,
    iNaturalistObservationsBR: p.iNaturalistObservationsBR || null,
    iNaturalistTaxonId:       p.iNaturalistTaxonId        || null,
    sources:                  p.sources    || { taxonomy: 'iNaturalist', vernacular: 'pendente', care: 'pendente' },
    status:                   p.status     || 'pendente_revisao',
    imageUrl:                 null,
  };
}

// ─── Gerador de PlantDatabaseExtra.js ────────────────────────────────────────

function generateExtraFile(plants) {
  const entries = plants.map(p => {
    const e   = normalizeEntry(p);
    const alt = JSON.stringify(e.alternativeNamesPt);
    const src = JSON.stringify(e.sources);
    return `  {
    id: ${JSON.stringify(e.id)},
    scientificName: ${JSON.stringify(e.scientificName)},
    commonNamePt: ${JSON.stringify(e.commonNamePt)},
    alternativeNamesPt: ${alt},
    family: ${JSON.stringify(e.family)},
    origin: ${JSON.stringify(e.origin)},
    habit: ${JSON.stringify(e.habit)},
    wateringFrequencyDays: ${JSON.stringify(e.wateringFrequencyDays)},
    fertilizingFrequencyDays: ${JSON.stringify(e.fertilizingFrequencyDays)},
    sunlight: ${JSON.stringify(e.sunlight)},
    careHint: ${JSON.stringify(e.careHint)},
    iNaturalistObservationsBR: ${JSON.stringify(e.iNaturalistObservationsBR)},
    iNaturalistTaxonId: ${JSON.stringify(e.iNaturalistTaxonId)},
    sources: ${src},
    status: ${JSON.stringify(e.status)},
    imageUrl: null,
  }`;
  });

  return `// PlantDatabaseExtra.js
// Gerado automaticamente por scripts/merge-catalog.js — NÃO editar manualmente.
// Contém ${plants.length} plantas descobertas via iNaturalist + JBRJ.
// Para reverter: apague este arquivo e remova o import do PlantDatabase.js.

const extraPlants = [
${entries.join(',\n')}
];

export default extraPlants;
`;
}

// ─── Integra import em PlantDatabase.js ──────────────────────────────────────

function integrateIntoPlantDatabase() {
  let content = fs.readFileSync(DB_FILE, 'utf8');

  // Já integrado?
  if (content.includes('PlantDatabaseExtra')) {
    console.log('  ℹ PlantDatabase.js já tem import do PlantDatabaseExtra — atualizando apenas o array');
    return; // funções de busca já usam o array combinado
  }

  // Adiciona import no topo (após comentário inicial)
  content = content.replace(
    /^(\/\/ PlantDatabase\.js\n)/,
    `$1import extraPlants from './PlantDatabaseExtra';\n`
  );

  // Substitui o array `mergedPlants` como base nas funções exportadas por `[...mergedPlants, ...extraPlants]`
  // Só altera as funções-chave, não o default export (que mantém mergedPlants para compatibilidade)
  content = content
    .replace(
      /return mergedPlants\.filter\(plant =>/g,
      'return [...mergedPlants, ...extraPlants].filter(plant =>'
    )
    .replace(
      /return mergedPlants\.find\(plant =>/g,
      'return [...mergedPlants, ...extraPlants].find(plant =>'
    )
    .replace(
      /return \[\.\.\.mergedPlants\]\.sort/g,
      'return [...mergedPlants, ...extraPlants].sort'
    );

  fs.writeFileSync(DB_FILE, content, 'utf8');
  console.log('  ✓ PlantDatabase.js atualizado com import + arrays combinados');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════');
  console.log(' merge-catalog.js');
  console.log('════════════════════════════════════════');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`\n❌ Arquivo de entrada não encontrado: ${INPUT_FILE}`);
    console.error(`   Execute primeiro: node scripts/enrich-catalog.js`);
    process.exit(1);
  }

  let plants = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(` Entrada: ${INPUT_NAME} — ${plants.length} plantas`);

  // Filtro por status se solicitado
  if (STATUS_FILTER) {
    plants = plants.filter(p => p.status === STATUS_FILTER);
    console.log(` Filtro --status ${STATUS_FILTER}: ${plants.length} plantas`);
  }

  // Remove entradas sem nome científico
  plants = plants.filter(p => p.scientificName && p.scientificName.trim());

  // Deduplica por id (caso catalog-approved tenha duplicatas)
  const seen = new Set();
  plants = plants.filter(p => {
    const key = (p.id || slugify(p.scientificName));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(` Após limpeza: ${plants.length} entradas únicas`);

  if (DRY_RUN || plants.length === 0) {
    // Mostra preview
    console.log('\n  Preview (primeiras 10):');
    plants.slice(0, 10).forEach((p, i) => {
      const e = normalizeEntry(p);
      console.log(`  ${String(i+1).padStart(3)}  ${e.scientificName.padEnd(35)} | ${(e.commonNamePt||'—').padEnd(25)} | rega:${e.wateringFrequencyDays || '—'}d`);
    });
    if (DRY_RUN) { console.log('\n  [dry-run] Nada salvo.\n'); return; }
  }

  // Gera PlantDatabaseExtra.js
  const content = generateExtraFile(plants);
  fs.writeFileSync(EXTRA_FILE, content, 'utf8');
  console.log(`\n✅ Gerado: frontend/src/data/PlantDatabaseExtra.js (${plants.length} plantas)`);

  // Care data summary
  const withCare = plants.filter(p => p.wateringFrequencyDays !== null && p.wateringFrequencyDays !== undefined).length;
  const withName = plants.filter(p => p.commonNamePt && p.commonNamePt !== p.scientificName.split(' ')[0]).length;
  console.log(`   Com care data: ${withCare}/${plants.length} (${Math.round(withCare/plants.length*100)}%)`);
  console.log(`   Com nome PT:   ${withName}/${plants.length} (${Math.round(withName/plants.length*100)}%)`);

  if (AUTO_MERGE) {
    console.log('\n► Integrando em PlantDatabase.js (--integrate)…');
    integrateIntoPlantDatabase();
  } else {
    console.log('\n   Para integrar ao app automáticamente:');
    console.log('     node scripts/merge-catalog.js --integrate');
    console.log('\n   Ou manualmente, adicione em frontend/src/data/PlantDatabase.js:');
    console.log("     import extraPlants from './PlantDatabaseExtra';");
    console.log("   E nas funções de busca, use [...mergedPlants, ...extraPlants]");
  }

  console.log('');
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
