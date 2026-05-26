// frontend/src/pages/ForgotPassword.js

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.msg ?? 'Erro ao enviar e-mail.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="container" style={{ maxWidth: '480px' }}>
        <h2>Verifique seu e-mail</h2>
        <p className="text-text-muted text-left mt-0">
          Se <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir a senha em breve.
        </p>
        <p className="text-text-muted text-sm text-left">
          Não chegou? Verifique a caixa de spam ou <button
            type="button"
            onClick={() => setSent(false)}
            className="w-auto p-0 bg-transparent border-none shadow-none text-emerald-leaf hover:underline text-sm"
            style={{ minHeight: 'auto' }}
          >tente novamente</button>.
        </p>
        <p><Link to="/login">← Voltar ao login</Link></p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '480px' }}>
      <h2>Recuperar senha</h2>
      <p className="text-text-muted text-left mt-0 mb-5 text-sm">
        Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="seu@email.com"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
      </form>

      <p><Link to="/login">← Voltar ao login</Link></p>
    </div>
  );
}

export default ForgotPassword;
