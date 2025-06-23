// frontend/src/pages/AddPlant.js

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

function AddPlant() {
  // Estados para o formulário de adição de planta
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [wateringFrequencyDays, setWateringFrequencyDays] = useState('');
  const [fertilizingFrequencyDays, setFertilizingFrequencyDays] = useState('');
  const [notes, setNotes] = useState('');

  // Estados para a funcionalidade de busca no Trefle.io
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false); // Para mostrar/ocultar a lista de resultados

  const navigate = useNavigate();

  // Função para lidar com o envio do formulário de adição de planta
  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Você precisa estar logado para adicionar plantas.');
      navigate('/login');
      return;
    }

    // Validação básica frontend
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
        fertilizingFrequencyDays: fertilizingFrequencyDays ? parseInt(fertilizingFrequencyDays) : 0,
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

  // Função para buscar plantas no Trefle.io através do backend
  const handleTrefleSearch = async (e) => {
    e.preventDefault(); // Evita recarregar a página no submit do formulário de busca

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Você precisa estar logado para buscar plantas.');
      navigate('/login');
      return;
    }

    if (!searchQuery.trim()) {
      toast.info('Por favor, digite um termo para buscar.');
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      // Faz a requisição para o seu backend, que então consulta o Trefle.io
      const res = await axios.get(`http://localhost:5000/api/trefle/search?query=${encodeURIComponent(searchQuery)}`, config);
      setSearchResults(res.data);
      setShowSearchResults(true); // Exibe os resultados
      if (res.data.length === 0) {
        toast.info('Nenhuma planta encontrada com este termo.');
      } else {
        toast.success(`${res.data.length} resultados encontrados.`);
      }
    } catch (error) {
      console.error('Erro ao buscar plantas externas:', error.response ? error.response.data : error.message);
      toast.error('Erro ao buscar plantas externas: ' + (error.response ? error.response.data.msg : error.message));
    }
  };

  // Função para preencher o formulário com dados da planta selecionada do Trefle.io
  const selectPlantFromSearch = (plant) => {
    setName(plant.common_name || plant.scientific_name || '');
    setSpecies(plant.scientific_name || plant.common_name || '');
    // Pode definir valores padrão para frequência ou deixar o usuário preencher
    setWateringFrequencyDays(''); // O usuário vai preencher
    setFertilizingFrequencyDays(''); // O usuário vai preencher
    setNotes(`Informações do Trefle.io:\nFamília: ${plant.family || 'N/A'}\nURL Imagem: ${plant.image_url || 'N/A'}`);
    setShowSearchResults(false); // Oculta os resultados após selecionar
    setSearchQuery(''); // Limpa o campo de busca
    toast.info(`Dados de "${plant.common_name || plant.scientific_name}" pré-preenchidos.`);
  };

  return (
    <div className="container">
      <h2>Adicionar Nova Planta</h2>

      {/* Seção de Busca no Trefle.io */}
      <div className="search-section">
        <h3>Buscar Plantas (Trefle.io)</h3>
        <form onSubmit={handleTrefleSearch}>
          <input
            type="text"
            placeholder="Ex: Rose, Orquídea, Basílio"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">Buscar</button>
        </form>

        {showSearchResults && searchResults.length > 0 && (
          <div className="search-results-list">
            <h4>Resultados da Busca:</h4>
            {searchResults.map((plant) => (
              <div key={plant.id} className="search-result-item" onClick={() => selectPlantFromSearch(plant)}>
                <strong>{plant.common_name || plant.scientific_name}</strong>
                <p>{plant.scientific_name && `(${plant.scientific_name})`}</p>
                {plant.image_url && <img src={plant.image_url} alt={plant.common_name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }} />}
              </div>
            ))}
          </div>
        )}
        {showSearchResults && searchResults.length === 0 && (
            <p>Nenhum resultado encontrado para a busca atual.</p>
        )}
      </div> {/* Fim da Seção de Busca */}

      <hr style={{ margin: '30px 0' }} /> {/* Separador */}

      {/* Formulário Principal de Adição de Planta */}
      <h3>Detalhes da Sua Planta</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome da Planta (Ex: Costela de Adão):</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Espécie (Ex: Monstera deliciosa):</label>
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