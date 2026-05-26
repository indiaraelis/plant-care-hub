// frontend/src/pages/ResetPassword.js

import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post(`/api/auth/reset-password/${token}`, { newPassword });
      toast.success(res.data.msg);
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.msg ?? 'Link inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '480px' }}>
      <h2>Nova senha</h2>
      <p className="text-text-muted text-left mt-0 mb-5 text-sm">
        Escolha uma senha com pelo menos 6 caracteres.
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Nova senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            autoFocus
          />
        </div>
        <div>
          <label>Confirmar nova senha</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Definir nova senha'}
        </button>
      </form>

      <p><Link to="/login">← Voltar ao login</Link></p>
    </div>
  );
}

export default ResetPassword;
