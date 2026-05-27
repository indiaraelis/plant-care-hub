#!/usr/bin/env node
/**
 * enrich-catalog.js
 *
 * Lê catalog-approved.json (ou catalog-candidates.json com --all),
 * chama a Gemini API em lotes para preencher dados de cuidado, e
 * salva catalog-enriched.json pronto para o merge-catalog.js.
 *
 * Campos enriquecidos por planta:
 *   wateringFrequencyDays   (number)
 *   fertilizingFrequencyDays (number)
 *   sunlight                ("Pleno sol" | "Meia sombra" | "Sombra")
 *   careHint                (string PT, 1-2 frases)
 *
 * Uso:
 *   node scripts/enrich-catalog.js
 *   node scripts/enrich-catalog.js --all       → usa catalog-candidates.json em vez do approved
 *   node scripts/enrich-catalog.js --dry-run   → imprime prompt mas não chama API
 *   node scripts/enrich-catalog.js --batch 5   → tamanho do lote Gemini (padrão: 10)
 *
 * GEMINI_API_KEY: lido de backend/.env ou process.env
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args           = process.argv.slice(2);
const DRY_RUN        = args.includes('--dry-run');
const USE_ALL        = args.includes('--all');
const RESUME         = args.includes('--resume');
const ENRICH_NAMES   = args.includes('--enrich-names'); // enriquece commonNamePt + alternativeNamesPt via Gemini
const BATCH          = (() => { const i = args.indexOf('--batch'); return i >= 0 ? parseInt(args[i + 1]) : 10; })();

// --model <id>: modelo Gemini a usar (padrão: gemini-3.1-flash-lite, RPD 500/dia)
// Fallback automático em caso de quota esgotada ou modelo não encontrado
const MODEL_ARG = (() => { const i = args.indexOf('--model'); return i >= 0 ? args[i + 1] : null; })();
const MODEL_FALLBACK_ORDER = [
  'gemini-3.1-flash-lite',   // RPD 500 — melhor opção free tier
  'gemini-3.5-flash',        // RPD 20
  'gemini-3-flash',          // RPD 20
  'gemini-2.5-flash',        // RPD 20
  'gemini-2.5-flash-lite',   // RPD 20
];
const MODELS_TO_TRY = MODEL_ARG
  ? [MODEL_ARG, ...MODEL_FALLBACK_ORDER.filter(m => m !== MODEL_ARG)]
  : MODEL_FALLBACK_ORDER;

const BATCH_DELAY_MS = 5000; // 5s entre lotes → fica abaixo do RPM mais restritivo (10/min)

const OUTPUT_DIR   = path.join(__dirname, 'output');
// --resume: continua a partir do catalog-enriched.json (pula as já enriquecidas)
// --all:    usa catalog-candidates.json em vez do approved
// padrão:   catalog-approved.json
const INPUT_FILE   = path.join(OUTPUT_DIR,
  (RESUME || ENRICH_NAMES) ? 'catalog-enriched.json' :
  USE_ALL                 ? 'catalog-candidates.json' :
                            'catalog-approved.json'
);
const OUTPUT_FILE  = path.join(OUTPUT_DIR, 'catalog-enriched.json');

// ─── Gemini key ───────────────────────────────────────────────────────────────

function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
  return line ? line.split('=')[1].trim() : null;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

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

// Planta tem nome PT "real" ou só o gênero?
function hasPtName(p) {
  const name = (p.commonNamePt || '').trim();
  if (!name) return false;
  const genus = p.scientificName.split(' ')[0];
  // Considera "real" se não for apenas o gênero (case-insensitive)
  return name.toLowerCase() !== genus.toLowerCase();
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

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

// ─── Gemini call ──────────────────────────────────────────────────────────────

// Testa se um modelo está disponível (retorna true/false)
async function testModel(modelId, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: 'Responda apenas: ok' }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 5 },
  };
  const data = await post(url, body);
  if (!data) return false;
  // 429 = quota, 400/404 = modelo inválido → falhou
  if (data.error) {
    const code = data.error.code || data.error.status || '';
    if (String(code) === '429' || String(code).includes('RESOURCE_EXHAUSTED')) return 'quota';
    return false;
  }
  return !!data.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callGemini(prompt, apiKey, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };
  const data = await post(url, body);
  if (!data) return null;

  // Propaga erro de quota para o caller poder tentar fallback
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

// ─── Prompt builder: nomes populares ─────────────────────────────────────────

function buildNamesPrompt(plants) {
  const list = plants.map((p, i) =>
    `${i + 1}. ${p.scientificName} — família: ${p.family || '?'}, hábito: ${p.habit || '?'}`
  ).join('\n');

  return `Você é um especialista em botânica e em nomes populares de plantas no Brasil.
Para cada planta abaixo, forneça o nome popular mais usado no Brasil em português (PT-BR).
Se a planta tiver vários nomes populares, inclua os principais como alternativas.
Se realmente não houver nome popular brasileiro consolidado, use null.

PLANTAS:
${list}

Responda SOMENTE com um array JSON válido, sem markdown, sem comentários, com exatamente ${plants.length} objetos na mesma ordem:
[
  {
    "commonNamePt": <string com o nome popular principal em PT-BR, ou null se não houver>,
    "alternativeNamesPt": <array de strings com outros nomes populares em PT-BR, pode ser []>
  }
]

Exemplos de resposta correta:
- Tillandsia stricta → {"commonNamePt": "Cravo-do-ar", "alternativeNamesPt": ["tillandsia"]}
- Zantedeschia aethiopica → {"commonNamePt": "Copo-de-leite", "alternativeNamesPt": ["antúrio-branco"]}
- Heliconia psittacorum → {"commonNamePt": "Bico-de-papagaio", "alternativeNamesPt": ["helicônia"]}
- Planta sem nome popular → {"commonNamePt": null, "alternativeNamesPt": []}`;
}

// Chama Gemini com fallback automático entre modelos
async function callGeminiWithFallback(prompt, apiKey, modelsQueue, currentModelRef) {
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
      console.log(`  ⚠ Quota esgotada para ${model} — tentando próximo modelo…`);
      continue; // tenta próximo
    }
    return result;
  }
  console.log('  ✗ Todos os modelos estão com quota esgotada.');
  return null;
}

// ─── Enriquecimento de nomes PT ───────────────────────────────────────────────

async function enrichNames(plants) {
  const needsNames = plants.filter(p => !hasPtName(p));
  const alreadyNamed = plants.filter(p => hasPtName(p));

  console.log(` Já com nome PT real: ${alreadyNamed.length} | Sem nome PT: ${needsNames.length}`);
  if (DRY_RUN) console.log(' MODO: dry-run');

  if (needsNames.length === 0) {
    console.log('\n✅ Todas as plantas já têm nome popular. Nada a fazer.');
    return;
  }

  const apiKey = loadGeminiKey();
  if (!apiKey && !DRY_RUN) {
    console.error('\n❌ GEMINI_API_KEY não encontrada.');
    process.exit(1);
  }

  const activeModel = { id: MODELS_TO_TRY[0] };
  if (!DRY_RUN) {
    console.log(` Testando modelos: ${MODELS_TO_TRY.join(' → ')}`);
    let found = false;
    for (const m of MODELS_TO_TRY) {
      process.stdout.write(`   ${m}… `);
      const ok = await testModel(m, apiKey);
      if (ok === true) { console.log('✓ disponível'); activeModel.id = m; found = true; break; }
      else if (ok === 'quota') console.log('quota esgotada');
      else console.log('indisponível');
    }
    if (!found) { console.error('\n❌ Nenhum modelo disponível.'); process.exit(1); }
    console.log(` Modelo ativo: ${activeModel.id}`);
  }

  // Mapa id → planta (para atualizar no final)
  const plantMap = new Map(plants.map(p => [p.id, p]));
  const totalBatches = Math.ceil(needsNames.length / BATCH);
  let successCount = 0, failCount = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batch    = needsNames.slice(b * BATCH, (b + 1) * BATCH);
    const progress = `[${b + 1}/${totalBatches}]`;
    console.log(`\n${progress} Lote ${b + 1}: ${batch.map(p => p.scientificName).join(', ')}`);

    if (DRY_RUN) {
      console.log('  [dry-run] Prompt que seria enviado:');
      console.log('  ' + buildNamesPrompt(batch).split('\n').slice(0, 6).join('\n  ') + '\n  ...');
      continue;
    }

    const results = await callGeminiWithFallback(buildNamesPrompt(batch), apiKey, MODELS_TO_TRY, activeModel);

    if (!results || results.length !== batch.length) {
      console.log(`  ⚠ Resposta inválida — lote pulado`);
      failCount += batch.length;
    } else {
      for (let j = 0; j < batch.length; j++) {
        const plant    = batch[j];
        const nameData = results[j];
        const entry    = plantMap.get(plant.id);
        if (!entry) continue;

        const newName = nameData.commonNamePt && nameData.commonNamePt.trim() !== ''
          ? nameData.commonNamePt.trim()
          : null;
        const newAlts = Array.isArray(nameData.alternativeNamesPt)
          ? nameData.alternativeNamesPt.filter(n => n && n.trim())
          : [];

        if (newName) {
          entry.commonNamePt       = newName;
          entry.alternativeNamesPt = newAlts;
          entry.sources            = { ...entry.sources, vernacular: 'Gemini' };
          console.log(`  ✓ ${plant.scientificName}: "${newName}"${newAlts.length ? ' / ' + newAlts.join(', ') : ''}`);
          successCount++;
        } else {
          console.log(`  — ${plant.scientificName}: sem nome popular conhecido`);
          failCount++;
        }
      }
    }

    if (b < totalBatches - 1) {
      process.stdout.write(`  Aguardando ${BATCH_DELAY_MS / 1000}s…`);
      await sleep(BATCH_DELAY_MS);
      process.stdout.write(' ok\n');
    }
  }

  if (!DRY_RUN) {
    const output = plants.map(p => plantMap.get(p.id) || p);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    const withRealName = output.filter(p => hasPtName(p)).length;
    console.log('\n────────────────────────────────────────');
    console.log(`✅ ${successCount} nomes preenchidos, ${failCount} sem nome popular`);
    console.log(`   Com nome PT real: ${withRealName}/${output.length} (${Math.round(withRealName/output.length*100)}%)`);
    console.log(`   Salvo em: ${OUTPUT_FILE}`);
    console.log(`   Próximo passo: node scripts/merge-catalog.js --integrate`);
  }
  console.log('');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════');
  console.log(' enrich-catalog.js');
  console.log('════════════════════════════════════════');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`\n❌ Arquivo de entrada não encontrado: ${INPUT_FILE}`);
    if (!USE_ALL) console.error('   Dica: copie catalog-candidates.json para catalog-approved.json após revisão,');
    console.error('   ou use --all para usar catalog-candidates.json diretamente.');
    process.exit(1);
  }

  const plants = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(` Entrada: ${path.basename(INPUT_FILE)} — ${plants.length} plantas`);

  if (ENRICH_NAMES) {
    await enrichNames(plants);
    return;
  }

  // Só processa as que ainda não têm care data
  const needsEnrich = plants.filter(p => p.wateringFrequencyDays === null || p.wateringFrequencyDays === undefined);
  const alreadyDone = plants.filter(p => p.wateringFrequencyDays !== null && p.wateringFrequencyDays !== undefined);

  console.log(` Já enriquecidas: ${alreadyDone.length} | A enriquecer: ${needsEnrich.length}`);
  if (DRY_RUN) console.log(' MODO: dry-run');

  if (needsEnrich.length === 0) {
    console.log('\n✅ Todas as plantas já têm dados de cuidado. Nada a fazer.');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(plants, null, 2), 'utf8');
    console.log(`   Salvo em: ${OUTPUT_FILE}`);
    return;
  }

  const apiKey = loadGeminiKey();
  if (!apiKey && !DRY_RUN) {
    console.error('\n❌ GEMINI_API_KEY não encontrada. Defina em backend/.env ou como variável de ambiente.');
    process.exit(1);
  }

  // Detecta o primeiro modelo disponível
  const activeModel = { id: MODELS_TO_TRY[0] };
  if (!DRY_RUN) {
    console.log(` Testando modelos: ${MODELS_TO_TRY.join(' → ')}`);
    let found = false;
    for (const m of MODELS_TO_TRY) {
      process.stdout.write(`   ${m}… `);
      const ok = await testModel(m, apiKey);
      if (ok === true) {
        console.log('✓ disponível');
        activeModel.id = m;
        found = true;
        break;
      } else if (ok === 'quota') {
        console.log('quota esgotada');
      } else {
        console.log('indisponível');
      }
    }
    if (!found) {
      console.error('\n❌ Nenhum modelo disponível. Tente novamente amanhã.');
      process.exit(1);
    }
    console.log(` Modelo ativo: ${activeModel.id}`);
  }

  // Mapa id → dados enriquecidos (para merge no final)
  const enrichedMap = new Map(alreadyDone.map(p => [p.id, p]));

  const totalBatches = Math.ceil(needsEnrich.length / BATCH);
  let successCount = 0, failCount = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batch    = needsEnrich.slice(b * BATCH, (b + 1) * BATCH);
    const progress = `[${b + 1}/${totalBatches}]`;

    console.log(`\n${progress} Lote ${b + 1}: ${batch.map(p => p.scientificName).join(', ')}`);

    if (DRY_RUN) {
      console.log('  [dry-run] Prompt que seria enviado:');
      console.log('  ' + buildPrompt(batch).split('\n').join('\n  '));
      continue;
    }

    const prompt  = buildPrompt(batch);
    const results = await callGeminiWithFallback(prompt, apiKey, MODELS_TO_TRY, activeModel);

    if (!results || results.length !== batch.length) {
      console.log(`  ⚠ Resposta inválida ou incompleta para este lote — marcando como pendente`);
      for (const p of batch) {
        enrichedMap.set(p.id, { ...p, sources: { ...p.sources, care: 'falhou' } });
        failCount++;
      }
    } else {
      for (let j = 0; j < batch.length; j++) {
        const plant   = batch[j];
        const careData = results[j];
        enrichedMap.set(plant.id, {
          ...plant,
          wateringFrequencyDays:    careData.wateringFrequencyDays    ?? null,
          fertilizingFrequencyDays: careData.fertilizingFrequencyDays ?? null,
          sunlight:                 careData.sunlight                 ?? null,
          careHint:                 careData.careHint                 ?? null,
          sources: { ...plant.sources, care: 'Gemini' },
          status: plant.status === 'pendente_revisao' ? 'pendente_revisao' : plant.status,
        });
        console.log(`  ✓ ${plant.scientificName}: rega=${careData.wateringFrequencyDays}d, luz=${careData.sunlight}`);
        successCount++;
      }
    }

    if (b < totalBatches - 1) {
      process.stdout.write(`  Aguardando ${BATCH_DELAY_MS / 1000}s…`);
      await sleep(BATCH_DELAY_MS);
      process.stdout.write(' ok\n');
    }
  }

  if (!DRY_RUN) {
    // Reconstrói array na ordem original
    const output = plants.map(p => enrichedMap.get(p.id) || p);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');

    const withCare = output.filter(p => p.wateringFrequencyDays !== null).length;
    console.log('\n────────────────────────────────────────');
    console.log(`✅ ${successCount} enriquecidas, ${failCount} falharam`);
    console.log(`   Total com care data: ${withCare}/${output.length} (${Math.round(withCare/output.length*100)}%)`);
    console.log(`   Salvo em: ${OUTPUT_FILE}`);
    console.log(`   Próximo passo: node scripts/merge-catalog.js`);
  }

  console.log('');
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
