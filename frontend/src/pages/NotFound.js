// frontend/src/pages/NotFound.js

import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>404 - Página Não Encontrada</h2>
      <p>Parece que você se perdeu no jardim.</p>
      <Link to="/">Voltar para o Início</Link>
    </div>
  );
}

export default NotFound;