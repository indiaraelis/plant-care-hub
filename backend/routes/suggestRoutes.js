// backend/routes/suggestRoutes.js

const express = require('express');
const router = express.Router();
const { suggestCare } = require('../controllers/suggestController');

router.post('/', suggestCare);

module.exports = router;
