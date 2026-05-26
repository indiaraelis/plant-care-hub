// backend/controllers/plantController.js

const Plant = require('../models/Plant');
const User = require('../models/User'); // Importa o modelo User para a validação (opcional, mas bom ter)

// @desc    Obter todas as plantas do usuário logado
// @route   GET /api/plants
// @access  Private
exports.getPlants = async (req, res, next) => {
    try {
        const plants = await Plant.find({ owner: req.user.id });
        res.json(plants);
    } catch (error) {
        next(error);
    }
};

// @desc    Criar uma nova planta
// @route   POST /api/plants
// @access  Private
exports.createPlant = async (req, res, next) => {
    try {
        const { name, species, acquisitionDate, wateringFrequencyDays, fertilizingFrequencyDays, notes } = req.body;

        const plant = await new Plant({
            owner: req.user.id,
            name,
            species,
            acquisitionDate,
            wateringFrequencyDays,
            fertilizingFrequencyDays,
            notes,
        }).save();

        res.status(201).json(plant);

    } catch (error) {
        next(error);
    }
};

// @desc    Obter uma planta por ID
// @route   GET /api/plants/:id
// @access  Private
exports.getPlantById = async (req, res, next) => {
    try {
        const plant = await Plant.findById(req.params.id);

        if (!plant) {
            return res.status(404).json({ msg: 'Planta não encontrada' });
        }

        if (plant.owner.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Não autorizado. Esta planta não pertence a você.' });
        }

        res.json(plant);

    } catch (error) {
        next(error);
    }
};

// @desc    Atualizar uma planta
// @route   PUT /api/plants/:id
// @access  Private
exports.updatePlant = async (req, res, next) => {
    try {
        const { name, species, acquisitionDate, wateringFrequencyDays, lastWatered, fertilizingFrequencyDays, lastFertilized, notes } = req.body;

        const plant = await Plant.findById(req.params.id);

        if (!plant) {
            return res.status(404).json({ msg: 'Planta não encontrada' });
        }

        if (plant.owner.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Não autorizado. Você só pode atualizar suas próprias plantas.' });
        }

        if (name !== undefined) plant.name = name;
        if (species !== undefined) plant.species = species;
        if (acquisitionDate !== undefined) plant.acquisitionDate = acquisitionDate;
        if (wateringFrequencyDays !== undefined) plant.wateringFrequencyDays = wateringFrequencyDays;
        if (lastWatered !== undefined) plant.lastWatered = lastWatered;
        if (fertilizingFrequencyDays !== undefined) plant.fertilizingFrequencyDays = fertilizingFrequencyDays;
        if (lastFertilized !== undefined) plant.lastFertilized = lastFertilized;
        if (notes !== undefined) plant.notes = notes;

        await plant.save();
        res.json(plant);

    } catch (error) {
        next(error);
    }
};

// @desc    Excluir uma planta
// @route   DELETE /api/plants/:id
// @access  Private
exports.deletePlant = async (req, res, next) => {
    try {
        const plant = await Plant.findById(req.params.id);

        if (!plant) {
            return res.status(404).json({ msg: 'Planta não encontrada' });
        }

        if (plant.owner.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Não autorizado. Você só pode deletar suas próprias plantas.' });
        }

        await Plant.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Planta removida com sucesso' });

    } catch (error) {
        next(error);
    }
};