require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const { startTelemetryCron } = require("./cron/telemetryFetcher");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Attach io to req for route handlers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Serve static assets (file uploads and UI static files)
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "public")));

app.set("io", io);

// Health check endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Express route registrations
app.use("/api/zones", require("./routes/zones"));
app.use("/api/predict", require("./routes/predict"));
app.use("/api/crowdsourced_feedback", require("./routes/crowdsourced_feedback"));
app.use("/api/feedback", require("./routes/crowdsourced_feedback")); // Alias for backward compatibility
app.use("/api/chatbot", require("./routes/chatbot"));

// Fallback route to serve the Clairveil Ops Room UI
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`Client disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  // Demo recipients for Day 1-3 testing.
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

  const getPoliceStations = async () => app.get("policeStations") || [];
  const getPublicSubscribers = async () => app.get("publicSubscribers") || [];

  startTelemetryCron(io, { getPoliceStations, getPublicSubscribers });

  server.listen(PORT, () => console.log(`Clairveil server running on port ${PORT}`));
}

start();