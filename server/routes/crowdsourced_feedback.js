const express = require("express");
const multer = require("multer");
const Incident = require("../models/Incident");
const RiskScore = require("../models/RiskScore");
const Zone = require("../models/Zone");

const router = express.Router();
const upload = multer({ dest: "public/uploads/" });

// POST /api/feedback/report - Handle photo and observation upload
router.post("/report", upload.single("photo"), async (req, res) => {
  try {
    const { zoneId, severityEstimate, description } = req.body;

    if (!zoneId) {
      return res.status(400).json({ error: "zoneId is required" });
    }

    const sev = parseFloat(severityEstimate) || 0.5;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Create incident log
    const incident = await Incident.create({
      zoneId,
      severityEstimate: sev,
      description: description || "Citizen Ground Report",
      photoUrl,
      reportedAt: new Date()
    });

    // Calculate nudged risk probability
    const nudgedProb = Math.min(0.95, 0.3 + (sev * 0.6));
    let tier = "MEDIUM";
    if (nudgedProb >= 0.75) tier = "CRITICAL";
    else if (nudgedProb >= 0.50) tier = "HIGH";

    // Keep the latest live telemetry so the dashboard card doesn't reset to zeros
    const zone = await Zone.findById(zoneId);
    const previous = await RiskScore.findOne({ zoneId }).sort({ createdAt: -1 });
    const lastTelemetry = previous && previous.inputSnapshot ? previous.inputSnapshot.telemetry : undefined;

    // Save updated risk score
    const updatedScore = await RiskScore.create({
      zoneId,
      riskProbability: nudgedProb,
      riskTier: tier,
      source: "crowdsourced_nudge",
      inputSnapshot: { severityEstimate: sev, incidentId: incident._id, telemetry: lastTelemetry }
    });

    // Broadcast via Socket.io
    if (req.io) {
      req.io.emit("risk_update", {
        zoneId,
        zoneName: zone ? zone.name : undefined,
        riskProbability: nudgedProb,
        riskTier: tier,
        telemetry: lastTelemetry,
        source: "Citizen Photo Ground-Truth",
        timestamp: updatedScore.createdAt
      });
    }

    return res.json({
      success: true,
      incident,
      updatedScore
    });
  } catch (err) {
    console.error("Crowdsourced Feedback Error:", err);
    return res.status(500).json({ error: "Failed to process crowdsourced report: " + err.message });
  }
});

module.exports = router;