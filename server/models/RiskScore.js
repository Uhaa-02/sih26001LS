const mongoose = require("mongoose");

const RiskScoreSchema = new mongoose.Schema({
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  riskProbability: { type: Number, required: true, min: 0, max: 1 },
  riskTier: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
  topContributingFactors: [
    {
      feature: String,
      impact: Number,
    },
  ],
  source: {
    type: String,
    enum: ["live_prediction", "crowdsourced_nudge", "manual_override"],
    default: "live_prediction",
  },
  inputSnapshot: { type: mongoose.Schema.Types.Mixed }, // raw feature vector used for this score
  createdAt: { type: Date, default: Date.now },
});

RiskScoreSchema.index({ zoneId: 1, createdAt: -1 });

module.exports = mongoose.model("RiskScore", RiskScoreSchema);
