// frontend/src/pages/NotFound.js

import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="container text-center mt-12">
      <p className="text-6xl mb-4 mt-0">🌿</p>
      <h2>Página não encontrada</h2>
      <p className="text-text-muted">Parece que você se perdeu no jardim. Não tem problema — até as melhores trilhas às vezes somem.</p>
      <Link to="/dashboard" className="button-link inline-block mt-4">Voltar ao jardim</Link>
    </div>
  );
}

export default NotFound;