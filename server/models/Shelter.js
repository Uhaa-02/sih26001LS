const mongoose = require("mongoose");

const ShelterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  capacity: { type: Number, required: true },
  currentOccupancy: { type: Number, default: 0 },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  status: {
    type: String,
    enum: ["vacant", "near_full", "full"],
    default: "vacant",
  },
  contactPhone: String,
});

module.exports = mongoose.model("Shelter", ShelterSchema);
