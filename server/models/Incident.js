const mongoose = require("mongoose");

const IncidentSchema = new mongoose.Schema({
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  description: String,
  severityEstimate: { type: Number, min: 0, max: 1, required: true },
  photoUrl: String,
  location: {
    lat: Number,
    lng: Number,
  },
  reportedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending_review", "applied_to_model", "rejected"],
    default: "pending_review",
  },
});

module.exports = mongoose.model("Incident", IncidentSchema);
