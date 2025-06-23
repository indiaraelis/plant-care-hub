// frontend/src/pages/Dashboard.js

import React, { useEffect, useState, } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

function Dashboard() {
  const [plants, setPlants] = useState([]);
  const navigate = useNavigate();

  // Função para buscar as plantas (útil para reutilizar após criar/editar/deletar)
  const fetchPlants = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const res = await axios.get('http://localhost:5000/api/plants', config);
      setPlants(res.data);
    } catch (error) {
      console.error('Erro ao buscar plantas:', error.response ? error.response.data : error.message);
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        toast.error('Sessão expirada ou inválida. Faça login novamente.');
        navigate('/login');
      } else {
        toast.error('Erro ao carregar plantas: ' + (error.response ? error.response.data.msg : error.message));
      }
    }
  };

useEffect(() => {
  fetchPlants();
}, [navigate, fetchPlants]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Função para deletar uma planta
  const handleDeletePlant = async (plantId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta planta?')) {
      return; // Cancela se o usuário não confirmar
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Você precisa estar logado para deletar plantas.');
      navigate('/login');
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      await axios.delete(`http://localhost:5000/api/plants/${plantId}`, config);
      toast.success('Planta excluída com sucesso!');
      fetchPlants(); // Atualiza a lista de plantas após a exclusão
    } catch (error) {
      console.error('Erro ao excluir planta:', error.response ? error.response.data : error.message);
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        toast.error('Sessão expirada. Faça login novamente.');
        navigate('/login');
      } else {
        toast.error('Erro ao excluir planta: ' + (error.response ? error.response.data.msg : error.message));
      }
    }
  };

  return (
    <div className="container">
      <h2>Suas Plantas</h2>
      <button onClick={handleLogout} style={{ float: 'right', marginBottom: '20px' }}>Sair</button>
      <div style={{ clear: 'both' }}></div> {/* Limpa o float para o conteúdo abaixo */}

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
              {plant.notes && (
                  <p>Notas: {plant.notes}</p>
              )}

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