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
      {value && !value.startsWith('trefle-') && ( // Não exibe PlantInfo para IDs Trefle aqui
        <PlantInfo plantId={value} />
      )}
    </div>
  );
};

// Componente para exibir informações da planta selecionada (apenas para plantas locais)
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