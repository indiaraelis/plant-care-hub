// frontend/src/pages/Login.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/api/auth/login', { email, password });
      login(res.data);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Erro no login: ' + (error.response ? error.response.data.msg : error.message));
    }
  };

  return (
    <div className="container">
      <div className="intro-section">
        <h2>Para quem ama plantas mas tem memória de peixe.</h2>
        <p>Registre, acompanhe e receba lembretes antes que o vaso murche.</p>
      </div>

      <h2>Entrar na Conta</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Senha:</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit">Login</button>
      </form>
      <p>
        Não tem uma conta? <Link to="/register">Crie uma aqui</Link>
      </p>
    </div>
  );
}

export default Login;