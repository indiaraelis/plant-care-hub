// frontend/src/pages/Account.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Change password form
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [changingPw, setChangingPw]             = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]           = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('A nova senha e a confirmação não coincidem.');
      return;
    }
    setChangingPw(true);
    try {
      await API.patch('/api/auth/password', { currentPassword, newPassword });
      toast.success('Senha alterada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.msg ?? 'Erro ao alterar senha.');
    } finally {
      setChangingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.username) {
      toast.error(`Digite seu nome de usuário "${user?.username}" para confirmar.`);
      return;
    }
    setDeleting(true);
    try {
      await API.delete('/api/auth/account');
      logout();
      navigate('/login');
      toast.success('Conta excluída.');
    } catch (error) {
      toast.error(error.response?.data?.msg ?? 'Erro ao excluir conta.');
      setDeleting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '560px' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="mb-0 text-left" style={{ background: 'none', WebkitTextFillColor: 'inherit', color: 'inherit' }}>
          Minha conta
        </h2>
        <Link to="/dashboard" className="text-sm text-text-muted hover:text-text-primary">← Voltar</Link>
      </div>

      {user && (
        <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-5 py-4 mb-8 text-left">
          <p className="text-sm font-semibold text-deep-forest mt-0 mb-0.5">{user.username}</p>
          <p className="text-xs text-text-muted mt-0 mb-0">{user.email}</p>
        </div>
      )}

      {/* Change password */}
      <div className="mb-8">
        <h3 className="text-base font-semibold text-deep-forest mb-4 mt-0 text-left">Alterar senha</h3>
        <form onSubmit={handleChangePassword}>
          <div>
            <label>Senha atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label>Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label>Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" disabled={changingPw} className="w-auto px-8">
            {changingPw ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5">
        <h3 className="text-base font-semibold text-red-700 mt-0 mb-2 text-left">Excluir conta</h3>
        <p className="text-sm text-red-600 text-left mt-0 mb-4">
          Esta ação é permanente. Todas as suas plantas e histórico de cuidados serão apagados.
        </p>
        <div className="mb-3">
          <label className="text-sm text-red-700">
            Digite <strong>{user?.username}</strong> para confirmar
          </label>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={user?.username}
            className="border-red-200 focus:border-red-400"
          />
        </div>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleting || deleteConfirm !== user?.username}
          className="w-auto px-8 bg-red-600 hover:bg-red-700 border-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? 'Excluindo...' : 'Excluir minha conta'}
        </button>
      </div>
    </div>
  );
}

export default Account;
