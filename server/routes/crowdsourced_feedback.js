const express = require("express");
const multer = require("multer");
const Incident = require("../models/Incident");
const RiskScore = require("../models/RiskScore");

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

    // Save updated risk score
    const updatedScore = await RiskScore.create({
      zoneId,
      riskProbability: nudgedProb,
      riskTier: tier,
      timestamp: new Date()
    });

    // Broadcast via Socket.io
    if (req.io) {
      req.io.emit("risk_update", {
        zoneId,
        riskProbability: nudgedProb,
        riskTier: tier,
        source: "Citizen Photo Ground-Truth"
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