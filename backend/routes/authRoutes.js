// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { registerValidators, loginValidators, changePasswordValidators, resetPasswordValidators } = require('../validators/authValidators');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // janela de 15 minutos
    max: 10,                   // máximo de 10 tentativas por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

router.post('/register', registerValidators, validate, authController.registerUser);
router.post('/login', loginLimiter, loginValidators, validate, authController.loginUser);
router.post('/logout', authController.logoutUser);
router.get('/me', protect, authController.getMe);
router.patch('/password', protect, changePasswordValidators, validate, authController.changePassword);
router.delete('/account', protect, authController.deleteAccount);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', resetPasswordValidators, validate, authController.resetPassword);

module.exports = router;