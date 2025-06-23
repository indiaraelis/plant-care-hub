// frontend/src/pages/Register.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Importa o axios para fazer requisições HTTP
import { toast } from 'react-toastify';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // Hook para navegação

  const handleSubmit = async (e) => {
    e.preventDefault(); // Previne o recarregamento da página
    try {
      const res = await axios.post('http://localhost:5000/api/auth/register', {
        username,
        email,
        password,
      });
      console.log('Registro bem-sucedido:', res.data);
      toast.success('Registro realizado com sucesso! Faça login agora.'); // Substitui alert
      navigate('/login');
    } catch (error) {
      console.error('Erro no registro:', error.response ? error.response.data : error.message);
      toast.error('Erro no registro: ' + (error.response ? error.response.data.msg : error.message)); // Substitui alert
    }
  };

  return (
    <div className="container">
      <h2>Criar Nova Conta</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome de Usuário:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Senha:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Registrar</button>
      </form>
      <p>
        Já tem uma conta? <Link to="/login">Faça Login</Link>
      </p>
    </div>
  );
}

export default Register;