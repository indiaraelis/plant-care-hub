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
        const { name, species, acquisitionDate, wateringFrequencyDays, fertilizingFrequencyDays, notes, location, photoUrl } = req.body;

        const plant = await new Plant({
            owner: req.user.id,
            name,
            species,
            acquisitionDate,
            wateringFrequencyDays,
            fertilizingFrequencyDays,
            notes,
            location,
            photoUrl,
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
        const { name, species, acquisitionDate, wateringFrequencyDays, lastWatered, fertilizingFrequencyDays, lastFertilized, notes, location } = req.body;

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
        if (location !== undefined) plant.location = location;
        if (req.body.photoUrl !== undefined) plant.photoUrl = req.body.photoUrl;

        // Track frequency changes for future analytics
        const freqChanged =
            (wateringFrequencyDays !== undefined && wateringFrequencyDays !== plant.wateringFrequencyDays) ||
            (fertilizingFrequencyDays !== undefined && fertilizingFrequencyDays !== plant.fertilizingFrequencyDays);
        if (freqChanged) plant.frequencyChangedAt = new Date();

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

// @desc    Upload de foto da planta
// @route   PATCH /api/plants/:id/photo
// @access  Private
exports.uploadPhoto = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ msg: 'Nenhum arquivo enviado.' });

        const plant = await require('../models/Plant').findById(req.params.id);
        if (!plant) return res.status(404).json({ msg: 'Planta não encontrada.' });
        if (plant.owner.toString() !== req.user.id) return res.status(403).json({ msg: 'Não autorizado.' });

        const { uploadBuffer } = require('../utils/cloudinary');
        const publicId = `user_${req.user.id}_plant_${req.params.id}`;
        const url = await uploadBuffer(req.file.buffer, publicId);

        plant.photoUrl = url;
        await plant.save();
        res.json({ photoUrl: url });
    } catch (error) {
        next(error);
    }
};

// @desc    Registrar rega imediata
// @route   PATCH /api/plants/:id/water
// @access  Private
exports.waterPlant = async (req, res, next) => {
    try {
        const plant = await Plant.findById(req.params.id);

        if (!plant) return res.status(404).json({ msg: 'Planta não encontrada' });
        if (plant.owner.toString() !== req.user.id) return res.status(403).json({ msg: 'Não autorizado.' });

        const now = new Date();
        plant.lastWatered = now;
        plant.wateringHistory.push(now);

        await plant.save();
        res.json(plant);
    } catch (error) {
        next(error);
    }
};

// @desc    Registrar adubação imediata
// @route   PATCH /api/plants/:id/fertilize
// @access  Private
exports.fertilizePlant = async (req, res, next) => {
    try {
        const plant = await Plant.findById(req.params.id);

        if (!plant) return res.status(404).json({ msg: 'Planta não encontrada' });
        if (plant.owner.toString() !== req.user.id) return res.status(403).json({ msg: 'Não autorizado.' });

        const now = new Date();
        plant.lastFertilized = now;
        plant.fertilizingHistory.push(now);

        await plant.save();
        res.json(plant);
    } catch (error) {
        next(error);
    }
};