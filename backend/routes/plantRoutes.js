// backend/routes/plantRoutes.js

const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plantController');
const validate = require('../middlewares/validate');
const { createPlantValidators, updatePlantValidators, mongoIdValidator } = require('../validators/plantValidators');

// Rotas para as plantas
router.get('/', plantController.getPlants);                                              // GET    /api/plants
router.post('/', createPlantValidators, validate, plantController.createPlant);          // POST   /api/plants
router.get('/:id', mongoIdValidator, validate, plantController.getPlantById);            // GET    /api/plants/:id
router.put('/:id', updatePlantValidators, validate, plantController.updatePlant);        // PUT    /api/plants/:id
router.delete('/:id', mongoIdValidator, validate, plantController.deletePlant);          // DELETE /api/plants/:id

module.exports = router;