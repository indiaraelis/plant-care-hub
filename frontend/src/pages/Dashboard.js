// frontend/src/pages/Dashboard.js

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle, Clock, Droplets, Leaf } from 'lucide-react';
import { getCareStatus, statusLabel, statusBadgeClass, statusIconProps } from '../utils/careStatus';

const LUCIDE_ICONS = { AlertCircle, CheckCircle, Clock, Droplets, Leaf };

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

function Dashboard() {
  const [plants, setPlants] = useState([]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fetchPlants = useCallback(async () => {
    try {
      const res = await API.get('/api/plants');
      setPlants(res.data);
    } catch (error) {
      toast.error('Erro ao carregar plantas: ' + (error.response ? error.response.data.msg : error.message));
    }
  }, []);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDeletePlant = async (plantId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta planta?')) {
      return;
    }
    try {
      await API.delete(`/api/plants/${plantId}`);
      toast.success('Planta excluída com sucesso!');
      fetchPlants();
    } catch (error) {
      toast.error('Erro ao excluir planta: ' + (error.response ? error.response.data.msg : error.message));
    }
  };

  return (
    <div className="container">
      <h2>Suas Plantas{user ? `, ${user.username}` : ''}</h2>
      <div className="flex justify-end mb-5">
        <button onClick={handleLogout} className="w-auto px-6">Sair</button>
      </div>

      <UrgentBanner plants={plants} />

      {plants.length === 0 ? (
        <p>Você ainda não tem plantas cadastradas. Que tal adicionar uma?</p>
      ) : (
        <div className="plant-list">
          {plants.map((plant) => (
            <div key={plant._id} className="plant-item">
              <h3>{plant.name} ({plant.species})</h3>

              <div className="flex flex-wrap gap-2 mb-3">
                <CareBadge lastDate={plant.lastWatered} freqDays={plant.wateringFrequencyDays} type="rega" />
                <CareBadge lastDate={plant.lastFertilized} freqDays={plant.fertilizingFrequencyDays} type="adubação" />
              </div>

              <p>Frequência de Rega: {plant.wateringFrequencyDays} dias</p>
              <p>Última Rega: {new Date(plant.lastWatered).toLocaleDateString('pt-BR')}</p>
              {plant.fertilizingFrequencyDays > 0 && (
                <p>Frequência de Adubação: {plant.fertilizingFrequencyDays} dias</p>
              )}
              {plant.lastFertilized && (
                <p>Última Adubação: {new Date(plant.lastFertilized).toLocaleDateString('pt-BR')}</p>
              )}
              {plant.notes && <p>Notas: {plant.notes}</p>}

              <div className="plant-actions">
                <Link to={`/edit-plant/${plant._id}`} className="button-link small-button edit-button">Editar</Link>
                <button onClick={() => handleDeletePlant(plant._id)} className="small-button delete-button">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link to="/add-plant" className="button-link">Adicionar Nova Planta</Link>
    </div>
  );
}

export default Dashboard;
