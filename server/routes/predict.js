const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/', async (req, res) => {
  try {
    const { precipitation_mm, soil_moisture, slope_angle, elevation } = req.body;

    // Send telemetry directly to Python ML Service running on port 5001
    const response = await axios.post('http://127.0.0.1:5001/predict', {
      precipitation_mm: parseFloat(precipitation_mm) || 0.0,
      soil_moisture: parseFloat(soil_moisture) || 0.20,
      slope_angle: parseFloat(slope_angle) || 35.0,
      elevation: parseFloat(elevation) || 1200.0
    });

    return res.json(response.data);
  } catch (err) {
    console.error('❌ Error forwarding to ML microservice:', err.message);
    return res.status(500).json({ 
      success: false, 
      error: 'ML service communication failed',
      riskProbability: 0.35 
    });
  }
});
const { dispatchAlertsForZone } = require("../services/alert_service");

// Manual Test Route for Fast2SMS
router.get("/test-sms", async (req, res) => {
  try {
    const testZone = {
      _id: "test_zone_123",
      name: "Test High-Risk Sector",
      lat: 30.3165,
      lng: 78.0322
    };

    const mockPoliceStations = [
      { name: "Central Police Control", phone: "+919390239411", lat: 30.3200, lng: 78.0350 }
    ];

    const mockSubscribers = [
      { phone: "+918500181622" }
    ];

    const result = await dispatchAlertsForZone({
      zone: testZone,
      riskProbability: 0.88, // Force CRITICAL tier (> 0.75)
      policeStations: mockPoliceStations,
      publicSubscribers: mockSubscribers
    });

    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
module.exports = router;