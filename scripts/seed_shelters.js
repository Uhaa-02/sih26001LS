/**
 * seed_shelters.js
 * Run with: node scripts/seed_shelters.js
 * Requires MONGO_URI in server/.env to point at a real MongoDB instance.
 *
 * Seeds a couple of demo zones (pick real landslide-prone coordinates,
 * e.g. Munnar/Idukki (Kerala), Darjeeling (WB), or Mussoorie (Uttarakhand))
 * plus a small shelter registry for the chatbot to query on Day 2.
 */
require("dotenv").config({ path: "../server/.env" });
const mongoose = require("../server/node_modules/mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const Zone = require("../server/models/Zone");
const Shelter = require("../server/models/Shelter");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  await Zone.deleteMany({});
  await Shelter.deleteMany({});

  const zones = await Zone.insertMany([
    {
      name: "Munnar Ridge",
      district: "Idukki",
      state: "Kerala",
      lat: 10.0889,
      lng: 77.0595,
      slopeDegrees: 38,
      lithologyIndex: 0.68,
      elevationM: 1600,
      landCoverIndex: 0.35,
      distanceToFaultKm: 22,
    },
    {
      name: "Darjeeling Hillside",
      district: "Darjeeling",
      state: "West Bengal",
      lat: 27.036,
      lng: 88.2627,
      slopeDegrees: 42,
      lithologyIndex: 0.74,
      elevationM: 2050,
      landCoverIndex: 0.3,
      distanceToFaultKm: 15,
    },
  ]);

  await Shelter.insertMany([
    {
      name: "Munnar Community Hall",
      capacity: 200,
      currentOccupancy: 12,
      location: { lat: 10.092, lng: 77.062 },
      status: "vacant",
      contactPhone: "+91XXXXXXXXXX",
    },
    {
      name: "Darjeeling Govt. School Shelter",
      capacity: 150,
      currentOccupancy: 5,
      location: { lat: 27.041, lng: 88.266 },
      status: "vacant",
      contactPhone: "+91XXXXXXXXXX",
    },
  ]);

  console.log(`Seeded ${zones.length} zones and 2 shelters.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
