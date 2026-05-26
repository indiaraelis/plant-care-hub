// backend/controllers/authController.js

const User = require('../models/User');
const Plant = require('../models/Plant');
const jwt = require('jsonwebtoken');

const TOKEN_TTL    = '7d';
const COOKIE_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
};

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_TTL,
});

// @desc    Registrar novo usuário
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res, next) => {
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

        user = new User({ username, email, password });
        await user.save();

        const token = generateToken(user._id);

        res.cookie('token', token, cookieOptions());

        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Autenticar usuário e obter token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'Credenciais inválidas' });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Credenciais inválidas' });
        }

        const token = generateToken(user._id);

        res.cookie('token', token, cookieOptions());

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Logout — limpa o cookie de autenticação
// @route   POST /api/auth/logout
// @access  Private
exports.logoutUser = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.json({ msg: 'Logout realizado com sucesso' });
};

// @desc    Retorna o usuário autenticado atual
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    res.json({
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
    });
};

// @desc    Alterar senha
// @route   PATCH /api/auth/password
// @access  Private
exports.changePassword = async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await User.findById(req.user._id);
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Senha atual incorreta.' });
        }
        user.password = newPassword;
        await user.save(); // pre-save hook fará o hash
        res.json({ msg: 'Senha alterada com sucesso.' });
    } catch (error) {
        next(error);
    }
};

// @desc    Deletar conta e todas as plantas do usuário
// @route   DELETE /api/auth/account
// @access  Private
exports.deleteAccount = async (req, res, next) => {
    try {
        await Plant.deleteMany({ owner: req.user._id });
        await User.findByIdAndDelete(req.user._id);
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
        res.json({ msg: 'Conta excluída com sucesso.' });
    } catch (error) {
        next(error);
    }
};