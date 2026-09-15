const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema({
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  riskProbability: { type: Number, required: true },
  tier: { type: String, enum: ["HIGH", "CRITICAL"], required: true },
  dispatchedAt: { type: Date, default: Date.now },
  recipients: [
    {
      to: String,
      type: { type: String, enum: ["public", "police"] },
      sid: String,
      distanceKm: Number,
      error: String,
    },
  ],
});

module.exports = mongoose.model("Alert", AlertSchema);
