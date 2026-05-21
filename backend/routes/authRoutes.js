// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // janela de 15 minutos
    max: 10,                   // máximo de 10 tentativas por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

// Rotas de autenticação
router.post('/register', authController.registerUser);              // POST /api/auth/register
router.post('/login', loginLimiter, authController.loginUser);      // POST /api/auth/login
router.post('/logout', authController.logoutUser);                  // POST /api/auth/logout
router.get('/me', protect, authController.getMe);                   // GET  /api/auth/me

module.exports = router;