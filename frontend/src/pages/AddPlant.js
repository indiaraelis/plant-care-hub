// frontend/src/pages/AddPlant.js

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

function AddPlant() {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [wateringFrequencyDays, setWateringFrequencyDays] = useState('');
  const [fertilizingFrequencyDays, setFertilizingFrequencyDays] = useState('');
  const [notes, setNotes] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Você precisa estar logado para adicionar plantas.');
      navigate('/login');
      return;
    }

    // Validação básica frontend (pode ser mais robusta)
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
        wateringFrequencyDays: parseInt(wateringFrequencyDays), // Converter para número
        fertilizingFrequencyDays: fertilizingFrequencyDays ? parseInt(fertilizingFrequencyDays) : 0, // Converter ou 0
        notes,
      };

      const res = await axios.post('http://localhost:5000/api/plants', plantData, config);
      console.log('Planta adicionada com sucesso:', res.data);
      toast.success('Planta adicionada com sucesso!');
      navigate('/dashboard'); // Volta para o dashboard após adicionar
    } catch (error) {
      console.error('Erro ao adicionar planta:', error.response ? error.response.data : error.message);
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        toast.error('Sessão expirada. Faça login novamente.');
        navigate('/login');
      } else {
        toast.error('Erro ao adicionar planta: ' + (error.response ? error.response.data.msg : error.message));
      }
    }
  };

  return (
    <div className="container">
      <h2>Adicionar Nova Planta</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome da Planta:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Espécie (Ex: Costela de Adão):</label>
          <input
            type="text"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          />
        </div>
        <div>
          <label>Frequência de Rega (dias):</label>
          <input
            type="number"
            value={wateringFrequencyDays}
            onChange={(e) => setWateringFrequencyDays(e.target.value)}
            required
            min="1"
          />
        </div>
        <div>
          <label>Frequência de Adubação (dias - 0 para não adubar):</label>
          <input
            type="number"
            value={fertilizingFrequencyDays}
            onChange={(e) => setFertilizingFrequencyDays(e.target.value)}
            min="0"
          />
        </div>
        <div>
          <label>Notas (opcional):</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="4"
          ></textarea>
        </div>
        <button type="submit">Adicionar Planta</button>
      </form>
      <p>
        <Link to="/dashboard">Voltar para o Dashboard</Link>
      </p>
    </div>
  );
}

export default AddPlant;