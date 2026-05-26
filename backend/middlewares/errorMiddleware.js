// backend/middlewares/errorMiddleware.js

// Middleware global de erros — deve ser registrado APÓS todas as rotas no server.js
// Recebe erros passados via next(error) em qualquer controller ou middleware
const errorHandler = (err, req, res, next) => {
    const status = err.statusCode || 500;
    const message = err.message || 'Erro interno no servidor';

    res.status(status).json({ msg: message });
};

module.exports = errorHandler;
