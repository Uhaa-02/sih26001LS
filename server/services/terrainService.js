const axios = require("axios");

/**
 * Real terrain for a zone from the Copernicus GLO-90 DEM (90 m resolution),
 * via the free Open-Meteo Elevation API.
 *
 * Elevation: DEM height at the zone point.
 * Slope: standard GIS finite-difference method. We sample the DEM one grid
 * cell (90 m) north, south, east and west of the point and compute
 *   slope = atan( sqrt( (dz/dx)^2 + (dz/dy)^2 ) )
 */
const SPACING_M = 90;
const METERS_PER_DEG_LAT = 111320;

async function fetchZoneTerrain(lat, lng) {
  const dLat = SPACING_M / METERS_PER_DEG_LAT;
  const dLng = SPACING_M / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

  // Order: center, north, south, east, west
  const lats = [lat, lat + dLat, lat - dLat, lat, lat];
  const lngs = [lng, lng, lng, lng + dLng, lng - dLng];

  const url =
    "https://api.open-meteo.com/v1/elevation" +
    `?latitude=${lats.map((v) => v.toFixed(6)).join(",")}` +
    `&longitude=${lngs.map((v) => v.toFixed(6)).join(",")}`;

  const { data } = await axios.get(url, { timeout: 8000 });
  const [center, north, south, east, west] = data.elevation || [];

  if ([center, north, south, east, west].some((v) => typeof v !== "number")) {
    throw new Error("Elevation API returned incomplete data");
  }

  const dzdx = (east - west) / (2 * SPACING_M);
  const dzdy = (north - south) / (2 * SPACING_M);
  const slopeDegrees = (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;

  return {
    elevationM: Math.round(center),
    slopeDegrees: parseFloat(slopeDegrees.toFixed(1)),
  };
}

module.exports = { fetchZoneTerrain };