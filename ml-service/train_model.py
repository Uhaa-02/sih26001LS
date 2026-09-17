"""
train_model.py
Trains the Clairveil XGBoost landslide-risk model on the 4 live features
the Node server sends: precipitation_mm, soil_moisture, slope_angle, elevation.

Render runs this during the build, so landslide_model.json never needs
to be committed to GitHub.

NOTE: the training data is synthetic, generated from known landslide
triggers (steep slopes, heavy rain, saturated soil, mid-hill elevations).
Replace generate_training_data() with real GSI / Bhu-Kosh records when ready.
"""

import os
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

FEATURES = ["precipitation_mm", "soil_moisture", "slope_angle", "elevation"]
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "landslide_model.json")


def generate_training_data(n=20000, seed=42):
    rng = np.random.default_rng(seed)
    precipitation = rng.gamma(shape=0.8, scale=8.0, size=n).clip(0, 80)   # mm per hour
    soil_moisture = rng.uniform(0.05, 0.55, size=n)                        # m3/m3
    slope = rng.uniform(5, 60, size=n)                                     # degrees
    elevation = rng.uniform(50, 3000, size=n)                              # metres

    # Landslide likelihood rises with rain, saturation and slope;
    # mid-hill elevations (800-2200 m) are most failure-prone.
    elevation_effect = -((elevation - 1500) / 900) ** 2
    logit = (
        -6.0
        + 0.09 * precipitation
        + 7.0 * soil_moisture
        + 0.07 * slope
        + 0.8 * elevation_effect
        + 0.03 * precipitation * soil_moisture * 10
        + rng.normal(0, 0.6, size=n)
    )
    prob = 1 / (1 + np.exp(-logit))
    label = (rng.uniform(size=n) < prob).astype(int)

    return pd.DataFrame({
        "precipitation_mm": precipitation,
        "soil_moisture": soil_moisture,
        "slope_angle": slope,
        "elevation": elevation,
        "landslide": label,
    })


def train():
    df = generate_training_data()
    X, y = df[FEATURES], df["landslide"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="logloss",
    )
    model.fit(X_train, y_train)

    auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    print(f"Training rows: {len(df)} | Positive rate: {y.mean():.2%} | Test ROC-AUC: {auc:.3f}")

    model.get_booster().save_model(MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    train()