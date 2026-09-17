const axios = require("axios");

/**
 * Fetches live weather and soil moisture data from Open-Meteo API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
async function fetchZoneTelemetry(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm&current_weather=true&timezone=auto`;
    
    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;

    const hourly = data.hourly || {};
    const currentPrecip = hourly.precipitation ? hourly.precipitation[0] || 0 : 0;
    
    // Average topsoil moisture across depths (m³/m³)
    const sm1 = hourly.soil_moisture_0_to_1cm ? hourly.soil_moisture_0_to_1cm[0] || 0.2 : 0.2;
    const sm2 = hourly.soil_moisture_1_to_3cm ? hourly.soil_moisture_1_to_3cm[0] || 0.2 : 0.2;
    const avgSoilMoisture = parseFloat(((sm1 + sm2) / 2).toFixed(3));

    return {
      precipitation_mm: currentPrecip,
      soil_moisture: avgSoilMoisture,
      temperature: data.current_weather ? data.current_weather.temperature : 20,
      windspeed: data.current_weather ? data.current_weather.windspeed : 5,
      fetchedAt: new Date()
    };
  } catch (err) {
    console.warn(`[Open-Meteo] Fallback used for (${lat}, ${lng}): ${err.message}`);
    // Safe fallback values if API rate limits or times out
    return {
      precipitation_mm: 12.5,
      soil_moisture: 0.38,
      temperature: 22.0,
      windspeed: 8.5,
      fetchedAt: new Date()
    };
  }
}

module.exports = { fetchZoneTelemetry };