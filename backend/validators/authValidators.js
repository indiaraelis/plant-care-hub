// backend/validators/authValidators.js

const { body } = require('express-validator');

const registerValidators = [
    body('username')
        .trim()
        .notEmpty().withMessage('O nome de usuário é obrigatório')
        .isLength({ min: 3, max: 30 }).withMessage('O nome de usuário deve ter entre 3 e 30 caracteres'),

    body('email')
        .trim()
        .notEmpty().withMessage('O e-mail é obrigatório')
        .isEmail().withMessage('Informe um e-mail válido')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('A senha é obrigatória')
        .isLength({ min: 6 }).withMessage('A senha deve ter no mínimo 6 caracteres'),
];

const loginValidators = [
    body('email')
        .trim()
        .notEmpty().withMessage('O e-mail é obrigatório')
        .isEmail().withMessage('Informe um e-mail válido')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('A senha é obrigatória'),
];

const changePasswordValidators = [
    body('currentPassword')
        .notEmpty().withMessage('Informe a senha atual.'),

    body('newPassword')
        .notEmpty().withMessage('A nova senha é obrigatória.')
        .isLength({ min: 6 }).withMessage('A nova senha deve ter no mínimo 6 caracteres.'),
];

const resetPasswordValidators = [
    body('newPassword')
        .notEmpty().withMessage('A nova senha é obrigatória.')
        .isLength({ min: 6 }).withMessage('A nova senha deve ter no mínimo 6 caracteres.'),
];

module.exports = { registerValidators, loginValidators, changePasswordValidators, resetPasswordValidators };
