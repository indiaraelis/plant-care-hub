// PlantAutocomplete.js
// Busca por nome popular (PT) ou científico na base local (+580 espécies).
// Quando não há resultado, orienta o usuário a digitar e usar a IA no passo 2.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  searchPlantsByPortuguese,
  searchPlantsByScientific,
  getPlantById,
} from '../data/PlantDatabase';

const PlantAutocomplete = ({
  value,
  onChange,
  placeholder = 'Digite o nome da planta...',
  className = '',
  disabled = false,
  maxResults = 10,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [noResults, setNoResults] = useState(false);

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

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
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchPlants = useCallback((query) => {
    if (query.length < 2) return [];
    const ptResults = searchPlantsByPortuguese(query);
    const sciResults = searchPlantsByScientific(query);
    const merged = [...ptResults];
    sciResults.forEach(p => { if (!merged.find(x => x.id === p.id)) merged.push(p); });
    return merged
      .sort((a, b) => {
        const aMatch = (a.commonNamePt || '').toLowerCase().startsWith(query.toLowerCase());
        const bMatch = (b.commonNamePt || '').toLowerCase().startsWith(query.toLowerCase());
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return (a.commonNamePt || '').localeCompare(b.commonNamePt || '', 'pt-BR');
      })
      .slice(0, maxResults);
  }, [maxResults]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setSelectedPlant(null);

    if (val.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      setNoResults(false);
      onChange({ id: '', scientificName: '', commonNamePt: '', plant: null });
      return;
    }

    const results = searchPlants(val);
    setSuggestions(results);
    setShowSuggestions(true);
    setNoResults(val.trim().length >= 2 && results.length === 0);
    setSelectedIndex(-1);

    // Propagate free-text so AddPlant can use it as the plant name
    onChange({ id: '', scientificName: '', commonNamePt: val, plant: null });
  };

  const handleSuggestionClick = (plant) => {
    setInputValue(plant.commonNamePt);
    setSelectedPlant(plant);
    setShowSuggestions(false);
    setNoResults(false);
    setSelectedIndex(-1);
    onChange({ id: plant.id, scientificName: plant.scientificName, commonNamePt: plant.commonNamePt, plant });
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => p < suggestions.length - 1 ? p + 1 : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => p > 0 ? p - 1 : suggestions.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (selectedIndex >= 0) handleSuggestionClick(suggestions[selectedIndex]); }
    else if (e.key === 'Escape') { setShowSuggestions(false); setSelectedIndex(-1); }
  };

  const handleBlur = () => { setTimeout(() => { setShowSuggestions(false); setSelectedIndex(-1); }, 200); };

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
    setNoResults(false);
    onChange({ id: '', scientificName: '', commonNamePt: '', plant: null });
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
          <button type="button" onClick={clearSelection} className="clear-button" tabIndex={-1}>×</button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="suggestions-container">
          {suggestions.map((plant, index) => (
            <div
              key={plant.id}
              className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionClick(plant)}
            >
              <div className="suggestion-main">
                <span className="plant-name-pt">{plant.commonNamePt}</span>
                {plant.alternativeNamesPt?.length > 0 && (
                  <span className="plant-alternatives">({plant.alternativeNamesPt.join(', ')})</span>
                )}
              </div>
              <div className="suggestion-scientific"><em>{plant.scientificName}</em></div>
              <div className="suggestion-family">{plant.family}</div>
            </div>
          ))}
        </div>
      )}

      {noResults && (
        <p className="text-xs text-text-muted mt-1 mb-0 text-left px-1">
          Não encontramos "<strong>{inputValue}</strong>" na nossa base.{' '}
          Continue com esse nome e use <strong>Sugerir com IA</strong> no próximo passo — a IA indica os cuidados pra você.
        </p>
      )}
    </div>
  );
};

export default PlantAutocomplete;
