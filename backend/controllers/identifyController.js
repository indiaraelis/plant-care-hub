// backend/controllers/identifyController.js

const { GoogleGenerativeAI } = require('@google/generative-ai');

const PROMPT = `Você é um especialista em botânica e plantas domésticas.
Analise a imagem fornecida e identifique a planta.
Responda APENAS com um objeto JSON válido, sem markdown, sem explicações, no seguinte formato:

{
  "commonName": "nome popular em português",
  "scientificName": "nome científico",
  "family": "família botânica",
  "origin": "região de origem",
  "habit": "hábito de crescimento (Herbácea, Arbustiva, Arbórea, Suculenta, Trepadeira, etc.)",
  "suggestedWateringDays": número inteiro (dias entre regas sugerido),
  "suggestedFertilizingDays": número inteiro ou 0 se não precisar,
  "careHint": "frase curta em português sobre cuidados essenciais (máx 120 caracteres)",
  "confident": true ou false (false se a imagem for incerta ou sem planta visível)
}

Se não houver planta identificável na imagem, retorne:
{ "confident": false, "commonName": null, "scientificName": null, "careHint": "Não foi possível identificar uma planta nessa imagem." }`;

exports.identifyPlant = async (req, res, next) => {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
        return res.status(400).json({ msg: 'Envie imageBase64 e mimeType.' });
    }

    // Validate mimeType to prevent injection
    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_MIME.includes(mimeType)) {
        return res.status(400).json({ msg: 'Tipo de imagem não suportado. Use JPEG, PNG ou WebP.' });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ msg: 'Identificação por imagem não está configurada neste servidor.' });
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const result = await model.generateContent([
            PROMPT,
            { inlineData: { data: imageBase64, mimeType } },
        ]);

        const text = result.response.text().trim();

        // Strip markdown code fences if the model wrapped the JSON
        const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return res.status(422).json({ msg: 'Resposta inesperada do modelo.', raw: cleaned });
        }

        return res.json(parsed);
    } catch (error) {
        next(error);
    }
};
