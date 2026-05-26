// backend/routes/plantRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const plantController = require('../controllers/plantController');
const validate = require('../middlewares/validate');
const { createPlantValidators, updatePlantValidators, mongoIdValidator } = require('../validators/plantValidators');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato não suportado. Use JPEG, PNG ou WebP.'));
  },
});

// Rotas para as plantas
router.get('/', plantController.getPlants);
router.post('/', createPlantValidators, validate, plantController.createPlant);
router.get('/:id', mongoIdValidator, validate, plantController.getPlantById);
router.put('/:id', updatePlantValidators, validate, plantController.updatePlant);
router.delete('/:id', mongoIdValidator, validate, plantController.deletePlant);
router.patch('/:id/water', mongoIdValidator, validate, plantController.waterPlant);
router.patch('/:id/fertilize', mongoIdValidator, validate, plantController.fertilizePlant);
router.patch('/:id/photo', mongoIdValidator, validate, upload.single('photo'), plantController.uploadPhoto);

module.exports = router;