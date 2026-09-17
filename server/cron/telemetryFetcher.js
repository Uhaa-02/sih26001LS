const cron = require("node-cron");
const axios = require("axios");
const Zone = require("../models/Zone");
const RiskScore = require("../models/RiskScore");
const { fetchZoneTelemetry } = require("../services/openMeteoService");
const { dispatchAlertsForZone } = require("../services/alert_service");

function startTelemetryCron(io) {
  console.log("⏱️ Telemetry Cron initialized: Running every 15 minutes.");

  // Runs every 15 minutes: '*/15 * * * *'
  cron.schedule("*/15 * * * *", async () => {
    console.log("📡 Executing 15-minute Open-Meteo automated risk evaluation...");

    try {
      const zones = await Zone.find({});

      for (const zone of zones) {
        // 1. Fetch live telemetry from Open-Meteo
        const telemetry = await fetchZoneTelemetry(zone.lat, zone.lng);

        // 2. Predict risk using Python XGBoost ML API
        let calculatedRisk = 0.35;
        try {
          const mlRes = await axios.post("http://127.0.0.1:5001/predict", {
            precipitation_mm: telemetry.precipitation_mm || 0.0,
            soil_moisture: telemetry.soil_moisture || 0.20,
            slope_angle: zone.slopeAngle || 35.0,
            elevation: zone.elevation || 1200.0,
          });

          calculatedRisk = parseFloat(
            (mlRes.data.riskProbability ?? mlRes.data.probability ?? 0.35).toFixed(2)
          );
        } catch (mlErr) {
          console.error(
            `⚠️ ML Service unreachable for ${zone.name}, applying fallback calculation:`,
            mlErr.message
          );
          // Fallback heuristic if Python service is offline
          const precipScore = Math.min(1.0, (telemetry.precipitation_mm || 0) / 50);
          const soilScore = Math.min(1.0, (telemetry.soil_moisture || 0.2) / 0.5);
          calculatedRisk = parseFloat(
            Math.min(0.98, precipScore * 0.5 + soilScore * 0.5).toFixed(2)
          );
        }

        // Determine Risk Tier
        let tier = "LOW";
        if (calculatedRisk >= 0.75) tier = "CRITICAL";
        else if (calculatedRisk >= 0.50) tier = "HIGH";
        else if (calculatedRisk >= 0.25) tier = "MEDIUM";

        // 3. Save updated risk score entry in MongoDB
        const newScore = await RiskScore.create({
          zoneId: zone._id,
          riskProbability: calculatedRisk,
          riskTier: tier,
          telemetry,
          timestamp: new Date(),
        });

        // 4. Update parent zone state
        zone.currentRiskScore = calculatedRisk;
        zone.currentTier = tier;
        await zone.save();

        // 5. Broadcast real-time update to Leaflet map via Socket.io
        if (io) {
          io.emit("risk_update", {
            zoneId: zone._id,
            zoneName: zone.name,
            riskProbability: calculatedRisk,
            riskTier: tier,
            telemetry,
            timestamp: newScore.timestamp,
          });
        }

        // 6. Dispatch SMS Alerts via Fast2SMS if risk exceeds alert thresholds (HIGH / CRITICAL)
        if (calculatedRisk >= 0.50) {
          console.log(`🚨 Triggering emergency SMS dispatches for High Risk Zone: ${zone.name}`);
          
          // Provide default/fallback contacts if arrays are unpopulated
          const policeStations = zone.policeStations || [];
          const publicSubscribers = zone.publicSubscribers || [];

          await dispatchAlertsForZone({
            zone,
            riskProbability: calculatedRisk,
            policeStations,
            publicSubscribers,
          });
        }
      }
    } catch (err) {
      console.error("Cron Execution Error:", err);
    }
  });
}

module.exports = { startTelemetryCron };