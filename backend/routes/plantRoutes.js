// backend/routes/plantRoutes.js

const express = require('express');
const router = express.Router(); // Cria uma instância de Router do Express
const plantController = require('../controllers/plantController'); // Importa o controller

// Rotas para as plantas
router.get('/', plantController.getPlants); // GET /api/plants
router.post('/', plantController.createPlant); // POST /api/plants
router.get('/:id', plantController.getPlantById); // GET /api/plants/:id
router.put('/:id', plantController.updatePlant); // PUT /api/plants/:id
router.delete('/:id', plantController.deletePlant); // DELETE /api/plants/:id

module.exports = router;