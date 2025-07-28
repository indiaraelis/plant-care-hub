// PlantSelectSimple.js
// Componente de select simples para seleção de plantas
// Exibe nomes em português, mas usa nome científico como valor

import React, { useState, useEffect } from 'react';
import { getAllPlantsOrderedByPortuguese, getPlantById } from './PlantDatabase';

const PlantSelectSimple = ({ 
  value, 
  onChange, 
  placeholder = "Selecione uma planta...",
  className = "",
  disabled = false 
}) => {
  const [plants, setPlants] = useState([]);

  useEffect(() => {
    // Carrega todas as plantas ordenadas por nome português
    const allPlants = getAllPlantsOrderedByPortuguese();
    setPlants(allPlants);
  }, []);

  const handleChange = (event) => {
    const selectedId = event.target.value;
    
    if (selectedId === "") {
      // Valor vazio selecionado
      onChange({
        id: "",
        scientificName: "",
        commonNamePt: "",
        plant: null
      });
    } else {
      // Busca a planta selecionada
      const selectedPlant = getPlantById(selectedId);
      
      if (selectedPlant) {
        onChange({
          id: selectedPlant.id,
          scientificName: selectedPlant.scientificName,
          commonNamePt: selectedPlant.commonNamePt,
          plant: selectedPlant
        });
      }
    }
  };

  return (
    <div className={`plant-select-simple ${className}`}>
      <select 
        value={value || ""} 
        onChange={handleChange}
        disabled={disabled}
        className="plant-select-dropdown"
      >
        <option value="">{placeholder}</option>
        {plants.map((plant) => (
          <option 
            key={plant.id} 
            value={plant.id}
            title={`${plant.scientificName} - ${plant.family}`}
          >
            {plant.commonNamePt}
            {plant.alternativeNamesPt.length > 0 && 
              ` (${plant.alternativeNamesPt.join(', ')})`
            }
          </option>
        ))}
      </select>
      
      {/* Informações adicionais da planta selecionada */}
      {value && (
        <PlantInfo plantId={value} />
      )}
    </div>
  );
};

// Componente para exibir informações da planta selecionada
const PlantInfo = ({ plantId }) => {
  const plant = getPlantById(plantId);
  
  if (!plant) return null;

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
      {plant.alternativeNamesPt.length > 0 && (
        <div className="plant-info-item">
          <strong>Outros nomes:</strong> {plant.alternativeNamesPt.join(', ')}
        </div>
      )}
    </div>
  );
};

export default PlantSelectSimple;

// CSS sugerido (adicionar ao seu arquivo CSS)
/*
.plant-select-simple {
  width: 100%;
}

.plant-select-dropdown {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
  cursor: pointer;
}

.plant-select-dropdown:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.plant-select-dropdown:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
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

