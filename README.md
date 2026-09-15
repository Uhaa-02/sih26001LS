# Clairveil — Live AI-Based Landslide Warning & Emergency Response System

Smart India Hackathon (SIH) 72-hour rapid prototype. See `IMPLEMENTATION_PLAN.md`
for the full architecture, feasibility analysis, roadmap, and demo script.

## Day 1 status (this scaffold)
- ✅ ML microservice (`ml-service/`): XGBoost training pipeline, FastAPI
  `/predict` + `/nudge` endpoints, SHAP explainability. Trained and
  smoke-tested end-to-end on a synthetic Bhu-Kosh-style dataset.
- ✅ Node.js orchestrator (`server/`): Express + Socket.io skeleton, Mongo
  schemas (Zone, RiskScore, Alert, Incident, Shelter), Open-Meteo rainfall
  service, SMAP soil-moisture stand-in, IoT displacement simulator,
  15-minute telemetry cron, geo-fenced SMS alert service, crowdsourced
  feedback route. All modules verified to load with no syntax/require errors.
- ⬜ Real Bhu-Kosh data (currently synthetic — see `scripts/scrape_bhukosh.py`)
- ⬜ MongoDB Atlas connection string (needs real `MONGO_URI` in `server/.env`)
- ⬜ Twilio/Fast2SMS credentials (server runs without them; SMS calls log
  a "SIMULATED_NO_CREDS" warning instead of failing)
- ⬜ Frontend (`client/`) — Day 2
- ⬜ Chatbot engine — Day 2

## Quick start

### 1. ML microservice
```bash
cd ml-service
pip install -r requirements.txt
python scripts/generate_synthetic_bhukosh.py   # or your real Bhu-Kosh export
python xgboost_model.py                         # trains + saves the model
uvicorn main:app --reload --port 8000
```

### 2. Node.js backend
```bash
cd server
cp .env.example .env     # fill in MONGO_URI at minimum
npm install
npm run dev
```

### 3. Seed demo zones/shelters (once MONGO_URI is set)
```bash
node scripts/seed_shelters.js
```
