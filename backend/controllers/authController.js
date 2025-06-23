// backend/controllers/authController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken'); // Importa o jsonwebtoken

// Função auxiliar para gerar JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1h', // Token expira em 1 hora (ajuste conforme necessidade)
    });
};

// @desc    Registrar novo usuário
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Verificar se o usuário já existe
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'Usuário com este e-mail já existe' });
        }

        user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'Nome de usuário já existe' });
        }

        // Criar novo usuário
        user = new User({
            username,
            email,
            password,
        });

        await user.save(); // Salva o usuário (a senha será hashed pelo middleware 'pre save')

        // Gerar token
        const token = generateToken(user._id);

        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: token,
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Erro no Servidor');
    }
};

// @desc    Autenticar usuário e obter token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Verificar se o usuário existe pelo email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'Credenciais inválidas' });
        }

        // Comparar a senha fornecida com a senha hash armazenada
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Credenciais inválidas' });
        }

        // Gerar token
        const token = generateToken(user._id);

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: token,
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Erro no Servidor');
    }
};