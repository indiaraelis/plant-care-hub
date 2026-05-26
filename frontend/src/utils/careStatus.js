// frontend/src/utils/careStatus.js
// Utilities to calculate watering/fertilizing status for a plant

/**
 * Returns the care status for a given last-care date + frequency.
 *
 * @param {string|Date|null} lastDate  — date of last care event
 * @param {number}           freqDays — frequency in days (0 = not applicable)
 * @returns {{ status: 'overdue'|'today'|'upcoming'|'ok'|'na', daysLeft: number, nextDate: Date|null }}
 */
export function getCareStatus(lastDate, freqDays) {
  if (!freqDays || freqDays <= 0) return { status: 'na', daysLeft: null, nextDate: null };
  if (!lastDate) return { status: 'overdue', daysLeft: 0, nextDate: null };

  const last = new Date(lastDate);
  const next = new Date(last);
  next.setDate(next.getDate() + freqDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);

  const diffMs = next.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let status;
  if (daysLeft < 0)     status = 'overdue';
  else if (daysLeft === 0) status = 'today';
  else if (daysLeft <= 2)  status = 'upcoming';
  else                     status = 'ok';

  return { status, daysLeft, nextDate: next };
}

/**
 * Returns a human-readable label for a care status.
 */
export function statusLabel(status, daysLeft, type = 'rega') {
  switch (status) {
    case 'overdue':  return `${type === 'rega' ? 'Rega' : 'Adubação'} atrasada ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
    case 'today':    return `${type === 'rega' ? 'Regar' : 'Adubar'} hoje!`;
    case 'upcoming': return `${type === 'rega' ? 'Regar' : 'Adubar'} em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`;
    case 'ok':       return `Próxima ${type === 'rega' ? 'rega' : 'adubação'} em ${daysLeft} dias`;
    default:         return null;
  }
}

/**
 * Returns Tailwind classes for the badge based on status.
 */
export function statusBadgeClass(status) {
  switch (status) {
    case 'overdue':  return 'bg-red-100 text-red-700 border border-red-300';
    case 'today':    return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
    case 'upcoming': return 'bg-blue-100 text-blue-700 border border-blue-300';
    case 'ok':       return 'bg-green-100 text-green-700 border border-green-300';
    default:         return '';
  }
}

/**
 * Returns the Tailwind color class for the small dot indicator.
 */
export function statusDotClass(status) {
  switch (status) {
    case 'overdue':  return 'bg-red-500';
    case 'today':    return 'bg-yellow-400';
    case 'upcoming': return 'bg-blue-400';
    case 'ok':       return 'bg-green-500';
    default:         return '';
  }
}
