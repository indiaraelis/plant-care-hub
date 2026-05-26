// frontend/src/utils/careDefaults.js
// Derives watering/fertilizing suggestions from the botanical data already in PlantDatabase.js
// Returns a suggestion, not a prescription — always show the hint to the user.

const TROPICAL_KEYWORDS = ['tropical', 'sudeste asiático', 'ásia tropical', 'américa central', 'amazônia'];
const DRY_KEYWORDS = ['mediterrâneo', 'áfrica do sul', 'sul da áfrica', 'méxico', 'caatinga', 'semiárido'];
const CERRADO_KEYWORDS = ['pantanal', 'cerrado', 'brasil'];

function matchesKeyword(text = '', keywords) {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

/**
 * Suggests watering/fertilizing frequency based on habit and origin.
 * @param {string} habit  — from PlantDatabase (Herbácea, Arbustiva, Arbórea, Não informado)
 * @param {string} origin — from PlantDatabase
 * @returns {{ wateringDays: number, fertilizingDays: number, hint: string, presetMatches: boolean }}
 */
export function suggestCareFromHabit(habit = '', origin = '') {
  const isTropical = matchesKeyword(origin, TROPICAL_KEYWORDS);
  const isDry      = matchesKeyword(origin, DRY_KEYWORDS);
  const isBrazil   = matchesKeyword(origin, CERRADO_KEYWORDS);
  const hasHabit   = habit && habit !== 'Não informado';

  let wateringDays;
  let wateringLabel;

  if (habit === 'Herbácea') {
    // Herbs and ground-covers need frequent watering
    wateringDays  = isTropical ? 3 : 7;
    wateringLabel = isTropical ? 'a cada 3 dias' : 'semanal';
  } else if (habit === 'Arbustiva') {
    wateringDays  = isDry ? 15 : 7;
    wateringLabel = isDry ? 'quinzenal' : 'semanal';
  } else if (habit === 'Arbórea') {
    // Native Brazilian trees (Cerrado/Pantanal) are drought-adapted
    wateringDays  = (isBrazil || isDry) ? 15 : 7;
    wateringLabel = (isBrazil || isDry) ? 'quinzenal' : 'semanal';
  } else {
    // Habit unknown — fall back on origin only
    if (isDry) {
      wateringDays  = 15;
      wateringLabel = 'quinzenal';
    } else {
      wateringDays  = 7;
      wateringLabel = 'semanal';
    }
  }

  // Fertilizing: monthly is a safe default for most ornamental/edible plants
  const fertilizingDays = 30;

  // Build the hint sentence
  const habitParts = hasHabit ? `planta ${habit.toLowerCase()}` : null;
  const originTrimmed = origin && origin !== 'Não informado' && origin !== 'Desconhecida'
    ? origin.toLowerCase()
    : null;

  let context = [habitParts, originTrimmed ? `de origem ${originTrimmed}` : null]
    .filter(Boolean)
    .join(' ');

  if (context) context = context.charAt(0).toUpperCase() + context.slice(1);

  const hint = context
    ? `${context} — costuma preferir rega ${wateringLabel}.`
    : `Sugestão padrão: rega ${wateringLabel}.`;

  // Does wateringDays exactly match one of the quick-pick presets?
  const presetValues = [2, 7, 15, 30];
  const presetMatches = presetValues.includes(wateringDays);

  return { wateringDays, fertilizingDays, hint, presetMatches };
}
