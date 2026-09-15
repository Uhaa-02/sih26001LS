const twilio = require("twilio");
const Alert = require("../models/Alert");

function getClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null; // allows the server to boot without Twilio creds set yet
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const RISK_THRESHOLDS = { HIGH: 0.5, CRITICAL: 0.75 };

async function sendSms(to, body) {
  const client = getClient();
  if (!client) {
    console.warn(`[SMS SKIPPED - no Twilio creds] Would send to ${to}: ${body}`);
    return { sid: "SIMULATED_NO_CREDS" };
  }
  return client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body });
}

async function findNearestPoliceStations(zoneLat, zoneLng, policeStations, radiusKm = 15) {
  return policeStations
    .map((ps) => ({ ...ps, distanceKm: haversineKm(zoneLat, zoneLng, ps.lat, ps.lng) }))
    .filter((ps) => ps.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function dispatchAlertsForZone({ zone, riskProbability, policeStations, publicSubscribers }) {
  let tier = null;
  if (riskProbability >= RISK_THRESHOLDS.CRITICAL) tier = "CRITICAL";
  else if (riskProbability >= RISK_THRESHOLDS.HIGH) tier = "HIGH";
  if (!tier) return { dispatched: false, reason: "Below alert threshold" };

  const publicMessage =
    `[Clairveil ${tier} ALERT] Landslide risk detected near ${zone.name}. ` +
    `Risk level: ${Math.round(riskProbability * 100)}%. Move to higher ground and follow local authority guidance.`;

  const policeMessage =
    `[Clairveil ${tier} ALERT - CONTROL ROOM] Zone: ${zone.name} (${zone.lat},${zone.lng}). ` +
    `Risk: ${Math.round(riskProbability * 100)}%. Dispatch assessment/evacuation support if warranted.`;

  const nearbyStations = await findNearestPoliceStations(zone.lat, zone.lng, policeStations);
  const smsResults = [];

  for (const subscriber of publicSubscribers) {
    try {
      const res = await sendSms(subscriber.phone, publicMessage);
      smsResults.push({ to: subscriber.phone, sid: res.sid, type: "public" });
    } catch (err) {
      smsResults.push({ to: subscriber.phone, error: err.message, type: "public" });
    }
  }

  for (const station of nearbyStations) {
    try {
      const res = await sendSms(station.phone, policeMessage);
      smsResults.push({ to: station.phone, sid: res.sid, type: "police", distanceKm: station.distanceKm });
    } catch (err) {
      smsResults.push({ to: station.phone, error: err.message, type: "police" });
    }
  }

  await Alert.create({
    zoneId: zone._id,
    riskProbability,
    tier,
    dispatchedAt: new Date(),
    recipients: smsResults,
  });

  return { dispatched: true, tier, recipientCount: smsResults.length, smsResults };
}

module.exports = { dispatchAlertsForZone, findNearestPoliceStations };
