// PlantAutocomplete.js
// Componente de autocomplete para seleção de plantas
// Permite busca por nome português ou científico

import React, { useState, useEffect, useRef } from 'react';
import { 
  searchPlantsByPortuguese, 
  searchPlantsByScientific, 
  getPlantById 
} from './PlantDatabase';

const PlantAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "Digite o nome da planta...",
  className = "",
  disabled = false,
  maxResults = 10 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedPlant, setSelectedPlant] = useState(null);
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Atualiza o input quando o valor externo muda
  useEffect(() => {
    if (value) {
      const plant = getPlantById(value);
      if (plant) {
        setInputValue(plant.commonNamePt);
        setSelectedPlant(plant);
      }
    } else {
      setInputValue('');
      setSelectedPlant(null);
    }
  }, [value]);

  // Função para buscar sugestões
  const searchPlants = (query) => {
    if (query.length < 2) {
      return [];
    }

    // Busca por nome português
    const portugueseResults = searchPlantsByPortuguese(query);
    
    // Busca por nome científico
    const scientificResults = searchPlantsByScientific(query);
    
    // Combina resultados, removendo duplicatas
    const allResults = [...portugueseResults];
    scientificResults.forEach(plant => {
      if (!allResults.find(p => p.id === plant.id)) {
        allResults.push(plant);
      }
    });

    // Ordena por relevância (nome português primeiro)
    return allResults
      .sort((a, b) => {
        const aMatchesPt = a.commonNamePt.toLowerCase().includes(query.toLowerCase());
        const bMatchesPt = b.commonNamePt.toLowerCase().includes(query.toLowerCase());
        
        if (aMatchesPt && !bMatchesPt) return -1;
        if (!aMatchesPt && bMatchesPt) return 1;
        
        return a.commonNamePt.localeCompare(b.commonNamePt, 'pt-BR');
      })
      .slice(0, maxResults);
  };

  const handleInputChange = (event) => {
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
      const results = searchPlants(newValue);
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
    // Delay para permitir clique nas sugestões
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const handleFocus = () => {
    if (inputValue.length >= 2) {
      const results = searchPlants(inputValue);
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
              onClick={() => handleSuggestionClick(plant)}
            >
              <div className="suggestion-main">
                <span className="plant-name-pt">{plant.commonNamePt}</span>
                {plant.alternativeNamesPt.length > 0 && (
                  <span className="plant-alternatives">
                    ({plant.alternativeNamesPt.join(', ')})
                  </span>
                )}
              </div>
              <div className="suggestion-scientific">
                <em>{plant.scientificName}</em>
              </div>
              <div className="suggestion-family">
                {plant.family}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Informações da planta selecionada */}
      {selectedPlant && (
        <PlantInfo plant={selectedPlant} />
      )}
    </div>
  );
};

// Componente para exibir informações da planta selecionada
const PlantInfo = ({ plant }) => {
  return (
    <div className="plant-info">
      <div className="plant-info-item">
        <strong>Nome científico:</strong> <em>{plant.scientificName}</em>
      </div>
      <div className="plant-info-item">
        <strong>Família:</strong> {plant.family}
      </div>
      <div className="plant-info-item">
        <strong>Origem:</strong> {plant.origin}
      </div>
      <div className="plant-info-item">
        <strong>Hábito:</strong> {plant.habit}
      </div>
      {plant.alternativeNamesPt.length > 0 && (
        <div className="plant-info-item">
          <strong>Outros nomes:</strong> {plant.alternativeNamesPt.join(', ')}
        </div>
      )}
    </div>
  );
};

export default PlantAutocomplete;

// CSS sugerido (adicionar ao seu arquivo CSS)
/*
.plant-autocomplete {
  position: relative;
  width: 100%;
}

.autocomplete-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.autocomplete-input {
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
}

.autocomplete-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.autocomplete-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.clear-button {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-button:hover {
  color: #666;
}

.suggestions-container {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f8f9fa;
}

.suggestion-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.plant-name-pt {
  font-weight: 500;
  color: #333;
}

.plant-alternatives {
  font-size: 12px;
  color: #666;
}

.suggestion-scientific {
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
}

.suggestion-family {
  font-size: 11px;
  color: #999;
}

.plant-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
}

.plant-info-item {
  margin-bottom: 5px;
}

.plant-info-item:last-child {
  margin-bottom: 0;
}
*/

