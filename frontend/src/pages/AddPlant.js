// frontend/src/pages/AddPlant.js

import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { Camera, Loader } from 'lucide-react';
import PlantAutocomplete from '../components/PlantAutocomplete';
import { suggestCareFromHabit } from '../utils/careDefaults';

// Quick-pick options for watering frequency
const WATERING_PRESETS = [
  { label: 'A cada 2 dias', value: 2 },
  { label: 'Semanal',       value: 7 },
  { label: 'Quinzenal',     value: 15 },
  { label: 'Mensal',        value: 30 },
];

const LOCATION_OPTIONS = ['Sala', 'Varanda', 'Quarto', 'Escritório', 'Cozinha', 'Banheiro', 'Jardim', 'Outro'];

// Returns today's date formatted as YYYY-MM-DD for date inputs
function today() {
  return new Date().toISOString().split('T')[0];
}

function AddPlant() {
  // Step 1 — identification
  const [step, setStep] = useState(1);
  const [selectedPlantInfo, setSelectedPlantInfo] = useState({ id: '', scientificName: '', commonNamePt: '', plant: null });
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [speciesFromAutocomplete, setSpeciesFromAutocomplete] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const photoInputRef = useRef(null);

  // Step 2 — care details
  const [careSuggestion, setCareSuggestion] = useState(null); // { wateringDays, fertilizingDays, hint }
  const [wateringPreset, setWateringPreset] = useState(null);
  const [wateringCustom, setWateringCustom] = useState('');
  const [lastWatered, setLastWatered] = useState(today());
  const [noFertilizing, setNoFertilizing] = useState(false);
  const [fertilizingPreset, setFertilizingPreset] = useState(null);
  const [fertilizingCustom, setFertilizingCustom] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const navigate = useNavigate();

  const handleTrefleSearch = async (query) => {
    if (!query.trim()) return [];
    try {
      const res = await API.get(`/api/trefle/search?query=${encodeURIComponent(query)}`);
      return res.data;
    } catch {
      return [];
    }
  };

  const handlePlantSelection = (selection) => {
    setSelectedPlantInfo(selection);
    if (selection.plant) {
      setName(selection.commonNamePt);
      setSpecies(selection.scientificName);
      setSpeciesFromAutocomplete(true);

      // Derive care suggestion from botanical data
      const suggestion = suggestCareFromHabit(
        selection.plant.habit,
        selection.plant.origin
      );
      setCareSuggestion(suggestion);

      // Pre-select the suggested watering preset if it maps to a quick-pick
      if (suggestion.presetMatches) {
        setWateringPreset(suggestion.wateringDays);
        setWateringCustom('');
      }

      // Notes: leave clean — user can add their own
      setNotes('');
    } else {
      setSpeciesFromAutocomplete(false);
      setCareSuggestion(null);
    }
  };

  const getWateringDays = () => {
    if (wateringPreset) return wateringPreset;
    const v = parseInt(wateringCustom);
    return isNaN(v) ? null : v;
  };

  const getFertilizingDays = () => {
    if (noFertilizing) return 0;
    if (fertilizingPreset) return fertilizingPreset;
    const v = parseInt(fertilizingCustom);
    return isNaN(v) ? null : v;
  };

  const handleStep1Next = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome da planta antes de continuar.');
      return;
    }
    setStep(2);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      toast.error('Use uma imagem JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5 MB.');
      return;
    }

    setIdentifying(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await API.post('/api/identify', { imageBase64: base64, mimeType: file.type });
      const data = res.data;

      if (!data.confident || !data.commonName) {
        toast.warn(data.careHint || 'Não foi possível identificar a planta. Tente outra foto ou preencha manualmente.');
        return;
      }

      // Pre-fill form from Gemini response
      setName(data.commonName);
      setSpecies(data.scientificName || '');
      setSpeciesFromAutocomplete(!!data.scientificName);

      const suggestion = {
        wateringDays: data.suggestedWateringDays || 7,
        fertilizingDays: data.suggestedFertilizingDays || 30,
        hint: data.careHint || '',
        presetMatches: [2, 7, 15, 30].includes(data.suggestedWateringDays),
      };
      setCareSuggestion(suggestion);
      if (suggestion.presetMatches) {
        setWateringPreset(suggestion.wateringDays);
        setWateringCustom('');
      } else if (data.suggestedWateringDays) {
        setWateringPreset(null);
        setWateringCustom(String(data.suggestedWateringDays));
      }
      if (data.suggestedFertilizingDays === 0) {
        setNoFertilizing(true);
      } else if (data.suggestedFertilizingDays) {
        setNoFertilizing(false);
        if ([2, 7, 15, 30].includes(data.suggestedFertilizingDays)) {
          setFertilizingPreset(data.suggestedFertilizingDays);
        } else {
          setFertilizingCustom(String(data.suggestedFertilizingDays));
        }
      }

      toast.success(`Planta identificada: ${data.commonName}!`);
    } catch (error) {
      toast.error(error.response?.data?.msg ?? 'Erro ao identificar a planta.');
    } finally {
      setIdentifying(false);
      // Reset input so the same file can be re-selected if needed
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const wateringDays = getWateringDays();
    if (!wateringDays || wateringDays < 1) {
      toast.error('Selecione ou informe a frequência de rega.');
      return;
    }

    try {
      await API.post('/api/plants', {
        name: name.trim(),
        species: species.trim(),
        wateringFrequencyDays: wateringDays,
        lastWatered: lastWatered || undefined,
        fertilizingFrequencyDays: getFertilizingDays() ?? 0,
        acquisitionDate: acquisitionDate || undefined,
        location: location || undefined,
        notes: notes.trim(),
      });
      toast.success(`"${name}" adicionada ao jardim!`);
      navigate('/dashboard');
    } catch (error) {
      toast.error('Erro ao adicionar planta: ' + (error.response?.data?.msg ?? error.message));
    }
  };

  return (
    <div className="container">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-sm text-text-muted">
        <span className={`font-semibold ${step === 1 ? 'text-emerald-leaf' : 'text-text-muted'}`}>1. Qual é a planta?</span>
        <span className="text-text-muted">→</span>
        <span className={`font-semibold ${step === 2 ? 'text-emerald-leaf' : 'text-text-muted'}`}>2. Como você cuida dela?</span>
      </div>

      {step === 1 && (
        <>
          <h2>Nova planta no jardim</h2>

          <div className="add-plant-section">
            <h2>Qual é a planta?</h2>
            <p className="text-left mt-0 mb-4 text-text-muted text-sm">
              Busque pelo nome em português ou científico — ou tire uma foto.
            </p>

            {/* Photo identify button */}
            <div className="mb-4">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
                id="photo-input"
              />
              <label
                htmlFor="photo-input"
                className={`flex items-center justify-center gap-2 w-full rounded-2xl border-2 border-dashed py-4 cursor-pointer transition-colors text-sm font-medium ${
                  identifying
                    ? 'border-mint-light text-text-muted cursor-wait'
                    : 'border-sage-green text-emerald-leaf hover:bg-sage-green/10'
                }`}
              >
                {identifying
                  ? <><Loader size={16} className="animate-spin" /> Identificando...</>
                  : <><Camera size={16} /> Identificar por foto</>
                }
              </label>
              <p className="text-xs text-text-muted text-center mt-1 mb-0">
                Sugestão por IA — confirme e ajuste abaixo
              </p>
            </div>

            <PlantAutocomplete
              value={selectedPlantInfo.id}
              onChange={handlePlantSelection}
              placeholder="Ex: Costela de Adão, Pothos, Samambaia..."
              onSearchExternal={handleTrefleSearch}
              useExternalSearch={true}
            />
          </div>

          <form onSubmit={handleStep1Next}>
            <div>
              <label>Nome da planta</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSpeciesFromAutocomplete(false); }}
                required
                placeholder="Como você quer chamar ela?"
              />
            </div>

            {species && (
              <div>
                <label>Nome científico</label>
                <input
                  type="text"
                  value={species}
                  onChange={speciesFromAutocomplete ? undefined : (e) => setSpecies(e.target.value)}
                  readOnly={speciesFromAutocomplete}
                  className={speciesFromAutocomplete ? 'opacity-60 cursor-default' : ''}
                  placeholder="Nome científico da espécie"
                />
              </div>
            )}

            <button type="submit">Continuar</button>
          </form>

          <p><Link to="/dashboard">Voltar</Link></p>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Como você cuida dela?</h2>

          {/* Botanical info card — shown when a plant was selected from our database */}
          {selectedPlantInfo.plant && (
            <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-5 py-4 mb-5 text-left">
              <p className="text-sm font-semibold text-deep-forest mt-0 mb-1">
                {name}
                {selectedPlantInfo.plant.family ? ` · ${selectedPlantInfo.plant.family}` : ''}
              </p>
              {selectedPlantInfo.plant.origin && selectedPlantInfo.plant.origin !== 'Não informado' && selectedPlantInfo.plant.origin !== 'Desconhecida' && (
                <p className="text-xs text-text-muted mt-0 mb-0">Origem: {selectedPlantInfo.plant.origin}</p>
              )}
              {selectedPlantInfo.plant.habit && selectedPlantInfo.plant.habit !== 'Não informado' && (
                <p className="text-xs text-text-muted mt-0.5 mb-0">Hábito: {selectedPlantInfo.plant.habit}</p>
              )}
              {selectedPlantInfo.plant.alternativeNamesPt?.length > 0 && (
                <p className="text-xs text-text-muted mt-0.5 mb-0">Também conhecida como: {selectedPlantInfo.plant.alternativeNamesPt.join(', ')}</p>
              )}
            </div>
          )}

          {!selectedPlantInfo.plant && (
            <p className="text-left mt-0 mb-6 text-text-muted text-sm">
              Registrando agora: <strong>{name}</strong>{species ? ` (${species})` : ''}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            {/* Watering frequency */}
            <div>
              <label>Com que frequência você rega?</label>
              {careSuggestion && (
                <p className="text-xs text-text-muted mt-0 mb-2">
                  {careSuggestion.hint} <span className="opacity-60">Ajuste conforme seu ambiente.</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {WATERING_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setWateringPreset(p.value); setWateringCustom(''); }}
                    className={`w-auto px-4 py-2 text-sm rounded-xl border transition-all ${
                      wateringPreset === p.value
                        ? 'bg-emerald-leaf text-white border-emerald-leaf'
                        : 'bg-white text-text-primary border-mint-light hover:border-sage-green'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={wateringCustom}
                onChange={(e) => { setWateringCustom(e.target.value); setWateringPreset(null); }}
                min="1"
                placeholder="Ou digite o número de dias..."
              />
            </div>

            {/* Last watered */}
            <div>
              <label>Última rega</label>
              <input type="date" value={lastWatered} onChange={(e) => setLastWatered(e.target.value)} />
            </div>

            {/* Fertilizing */}
            <div>
              <label>Adubação</label>
              <label className="flex items-center gap-2 mb-3 cursor-pointer font-normal text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={noFertilizing}
                  onChange={(e) => { setNoFertilizing(e.target.checked); setFertilizingPreset(null); setFertilizingCustom(''); }}
                  className="w-4 h-4"
                />
                Essa planta não precisa de adubação
              </label>

              {!noFertilizing && (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {WATERING_PRESETS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => { setFertilizingPreset(p.value); setFertilizingCustom(''); }}
                        className={`w-auto px-4 py-2 text-sm rounded-xl border transition-all ${
                          fertilizingPreset === p.value
                            ? 'bg-emerald-leaf text-white border-emerald-leaf'
                            : 'bg-white text-text-primary border-mint-light hover:border-sage-green'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={fertilizingCustom}
                    onChange={(e) => { setFertilizingCustom(e.target.value); setFertilizingPreset(null); }}
                    min="1"
                    placeholder="Ou digite o número de dias..."
                  />
                </>
              )}
            </div>

            {/* Location */}
            <div>
              <label>Onde ela fica?</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">Selecione um cômodo (opcional)</option>
                {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Acquisition date */}
            <div>
              <label>Quando você a adquiriu? (opcional)</label>
              <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </div>

            {/* Notes */}
            <div>
              <label>Alguma observação?</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="4"
                placeholder="Onde ela fica, comportamento, cuidados especiais..."
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="bg-white text-text-primary border border-mint-light hover:border-sage-green w-auto px-6">
                Voltar
              </button>
              <button type="submit">Adicionar ao jardim</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default AddPlant;