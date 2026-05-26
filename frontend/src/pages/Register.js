// frontend/src/pages/Register.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/api/auth/register', { username, email, password });
      login(res.data);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Erro no registro: ' + (error.response ? error.response.data.msg : error.message));
    }
  };

  return (
    <div className="container">
      <h2>Criar Nova Conta</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome de Usuário:</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Senha:</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
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
