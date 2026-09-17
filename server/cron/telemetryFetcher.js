const cron = require("node-cron");
const axios = require("axios");
const Zone = require("../models/Zone");
const RiskScore = require("../models/RiskScore");
const { fetchZoneTelemetry } = require("../services/openMeteoService");
const { dispatchAlertsForZone } = require("../services/alert_service");

// Live on Render: https://sih-26001ls.onrender.com | Local: set ML_SERVICE_URL in server/.env
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || "http://127.0.0.1:5001").replace(/\/+$/, "");

function tierFor(prob) {
  if (prob >= 0.75) return "CRITICAL";
  if (prob >= 0.5) return "HIGH";
  if (prob >= 0.25) return "MEDIUM";
  return "LOW";
}

async function evaluateAllZones(io) {
  console.log("📡 Running Open-Meteo + XGBoost risk evaluation...");

  try {
    const zones = await Zone.find({});

    for (const zone of zones) {
      // 1. Fetch live telemetry from Open-Meteo
      const telemetry = await fetchZoneTelemetry(zone.lat, zone.lng);

      const features = {
        precipitation_mm: telemetry.precipitation_mm || 0.0,
        soil_moisture: telemetry.soil_moisture || 0.2,
        slope_angle: zone.slopeDegrees ?? 35.0,
        elevation: zone.elevationM ?? 1200.0,
      };

      // 2. Predict risk with the XGBoost ML service
      let calculatedRisk;
      let tier;
      let factors = [];
      let modelUsed = "xgboost";

      try {
        // Timeout is long because a sleeping free Render instance takes ~50s to wake up
        const mlRes = await axios.post(`${ML_SERVICE_URL}/predict`, features, { timeout: 60000 });
        calculatedRisk = Number(mlRes.data.riskProbability);
        tier = mlRes.data.riskTier || tierFor(calculatedRisk);
        factors = mlRes.data.topContributingFactors || [];
      } catch (mlErr) {
        modelUsed = "fallback_heuristic";
        console.error(`⚠️ ML service unreachable for ${zone.name} (${ML_SERVICE_URL}): ${mlErr.message}`);
        const precipScore = Math.min(1.0, features.precipitation_mm / 50);
        const soilScore = Math.min(1.0, features.soil_moisture / 0.5);
        calculatedRisk = parseFloat(Math.min(0.98, precipScore * 0.5 + soilScore * 0.5).toFixed(2));
        tier = tierFor(calculatedRisk);
      }

      console.log(`✅ ${zone.name}: ${calculatedRisk} (${tier}) via ${modelUsed}`);

      // 3. Save the score in MongoDB
      const newScore = await RiskScore.create({
        zoneId: zone._id,
        riskProbability: calculatedRisk,
        riskTier: tier,
        topContributingFactors: factors,
        source: "live_prediction",
        inputSnapshot: { ...features, model: modelUsed, telemetry },
      });

      // 4. Broadcast real-time update to the Leaflet map via Socket.io
      if (io) {
        io.emit("risk_update", {
          zoneId: zone._id,
          zoneName: zone.name,
          riskProbability: calculatedRisk,
          riskTier: tier,
          topContributingFactors: factors,
          model: modelUsed,
          telemetry,
          timestamp: newScore.createdAt,
        });
      }

      // 5. Dispatch SMS alerts if risk is HIGH or CRITICAL
      if (calculatedRisk >= 0.5) {
        console.log(`🚨 Triggering emergency SMS dispatches for High Risk Zone: ${zone.name}`);
        await dispatchAlertsForZone({
          zone,
          riskProbability: calculatedRisk,
          policeStations: zone.policeStations || [],
          publicSubscribers: zone.publicSubscribers || [],
        });
      }
    }
  } catch (err) {
    console.error("Cron Execution Error:", err);
  }
}

function startTelemetryCron(io) {
  console.log(`⏱️ Telemetry cron initialized (every 15 min). ML service: ${ML_SERVICE_URL}`);

  // Score once shortly after startup so the map has fresh data immediately
  setTimeout(() => evaluateAllZones(io), 10000);

  // Then every 15 minutes
  cron.schedule("*/15 * * * *", () => evaluateAllZones(io));
}

module.exports = { startTelemetryCron, evaluateAllZones };