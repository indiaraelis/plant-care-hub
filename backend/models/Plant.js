// backend/models/Plant.js

const mongoose = require('mongoose');

const PlantSchema = new mongoose.Schema({
    owner: { // Proprietário da planta
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // 'User' é o nome do nosso modelo de usuário
        required: true, // Cada planta DEVE ter um proprietário
    },
    name: {
        type: String,
        required: [true, 'O nome da planta é obrigatório'],
        trim: true,
    },
    species: {
        type: String,
        trim: true,
        default: 'Desconhecida'
    },
    acquisitionDate: { // Data em que a planta foi adquirida
        type: Date,
        default: Date.now,
    },
    wateringFrequencyDays: { // Frequência de rega em dias
        type: Number,
        required: [true, 'A frequência de rega é obrigatória'],
        min: [1, 'A frequência de rega deve ser pelo menos 1 dia'],
    },
    lastWatered: { // Última data de rega
        type: Date,
        default: Date.now,
    },
    wateringHistory: {
        type: [Date],
        default: [],
    },
    fertilizingFrequencyDays: { // Frequência de adubação em dias
        type: Number,
        default: 0, // 0 significa que não precisa de adubação regular
    },
    lastFertilized: { // Última data de adubação
        type: Date,
        default: null, // Pode ser null se não for adubada
    },
    fertilizingHistory: {
        type: [Date],
        default: [],
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'As notas não podem ter mais de 500 caracteres'],
    },
    location: {
        type: String,
        trim: true,
        default: null,
    },
    photoUrl: {
        type: String,
        default: null,
    },
    frequencyChangedAt: {
        // Tracks the last time wateringFrequencyDays or fertilizingFrequencyDays was changed,
        // so future analyses can account for mid-history schedule changes.
        type: Date,
        default: null,
    },
}, {
    timestamps: true // Adiciona automaticamente createdAt e updatedAt
});

module.exports = mongoose.model('Plant', PlantSchema);