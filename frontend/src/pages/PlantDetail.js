// frontend/src/pages/PlantDetail.js
// Shows full info + watering/fertilizing heatmap for a single plant.

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { Droplets, Leaf, MapPin, Pencil, Trash2 } from 'lucide-react';
import { getCareStatus, statusBadgeClass, statusLabel } from '../utils/careStatus';

// ── Heatmap helpers ────────────────────────────────────────────────────────────

function buildWeekGrid(dates, weeks = 26) {
  // Build a map of ISO date string → count
  const counts = {};
  (dates || []).forEach((d) => {
    const key = new Date(d).toISOString().split('T')[0];
    counts[key] = (counts[key] || 0) + 1;
  });

  // Build a grid: [weeks] columns × 7 rows (Mon–Sun)
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
  const endOfGrid = new Date(today);
  endOfGrid.setDate(today.getDate() + (6 - dayOfWeek)); // end on Sunday

  const cells = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(endOfGrid);
      cell.setDate(endOfGrid.getDate() - w * 7 - (6 - d));
      const key = cell.toISOString().split('T')[0];
      col.push({ date: key, count: counts[key] || 0, future: cell > today });
    }
    cells.push(col);
  }
  return cells;
}

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function cellColor(count, future) {
  if (future) return 'bg-transparent';
  if (count === 0) return 'bg-mint-light/60';
  if (count === 1) return 'bg-sage-green';
  if (count === 2) return 'bg-emerald-leaf';
  return 'bg-deep-forest';
}

function Heatmap({ dates, label }) {
  const grid = buildWeekGrid(dates, 26);
  const total = (dates || []).length;

  // Month labels: detect month change at first day of each column
  const monthLabels = grid.map((col, i) => {
    const firstDay = col.find((c) => !c.future) || col[0];
    const d = new Date(firstDay.date);
    const prevCol = grid[i - 1];
    const prevFirst = prevCol ? (prevCol.find((c) => !c.future) || prevCol[0]) : null;
    const prevMonth = prevFirst ? new Date(prevFirst.date).getMonth() : -1;
    return d.getMonth() !== prevMonth ? MONTH_ABBR[d.getMonth()] : '';
  });

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-text-muted mb-2 text-left mt-0">
        {label} — {total} registro{total !== 1 ? 's' : ''} nos últimos 6 meses
      </p>
      <div className="overflow-x-auto pb-1">
        {/* Month row */}
        <div className="flex gap-0.5 mb-0.5 ml-0">
          {monthLabels.map((m, i) => (
            <div key={i} className="w-3 text-[9px] text-text-muted shrink-0">{m}</div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex gap-0.5">
          {grid.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-0.5">
              {col.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date}${cell.count > 0 ? ` — ${cell.count}×` : ''}`}
                  className={`w-3 h-3 rounded-[2px] shrink-0 ${cellColor(cell.count, cell.future)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function PlantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlant = useCallback(async () => {
    try {
      const res = await API.get(`/api/plants/${id}`);
      setPlant(res.data);
    } catch {
      toast.error('Planta não encontrada.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchPlant(); }, [fetchPlant]);

  const handleWater = async () => {
    try {
      const res = await API.patch(`/api/plants/${id}/water`);
      setPlant(res.data);
      toast.success('Rega registrada!');
    } catch {
      toast.error('Erro ao registrar rega.');
    }
  };

  const handleFertilize = async () => {
    try {
      const res = await API.patch(`/api/plants/${id}/fertilize`);
      setPlant(res.data);
      toast.success('Adubação registrada!');
    } catch {
      toast.error('Erro ao registrar adubação.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir esta planta permanentemente?')) return;
    try {
      await API.delete(`/api/plants/${id}`);
      toast.success('Planta removida.');
      navigate('/dashboard');
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  if (loading) return <div className="container"><p className="text-text-muted">Carregando...</p></div>;
  if (!plant) return null;

  const wStatus = getCareStatus(plant.lastWatered, plant.wateringFrequencyDays);
  const fStatus = getCareStatus(plant.lastFertilized, plant.fertilizingFrequencyDays);

  return (
    <div className="container" style={{ maxWidth: '700px' }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="mb-0 text-left" style={{ background: 'none', WebkitTextFillColor: 'inherit', color: 'inherit' }}>
            {plant.name}
          </h2>
          {plant.species && plant.species !== 'Desconhecida' && (
            <p className="text-sm italic text-text-muted mt-0.5 mb-0 text-left">{plant.species}</p>
          )}
          {plant.location && (
            <p className="flex items-center gap-1 text-xs text-text-muted mt-1 mb-0 text-left">
              <MapPin size={11} /> {plant.location}
            </p>
          )}
        </div>
        <Link to="/dashboard" className="text-sm text-text-muted hover:text-text-primary shrink-0 mt-1">← Jardim</Link>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        {wStatus.status !== 'na' && (
          <span className={`inline-flex items-center text-xs font-medium px-3 py-1 rounded-full ${statusBadgeClass(wStatus.status)}`}>
            <Droplets size={11} className="mr-1" />
            {statusLabel(wStatus.status, wStatus.daysLeft, 'rega')}
          </span>
        )}
        {fStatus.status !== 'na' && (
          <span className={`inline-flex items-center text-xs font-medium px-3 py-1 rounded-full ${statusBadgeClass(fStatus.status)}`}>
            <Leaf size={11} className="mr-1" />
            {statusLabel(fStatus.status, fStatus.daysLeft, 'adubação')}
          </span>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-6 text-sm text-left">
        <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-4 py-3">
          <p className="text-xs text-text-muted mt-0 mb-0.5">Rega</p>
          <p className="font-semibold text-deep-forest mt-0 mb-0">
            A cada {plant.wateringFrequencyDays} dia{plant.wateringFrequencyDays !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-text-muted mt-0.5 mb-0">
            Última: {plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString('pt-BR') : '—'}
          </p>
        </div>
        {plant.fertilizingFrequencyDays > 0 && (
          <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-4 py-3">
            <p className="text-xs text-text-muted mt-0 mb-0.5">Adubação</p>
            <p className="font-semibold text-deep-forest mt-0 mb-0">
              A cada {plant.fertilizingFrequencyDays} dia{plant.fertilizingFrequencyDays !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-text-muted mt-0.5 mb-0">
              Última: {plant.lastFertilized ? new Date(plant.lastFertilized).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
        )}
        {plant.acquisitionDate && (
          <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-4 py-3">
            <p className="text-xs text-text-muted mt-0 mb-0.5">Adquirida em</p>
            <p className="font-semibold text-deep-forest mt-0 mb-0">
              {new Date(plant.acquisitionDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
        )}
        {plant.notes && (
          <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-4 py-3 col-span-2">
            <p className="text-xs text-text-muted mt-0 mb-0.5">Observações</p>
            <p className="text-sm text-text-primary mt-0 mb-0">{plant.notes}</p>
          </div>
        )}
      </div>

      {/* Heatmaps */}
      <div className="mb-6">
        <Heatmap dates={plant.wateringHistory} label="Regas" />
        {plant.fertilizingFrequencyDays > 0 && (
          <Heatmap dates={plant.fertilizingHistory} label="Adubações" />
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={handleWater} className="flex items-center gap-1.5 w-auto px-5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
          <Droplets size={14} /> Reguei agora
        </button>
        {plant.fertilizingFrequencyDays > 0 && (
          <button onClick={handleFertilize} className="flex items-center gap-1.5 w-auto px-5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
            <Leaf size={14} /> Adubei agora
          </button>
        )}
        <Link to={`/edit-plant/${id}`} className="button-link flex items-center gap-1.5 w-auto px-5">
          <Pencil size={14} /> Editar
        </Link>
        <button onClick={handleDelete} className="flex items-center gap-1.5 w-auto px-5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
          <Trash2 size={14} /> Excluir
        </button>
      </div>
    </div>
  );
}

export default PlantDetail;
