// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

// Importa as rotas e o middleware
const plantRoutes = require('./routes/plantRoutes');
const authRoutes = require('./routes/authRoutes');
const { protect } = require('./middlewares/authMiddleware');
const errorHandler = require('./middlewares/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Conexão com o Banco de Dados
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB conectado com sucesso!');
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        process.exit(1);
    }
};
connectDB();


// Middlewares
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Rota de Teste Simples (Pode remover se quiser, já temos /api/auth)
app.get('/', (req, res) => {
    res.send('API do Plant-Care Hub está funcionando!');
});

// Usar as rotas de autenticação
app.use('/api/auth', authRoutes);
app.use('/api/plants', protect, plantRoutes);
app.use('/api/trefle', require('./routes/trefleRoutes'));
app.use('/api/identify', require('./routes/identifyRoutes'));
app.use('/api/suggest-care', protect, require('./routes/suggestRoutes'));

// Middleware global de erros — deve ficar após todas as rotas
app.use(errorHandler);

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});

