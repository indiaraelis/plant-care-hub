// AddPlantImproved.js
// Versão melhorada do componente AddPlant com seletor de plantas em português
// e integração aprimorada com busca Trefle.io via PlantAutocomplete

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api'; // Seu cliente Axios
import { toast } from 'react-toastify';
import PlantAutocomplete from './PlantAutocomplete';
import PlantSelectSimple from './PlantSelectSimple';

function AddPlant() {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [wateringFrequencyDays, setWateringFrequencyDays] = useState('');
  const [fertilizingFrequencyDays, setFertilizingFrequencyDays] = useState('');
  const [notes, setNotes] = useState('');
  
  // Estado para o seletor de plantas
  const [selectedPlantInfo, setSelectedPlantInfo] = useState({ 
    id: "", 
    scientificName: "", 
    commonNamePt: "", 
    plant: null 
  });
  const [useAutocomplete, setUseAutocomplete] = useState(true);
  // Novo estado para controlar se a busca externa deve ser usada no PlantAutocomplete
  const [useExternalSearchInAutocomplete, setUseExternalSearchInAutocomplete] = useState(false);

  const navigate = useNavigate();

  // Função para buscar na API Trefle (passada para PlantAutocomplete)
  const handleTrefleSearchInAutocomplete = async (query) => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Você precisa estar logado para buscar plantas.');
      navigate('/login');
      throw new Error('Usuário não autenticado'); // Lança erro para interromper a busca
    }

    if (!query.trim()) {
      return [];
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      // A rota do seu backend que faz a requisição para a API Trefle
      const res = await API.get(`/api/trefle/search?query=${encodeURIComponent(query)}`, config);
      return res.data; // Retorna os dados crus do Trefle
    } catch (error) {
      console.error('Erro ao buscar plantas externas (Trefle):', error.response ? error.response.data : error.message);
      toast.error('Erro ao buscar plantas externas: ' + (error.response ? error.response.data.msg : error.message));
      return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Você precisa estar logado para adicionar plantas.');
      navigate('/login');
      return;
    }

    // Validações
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

      const res = await API.post('/api/plants', plantData, config);
      console.log('Planta adicionada com sucesso:', res.data);
      toast.success('Planta adicionada com sucesso!');
      navigate('/dashboard');
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

  // Função para lidar com a seleção de planta do PlantAutocomplete ou PlantSelectSimple
  const handlePlantSelection = (selection) => {
    setSelectedPlantInfo(selection);
    if (selection.plant) {
      setName(selection.commonNamePt);
      setSpecies(selection.scientificName);
      
      // Adiciona informações da planta nas notas
      let plantInfo = `Informações da planta:
Nome científico: ${selection.plant.scientificName || 'N/A'}
Família: ${selection.plant.family || 'N/A'}
Origem: ${selection.plant.origin || 'N/A'}
Hábito: ${selection.plant.habit || 'N/A'}`;
      
      if (selection.plant.alternativeNamesPt && selection.plant.alternativeNamesPt.length > 0) {
        plantInfo += `\nOutros nomes: ${selection.plant.alternativeNamesPt.join(', ')}`;
      }

      // Adiciona informações específicas do Trefle.io se a planta for externa
      if (selection.plant.isExternal && selection.plant.originalTrefleData) {
        const trefleData = selection.plant.originalTrefleData;
        plantInfo += `\n\nDados do Trefle.io:
Etimologia: ${trefleData.etymology || 'N/A'}
Duração: ${trefleData.duration || 'N/A'}
Folhagem persistente: ${trefleData.foliage?.evergreen ? 'Sim' : 'Não'}
Tolerância à sombra: ${trefleData.growth?.light_tolerated || 'N/A'}
Link Trefle: ${trefleData.links?.plant || 'N/A'}`;
        // Você pode adicionar mais campos do Trefle.io conforme necessário
      }

      setNotes(plantInfo);
      toast.success(`Dados de "${selection.commonNamePt}" pré-preenchidos.`);
    } else {
      // Limpa os campos se nenhuma planta foi selecionada
      setName('');
      setSpecies('');
      setNotes('');
      toast.info('Nenhuma planta selecionada.');
    }
  };

  return (
    <div className="container">
      <h2>Adicionar Nova Planta</h2>

      {/* Seletor de plantas em português */}
      <div className="plant-selector-section">
        <h3>Selecionar Planta</h3>
        
        {/* Toggle entre autocomplete e select simples */}
        <div className="selector-toggle">
          <label>
            <input
              type="radio"
              name="selectorType"
              checked={useAutocomplete}
              onChange={() => {
                setUseAutocomplete(true);
                // Quando muda para autocomplete, define o uso da busca externa baseada na checkbox
                // Isso evita que a busca externa seja ativada no select simples
                setUseExternalSearchInAutocomplete(document.getElementById('toggleExternalSearch').checked);
              }}
            />
            Busca com autocomplete (Base local &amp; Internacional)
          </label>
          <label>
            <input
              type="radio"
              name="selectorType"
              checked={!useAutocomplete}
              onChange={() => {
                setUseAutocomplete(false);
                // Desativa a busca externa ao mudar para o select simples
                setUseExternalSearchInAutocomplete(false);
              }}
            />
            Lista simples (Base local)
          </label>
        </div>

        {/* Toggle para ativar/desativar busca externa no autocomplete */}
        {useAutocomplete && (
          <div className="external-search-toggle">
            <label>
              <input
                type="checkbox"
                id="toggleExternalSearch"
                checked={useExternalSearchInAutocomplete}
                onChange={(e) => setUseExternalSearchInAutocomplete(e.target.checked)}
              />
              Incluir busca na base internacional (Trefle.io)
            </label>
          </div>
        )}

        {/* Componente de seleção */}
        {useAutocomplete ? (
          <PlantAutocomplete
            value={selectedPlantInfo.id}
            onChange={handlePlantSelection}
            placeholder="Digite o nome da planta em português ou científico..."
            className="plant-selector"
            onSearchExternal={handleTrefleSearchInAutocomplete} // Passa a função de busca externa
            useExternalSearch={useExternalSearchInAutocomplete} // Passa o controle do uso da busca externa
          />
        ) : (
          <PlantSelectSimple
            value={selectedPlantInfo.id}
            onChange={handlePlantSelection}
            placeholder="Selecione uma planta..."
            className="plant-selector"
          />
        )}
      </div>

      <hr style={{ margin: '30px 0' }} />

      {/* Formulário de detalhes da planta */}
      <h3>Detalhes da Sua Planta</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome da Planta (Ex: Costela de Adão):</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
            placeholder="Nome que você dará para sua planta"
          />
        </div>
        <div>
          <label>Espécie (Ex: Monstera deliciosa):</label>
          <input 
            type="text" 
            value={species} 
            onChange={(e) => setSpecies(e.target.value)} 
            placeholder="Nome científico da espécie"
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
            placeholder="Quantos dias entre cada rega"
          />
        </div>
        <div>
          <label>Frequência de Adubação (dias - 0 para não adubar):</label>
          <input 
            type="number" 
            value={fertilizingFrequencyDays} 
            onChange={(e) => setFertilizingFrequencyDays(e.target.value)} 
            min="0" 
            placeholder="Quantos dias entre cada adubação"
          />
        </div>
        <div>
          <label>Notas (opcional):</label>
          <textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            rows="6"
            placeholder="Informações adicionais sobre sua planta"
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