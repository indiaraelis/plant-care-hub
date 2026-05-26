// frontend/src/pages/NotFound.js

import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="container text-center mt-12">
      <h2>404 - Página Não Encontrada</h2>
      <p>Parece que você se perdeu no jardim.</p>
      <Link to="/">Voltar para o Início</Link>
    </div>
  );
}

export default NotFound;