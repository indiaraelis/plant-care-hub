// frontend/src/pages/Dashboard.js

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const [plants, setPlants] = useState([]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fetchPlants = useCallback(async () => {
    try {
      const res = await API.get('/api/plants');
      setPlants(res.data);
    } catch (error) {
      toast.error('Erro ao carregar plantas: ' + (error.response ? error.response.data.msg : error.message));
    }
  }, []);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDeletePlant = async (plantId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta planta?')) {
      return;
    }

    try {
      await API.delete(`/api/plants/${plantId}`);
      toast.success('Planta excluída com sucesso!');
      fetchPlants();
    } catch (error) {
      toast.error('Erro ao excluir planta: ' + (error.response ? error.response.data.msg : error.message));
    }
  };

  return (
    <div className="container">
      <h2>Suas Plantas{user ? `, ${user.username}` : ''}</h2>
      <div className="flex justify-end mb-5">
        <button onClick={handleLogout} className="w-auto px-6">Sair</button>
      </div>

      {plants.length === 0 ? (
        <p>Você ainda não tem plantas cadastradas. Que tal adicionar uma?</p>
      ) : (
        <div className="plant-list">
          {plants.map((plant) => (
            <div key={plant._id} className="plant-item">
              <h3>{plant.name} ({plant.species})</h3>
              <p>Frequência de Rega: {plant.wateringFrequencyDays} dias</p>
              <p>Última Rega: {new Date(plant.lastWatered).toLocaleDateString()}</p>
              {plant.fertilizingFrequencyDays > 0 && (
                <p>Frequência de Adubação: {plant.fertilizingFrequencyDays} dias</p>
              )}
              {plant.lastFertilized && (
                <p>Última Adubação: {new Date(plant.lastFertilized).toLocaleDateString()}</p>
              )}
              {plant.notes && <p>Notas: {plant.notes}</p>}

              <div className="plant-actions">
                <Link to={`/edit-plant/${plant._id}`} className="button-link small-button edit-button">Editar</Link>
                <button onClick={() => handleDeletePlant(plant._id)} className="small-button delete-button">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link to="/add-plant" className="button-link">Adicionar Nova Planta</Link>
    </div>
  );
}

export default Dashboard;
