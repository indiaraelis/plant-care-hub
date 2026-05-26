// backend/controllers/suggestController.js
// Text-based care suggestion via Gemini — called when plant is from Trefle or typed manually.

const { GoogleGenerativeAI } = require('@google/generative-ai');

// @desc    Suggest watering/fertilizing schedule from a plant name or species (no image)
// @route   POST /api/suggest-care
// @access  Private
exports.suggestCare = async (req, res, next) => {
  try {
    const { name, species } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'O nome da planta é obrigatório.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ msg: 'Serviço de sugestão IA não configurado.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const plantLabel = species?.trim()
      ? `"${name.trim()}" (nome científico: ${species.trim()})`
      : `"${name.trim()}"`;

    const prompt = `You are a plant care specialist for Brazilian home conditions.
For the plant ${plantLabel}, respond ONLY with a valid JSON object — no markdown, no prose, no extra text:
{
  "suggestedWateringDays": <integer 1-60: recommended days between waterings>,
  "suggestedFertilizingDays": <integer: days between fertilizing, 0 if not needed>,
  "careHint": "<one sentence in Brazilian Portuguese describing the main care tip, max 90 chars>",
  "confident": <boolean: true if you recognise this species well>
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.json({
        suggestedWateringDays: 7,
        suggestedFertilizingDays: 30,
        careHint: 'Rega semanal é um bom ponto de partida. Ajuste conforme seu ambiente.',
        confident: false,
      });
    }

    if (typeof data.suggestedWateringDays !== 'number' || data.suggestedWateringDays < 1) {
      data.suggestedWateringDays = 7;
    }
    if (typeof data.suggestedFertilizingDays !== 'number') {
      data.suggestedFertilizingDays = 30;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
};
