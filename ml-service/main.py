from fastapi import FastAPI
from pydantic import BaseModel
from xgboost_model import predict_risk, apply_crowdsourced_nudge

app = FastAPI(title="Clairveil ML Service")


class LiveFeatures(BaseModel):
    slope_degrees: float
    lithology_index: float
    seasonal_rainfall_mm: float
    soil_moisture_pct: float
    rock_displacement_mm_per_day: float
    elevation_m: float
    land_cover_index: float
    distance_to_fault_km: float


class NudgeRequest(BaseModel):
    zone_id: str
    ground_truth_severity: float
    current_score: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(features: LiveFeatures):
    return predict_risk(features.dict())


@app.post("/nudge")
def nudge(req: NudgeRequest):
    return {"adjusted_score": apply_crowdsourced_nudge(
        req.zone_id, req.ground_truth_severity, req.current_score
    )}
