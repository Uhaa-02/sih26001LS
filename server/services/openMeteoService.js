const axios = require("axios");

/**
 * Fetches live weather and soil moisture data from Open-Meteo API
 * for the CURRENT hour (not midnight).
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
async function fetchZoneTelemetry(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm&current_weather=true&timezone=auto&forecast_days=1`;

    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;
    const hourly = data.hourly || {};
    const times = hourly.time || [];

    // hourly arrays start at 00:00 local time, so find the index of the current hour
    let idx = 0;
    if (data.current_weather && data.current_weather.time) {
      const currentHour = data.current_weather.time.slice(0, 13); // e.g. "2026-09-17T16"
      const found = times.findIndex((t) => t.slice(0, 13) === currentHour);
      if (found >= 0) idx = found;
    }

    const valueAt = (arr, fallback) =>
      Array.isArray(arr) && typeof arr[idx] === "number" ? arr[idx] : fallback;

    const precipitation = valueAt(hourly.precipitation, 0);
    const sm1 = valueAt(hourly.soil_moisture_0_to_1cm, 0.2);
    const sm2 = valueAt(hourly.soil_moisture_1_to_3cm, 0.2);

    return {
      precipitation_mm: precipitation,
      soil_moisture: parseFloat(((sm1 + sm2) / 2).toFixed(3)),
      temperature: data.current_weather ? data.current_weather.temperature : 20,
      windspeed: data.current_weather ? data.current_weather.windspeed : 5,
      observedHour: times[idx] || null,
      fetchedAt: new Date(),
    };
  } catch (err) {
    console.warn(`[Open-Meteo] Fallback used for (${lat}, ${lng}): ${err.message}`);
    // Safe fallback values if API rate limits or times out
    return {
      precipitation_mm: 12.5,
      soil_moisture: 0.38,
      temperature: 22.0,
      windspeed: 8.5,
      observedHour: null,
      fetchedAt: new Date(),
    };
  }
}

module.exports = { fetchZoneTelemetry };