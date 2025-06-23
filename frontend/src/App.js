// frontend/src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddPlant from './pages/AddPlant';
import EditPlant from './pages/EditPlant';
import NotFound from './pages/NotFound';
import Layout from './components/Layout'; // Importa o componente Layout
import './App.css';

function App() {
  return (
    <Router>
      <Layout> {/* Envolve as rotas com o Layout */}
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/add-plant" element={<AddPlant />} />
            <Route path="/edit-plant/:id" element={<EditPlant />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Layout>
    </Router>
  );
}

export default App;