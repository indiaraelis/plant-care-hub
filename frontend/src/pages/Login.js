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
      <div className="intro-section">
        <h2>Bem-vindo(a) ao Plant-Care Hub!</h2>
        <p>
          Se você é um(a) apaixonado(a) por plantas e busca uma forma eficiente de gerenciar e acompanhar o cuidado de cada uma delas, você está no lugar certo! O <strong>Plant-Care Hub</strong> é a sua ferramenta completa para simplificar a rotina de jardinagem e garantir que suas plantas prosperem.
        </p>
        <h3>O que você pode fazer aqui?</h3>
        <p>
          Ao criar sua conta e fazer login, você terá acesso a um <strong>painel personalizado</strong> onde poderá:
        </p>
        <ul>
          <li><strong>Gerenciar suas plantas</strong>: Adicione, edite e organize todas as suas plantas, registrando detalhes importantes como nome, espécie, e horários de rega e fertilização.</li>
          <li><strong>Acompanhar o cuidado</strong>: Mantenha um histórico das últimas regas e fertilizações, garantindo que suas plantas recebam a atenção necessária no momento certo.</li>
          <li><strong>Descobrir novas espécies</strong>: Utilize nossa integração com a <strong>API Trefle.io</strong> para pesquisar informações detalhadas sobre diversas espécies de plantas, enriquecendo seu conhecimento e ajudando você a cuidar ainda melhor da sua coleção.</li>
        </ul>
        <p>
          Nosso objetivo é tornar o cuidado com as plantas uma experiência mais fácil, organizada e prazerosa para você. Junte-se à nossa comunidade de amantes de plantas e comece a transformar a forma como você cuida do seu jardim!
        </p>
        <p>
          Faça login ou crie sua conta para começar a explorar todas as funcionalidades.
        </p>
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