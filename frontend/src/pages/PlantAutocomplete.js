// PlantAutocomplete.js
// Componente de autocomplete para seleção de plantas
// Permite busca por nome português ou científico, e agora, busca externa (opcional)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  searchPlantsByPortuguese, 
  searchPlantsByScientific, 
  getPlantById 
} from './PlantDatabase'; // Assumindo que PlantDatabase.js existe

const PlantAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "Digite o nome da planta...",
  className = "",
  disabled = false,
  maxResults = 10,
  // Nova prop: função para buscar em uma API externa (ex: Trefle.io)
  onSearchExternal = null, 
  // Nova prop: booleano para indicar se deve buscar externamente
  useExternalSearch = false 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [loadingExternal, setLoadingExternal] = useState(false); // Novo estado para carregamento externo
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Atualiza o input quando o valor externo muda
  useEffect(() => {
    if (value) {
      // Verifica se o ID é de uma planta externa (Trefle)
      if (value.startsWith('trefle-')) {
        // Se for externa, não podemos usar getPlantById diretamente.
        // Precisaríamos de um mecanismo para armazenar ou buscar plantas Trefle por ID.
        // Por simplicidade, se for externa e o valor for definido, apenas exibe o nome comum
        // que foi previamente selecionado, sem buscar detalhes adicionais aqui.
        // Em um cenário real, você poderia ter um cache ou uma API para buscar detalhes de Trefle por ID.
        setInputValue(selectedPlant?.commonNamePt || ''); // Usa o nome da planta já selecionada
      } else {
        // Se for ID local
        const plant = getPlantById(value); 
        if (plant) {
          setInputValue(plant.commonNamePt);
          setSelectedPlant(plant);
        }
      }
    } else {
      setInputValue('');
      setSelectedPlant(null);
    }
  }, [value, selectedPlant]); // Adicionado selectedPlant como dependência

  // Função para buscar sugestões (local ou externa)
  const searchPlants = useCallback(async (query) => {
    if (query.length < 2) {
      return [];
    }

    let results = [];

    // Prioriza a busca na base de dados local
    const portugueseResults = searchPlantsByPortuguese(query);
    const scientificResults = searchPlantsByScientific(query);
    
    results = [...portugueseResults];
    scientificResults.forEach(plant => {
      if (!results.find(p => p.id === plant.id)) {
        results.push(plant);
      }
    });

    // Se houver uma função de busca externa e for para usá-la
    if (useExternalSearch && onSearchExternal && results.length === 0) {
      setLoadingExternal(true);
      try {
        // Chama a função de busca externa
        const externalData = await onSearchExternal(query);
        // Mapeia os resultados externos para o formato interno esperado
        const mappedExternalResults = externalData.map(plant => ({
          id: `trefle-${plant.id}`, // Prefixo para evitar conflito de IDs
          commonNamePt: plant.common_name || plant.scientific_name,
          scientificName: plant.scientific_name,
          family: plant.family,
          origin: plant.distribution?.native?.join(', ') || 'N/A', // Exemplo de como Trefle pode retornar
          habit: plant.growth?.form || 'N/A',
          alternativeNamesPt: [], // Trefle pode não ter outros nomes em PT
          imageUrl: plant.image_url, // Adiciona URL da imagem
          isExternal: true, // Flag para identificar planta externa
          originalTrefleData: plant // Mantém os dados originais do Trefle para referência
        }));
        results = [...results, ...mappedExternalResults];
      } catch (error) {
        console.error('Erro ao buscar plantas externas:', error);
        // Tratar erro de busca externa
      } finally {
        setLoadingExternal(false);
      }
    }

    // Ordena por relevância (nome português primeiro para resultados locais)
    // Para resultados externos, a ordem pode ser diferente ou já vir ordenada
    return results
      .sort((a, b) => {
        // Prioriza resultados locais
        if (!a.isExternal && b.isExternal) return -1;
        if (a.isExternal && !b.isExternal) return 1;

        // Dentro do mesmo tipo (local ou externo), ordena por nome
        const aMatchesPt = (a.commonNamePt || '').toLowerCase().includes(query.toLowerCase());
        const bMatchesPt = (b.commonNamePt || '').toLowerCase().includes(query.toLowerCase());
        
        if (aMatchesPt && !bMatchesPt) return -1;
        if (!aMatchesPt && bMatchesPt) return 1;
        
        return (a.commonNamePt || '').localeCompare((b.commonNamePt || ''), 'pt-BR');
      })
      .slice(0, maxResults);
  }, [onSearchExternal, useExternalSearch, maxResults]);

  const handleInputChange = async (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    
    if (newValue.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedPlant(null);
      onChange({
        id: "",
        scientificName: "",
        commonNamePt: "",
        plant: null
      });
    } else {
      const results = await searchPlants(newValue); // Aguarda a busca
      setSuggestions(results);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (plant) => {
    setInputValue(plant.commonNamePt);
    setSelectedPlant(plant);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    onChange({
      id: plant.id,
      scientificName: plant.scientificName,
      commonNamePt: plant.commonNamePt,
      plant: plant
    });
  };

  const handleKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
        
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
        
      default:
        break;
    }
  };

  const handleBlur = (event) => {
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const handleFocus = async () => {
    if (inputValue.length >= 2) {
      const results = await searchPlants(inputValue); // Aguarda a busca
      setSuggestions(results);
      setShowSuggestions(true);
    }
  };

  const clearSelection = () => {
    setInputValue('');
    setSelectedPlant(null);
    setShowSuggestions(false);
    setSuggestions([]);
    
    onChange({
      id: "",
      scientificName: "",
      commonNamePt: "",
      plant: null
    });
    
    inputRef.current?.focus();
  };

  return (
    <div className={`plant-autocomplete ${className}`}>
      <div className="autocomplete-input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="autocomplete-input"
          autoComplete="off"
        />
        
        {inputValue && (
          <button
            type="button"
            onClick={clearSelection}
            className="clear-button"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="suggestions-container">
          {suggestions.map((plant, index) => (
            <div
              key={plant.id}
              className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()} // Evita que o blur feche antes do click
              onClick={() => handleSuggestionClick(plant)}
            >
              <div className="suggestion-main">
                <span className="plant-name-pt">{plant.commonNamePt}</span>
                {plant.alternativeNamesPt && plant.alternativeNamesPt.length > 0 && (
                  <span className="plant-alternatives">
                    ({plant.alternativeNamesPt.join(', ')})
                  </span>
                )}
                {plant.isExternal && <span className="external-tag">(Trefle.io)</span>}
              </div>
              <div className="suggestion-scientific">
                <em>{plant.scientificName}</em>
              </div>
              <div className="suggestion-family">
                {plant.family}
              </div>
              {plant.imageUrl && plant.isExternal && (
                <img 
                  src={plant.imageUrl} 
                  alt={plant.commonNamePt} 
                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', marginLeft: 'auto' }} 
                />
              )}
            </div>
          ))}
        </div>
      )}
      {loadingExternal && (
        <div className="loading-message">Buscando na base internacional...</div>
      )}

      {selectedPlant && (
        <PlantInfo plant={selectedPlant} />
      )}
    </div>
  );
};

// Componente para exibir informações da planta selecionada (pode ser ajustado para exibir dados de Trefle)
const PlantInfo = ({ plant }) => {
  if (!plant) return null;

  return (
    <div className="plant-info">
      <div className="plant-info-item">
        <strong>Nome científico:</strong> <em>{plant.scientificName}</em>
      </div>
      <div className="plant-info-item">
        <strong>Família:</strong> {plant.family || 'N/A'}
      </div>
      {plant.origin && (
        <div className="plant-info-item">
          <strong>Origem:</strong> {plant.origin}
        </div>
      )}
      {plant.habit && (
        <div className="plant-info-item">
          <strong>Hábito:</strong> {plant.habit}
        </div>
      )}
      {plant.alternativeNamesPt && plant.alternativeNamesPt.length > 0 && (
        <div className="plant-info-item">
          <strong>Outros nomes:</strong> {plant.alternativeNamesPt.join(', ')}
        </div>
      )}
       {plant.isExternal && plant.originalTrefleData?.image_url && (
        <div className="plant-info-item">
          <strong>Imagem:</strong> <a href={plant.originalTrefleData.image_url} target="_blank" rel="noopener noreferrer">Ver Imagem (Trefle.io)</a>
        </div>
      )}
    </div>
  );
};

export default PlantAutocomplete;