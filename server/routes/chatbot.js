const express = require("express");
const router = express.Router();

router.post("/intent", (req, res) => {
  const { intent } = req.body;

  if (intent === "NEAREST_SHELTER") {
    return res.json({
      reply: "📍 Nearest Active Emergency Shelters:\n1. District Indoor Sports Complex, Gangtok (Capacity: 500)\n2. St. Xavier School Relief Center (Capacity: 350)"
    });
  }

  if (intent === "NEAREST_HOSPITAL") {
    return res.json({
      reply: "🏥 Emergency Medical Response Units:\n1. STNM Multi-Specialty Hospital, Sochakgang (8.4 km)\n2. Central Referral Hospital Manipal (11.2 km)"
    });
  }

  if (intent === "EVACUATION_STEPS") {
    return res.json({
      reply: "🚨 Official MoDNER Landslide Protocol:\n1. Evacuate perpendicular to mud flow\n2. Avoid valley bottoms & natural drainage paths\n3. Proceed to nearest high-ground relief shelter"
    });
  }

  return res.json({ reply: "MoDNER Control Room active. Select an option above to view emergency procedures." });
});

module.exports = router;