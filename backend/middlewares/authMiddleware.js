// backend/middlewares/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // Verifica se o token está no cabeçalho da requisição (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extrai o token
            token = req.headers.authorization.split(' ')[1];

            // Verifica o token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Anexa o usuário à requisição (sem a senha)
            req.user = await User.findById(decoded.id).select('-password');
            next(); // Prossegue para a próxima função da rota

        } catch (error) {
            console.error('Token inválido:', error.message);
            res.status(401).json({ msg: 'Não autorizado, token inválido' });
        }
    }

    if (!token) {
        res.status(401).json({ msg: 'Não autorizado, nenhum token' });
    }
};

module.exports = { protect };