// backend/controllers/suggestController.js
// Returns structured care suggestions via Gemini (PT-BR).

const { GoogleGenerativeAI } = require('@google/generative-ai');

// @desc    Suggest watering/fertilizing schedule from a plant name or species
// @route   POST /api/suggest-care
// @access  Private
exports.suggestCare = async (req, res, next) => {
  try {
    const { name, species } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'O nome da planta é obrigatório.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        suggestedWateringDays: 7,
        suggestedFertilizingDays: 30,
        careHint: 'Rega semanal é um bom ponto de partida. Ajuste conforme seu ambiente.',
        confident: false,
        source: 'fallback',
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const plantLabel = species?.trim()
      ? `"${name.trim()}" (${species.trim()})`
      : `"${name.trim()}"`;

    const prompt = `Você é especialista em plantas domésticas em condições brasileiras.
Para a planta ${plantLabel}, responda APENAS com um objeto JSON válido — sem markdown, sem texto extra:
{
  "suggestedWateringDays": <inteiro 1-60, quantos dias entre regas>,
  "suggestedFertilizingDays": <inteiro, 0 se não precisar adubar>,
  "careHint": "<uma frase em português brasileiro, máx 90 caracteres, dica mais importante>",
  "confident": <true se conhece a planta, false se incerto>
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
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

  } catch (error) {
    next(error);
  }
};

