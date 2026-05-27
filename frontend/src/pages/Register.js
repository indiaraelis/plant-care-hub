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
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/auth/register', { username, email, password });
      if (res.data.token) localStorage.setItem('token', res.data.token);
      login(res.data);
      toast.success(`Bem-vinda, ${res.data.username}! Vamos adicionar sua primeira planta.`);
      navigate('/add-plant');
    } catch (error) {
      toast.error(error.response?.data?.msg ?? 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="intro-section">
        <h2>Seu jardim começa aqui.</h2>
        <p>Crie uma conta gratuita e nunca mais esqueça de regar.</p>
      </div>

      <h2>Criar conta</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome de usuário</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Como você quer ser chamada?"
            autoComplete="username"
          />
        </div>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="seu@email.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta e começar'}
        </button>
      </form>
      <p className="text-sm text-center mt-3">
        Já tem uma conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}

export default Register;
