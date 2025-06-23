// backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Importa o bcryptjs

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'O nome de usuário é obrigatório'],
        unique: true, // Garante que o nome de usuário seja único
        trim: true,
        minlength: [3, 'O nome de usuário deve ter pelo menos 3 caracteres']
    },
    email: {
        type: String,
        required: [true, 'O e-mail é obrigatório'],
        unique: true, // Garante que o e-mail seja único
        match: [/.+@.+\..+/, 'Por favor, insira um e-mail válido'], // Validação de formato de e-mail
        trim: true,
        lowercase: true // Armazena e-mail em minúsculas
    },
    password: {
        type: String,
        required: [true, 'A senha é obrigatória'],
        minlength: [6, 'A senha deve ter pelo menos 6 caracteres']
    }
}, {
    timestamps: true // Adiciona createdAt e updatedAt
});

// Middleware do Mongoose: Hash da senha antes de salvar
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) { // Só faz o hash se a senha foi modificada (ou é nova)
        next();
    }
    const salt = await bcrypt.genSalt(10); // Gera um salt
    this.password = await bcrypt.hash(this.password, salt); // Faz o hash da senha
    next();
});

// Método customizado para comparar senhas
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password); // Compara a senha informada com a senha hash
};

module.exports = mongoose.model('User', UserSchema);