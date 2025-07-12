// frontend/src/pages/EditPlant.js

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import API from '../api'; // axios configurado
import { toast } from 'react-toastify';

function EditPlant() {
  const { id } = useParams();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [wateringFrequencyDays, setWateringFrequencyDays] = useState('');
  const [lastWatered, setLastWatered] = useState('');
  const [fertilizingFrequencyDays, setFertilizingFrequencyDays] = useState('');
  const [lastFertilized, setLastFertilized] = useState('');
  const [notes, setNotes] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlant = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Você precisa estar logado para editar plantas.');
        navigate('/login');
        return;
      }

      try {
        const config = {
          headers: { Authorization: `Bearer ${token}` },
        };
        const res = await API.get(`/api/plants/${id}`, config);
        const plantData = res.data;

        setName(plantData.name);
        setSpecies(plantData.species);
        setWateringFrequencyDays(plantData.wateringFrequencyDays);
        setLastWatered(plantData.lastWatered ? new Date(plantData.lastWatered).toISOString().split('T')[0] : '');
        setFertilizingFrequencyDays(plantData.fertilizingFrequencyDays || '');
        setLastFertilized(plantData.lastFertilized ? new Date(plantData.lastFertilized).toISOString().split('T')[0] : '');
        setNotes(plantData.notes || '');
      } catch (error) {
        console.error('Erro ao buscar dados da planta:', error.response ? error.response.data : error.message);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          toast.error('Sessão expirada. Faça login novamente.');
          navigate('/login');
        } else {
          toast.error('Erro ao carregar dados da planta: ' + (error.response ? error.response.data.msg : error.message));
          navigate('/dashboard');
        }
      }
    };

    fetchPlant();
  }, [id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Você precisa estar logado para editar plantas.');
      navigate('/login');
      return;
    }

    if (!name || !wateringFrequencyDays) {
      toast.error('Nome da planta e frequência de rega são obrigatórios!');
      return;
    }
    if (isNaN(wateringFrequencyDays) || parseInt(wateringFrequencyDays) < 1) {
      toast.error('Frequência de rega deve ser um número maior que 0.');
      return;
    }
    if (fertilizingFrequencyDays && isNaN(fertilizingFrequencyDays)) {
      toast.error('Frequência de adubação deve ser um número.');
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      const plantData = {
        name,
        species,
        wateringFrequencyDays: parseInt(wateringFrequencyDays),
        lastWatered: lastWatered || null,
        fertilizingFrequencyDays: fertilizingFrequencyDays ? parseInt(fertilizingFrequencyDays) : 0,
        lastFertilized: lastFertilized || null,
        notes,
      };

      const res = await API.put(`/api/plants/${id}`, plantData, config);
      console.log('Planta atualizada com sucesso:', res.data);
      toast.success('Planta atualizada com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Erro ao atualizar planta:', error.response ? error.response.data : error.message);
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        toast.error('Sessão expirada. Faça login novamente.');
        navigate('/login');
      } else {
        toast.error('Erro ao atualizar planta: ' + (error.response ? error.response.data.msg : error.message));
      }
    }
  };

  return (
    <div className="container">
      <h2>Editar Planta</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome da Planta:</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Espécie:</label>
          <input type="text" value={species} onChange={(e) => setSpecies(e.target.value)} />
        </div>
        <div>
          <label>Frequência de Rega (dias):</label>
          <input type="number" value={wateringFrequencyDays} onChange={(e) => setWateringFrequencyDays(e.target.value)} required min="1" />
        </div>
        <div>
          <label>Última Rega:</label>
          <input type="date" value={lastWatered} onChange={(e) => setLastWatered(e.target.value)} />
        </div>
        <div>
          <label>Frequência de Adubação (dias - 0 para não adubar):</label>
          <input type="number" value={fertilizingFrequencyDays} onChange={(e) => setFertilizingFrequencyDays(e.target.value)} min="0" />
        </div>
        <div>
          <label>Última Adubação:</label>
          <input type="date" value={lastFertilized} onChange={(e) => setLastFertilized(e.target.value)} />
        </div>
        <div>
          <label>Notas:</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="4"></textarea>
        </div>
        <button type="submit">Salvar Alterações</button>
      </form>
      <p><Link to="/dashboard">Voltar para o Dashboard</Link></p>
    </div>
  );
}

export default EditPlant;
