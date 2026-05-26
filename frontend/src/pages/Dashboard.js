// frontend/src/pages/Dashboard.js

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, BarChart2, Bell, BellOff, Camera, CheckCircle, Clock, Droplets, Leaf, Luggage, MapPin, Pencil, Search, Settings, Trash2, X } from 'lucide-react';
import { getCareStatus, statusLabel, statusBadgeClass, statusIconProps } from '../utils/careStatus';
import { useNotifications } from '../hooks/useNotifications';

const LUCIDE_ICONS = { AlertCircle, CheckCircle, Clock, Droplets, Leaf };

const FILTER_OPTIONS = [
  { value: 'all',     label: 'Todas' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'today',   label: 'Hoje' },
  { value: 'ok',      label: 'Em dia' },
];

function CareBadge({ lastDate, freqDays, type }) {
  const { status, daysLeft } = getCareStatus(lastDate, freqDays);
  if (status === 'na') return null;
  const label = statusLabel(status, daysLeft, type);
  const iconProps = statusIconProps(status, type);
  const Icon = iconProps ? LUCIDE_ICONS[iconProps.icon] : null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusBadgeClass(status)}`}>
      {Icon && <Icon size={12} className={`flex-shrink-0 ${iconProps.colorClass}`} />}
      {label}
    </span>
  );
}

function UrgentBanner({ plants }) {
  const urgent = plants.filter(p => {
    const w = getCareStatus(p.lastWatered, p.wateringFrequencyDays);
    const f = getCareStatus(p.lastFertilized, p.fertilizingFrequencyDays);
    return w.status === 'overdue' || w.status === 'today' || f.status === 'overdue' || f.status === 'today';
  });

  if (urgent.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-yellow-300 bg-yellow-50 px-5 py-4">
      <p className="text-yellow-800 font-semibold mb-2 text-sm text-left mt-0">
        {urgent.length} planta{urgent.length !== 1 ? 's precisam' : ' precisa'} de atenção hoje:
      </p>
      <ul className="list-none m-0 p-0 flex flex-col gap-1">
        {urgent.map(p => {
          const w = getCareStatus(p.lastWatered, p.wateringFrequencyDays);
          const f = getCareStatus(p.lastFertilized, p.fertilizingFrequencyDays);
          const needsWater = w.status === 'overdue' || w.status === 'today';
          const needsFert  = f.status === 'overdue'  || f.status === 'today';
          return (
            <li key={p._id} className="text-sm text-yellow-800 text-left flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0 text-yellow-700" />
              <span className="font-medium">{p.name}</span>
              {needsWater && <span className="text-yellow-700">rega</span>}
              {needsFert  && <span className="text-yellow-700">adubação</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlantCard({ plant, onWater, onFertilize, onDelete }) {
  const wStatus = getCareStatus(plant.lastWatered, plant.wateringFrequencyDays).status;

  const cardBorder =
    wStatus === 'overdue' ? 'border-red-200' :
    wStatus === 'today'   ? 'border-yellow-200' : 'border-mint-light';

  return (
    <div className={`plant-item flex flex-col justify-between ${cardBorder}`}>
      {plant.photoUrl && (
        <div className="-mx-5 -mt-5 mb-4 rounded-t-2xl overflow-hidden" style={{ height: '140px' }}>
          <img src={plant.photoUrl} alt={plant.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link to={`/plants/${plant._id}`} className="text-deep-forest no-underline hover:underline"><h3 className="text-lg leading-tight mb-0">{plant.name}</h3></Link>
          {plant.location && (
            <span className="flex items-center gap-1 text-xs text-text-muted whitespace-nowrap mt-1">
              <MapPin size={11} /> {plant.location}
            </span>
          )}
        </div>
        {plant.species && plant.species !== 'Desconhecida' && (
          <p className="text-xs italic text-text-muted mt-0 mb-3 text-left">{plant.species}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          <CareBadge lastDate={plant.lastWatered} freqDays={plant.wateringFrequencyDays} type="rega" />
          <CareBadge lastDate={plant.lastFertilized} freqDays={plant.fertilizingFrequencyDays} type="adubação" />
        </div>

        <p className="text-xs text-text-muted text-left mt-0 mb-1">
          Rega a cada {plant.wateringFrequencyDays} dia{plant.wateringFrequencyDays !== 1 ? 's' : ''}
          {' · '}última: {new Date(plant.lastWatered).toLocaleDateString('pt-BR')}
        </p>
        {plant.fertilizingFrequencyDays > 0 && (
          <p className="text-xs text-text-muted text-left mt-0 mb-1">
            Adubação a cada {plant.fertilizingFrequencyDays} dia{plant.fertilizingFrequencyDays !== 1 ? 's' : ''}
            {plant.lastFertilized ? ` · última: ${new Date(plant.lastFertilized).toLocaleDateString('pt-BR')}` : ''}
          </p>
        )}
        {plant.notes && (
          <p className="text-xs text-text-muted text-left mt-2 mb-0 line-clamp-2">{plant.notes}</p>
        )}
      </div>

      <div className="plant-actions mt-4 flex-wrap">
        <button
          onClick={() => onWater(plant._id, plant.name)}
          className="small-button flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
        >
          <Droplets size={13} /> Reguei
        </button>
        {plant.fertilizingFrequencyDays > 0 && (
          <button
            onClick={() => onFertilize(plant._id, plant.name)}
            className="small-button flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
          >
            <Leaf size={13} /> Adubei
          </button>
        )}
        <Link to={`/edit-plant/${plant._id}`} className="button-link small-button edit-button flex items-center gap-1.5">
          <Pencil size={13} /> Editar
        </Link>
        <button onClick={() => onDelete(plant._id)} className="small-button delete-button flex items-center gap-1.5">
          <Trash2 size={13} /> Excluir
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const [plants, setPlants] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { permission, enabled, requestPermission, disableNotifications } = useNotifications(plants);

  const handleNotificationToggle = async () => {
    if (enabled) {
      disableNotifications();
    } else if (permission === 'denied') {
      toast.warn('Notificações bloqueadas. Habilite nas configurações do navegador.');
    } else {
      await requestPermission();
    }
  };

  const fetchPlants = useCallback(async () => {
    try {
      const res = await API.get('/api/plants');
      setPlants(res.data);
    } catch (error) {
      toast.error('Erro ao carregar plantas: ' + (error.response?.data?.msg ?? error.message));
    }
  }, []);

  useEffect(() => { fetchPlants(); }, [fetchPlants]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleWater = async (plantId, plantName) => {
    try {
      const res = await API.patch(`/api/plants/${plantId}/water`);
      setPlants(prev => prev.map(p => p._id === plantId ? res.data : p));
      toast.success(`${plantName} regada!`);
    } catch (error) {
      toast.error('Erro ao registrar rega: ' + (error.response?.data?.msg ?? error.message));
    }
  };

  const handleFertilize = async (plantId, plantName) => {
    try {
      const res = await API.patch(`/api/plants/${plantId}/fertilize`);
      setPlants(prev => prev.map(p => p._id === plantId ? res.data : p));
      toast.success(`${plantName} adubada!`);
    } catch (error) {
      toast.error('Erro ao registrar adubação: ' + (error.response?.data?.msg ?? error.message));
    }
  };

  const handleDelete = async (plantId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta planta?')) return;
    try {
      await API.delete(`/api/plants/${plantId}`);
      setPlants(prev => prev.filter(p => p._id !== plantId));
      toast.success('Planta removida.');
    } catch (error) {
      toast.error('Erro ao excluir: ' + (error.response?.data?.msg ?? error.message));
    }
  };

  const filtered = useMemo(() => {
    return plants
      .filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.species || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
      })
      .filter(p => {
        if (filter === 'all') return true;
        const w = getCareStatus(p.lastWatered, p.wateringFrequencyDays);
        const f = getCareStatus(p.lastFertilized, p.fertilizingFrequencyDays);
        if (filter === 'overdue') return w.status === 'overdue' || f.status === 'overdue';
        if (filter === 'today')   return w.status === 'today'   || f.status === 'today';
        if (filter === 'ok')      return w.status === 'ok'      && (f.status === 'ok' || f.status === 'na');
        return true;
      });
  }, [plants, search, filter]);

  return (
    <div className="container" style={{ maxWidth: '1100px' }}>
      <div className="flex items-center justify-between mb-5 gap-4">
        <h2 className="mb-0 text-left" style={{ background: 'none', WebkitTextFillColor: 'inherit', color: 'inherit' }}>
          {user ? `Jardim de ${user.username}` : 'Meu Jardim'}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {'Notification' in window && (
            <button
              onClick={handleNotificationToggle}
              title={enabled ? 'Desativar notificações' : 'Ativar notificações'}
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-colors ${
                enabled
                  ? 'bg-emerald-leaf/10 border-emerald-leaf text-emerald-leaf'
                  : 'bg-white border-mint-light text-text-muted hover:border-sage-green'
              }`}
            >
              {enabled ? <Bell size={16} /> : <BellOff size={16} />}
            </button>
          )}
          <Link to="/stats" className="flex items-center justify-center w-9 h-9 rounded-xl border border-mint-light bg-white hover:border-sage-green text-text-muted hover:text-deep-forest transition-colors" title="Estatísticas do jardim">
            <BarChart2 size={16} />
          </Link>
          <Link to="/viagem" className="flex items-center justify-center w-9 h-9 rounded-xl border border-mint-light bg-white hover:border-sage-green text-text-muted hover:text-deep-forest transition-colors" title="Modo viagem">
            <Luggage size={16} />
          </Link>
          <Link to="/account" className="flex items-center justify-center w-9 h-9 rounded-xl border border-mint-light bg-white hover:border-sage-green text-text-muted hover:text-deep-forest transition-colors" title="Minha conta">
            <Settings size={16} />
          </Link>
          <button onClick={handleLogout} className="w-auto px-5 py-2 text-sm">Sair</button>
        </div>
      </div>

      <UrgentBanner plants={plants} />

      {plants.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, espécie ou cômodo..."
              className="pl-9 pr-8"
              style={{ minHeight: '44px', padding: '10px 32px 10px 36px' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-auto p-0 bg-transparent border-none shadow-none text-text-muted hover:text-text-primary" style={{ minHeight: 'auto' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`w-auto px-4 text-sm transition-all ${
                  filter === opt.value
                    ? 'bg-emerald-leaf text-white'
                    : 'bg-white text-text-primary border border-mint-light hover:border-sage-green'
                }`}
                style={{ minHeight: '44px' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {plants.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-5xl mb-3 mt-0">🌱</p>
          <p className="text-text-muted text-lg font-medium mt-0 mb-1">Seu jardim ainda está em silêncio.</p>
          <p className="text-text-muted text-sm mt-0 mb-8">Adicione sua primeira planta e dê início a essa história verde.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 mx-auto" style={{ maxWidth: '440px' }}>
            <Link to="/add-plant" className="no-underline group">
              <div className="rounded-2xl border-2 border-dashed border-sage-green bg-sage-green/5 group-hover:bg-sage-green/10 p-5 text-center transition-colors">
                <Camera size={24} className="text-emerald-leaf mx-auto mb-2" />
                <p className="font-semibold text-deep-forest text-sm mt-0 mb-1">Identificar por foto</p>
                <p className="text-xs text-text-muted mt-0 mb-0">Tire uma foto e a IA identifica e sugere os cuidados</p>
              </div>
            </Link>
            <Link to="/add-plant" className="no-underline group">
              <div className="rounded-2xl border-2 border-dashed border-mint-light group-hover:border-sage-green bg-white group-hover:bg-sage-green/5 p-5 text-center transition-colors">
                <Search size={24} className="text-sage-green mx-auto mb-2" />
                <p className="font-semibold text-deep-forest text-sm mt-0 mb-1">Buscar pelo nome</p>
                <p className="text-xs text-text-muted mt-0 mb-0">130 espécies na base local com sugestões de rega</p>
              </div>
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-muted mt-0">Nenhuma planta encontrada para "{search || filter}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          {filtered.map(plant => (
            <PlantCard
              key={plant._id}
              plant={plant}
              onWater={handleWater}
              onFertilize={handleFertilize}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Link to="/add-plant" className="button-link">+ Nova planta no jardim</Link>
    </div>
  );
}

export default Dashboard;

