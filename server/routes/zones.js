const express = require("express");
const Zone = require("../models/Zone");
const RiskScore = require("../models/RiskScore");

const router = express.Router();

// GET /api/zones - list all monitored zones with their latest risk scores
router.get("/", async (req, res) => {
  try {
    const zones = await Zone.find({});
    const zonesWithRisk = await Promise.all(
      zones.map(async (zone) => {
        const latest = await RiskScore.findOne({ zoneId: zone._id }).sort({ timestamp: -1 });
        return {
          ...zone.toObject(),
          currentRiskScore: latest || null
        };
      })
    );
    res.json(zonesWithRisk);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones/seed - Seed initial Northeast India landslide zones
router.post("/seed", async (req, res) => {
  try {
    const sampleZones = [
      { name: "Gangtok - NH10 Corridor", district: "East Sikkim", state: "Sikkim", lat: 27.3389, lng: 88.6065 },
      { name: "Shillong - Laitkor Peak Slope", district: "East Khasi Hills", state: "Meghalaya", lat: 25.5788, lng: 91.8933 },
      { name: "Champhai - Ridge Belt", district: "Champhai", state: "Mizoram", lat: 23.4566, lng: 93.3282 },
      { name: "Guwahati - Kamakhya Hill Cut", district: "Kamrup Metropolitan", state: "Assam", lat: 26.1664, lng: 91.7086 }
    ];

    await Zone.deleteMany({}); // Clears existing incomplete records
    const inserted = await Zone.insertMany(sampleZones);

    // Create initial baseline risk scores for each zone
    for (const zone of inserted) {
      await RiskScore.create({
        zoneId: zone._id,
        riskProbability: Math.random() * 0.6 + 0.2, // Generates 0.20 to 0.80 score
        riskTier: "MEDIUM",
        timestamp: new Date()
      });
    }

    res.json({ message: "Successfully seeded 4 NE zones with baseline risk scores!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones - register a new monitored zone
router.post("/", async (req, res) => {
  try {
    const zone = new Zone(req.body);
    await zone.save();
    res.status(201).json(zone);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;