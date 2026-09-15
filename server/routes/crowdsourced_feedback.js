const express = require("express");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const Incident = require("../models/Incident");
const RiskScore = require("../models/RiskScore");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/incidents/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

// POST /api/feedback/report
router.post("/report", upload.single("photo"), async (req, res) => {
  try {
    const { zoneId, description, severityEstimate, lat, lng } = req.body;
    if (!zoneId || severityEstimate === undefined) {
      return res.status(400).json({ error: "zoneId and severityEstimate are required" });
    }

    const incident = await Incident.create({
      zoneId,
      description,
      severityEstimate: parseFloat(severityEstimate),
      photoUrl: req.file ? `/uploads/incidents/${req.file.filename}` : null,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      reportedAt: new Date(),
      status: "pending_review",
    });

    const currentRisk = await RiskScore.findOne({ zoneId }).sort({ createdAt: -1 });
    if (!currentRisk) {
      return res.status(200).json({ incident, note: "No existing risk score to nudge yet." });
    }

    const { data } = await axios.post(`${process.env.ML_SERVICE_URL}/nudge`, {
      zone_id: zoneId,
      ground_truth_severity: incident.severityEstimate,
      current_score: currentRisk.riskProbability,
    });

    const updatedScore = await RiskScore.create({
      zoneId,
      riskProbability: data.adjusted_score,
      source: "crowdsourced_nudge",
      createdAt: new Date(),
    });

    incident.status = "applied_to_model";
    await incident.save();

    req.app.get("io")?.emit("risk_update", {
      zoneId,
      riskProbability: updatedScore.riskProbability,
      source: "crowdsourced_nudge",
    });

    res.status(201).json({ incident, updatedScore });
  } catch (err) {
    console.error("Feedback processing failed:", err.message);
    res.status(500).json({ error: "Failed to process crowdsourced report" });
  }
});

module.exports = router;
