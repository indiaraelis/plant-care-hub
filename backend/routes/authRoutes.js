// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Importa o controller de autenticação

// Rotas de autenticação
router.post('/register', authController.registerUser); // POST /api/auth/register
router.post('/login', authController.loginUser);     // POST /api/auth/login

module.exports = router;