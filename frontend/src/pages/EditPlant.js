// frontend/src/pages/EditPlant.js

import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { ImagePlus } from 'lucide-react';

const WATERING_PRESETS = [
  { label: 'A cada 2 dias', value: 2 },
  { label: 'Semanal',       value: 7 },
  { label: 'Quinzenal',     value: 15 },
  { label: 'Mensal',        value: 30 },
];

const LOCATION_OPTIONS = ['Sala', 'Varanda', 'Quarto', 'Escritório', 'Cozinha', 'Banheiro', 'Jardim', 'Outro'];

function EditPlant() {
  const { id } = useParams();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [wateringPreset, setWateringPreset] = useState(null);
  const [wateringCustom, setWateringCustom] = useState('');
  const [lastWatered, setLastWatered] = useState('');
  const [noFertilizing, setNoFertilizing] = useState(false);
  const [fertilizingPreset, setFertilizingPreset] = useState(null);
  const [fertilizingCustom, setFertilizingCustom] = useState('');
  const [lastFertilized, setLastFertilized] = useState('');
  const [location, setLocation] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlant = async () => {
      try {
        const res = await API.get(`/api/plants/${id}`);
        const p = res.data;

        setName(p.name);
        setSpecies(p.species || '');
        setLastWatered(p.lastWatered ? new Date(p.lastWatered).toISOString().split('T')[0] : '');
        setLastFertilized(p.lastFertilized ? new Date(p.lastFertilized).toISOString().split('T')[0] : '');
        setLocation(p.location || '');
        setAcquisitionDate(p.acquisitionDate ? new Date(p.acquisitionDate).toISOString().split('T')[0] : '');
        setNotes(p.notes || '');
        setPhotoUrl(p.photoUrl || null);

        // Watering: map to preset or custom
        const wDays = p.wateringFrequencyDays;
        if (WATERING_PRESETS.some(pr => pr.value === wDays)) {
          setWateringPreset(wDays);
        } else {
          setWateringCustom(String(wDays || ''));
        }

        // Fertilizing
        const fDays = p.fertilizingFrequencyDays;
        if (!fDays || fDays === 0) {
          setNoFertilizing(true);
        } else if (WATERING_PRESETS.some(pr => pr.value === fDays)) {
          setFertilizingPreset(fDays);
        } else {
          setFertilizingCustom(String(fDays));
        }
      } catch (error) {
        toast.error('Erro ao carregar dados da planta: ' + (error.response?.data?.msg ?? error.message));
        if (error.response?.status !== 401) navigate('/dashboard');
      }
    };

    fetchPlant();
  }, [id, navigate]);

  const getWateringDays = () => {
    if (wateringPreset) return wateringPreset;
    const v = parseInt(wateringCustom);
    return isNaN(v) ? null : v;
  };

  const getFertilizingDays = () => {
    if (noFertilizing) return 0;
    if (fertilizingPreset) return fertilizingPreset;
    const v = parseInt(fertilizingCustom);
    return isNaN(v) ? 0 : v;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const wateringDays = getWateringDays();
    if (!name || !wateringDays || wateringDays < 1) {
      toast.error('Nome e frequência de rega são obrigatórios.');
      return;
    }

    try {
      await API.put(`/api/plants/${id}`, {
        name,
        species,
        wateringFrequencyDays: wateringDays,
        lastWatered: lastWatered || null,
        fertilizingFrequencyDays: getFertilizingDays(),
        lastFertilized: lastFertilized || null,
        location: location || undefined,
        acquisitionDate: acquisitionDate || undefined,
        notes,
      });
      toast.success('Planta atualizada!');
      navigate(`/plants/${id}`);
    } catch (error) {
      toast.error('Erro ao atualizar planta: ' + (error.response?.data?.msg ?? error.message));
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) { toast.error('Use JPEG, PNG ou WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5 MB.'); return; }
    const formData = new FormData();
    formData.append('photo', file);
    setUploading(true);
    try {
      const res = await API.patch(`/api/plants/${id}/photo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPhotoUrl(res.data.photoUrl);
      toast.success('Foto atualizada!');
    } catch { toast.error('Erro ao enviar foto.'); }
    finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  return (
    <div className="container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="mb-0 text-left" style={{ background: 'none', WebkitTextFillColor: 'inherit', color: 'inherit' }}>
          Editar planta
        </h2>
        <Link to={`/plants/${id}`} className="text-sm text-text-muted hover:text-text-primary">← Voltar</Link>
      </div>

      {/* Photo section */}
      <div className="mb-6 text-left">
        {photoUrl && (
          <div className="mb-3 rounded-2xl overflow-hidden border border-mint-light" style={{ maxHeight: '200px', maxWidth: '340px' }}>
            <img src={photoUrl} alt="foto" className="w-full h-full object-cover" style={{ maxHeight: '200px' }} />
          </div>
        )}
        <label className="inline-flex items-center gap-2 cursor-pointer small-button bg-sage-green/10 text-deep-forest border border-mint-light hover:border-sage-green" style={{ borderRadius: '10px', padding: '8px 14px', fontSize: '0.85rem' }}>
          <ImagePlus size={14} /> {uploading ? 'Enviando...' : photoUrl ? 'Trocar foto' : 'Adicionar foto'}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
            disabled={uploading}
          />
        </label>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome da planta</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <label>Nome científico (opcional)</label>
          {species && (
            <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-4 py-2.5 mb-2 text-left">
              <p className="text-xs text-text-muted mt-0 mb-0 italic">{species}</p>
            </div>
          )}
          <input
            type="text"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            placeholder="Ex: Monstera deliciosa"
          />
        </div>

        {/* Watering frequency */}
        <div>
          <label>Com que frequência você rega?</label>
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

        <div>
          <label>Última adubação</label>
          <input type="date" value={lastFertilized} onChange={(e) => setLastFertilized(e.target.value)} disabled={noFertilizing} />
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

        <div>
          <label>Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="4" placeholder="Cuidados especiais, comportamento..." />
        </div>

        <button type="submit">Salvar alterações</button>
      </form>
    </div>
  );
}

export default EditPlant;
