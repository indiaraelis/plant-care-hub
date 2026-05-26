// backend/routes/identifyRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { identifyPlant } = require('../controllers/identifyController');

// POST /api/identify — receives base64 image, returns structured plant data
router.post('/', protect, identifyPlant);

module.exports = router;
