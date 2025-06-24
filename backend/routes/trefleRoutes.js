const express = require('express');
const axios = require('axios');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');

router.get('/search', protect, async (req, res) => {
  const { query } = req.query;
  const TREFLE_API_KEY = process.env.TREFLE_API_KEY;

  if (!query) {
    return res.status(400).json({ msg: 'É necessário fornecer um termo de busca (query).' });
  }

  try {
    // ---- NOVA TENTATIVA: Usar filter[common_name] ou filter[scientific_name] ----
    // Primeiro, vamos tentar buscar pelo common_name
    let trefleUrl = `https://trefle.io/api/v1/plants?token=${TREFLE_API_KEY}&filter[common_name]=${encodeURIComponent(query)}`;

    // OPCIONAL: Se a busca por common_name não retornar resultados, você pode tentar scientific_name
    // Mas vamos focar em fazer uma funcionar primeiro.
    // Outra abordagem seria fazer duas requisições e combinar os resultados.

    console.log('URL da Trefle.io (usando filter):', trefleUrl);

    const response = await axios.get(trefleUrl);

    const plantsData = response.data.data.map(plant => ({
      id: plant.id,
      common_name: plant.common_name,
      scientific_name: plant.scientific_name,
      family: plant.family,
      image_url: plant.image_url,
    }));

    res.json(plantsData);
  } catch (error) {
    console.error('Erro ao buscar plantas do Trefle.io:', error.response ? error.response.data : error.message);
    res.status(500).json({
      msg: 'Erro ao buscar plantas externas.',
      error: error.response ? error.response.data : error.message
    });
  }
});

module.exports = router;