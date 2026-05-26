// frontend/src/pages/EditPlant.js

import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { ImagePlus } from 'lucide-react';

function EditPlant() {
  const { id } = useParams();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [wateringFrequencyDays, setWateringFrequencyDays] = useState('');
  const [lastWatered, setLastWatered] = useState('');
  const [fertilizingFrequencyDays, setFertilizingFrequencyDays] = useState('');
  const [lastFertilized, setLastFertilized] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlant = async () => {
      try {
        const res = await API.get(`/api/plants/${id}`);
        const plantData = res.data;

        setName(plantData.name);
        setSpecies(plantData.species);
        setWateringFrequencyDays(plantData.wateringFrequencyDays);
        setLastWatered(plantData.lastWatered ? new Date(plantData.lastWatered).toISOString().split('T')[0] : '');
        setFertilizingFrequencyDays(plantData.fertilizingFrequencyDays || '');
        setLastFertilized(plantData.lastFertilized ? new Date(plantData.lastFertilized).toISOString().split('T')[0] : '');
        setNotes(plantData.notes || '');
        setPhotoUrl(plantData.photoUrl || null);
      } catch (error) {
        toast.error('Erro ao carregar dados da planta: ' + (error.response ? error.response.data.msg : error.message));
        if (error.response?.status !== 401) navigate('/dashboard');
      }
    };

    fetchPlant();
  }, [id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      const plantData = {
        name,
        species,
        wateringFrequencyDays: parseInt(wateringFrequencyDays),
        lastWatered: lastWatered || null,
        fertilizingFrequencyDays: fertilizingFrequencyDays ? parseInt(fertilizingFrequencyDays) : 0,
        lastFertilized: lastFertilized || null,
        notes,
      };

      await API.put(`/api/plants/${id}`, plantData);
      toast.success('Planta atualizada com sucesso!');
      navigate(`/plants/${id}`);
    } catch (error) {
      toast.error('Erro ao atualizar planta: ' + (error.response ? error.response.data.msg : error.message));
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
      <h2>Editar planta</h2>

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
          <label>Nome da Planta:</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Espécie:</label>
          <input type="text" value={species} onChange={(e) => setSpecies(e.target.value)} />
        </div>
        <div>
          <label>Frequência de Rega (dias):</label>
          <input type="number" value={wateringFrequencyDays} onChange={(e) => setWateringFrequencyDays(e.target.value)} required min="1" />
        </div>
        <div>
          <label>Última Rega:</label>
          <input type="date" value={lastWatered} onChange={(e) => setLastWatered(e.target.value)} />
        </div>
        <div>
          <label>Frequência de Adubação (dias - 0 para não adubar):</label>
          <input type="number" value={fertilizingFrequencyDays} onChange={(e) => setFertilizingFrequencyDays(e.target.value)} min="0" />
        </div>
        <div>
          <label>Última Adubação:</label>
          <input type="date" value={lastFertilized} onChange={(e) => setLastFertilized(e.target.value)} />
        </div>
        <div>
          <label>Notas:</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="4"></textarea>
        </div>
        <button type="submit">Salvar alterações</button>
      </form>
      <p><Link to="/dashboard">← Voltar ao jardim</Link></p>
    </div>
  );
}

export default EditPlant;
