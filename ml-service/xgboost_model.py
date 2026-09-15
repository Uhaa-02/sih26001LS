"""
xgboost_model.py
Trains an XGBoost risk model on Bhu-Kosh landslide inventory data
and exposes a scoring function used by the FastAPI /predict endpoint.
"""

import os
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import joblib
import shap

FEATURE_COLUMNS = [
    "slope_degrees",
    "lithology_index",
    "seasonal_rainfall_mm",
    "soil_moisture_pct",
    "rock_displacement_mm_per_day",
    "elevation_m",
    "land_cover_index",
    "distance_to_fault_km",
]

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "landslide_model.json")


def load_bhukosh_data(csv_path: str) -> pd.DataFrame:
    """Load and clean the Bhu-Kosh historical landslide inventory."""
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=FEATURE_COLUMNS + ["landslide_occurred"])
    df["risk_class"] = df["landslide_occurred"].astype(int)
    return df


def train_model(csv_path: str = None):
    if csv_path is None:
        csv_path = os.path.join(os.path.dirname(__file__), "data/raw/bhukosh_inventory.csv")

    df = load_bhukosh_data(csv_path)
    X = df[FEATURE_COLUMNS]
    y = df["risk_class"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    model = xgb.XGBClassifier(
        n_estimators=350,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=42,
    )

    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)[:, 1]
    print(classification_report(y_test, preds))
    print("ROC-AUC:", round(roc_auc_score(y_test, probs), 4))

    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save_model(MODEL_PATH)
    joblib.dump(model, os.path.join(MODEL_DIR, "landslide_model.joblib"))
    print(f"Model saved to {MODEL_PATH}")
    return model


def load_model():
    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH)
    return model


def predict_risk(live_features: dict) -> dict:
    """
    live_features example:
    {
        "slope_degrees": 34.2,
        "lithology_index": 0.72,
        "seasonal_rainfall_mm": 210.5,
        "soil_moisture_pct": 61.3,
        "rock_displacement_mm_per_day": 3.8,
        "elevation_m": 1450,
        "land_cover_index": 0.4,
        "distance_to_fault_km": 12.1
    }
    """
    model = load_model()
    row = pd.DataFrame([live_features])[FEATURE_COLUMNS]
    risk_prob = float(model.predict_proba(row)[0][1])

    if risk_prob >= 0.75:
        tier = "CRITICAL"
    elif risk_prob >= 0.5:
        tier = "HIGH"
    elif risk_prob >= 0.25:
        tier = "MEDIUM"
    else:
        tier = "LOW"

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(row)
    top_factors = sorted(
        zip(FEATURE_COLUMNS, shap_values[0]),
        key=lambda x: abs(x[1]),
        reverse=True,
    )[:3]

    return {
        "risk_probability": round(risk_prob, 4),
        "risk_tier": tier,
        "top_contributing_factors": [
            {"feature": f, "impact": round(float(v), 4)} for f, v in top_factors
        ],
    }


def apply_crowdsourced_nudge(zone_id: str, ground_truth_severity: float, current_score: float) -> float:
    """
    Blend a crowdsourced ground-truth severity report (0-1 scale) into
    the model's raw score using a bounded weighted nudge, so a single
    noisy report can't wildly destabilize the zone's risk.
    """
    NUDGE_WEIGHT = 0.15
    nudged_score = (1 - NUDGE_WEIGHT) * current_score + NUDGE_WEIGHT * ground_truth_severity
    return round(min(max(nudged_score, 0.0), 1.0), 4)


if __name__ == "__main__":
    train_model()
