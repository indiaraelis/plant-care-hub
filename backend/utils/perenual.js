// backend/utils/perenual.js
// Searches the Perenual API for plant care data (watering, sunlight, maintenance).
// https://perenual.com/docs/plant-open-api

const axios = require('axios');

const BASE_URL = 'https://perenual.com/api';

// Map Perenual watering string → recommended days between watering
const WATERING_TO_DAYS = {
  'Frequent': 2,
  'Average': 7,
  'Minimum': 14,
  'None': 45,
};

// Map Perenual maintenance level → suggested fertilizing interval (days)
const MAINTENANCE_TO_FERTILIZING = {
  'High': 14,
  'Medium': 30,
  'Low': 60,
  'Minimum': 90,
};

// Normalize Perenual sunlight strings to Portuguese labels
function sunlightPt(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const v = values[0].toLowerCase();
  if (v.includes('full sun')) return 'Sol pleno';
  if (v.includes('part') || v.includes('filtered')) return 'Meia luz';
  if (v.includes('indirect') || v.includes('low')) return 'Luz indireta';
  if (v.includes('shade') || v.includes('full shade')) return 'Sombra';
  return null;
}

/**
 * Search Perenual for a plant by name/species and return structured care data.
 * Returns null if API is not configured, plant not found, or request fails.
 *
 * @param {string} name - Common name to search
 * @param {string} [species] - Optional scientific name for refining match
 * @returns {Promise<object|null>}
 */
async function searchPlantCare(name, species) {
  const key = process.env.PERENUAL_API_KEY;
  if (!key) return null;

  // Prefer scientific name for search accuracy; fall back to common name
  const query = species?.trim() || name.trim();

  try {
    const res = await axios.get(`${BASE_URL}/species-list`, {
      params: { key, q: query, page: 1 },
      timeout: 6000,
    });

    const data = res.data?.data;
    if (!Array.isArray(data) || data.length === 0) {
      // Try again with common name if scientific search returned nothing
      if (species?.trim()) {
        return searchPlantCare(name, null);
      }
      return null;
    }

    const plant = data[0];
    const wateringLevel = plant.watering || null;
    const maintenanceLevel = plant.maintenance || null;
    const sunlightLabel = sunlightPt(plant.sunlight);

    return {
      perenualId: plant.id,
      commonName: plant.common_name || null,
      scientificName: plant.scientific_name?.[0] || null,
      wateringLevel,
      maintenanceLevel,
      sunlightLabel,
      suggestedWateringDays: WATERING_TO_DAYS[wateringLevel] ?? 7,
      suggestedFertilizingDays: MAINTENANCE_TO_FERTILIZING[maintenanceLevel] ?? 30,
    };
  } catch {
    return null;
  }
}

module.exports = { searchPlantCare };
