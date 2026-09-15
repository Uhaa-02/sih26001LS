const express = require("express");
const Zone = require("../models/Zone");
const { scoreZone } = require("../cron/telemetryFetcher");
const { triggerCriticalEvent } = require("../services/iotSimulator");

const router = express.Router();

// POST /api/predict/zone/:zoneId - force an immediate re-score (demo "refresh now" button)
router.post("/zone/:zoneId", async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.zoneId);
    if (!zone) return res.status(404).json({ error: "Zone not found" });

    const io = req.app.get("io");
    // In a full build these lists come from DB collections; kept simple here for Day 1.
    const policeStations = req.app.get("policeStations") || [];
    const publicSubscribers = req.app.get("publicSubscribers") || [];

    const riskScore = await scoreZone(zone, io, policeStations, publicSubscribers);
    res.json(riskScore);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/predict/zone/:zoneId/trigger-event - demo control to force a critical spike
router.post("/zone/:zoneId/trigger-event", (req, res) => {
  triggerCriticalEvent(req.params.zoneId);
  res.json({ triggered: true, zoneId: req.params.zoneId });
});

module.exports = router;
