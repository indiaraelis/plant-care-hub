// backend/routes/trefleRoutes.js

const express = require('express');
const axios = require('axios');
const router = express.Router();
const auth = require('../middleware/auth'); // Opcional: proteger esta rota também

// Rota para buscar plantas do Trefle.io
// Exemplo de uso no frontend: GET /api/trefle/search?query=rose
router.get('/search', auth, async (req, res) => { // Proteger com auth é uma boa prática
  const { query } = req.query; // Pega o termo de busca da URL (ex: ?query=rose)
  const TREFLE_API_KEY = process.env.TREFLE_API_KEY;

  if (!query) {
    return res.status(400).json({ msg: 'É necessário fornecer um termo de busca (query).' });
  }

  try {
    const trefleUrl = `https://trefle.io/api/v1/plants/search?token=<span class="math-inline">\{TREFLE\_API\_KEY\}&q\=</span>{encodeURIComponent(query)}`;
    const response = await axios.get(trefleUrl);

    // O Trefle.io retorna muitos dados, vamos simplificar para o frontend
    const plantsData = response.data.data.map(plant => ({
      id: plant.id,
      common_name: plant.common_name,
      scientific_name: plant.scientific_name,
      family: plant.family,
      image_url: plant.image_url,
      // Adicione outros campos se precisar
    }));

    res.json(plantsData);
  } catch (error) {
    console.error('Erro ao buscar plantas do Trefle.io:', error.response ? error.response.data : error.message);
    res.status(500).json({ msg: 'Erro ao buscar plantas externas.', error: error.response ? error.response.data : error.message });
  }
});

module.exports = router;