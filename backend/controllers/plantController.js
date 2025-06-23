// backend/controllers/plantController.js

const Plant = require('../models/Plant');
const User = require('../models/User'); // Importa o modelo User para a validação (opcional, mas bom ter)

// @desc    Obter todas as plantas do usuário logado
// @route   GET /api/plants
// @access  Private
exports.getPlants = async (req, res) => {
    try {
        const plants = await Plant.find({ owner: req.user.id }); // Apenas plantas do usuário logado
        res.json(plants);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Erro no Servidor');
    }
};

// @desc    Criar uma nova planta
// @route   POST /api/plants
// @access  Private
exports.createPlant = async (req, res) => {
    try {
        const { name, species, acquisitionDate, wateringFrequencyDays, fertilizingFrequencyDays, notes } = req.body;

        // Validação básica
        if (!name || !wateringFrequencyDays) {
            return res.status(400).json({ msg: 'Por favor, inclua o nome e a frequência de rega da planta.' });
        }

        const newPlant = new Plant({
            owner: req.user.id, // Associa a planta ao usuário logado
            name,
            species,
            acquisitionDate,
            wateringFrequencyDays,
            fertilizingFrequencyDays,
            notes,
        });

        const plant = await newPlant.save();
        res.status(201).json(plant);

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Erro no Servidor');
    }
};

// @desc    Obter uma planta por ID
// @route   GET /api/plants/:id
// @access  Private
exports.getPlantById = async (req, res) => {
    try {
        const plant = await Plant.findById(req.params.id);

        if (!plant) {
            return res.status(404).json({ msg: 'Planta não encontrada' });
        }

        // Garante que o usuário logado é o proprietário da planta
        if (plant.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Não autorizado. Esta planta não pertence a você.' });
        }

        res.json(plant);

    } catch (error) {
        console.error(error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'ID de planta inválido' });
        }
        res.status(500).send('Erro no Servidor');
    }
};

// @desc    Atualizar uma planta
// @route   PUT /api/plants/:id
// @access  Private
exports.updatePlant = async (req, res) => {
    try {
        const { name, species, acquisitionDate, wateringFrequencyDays, lastWatered, fertilizingFrequencyDays, lastFertilized, notes } = req.body;

        let plant = await Plant.findById(req.params.id);

        if (!plant) {
            return res.status(404).json({ msg: 'Planta não encontrada' });
        }

        // Garante que o usuário logado é o proprietário da planta
        if (plant.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Não autorizado. Você só pode atualizar suas próprias plantas.' });
        }

        // Atualiza os campos (pode ser mais robusto com validação ou um findByIdAndUpdate)
        plant.name = name !== undefined ? name : plant.name;
        plant.species = species !== undefined ? species : plant.species;
        plant.acquisitionDate = acquisitionDate !== undefined ? acquisitionDate : plant.acquisitionDate;
        plant.wateringFrequencyDays = wateringFrequencyDays !== undefined ? wateringFrequencyDays : plant.wateringFrequencyDays;
        plant.lastWatered = lastWatered !== undefined ? lastWatered : plant.lastWatered;
        plant.fertilizingFrequencyDays = fertilizingFrequencyDays !== undefined ? fertilizingFrequencyDays : plant.fertilizingFrequencyDays;
        plant.lastFertilized = lastFertilized !== undefined ? lastFertilized : plant.lastFertilized;
        plant.notes = notes !== undefined ? notes : plant.notes;


        await plant.save();
        res.json(plant);

    } catch (error) {
        console.error(error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'ID de planta inválido' });
        }
        res.status(500).send('Erro no Servidor');
    }
};

// @desc    Excluir uma planta
// @route   DELETE /api/plants/:id
// @access  Private
exports.deletePlant = async (req, res) => {
    try {
        const plant = await Plant.findById(req.params.id);

        if (!plant) {
            return res.status(404).json({ msg: 'Planta não encontrada' });
        }

        // Garante que o usuário logado é o proprietário da planta
        if (plant.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Não autorizado. Você só pode deletar suas próprias plantas.' });
        }

        await Plant.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Planta removida com sucesso' });

    } catch (error) {
        console.error(error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ msg: 'ID de planta inválido' });
        }
        res.status(500).send('Erro no Servidor');
    }
};