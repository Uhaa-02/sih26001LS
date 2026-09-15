const cron = require("node-cron");
const axios = require("axios");
const Zone = require("../models/Zone");
const RiskScore = require("../models/RiskScore");
const { getSeasonalRainfallMm } = require("../services/openMeteoService");
const { getSoilMoisturePct } = require("../services/smapService");
const { getDisplacement } = require("../services/iotSimulator");
const { dispatchAlertsForZone } = require("../services/alert_service");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function scoreZone(zone, io, policeStations, publicSubscribers) {
  const [{ seasonalRainfallMm }, { soilMoisturePct }] = await Promise.all([
    getSeasonalRainfallMm(zone.lat, zone.lng),
    getSoilMoisturePct(zone._id.toString()),
  ]);
  const rockDisplacement = getDisplacement(zone._id.toString());

  const featureVector = {
    slope_degrees: zone.slopeDegrees,
    lithology_index: zone.lithologyIndex,
    seasonal_rainfall_mm: seasonalRainfallMm,
    soil_moisture_pct: soilMoisturePct,
    rock_displacement_mm_per_day: rockDisplacement,
    elevation_m: zone.elevationM,
    land_cover_index: zone.landCoverIndex,
    distance_to_fault_km: zone.distanceToFaultKm,
  };

  const { data: prediction } = await axios.post(`${ML_SERVICE_URL}/predict`, featureVector, {
    timeout: 10000,
  });

  const riskScore = await RiskScore.create({
    zoneId: zone._id,
    riskProbability: prediction.risk_probability,
    riskTier: prediction.risk_tier,
    topContributingFactors: prediction.top_contributing_factors,
    source: "live_prediction",
    inputSnapshot: featureVector,
  });

  io?.emit("risk_update", {
    zoneId: zone._id,
    zoneName: zone.name,
    riskProbability: riskScore.riskProbability,
    riskTier: riskScore.riskTier,
    source: "live_prediction",
  });

  if (prediction.risk_tier === "HIGH" || prediction.risk_tier === "CRITICAL") {
    await dispatchAlertsForZone({
      zone,
      riskProbability: prediction.risk_probability,
      policeStations,
      publicSubscribers,
    });
  }

  return riskScore;
}

/**
 * Starts the 15-minute telemetry -> prediction -> alert cycle for every
 * monitored zone. `getPoliceStations` and `getPublicSubscribers` are
 * injected functions so this module stays decoupled from how those
 * lists are sourced/seeded.
 */
function startTelemetryCron(io, { getPoliceStations, getPublicSubscribers }) {
  const job = cron.schedule("*/15 * * * *", async () => {
    try {
      const zones = await Zone.find({});
      const policeStations = await getPoliceStations();
      const publicSubscribers = await getPublicSubscribers();

      for (const zone of zones) {
        try {
          await scoreZone(zone, io, policeStations, publicSubscribers);
        } catch (err) {
          console.error(`Failed to score zone ${zone.name}:`, err.message);
        }
      }
    } catch (err) {
      console.error("Telemetry cron cycle failed:", err.message);
    }
  });

  console.log("Telemetry cron scheduled: every 15 minutes");
  return job;
}

module.exports = { startTelemetryCron, scoreZone };
