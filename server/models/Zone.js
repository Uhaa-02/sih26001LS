const mongoose = require("mongoose");

const ZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  // Static/slow-changing features used alongside live telemetry for scoring
  slopeDegrees: Number,
  lithologyIndex: Number,
  elevationM: Number,
  landCoverIndex: Number,
  distanceToFaultKm: Number,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Zone", ZoneSchema);
