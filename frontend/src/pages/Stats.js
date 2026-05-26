// frontend/src/pages/Stats.js
// "Meu Jardim" — summary stats and streaks.

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { Droplets, Leaf, Sprout, Trophy } from 'lucide-react';

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function ageLabel(date) {
  if (!date) return '—';
  const days = daysAgo(date);
  if (days < 30) return `${days} dia${days !== 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mês${months !== 1 ? 'es' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} ano${years > 1 ? 's' : ''} e ${rem} mês${rem > 1 ? 'es' : ''}` : `${years} ano${years > 1 ? 's' : ''}`;
}

// Calculates the current consecutive-day streak from a sorted array of ISO date strings
function calcStreak(dates) {
  if (!dates || dates.length === 0) return 0;
  const unique = [...new Set(dates.map((d) => new Date(d).toISOString().split('T')[0]))].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (unique[0] !== today && unique[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    const diff = Math.round((prev - curr) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function StatCard({ icon: Icon, label, value, sub, color = 'emerald-leaf' }) {
  return (
    <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-5 py-4 text-left">
      <div className={`flex items-center gap-2 mb-1`}>
        <Icon size={16} className="text-emerald-leaf" />
        <p className="text-xs text-text-muted mt-0 mb-0 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-deep-forest mt-0 mb-0">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5 mb-0">{sub}</p>}
    </div>
  );
}

function Stats() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPlants = useCallback(async () => {
    try {
      const res = await API.get('/api/plants');
      setPlants(res.data);
    } catch {
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlants(); }, [fetchPlants]);

  if (loading) return <div className="container"><p className="text-text-muted">Carregando...</p></div>;

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalPlants = plants.length;

  const now = new Date();
  const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const wateringsThisMonth = plants.reduce((sum, p) => {
    const count = (p.wateringHistory || []).filter((d) => new Date(d) >= startOfMonth).length;
    return sum + count;
  }, 0);
  const fertilizingsThisMonth = plants.reduce((sum, p) => {
    const count = (p.fertilizingHistory || []).filter((d) => new Date(d) >= startOfMonth).length;
    return sum + count;
  }, 0);

  // Oldest plant by acquisitionDate, fallback to createdAt
  const oldest = [...plants]
    .filter((p) => p.acquisitionDate || p.createdAt)
    .sort((a, b) => new Date(a.acquisitionDate || a.createdAt) - new Date(b.acquisitionDate || b.createdAt))[0];

  // Overall watering streak (any plant watered each day)
  const allWateringDates = plants.flatMap((p) => p.wateringHistory || []);
  const streak = calcStreak(allWateringDates);

  // Top plant by most waterings this month
  const topPlant = [...plants].sort((a, b) => {
    const ca = (a.wateringHistory || []).filter((d) => new Date(d) >= startOfMonth).length;
    const cb = (b.wateringHistory || []).filter((d) => new Date(d) >= startOfMonth).length;
    return cb - ca;
  })[0];
  const topPlantCount = topPlant
    ? (topPlant.wateringHistory || []).filter((d) => new Date(d) >= startOfMonth).length
    : 0;

  // Per-plant heatmap: last 12 weeks of watering activity
  const plantActivity = [...plants]
    .map((p) => ({
      ...p,
      monthWaterings: (p.wateringHistory || []).filter((d) => new Date(d) >= startOfMonth).length,
    }))
    .sort((a, b) => b.monthWaterings - a.monthWaterings)
    .slice(0, 8);

  return (
    <div className="container" style={{ maxWidth: '700px' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="mb-0 text-left" style={{ background: 'none', WebkitTextFillColor: 'inherit', color: 'inherit' }}>
          Meu Jardim
        </h2>
        <Link to="/dashboard" className="text-sm text-text-muted hover:text-text-primary">← Jardim</Link>
      </div>

      {totalPlants === 0 ? (
        <p className="text-text-muted text-left">Você ainda não tem plantas. <Link to="/add-plant">Adicione uma</Link> para ver as estatísticas.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard icon={Sprout} label="Plantas" value={totalPlants} sub={`no jardim`} />
            <StatCard icon={Droplets} label={`Regas em ${MONTH_NAMES[now.getMonth()]}`} value={wateringsThisMonth} sub="este mês" />
            <StatCard icon={Leaf} label="Adubações" value={fertilizingsThisMonth} sub={`este mês`} />
            <StatCard icon={Trophy} label="Sequência" value={streak} sub={`dia${streak !== 1 ? 's' : ''} seguido${streak !== 1 ? 's' : ''}`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {oldest && (
              <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-5 py-4 text-left">
                <p className="text-xs text-text-muted mt-0 mb-1 font-medium">Planta mais antiga</p>
                <p className="font-semibold text-deep-forest mt-0 mb-0">{oldest.name}</p>
                <p className="text-xs text-text-muted mt-0.5 mb-0">
                  {ageLabel(oldest.acquisitionDate || oldest.createdAt)} no jardim
                </p>
              </div>
            )}
            {topPlantCount > 0 && (
              <div className="rounded-2xl border border-mint-light bg-sage-green/10 px-5 py-4 text-left">
                <p className="text-xs text-text-muted mt-0 mb-1 font-medium">Mais regada este mês</p>
                <p className="font-semibold text-deep-forest mt-0 mb-0">{topPlant.name}</p>
                <p className="text-xs text-text-muted mt-0.5 mb-0">{topPlantCount} rega{topPlantCount !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-deep-forest mb-3 text-left mt-0">Atividade por planta este mês</p>
            <div className="flex flex-col gap-2">
              {plantActivity.map((p) => {
                const pct = topPlantCount > 0 ? (p.monthWaterings / topPlantCount) * 100 : 0;
                return (
                  <Link key={p._id} to={`/plants/${p._id}`} className="no-underline group">
                    <div className="flex items-center gap-3 rounded-2xl border border-mint-light bg-sage-green/10 px-4 py-2.5 hover:border-sage-green transition-colors">
                      <span className="text-sm text-deep-forest font-medium w-28 truncate shrink-0">{p.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-mint-light overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-leaf transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="text-xs text-text-muted shrink-0 w-8 text-right">{p.monthWaterings}×</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Stats;
