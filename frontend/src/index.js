// frontend/src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import 'react-toastify/dist/ReactToastify.css'; // Carrega o CSS da biblioteca React-Toastify primeiro
import './index.css'; // Carrega o CSS personalizado DEPOIS, para ter prioridade
import App from './App';
// import reportWebVitals from './reportWebVitals'; // Manter comentado ou remover se não estiver usando

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);