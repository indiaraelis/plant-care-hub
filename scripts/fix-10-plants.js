#!/usr/bin/env node
/**
 * fix-10-plants.js
 *
 * Corrige dados de cuidado das 10 plantas base que tinham comentários JS inline
 * (// ...) nos seus objetos — o que impediu o JSON.parse do enrich-base.js de
 * extraí-las, causando dados errados por deslocamento de bloco.
 *
 * Chama Gemini diretamente para essas 10 e substitui os campos no PlantDatabase.js.
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DB_FILE = path.join(__dirname, '..', 'frontend', 'src', 'data', 'PlantDatabase.js');

// Metadados hard-coded (JSON.parse falha nos blocos originais por causa dos // comments)
const PLANTS = [
  { id: 'justicia_gendarussa_burm_f',
    scientificName: 'Justicia gendarussa Burm. f.',
    commonNamePt: 'Abre caminho', family: 'Acanthaceae', habit: 'Arbustiva', origin: 'Sudeste Asiático' },
  { id: 'ocimum_campechianum_mill',
    scientificName: 'Ocimum campechianum Mill.',
    commonNamePt: 'Alfavaca de jardim', family: 'Lamiaceae', habit: 'Herbácea', origin: 'América tropical' },
  { id: 'alstroemeria_cf_psittacina_lehm',
    scientificName: 'Alstroemeria cf. psittacina Lehm.',
    commonNamePt: 'Alstroemeria', family: 'Amaryllidaceae', habit: 'Herbácea perene rizomatosa', origin: 'Brasil (Pantanal)' },
  { id: 'bryophyllum_daigremontianum_raym_hamet_&_hperrier_aberger',
    scientificName: 'Bryophyllum daigremontianum (Raym.-Hamet & H.Perrier) A.Berger',
    commonNamePt: 'Aranto', family: 'Crassulaceae', habit: 'Suculenta', origin: 'Madagascar' },
  { id: 'euphorbia_tirucalli_l',
    scientificName: 'Euphorbia tirucalli L.',
    commonNamePt: 'Avelós', family: 'Euphorbiaceae', habit: 'Arbusto suculento', origin: 'África e Madagascar' },
  { id: 'bonafousia_siphilitica_lf_l_allorge',
    scientificName: 'Bonafousia siphilitica (L.f.) L. Allorge',
    commonNamePt: 'Bonafousia', family: 'Apocynaceae', habit: 'Arbusto tropical', origin: 'Brasil (Amazônia/Pantanal)' },
  { id: 'spondias_lutea_l',
    scientificName: 'Spondias lutea L.',
    commonNamePt: 'Cajá', family: 'Anacardiaceae', habit: 'Árvore tropical', origin: 'Brasil (nordeste e Amazônia)' },
  { id: 'mentha_sp_1',
    scientificName: 'Mentha sp. 1',
    commonNamePt: 'Hortelã (Tipo 1)', family: 'Lamiaceae', habit: 'Herbácea', origin: 'Mediterrâneo' },
  { id: 'mentha_sp_2',
    scientificName: 'Mentha sp. 2',
    commonNamePt: 'Hortelã (Tipo 2)', family: 'Lamiaceae', habit: 'Herbácea', origin: 'Mediterrâneo' },
  { id: 'mentha_sp_variegata',
    scientificName: 'Mentha sp. (variegada)',
    commonNamePt: 'Hortelã variegata', family: 'Lamiaceae', habit: 'Herbácea ornamental', origin: 'Mediterrâneo' },
];

// ─── Gemini ───────────────────────────────────────────────────────────────────

function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
  return line ? line.split('=')[1].trim() : null;
}

function post(url, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const parsed  = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

async function callGemini(prompt, apiKey, model) {
  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } };
  const data = await post(url, body);
  if (!data || data.error) return null;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function buildPrompt(plants) {
  const list = plants.map((p, i) =>
    `${i + 1}. ${p.scientificName} (${p.commonNamePt}) — família: ${p.family}, hábito: ${p.habit}, origem: ${p.origin}`
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

Referência de rega: Frequente=2d, Moderado=7d, Quinzenal=14d, Mensal=30d.
Para suculentas/cactos use 14-30d. Para aquosas tropicais use 2-5d. Para aromáticas mediterrâneas use 7d.`;
}

// ─── Patch ───────────────────────────────────────────────────────────────────

function patchPlantCare(content, plantId, care) {
  // Para mentha_sp_variegata o id tem // após, então mantemos busca parcial segura
  const idPattern = `"id": "${plantId}"`;
  const idIndex   = content.indexOf(idPattern);
  if (idIndex === -1) throw new Error(`Planta não encontrada: ${plantId}`);

  // Bloco: de \n  { antes do id até o próximo \n  {
  const blockStart    = content.lastIndexOf('\n  {', idIndex) + 1;
  const blockEndSearch = content.indexOf('\n  {', idIndex + 1);
  const blockEnd      = blockEndSearch === -1 ? content.length : blockEndSearch;

  let block = content.slice(blockStart, blockEnd);

  // Remove campos de cuidado existentes junto com a vírgula que os precede
  // Formato atual: "imageUrl": "...",\n    "wateringFrequencyDays": ...\n  ...\n  ...\n  ...
  block = block.replace(
    /,[ \t]*\n[ \t]*"wateringFrequencyDays":[^\n]*\n[ \t]*"fertilizingFrequencyDays":[^\n]*\n[ \t]*"sunlight":[^\n]*\n[ \t]*"careHint":[^\n]*/,
    ''
  );

  // Insere novos campos antes do } de fechamento
  const careLines = [
    `    "wateringFrequencyDays": ${care.wateringFrequencyDays}`,
    `    "fertilizingFrequencyDays": ${care.fertilizingFrequencyDays ?? null}`,
    `    "sunlight": ${JSON.stringify(care.sunlight)}`,
    `    "careHint": ${JSON.stringify(care.careHint)}`,
  ].join(',\n');

  const closePos  = block.lastIndexOf('\n  }');
  if (closePos === -1) throw new Error(`Sem } de fechamento para: ${plantId}`);

  const beforeClose = block.slice(0, closePos);
  const afterClose  = block.slice(closePos + 4); // após \n  }

  const newBlock = beforeClose + ',\n' + careLines + '\n  }' + afterClose;
  return content.slice(0, blockStart) + newBlock + content.slice(blockEnd);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  fix-10-plants.js — Plant Care Hub');
  console.log('══════════════════════════════════════════════\n');

  const apiKey = loadGeminiKey();
  if (!apiKey) { console.error('❌ GEMINI_API_KEY não encontrado.\n'); process.exit(1); }

  const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];

  // Chama Gemini para todas as 10 de uma vez
  let careData = null;
  for (const model of MODELS) {
    process.stdout.write(`  Modelo: ${model}… `);
    const prompt = buildPrompt(PLANTS);
    careData = await callGemini(prompt, apiKey, model);
    if (careData && Array.isArray(careData) && careData.length === PLANTS.length) {
      console.log('✅');
      break;
    }
    console.log('✗');
    careData = null;
  }

  if (!careData) {
    // Fallback: uma por uma
    console.log('\n  Fallback: enriquecendo uma por uma…\n');
    careData = [];
    for (const plant of PLANTS) {
      for (const model of MODELS) {
        const result = await callGemini(buildPrompt([plant]), apiKey, model);
        if (result?.[0]?.wateringFrequencyDays != null) {
          careData.push(result[0]);
          break;
        }
      }
      if (careData.length < PLANTS.indexOf(plant) + 1) careData.push(null);
    }
  }

  console.log('\n  Resultados:\n');
  PLANTS.forEach((plant, i) => {
    const c = careData[i];
    if (c) {
      console.log(`    ✓ ${plant.commonNamePt}: rega ${c.wateringFrequencyDays}d | sol: ${c.sunlight}`);
    } else {
      console.log(`    ✗ ${plant.commonNamePt}: sem dados`);
    }
  });

  // Aplica patch
  console.log('\n  🔧 Aplicando no PlantDatabase.js…\n');
  let content = fs.readFileSync(DB_FILE, 'utf8');
  let patched = 0;
  let errors  = 0;

  for (let i = 0; i < PLANTS.length; i++) {
    const plant = PLANTS[i];
    const care  = careData[i];
    if (!care) { console.log(`    ⚠ ${plant.commonNamePt}: pulando (sem dados)`); errors++; continue; }
    try {
      content = patchPlantCare(content, plant.id, care);
      console.log(`    ✓ ${plant.commonNamePt}`);
      patched++;
    } catch (e) {
      console.log(`    ✗ ${plant.commonNamePt}: ${e.message}`);
      errors++;
    }
  }

  fs.writeFileSync(DB_FILE, content, 'utf8');
  console.log(`\n  ✅ Aplicados: ${patched} | Erros: ${errors}`);
  console.log('\n══════════════════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); });
