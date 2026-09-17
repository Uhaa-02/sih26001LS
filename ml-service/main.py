import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import xgboost as xgb
import pandas as pd

app = FastAPI(title="Clairveil ML Service")

FEATURES = ["precipitation_mm", "soil_moisture", "slope_angle", "elevation"]
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "landslide_model.json")

# Load the trained XGBoost model (created by train_model.py)
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(
        f"Model file not found at {MODEL_PATH}. Run `python train_model.py` first."
    )
model = xgb.Booster()
model.load_model(MODEL_PATH)


class TelemetryInput(BaseModel):
    precipitation_mm: float
    soil_moisture: float
    slope_angle: float
    elevation: float


def risk_tier(prob: float) -> str:
    if prob >= 0.75:
        return "CRITICAL"
    if prob >= 0.50:
        return "HIGH"
    if prob >= 0.25:
        return "MEDIUM"
    return "LOW"


@app.get("/health")
def health():
    return {"status": "ok", "model": "xgboost", "features": FEATURES}


@app.post("/predict")
def predict_risk(data: TelemetryInput):
    try:
        input_df = pd.DataFrame([{f: getattr(data, f) for f in FEATURES}])
        dmatrix = xgb.DMatrix(input_df)

        risk_prob = float(model.predict(dmatrix)[0])

        # XGBoost's built-in SHAP values: how much each feature pushed the risk up or down
        contribs = model.predict(dmatrix, pred_contribs=True)[0][:-1]
        factors = sorted(
            ({"feature": f, "impact": round(float(c), 3)} for f, c in zip(FEATURES, contribs)),
            key=lambda x: abs(x["impact"]),
            reverse=True,
        )

        return {
            "riskProbability": round(risk_prob, 2),
            "riskTier": risk_tier(risk_prob),
            "topContributingFactors": factors[:3],
            "model": "xgboost",
        }

    except Exception as e:
        print(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))