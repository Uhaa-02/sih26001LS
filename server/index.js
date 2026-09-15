require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const zonesRouter = require("./routes/zones");
const predictRouter = require("./routes/predict");
const feedbackRouter = require("./routes/crowdsourced_feedback");
const { startTelemetryCron } = require("./cron/telemetryFetcher");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.set("io", io);

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/zones", zonesRouter);
app.use("/api/predict", predictRouter);
app.use("/api/feedback", feedbackRouter);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`Client disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  // Demo recipients for Day 1-3 testing. In a full build these come from
  // real Subscriber/PoliceStation collections seeded per-district; for now
  // we wire in the two numbers from .env so the alert pipeline has someone
  // real to actually send to.
  //
  // The demo police "station" is pinned near Munnar Ridge's coordinates
  // (10.09, 77.06) so it falls inside the 15km geofence radius used by
  // findNearestPoliceStations when you trigger alerts on that seeded zone.
  if (process.env.DEMO_PUBLIC_TEST_NUMBER) {
    app.set("publicSubscribers", [{ phone: process.env.DEMO_PUBLIC_TEST_NUMBER }]);
  }
  if (process.env.DEMO_POLICE_NUMBER) {
    app.set("policeStations", [
      {
        name: "Munnar Control Room (Simulated)",
        phone: process.env.DEMO_POLICE_NUMBER,
        lat: 10.09,
        lng: 77.06,
      },
    ]);
  }

  // Placeholder sources for Day 1 — swap for real Police/Subscriber
  // collections once seeded (see scripts/seed_shelters.js pattern).
  const getPoliceStations = async () => app.get("policeStations") || [];
  const getPublicSubscribers = async () => app.get("publicSubscribers") || [];

  startTelemetryCron(io, { getPoliceStations, getPublicSubscribers });

  server.listen(PORT, () => console.log(`Clairveil server running on port ${PORT}`));
}

start();