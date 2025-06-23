// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Importa as rotas e o middleware
const plantRoutes = require('./routes/plantRoutes');
const authRoutes = require('./routes/authRoutes');
const { protect } = require('./middlewares/authMiddleware'); // Importa o middleware de proteção

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
app.use(cors());
app.use(express.json());

// Rota de Teste Simples (Pode remover se quiser, já temos /api/auth)
app.get('/', (req, res) => {
    res.send('API do Plant-Care Hub está funcionando!');
});

// Usar as rotas de autenticação
app.use('/api/auth', authRoutes);

// Proteger as rotas de plantas
// Todas as rotas definidas em plantRoutes serão agora protegidas pelo middleware 'protect'
// Ou seja, precisarão de um JWT válido no cabeçalho 'Authorization'
app.use('/api/plants', protect, plantRoutes);

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});