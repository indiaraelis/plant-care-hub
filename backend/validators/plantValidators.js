// backend/validators/plantValidators.js

const { body, param } = require('express-validator');

const createPlantValidators = [
    body('name')
        .trim()
        .notEmpty().withMessage('O nome da planta é obrigatório')
        .isLength({ max: 100 }).withMessage('O nome não pode ter mais de 100 caracteres'),

    body('species')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('A espécie não pode ter mais de 100 caracteres'),

    body('wateringFrequencyDays')
        .notEmpty().withMessage('A frequência de rega é obrigatória')
        .isInt({ min: 1 }).withMessage('A frequência de rega deve ser um número inteiro maior que 0'),

    body('fertilizingFrequencyDays')
        .optional()
        .isInt({ min: 0 }).withMessage('A frequência de adubação deve ser um número inteiro maior ou igual a 0'),

    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('As notas não podem ter mais de 500 caracteres'),

    body('location')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('A localização não pode ter mais de 50 caracteres'),
];

const updatePlantValidators = [
    param('id')
        .isMongoId().withMessage('ID de planta inválido'),

    body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('O nome não pode ser vazio')
        .isLength({ max: 100 }).withMessage('O nome não pode ter mais de 100 caracteres'),

    body('wateringFrequencyDays')
        .optional()
        .isInt({ min: 1 }).withMessage('A frequência de rega deve ser um número inteiro maior que 0'),

    body('fertilizingFrequencyDays')
        .optional()
        .isInt({ min: 0 }).withMessage('A frequência de adubação deve ser um número inteiro maior ou igual a 0'),

    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('As notas não podem ter mais de 500 caracteres'),

    body('location')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('A localização não pode ter mais de 50 caracteres'),
];

const mongoIdValidator = [
    param('id')
        .isMongoId().withMessage('ID de planta inválido'),
];

module.exports = { createPlantValidators, updatePlantValidators, mongoIdValidator };
