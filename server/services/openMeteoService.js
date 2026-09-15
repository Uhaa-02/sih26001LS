const axios = require("axios");

const BASE_URL = process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1/forecast";

/**
 * Fetches recent + forecast rainfall for a zone and returns a
 * seasonal-style aggregate (sum of last 7 days precipitation, mm)
 * suitable as a live model feature.
 */
async function getSeasonalRainfallMm(lat, lng) {
  const params = {
    latitude: lat,
    longitude: lng,
    daily: "precipitation_sum",
    past_days: 7,
    forecast_days: 1,
    timezone: "auto",
  };

  const { data } = await axios.get(BASE_URL, { params, timeout: 10000 });
  const daily = data?.daily?.precipitation_sum || [];
  const seasonalRainfallMm = daily.reduce((sum, v) => sum + (v || 0), 0);

  return {
    seasonalRainfallMm: Number(seasonalRainfallMm.toFixed(1)),
    raw: data.daily,
  };
}

module.exports = { getSeasonalRainfallMm };
