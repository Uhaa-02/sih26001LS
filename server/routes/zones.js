const express = require("express");
const Zone = require("../models/Zone");
const RiskScore = require("../models/RiskScore");

const router = express.Router();

// GET /api/zones - list all monitored zones with their latest risk score
router.get("/", async (req, res) => {
  try {
    const zones = await Zone.find({});
    const zonesWithRisk = await Promise.all(
      zones.map(async (zone) => {
        const latest = await RiskScore.findOne({ zoneId: zone._id }).sort({ createdAt: -1 });
        return { ...zone.toObject(), latestRisk: latest || null };
      })
    );
    res.json(zonesWithRisk);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones - register a new monitored zone
router.post("/", async (req, res) => {
  try {
    const zone = await Zone.create(req.body);
    res.status(201).json(zone);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
