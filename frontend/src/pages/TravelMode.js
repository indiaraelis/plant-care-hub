// frontend/src/pages/TravelMode.js
// Modo viagem: calcula quais plantas precisam de cuidado durante a ausência.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import { toast } from 'react-toastify';
import { AlertTriangle, CheckCircle, Droplets, Luggage, Share2 } from 'lucide-react';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Returns today in YYYY-MM-DD for min attribute
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const LS_DEP = 'pch_travel_departure';
const LS_RET = 'pch_travel_return';

function TravelMode() {
  const [plants, setPlants] = useState([]);
  const [departure, setDeparture] = useState(() => localStorage.getItem(LS_DEP) || '');
  const [returnDate, setReturnDate] = useState(() => localStorage.getItem(LS_RET) || '');
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    API.get('/api/plants')
      .then((r) => setPlants(r.data))
      .catch(() => toast.error('Erro ao carregar plantas.'));
  }, []);

  useEffect(() => {
    if (departure) localStorage.setItem(LS_DEP, departure);
    else localStorage.removeItem(LS_DEP);
  }, [departure]);

  useEffect(() => {
    if (returnDate) localStorage.setItem(LS_RET, returnDate);
    else localStorage.removeItem(LS_RET);
  }, [returnDate]);

  const analyze = () => {
    if (!departure || !returnDate) {
      toast.warn('Escolha as datas de saída e retorno.');
      return;
    }
    const dep = new Date(departure + 'T00:00:00');
    const ret = new Date(returnDate + 'T23:59:59');
    if (dep >= ret) {
      toast.warn('O retorno deve ser após a data de saída.');
      return;
    }
    if (plants.length === 0) {
      toast.info('Você ainda não tem plantas cadastradas.');
      return;
    }

    const beforeLeaving = [];   // next watering is due before departure
    const duringAbsence = [];   // first watering falls within the trip
    const canWait = [];         // safe until return

    plants.forEach((p) => {
      if (!p.wateringFrequencyDays) return;
      const lastW = p.lastWatered ? new Date(p.lastWatered) : new Date();
      const freq = p.wateringFrequencyDays;
      const firstNext = addDays(lastW, freq);

      if (firstNext <= dep) {
        // Overdue or due before leaving
        let count = 0;
        let next = firstNext;
        while (next <= ret) { count++; next = addDays(next, freq); }
        beforeLeaving.push({ ...p, firstNext, countDuring: count });
      } else if (firstNext <= ret) {
        // First watering during the trip
        let count = 0;
        let next = firstNext;
        while (next <= ret) { count++; next = addDays(next, freq); }
        duringAbsence.push({ ...p, firstNext, count });
      } else {
        canWait.push({ ...p, firstNext });
      }
    });

    setResults({ beforeLeaving, duringAbsence, canWait, dep, ret });
    setCopied(false);
  };

  const buildText = () => {
    if (!results) return '';
    const { beforeLeaving, duringAbsence, canWait, dep, ret } = results;
    const lines = [
      `🌱 Cuidados das plantas — viagem ${fmt(dep)} a ${fmt(ret)}`,
      '',
    ];
    if (beforeLeaving.length > 0) {
      lines.push('⏰ REGAR ANTES DE SAIR:');
      beforeLeaving.forEach((p) => lines.push(`  [ ] ${p.name}`));
      lines.push('');
    }
    if (duringAbsence.length > 0) {
      lines.push('🪴 PRECISARÁ DE REGA DURANTE A AUSÊNCIA:');
      duringAbsence.forEach((p) =>
        lines.push(`  • ${p.name} — ${p.count}x (primeira em ${fmt(p.firstNext)}, a cada ${p.wateringFrequencyDays}d)`)
      );
      lines.push('');
    }
    if (canWait.length > 0) {
      lines.push('✅ AGUENTA ATÉ VOCÊ VOLTAR:');
      canWait.forEach((p) => lines.push(`  ✓ ${p.name} (próxima rega: ${fmt(p.firstNext)})`));
    }
    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildText();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Cuidados das plantas — viagem', text });
      } catch (e) {
        if (e.name !== 'AbortError') toast.error('Erro ao compartilhar.');
      }
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        toast.success('Lista copiada!');
        setTimeout(() => setCopied(false), 3000);
      });
    }
  };

  const totalNeedCare = results ? results.beforeLeaving.length + results.duringAbsence.length : 0;

  return (
    <div className="container" style={{ maxWidth: '640px' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Luggage size={20} className="text-emerald-leaf" />
          <h2 className="mb-0 text-left" style={{ background: 'none', WebkitTextFillColor: 'inherit', color: 'inherit' }}>
            Modo viagem
          </h2>
        </div>
        <Link to="/dashboard" className="text-sm text-text-muted hover:text-text-primary">← Jardim</Link>
      </div>

      <p className="text-sm text-text-muted text-left mt-0 mb-5">
        Informe quando você sai e quando volta. O app calcula quais plantas vão precisar de cuidados.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5">Saída</label>
          <input
            type="date"
            value={departure}
            min={todayStr()}
            onChange={(e) => setDeparture(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5">Retorno</label>
          <input
            type="date"
            value={returnDate}
            min={departure || todayStr()}
            onChange={(e) => setReturnDate(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <button onClick={analyze} className="mb-8">
        Analisar plantas
      </button>

      {results && (
        <>
          {totalNeedCare === 0 && results.canWait.length > 0 ? (
            <div className="rounded-2xl border border-emerald-leaf/30 bg-emerald-leaf/5 px-5 py-4 mb-6 text-left">
              <p className="flex items-center gap-2 font-semibold text-emerald-leaf mt-0 mb-1">
                <CheckCircle size={16} /> Boa viagem! Tudo sob controle.
              </p>
              <p className="text-sm text-text-muted mt-0 mb-0">
                Suas {results.canWait.length} planta{results.canWait.length > 1 ? 's aguentam' : ' aguenta'} até você voltar.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-5 py-4 mb-6 text-left">
              <p className="flex items-center gap-2 font-semibold text-yellow-800 mt-0 mb-1">
                <AlertTriangle size={16} />
                {results.beforeLeaving.length + results.duringAbsence.length} planta{totalNeedCare !== 1 ? 's precisam' : ' precisa'} de atenção.
              </p>
              <p className="text-sm text-yellow-700 mt-0 mb-0">Verifique os detalhes abaixo.</p>
            </div>
          )}

          {results.beforeLeaving.length > 0 && (
            <section className="mb-6">
              <p className="text-sm font-semibold text-deep-forest mb-3 text-left mt-0 flex items-center gap-1.5">
                <Droplets size={14} className="text-blue-500" /> Regar antes de sair
              </p>
              <div className="flex flex-col gap-2">
                {results.beforeLeaving.map((p) => (
                  <Link key={p._id} to={`/plants/${p._id}`} className="no-underline">
                    <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 hover:border-blue-300 transition-colors">
                      <span className="text-sm font-medium text-blue-800">{p.name}</span>
                      <span className="text-xs text-blue-600">
                        {p.countDuring > 1 ? `${p.countDuring}x durante viagem também` : 'estava atrasada'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.duringAbsence.length > 0 && (
            <section className="mb-6">
              <p className="text-sm font-semibold text-deep-forest mb-3 text-left mt-0 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-yellow-500" /> Precisa de cuidado durante a viagem
              </p>
              <div className="flex flex-col gap-2">
                {results.duringAbsence.map((p) => (
                  <Link key={p._id} to={`/plants/${p._id}`} className="no-underline">
                    <div className="flex items-center justify-between rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-2.5 hover:border-yellow-300 transition-colors">
                      <span className="text-sm font-medium text-yellow-800">{p.name}</span>
                      <span className="text-xs text-yellow-600">
                        {p.count}× — 1ª em {fmt(p.firstNext)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.canWait.length > 0 && (
            <section className="mb-6">
              <p className="text-sm font-semibold text-deep-forest mb-3 text-left mt-0 flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-leaf" /> Em dia — sem preocupação
              </p>
              <div className="flex flex-col gap-2">
                {results.canWait.map((p) => (
                  <div key={p._id} className="flex items-center justify-between rounded-2xl border border-mint-light bg-sage-green/10 px-4 py-2.5">
                    <span className="text-sm font-medium text-deep-forest">{p.name}</span>
                    <span className="text-xs text-text-muted">próxima: {fmt(p.firstNext)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button
            onClick={handleShare}
            className="flex items-center gap-2 w-auto px-5 bg-sage-green/20 text-deep-forest border border-sage-green hover:bg-sage-green/30"
          >
            <Share2 size={14} />
            {copied ? 'Copiado!' : 'Compartilhar lista'}
          </button>
        </>
      )}
    </div>
  );
}

export default TravelMode;
