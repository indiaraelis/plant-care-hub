// frontend/src/pages/Login.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api'; // import axios configurado
import { toast } from 'react-toastify';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/api/auth/login', { email, password });
      console.log('Login bem-sucedido:', res.data);
      localStorage.setItem('token', res.data.token);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Erro no login:', error.response ? error.response.data : error.message);
      toast.error('Erro no login: ' + (error.response ? error.response.data.msg : error.message));
    }
  };

  return (
    <div className="container">
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
