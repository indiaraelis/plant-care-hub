// backend/routes/plantRoutes.js

const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plantController');
const validate = require('../middlewares/validate');
const { createPlantValidators, updatePlantValidators, mongoIdValidator } = require('../validators/plantValidators');

// Rotas para as plantas
router.get('/', plantController.getPlants);
router.post('/', createPlantValidators, validate, plantController.createPlant);
router.get('/:id', mongoIdValidator, validate, plantController.getPlantById);
router.put('/:id', updatePlantValidators, validate, plantController.updatePlant);
router.delete('/:id', mongoIdValidator, validate, plantController.deletePlant);
router.patch('/:id/water', mongoIdValidator, validate, plantController.waterPlant);
router.patch('/:id/fertilize', mongoIdValidator, validate, plantController.fertilizePlant);

module.exports = router;