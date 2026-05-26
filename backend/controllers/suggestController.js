// backend/controllers/suggestController.js
// Returns structured care suggestions, using Perenual (structured data) first
// and Gemini (Portuguese hint) as supplement/fallback.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchPlantCare } = require('../utils/perenual');

// @desc    Suggest watering/fertilizing schedule from a plant name or species
// @route   POST /api/suggest-care
// @access  Private
exports.suggestCare = async (req, res, next) => {
  try {
    const { name, species } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'O nome da planta é obrigatório.' });
    }

    // ── 1. Try Perenual for structured data ───────────────────────────────────
    const perenual = await searchPlantCare(name.trim(), species?.trim());

    // ── 2. Ask Gemini only for the Portuguese care hint ───────────────────────
    let careHint = null;
    let geminiConfident = true;

    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const plantLabel = species?.trim()
          ? `"${name.trim()}" (${species.trim()})`
          : `"${name.trim()}"`;

        // If Perenual already supplied watering data, ask Gemini only for the hint
        const prompt = perenual
          ? `Para a planta ${plantLabel} que rega a cada ${perenual.suggestedWateringDays} dias, escreva UMA frase curta em português brasileiro (máx 90 caracteres) com a principal dica de cuidado. Responda APENAS a frase, sem aspas.`
          : `You are a plant care specialist for Brazilian home conditions.
For the plant ${plantLabel}, respond ONLY with a valid JSON object — no markdown, no prose:
{
  "suggestedWateringDays": <integer 1-60>,
  "suggestedFertilizingDays": <integer, 0 if not needed>,
  "careHint": "<one sentence in Brazilian Portuguese, max 90 chars>",
  "confident": <boolean>
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        if (perenual) {
          // Text response is just the hint sentence
          careHint = text.replace(/^["']|["']$/g, '').trim().slice(0, 120);
        } else {
          // Parse full JSON response
          const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          try {
            const data = JSON.parse(cleaned);
            return res.json({
              suggestedWateringDays: typeof data.suggestedWateringDays === 'number' ? data.suggestedWateringDays : 7,
              suggestedFertilizingDays: typeof data.suggestedFertilizingDays === 'number' ? data.suggestedFertilizingDays : 30,
              careHint: data.careHint || null,
              confident: data.confident !== false,
              source: 'gemini',
            });
          } catch {
            return res.json({
              suggestedWateringDays: 7,
              suggestedFertilizingDays: 30,
              careHint: 'Rega semanal é um bom ponto de partida. Ajuste conforme seu ambiente.',
              confident: false,
              source: 'fallback',
            });
          }
        }
      } catch {
        geminiConfident = false;
      }
    }

    // ── 3. Return Perenual data + Gemini hint ─────────────────────────────────
    if (perenual) {
      return res.json({
        suggestedWateringDays: perenual.suggestedWateringDays,
        suggestedFertilizingDays: perenual.suggestedFertilizingDays,
        careHint: careHint || null,
        confident: geminiConfident,
        source: 'perenual',
        wateringLevel: perenual.wateringLevel,
        maintenanceLevel: perenual.maintenanceLevel,
        sunlightLabel: perenual.sunlightLabel,
        perenualName: perenual.commonName,
      });
    }

    // ── 4. Neither worked — safe fallback ─────────────────────────────────────
    return res.json({
      suggestedWateringDays: 7,
      suggestedFertilizingDays: 30,
      careHint: 'Rega semanal é um bom ponto de partida. Ajuste conforme seu ambiente.',
      confident: false,
      source: 'fallback',
    });

  } catch (error) {
    next(error);
  }
};

