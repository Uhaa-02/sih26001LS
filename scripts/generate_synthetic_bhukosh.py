"""
generate_synthetic_bhukosh.py

Generates a synthetic dataset that mirrors the structure and rough
statistical relationships of GSI's Bhu-Kosh/Bhusanket landslide inventory,
so the ML pipeline can be built and tested on Day 1 before/while the
real inventory is scraped and cleaned.

Swap this out for scripts/scrape_bhukosh.py output once you have the
real CSV — the column names match exactly, so xgboost_model.py needs
zero changes.
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)
N_RECORDS = 11000


def generate(n=N_RECORDS) -> pd.DataFrame:
    slope_degrees = np.clip(RNG.normal(28, 12, n), 0, 75)
    lithology_index = RNG.uniform(0, 1, n)  # 0 = stable rock, 1 = weak/weathered
    seasonal_rainfall_mm = np.clip(RNG.normal(180, 90, n), 5, 600)
    soil_moisture_pct = np.clip(RNG.normal(45, 18, n), 5, 100)
    rock_displacement_mm_per_day = np.clip(RNG.exponential(1.2, n), 0, 15)
    elevation_m = np.clip(RNG.normal(1200, 600, n), 50, 4500)
    land_cover_index = RNG.uniform(0, 1, n)  # 0 = dense forest, 1 = bare/deforested
    distance_to_fault_km = np.clip(RNG.exponential(20, n), 0.1, 150)

    # Latent risk score built from a weighted, non-linear combination
    # of the features, so the labels are learnable but noisy (realistic).
    latent = (
        0.035 * slope_degrees
        + 2.2 * lithology_index
        + 0.006 * seasonal_rainfall_mm
        + 0.02 * soil_moisture_pct
        + 0.55 * rock_displacement_mm_per_day
        + 1.1 * land_cover_index
        - 0.015 * distance_to_fault_km
        - 0.0006 * elevation_m
        + RNG.normal(0, 1.1, n)  # noise
    )

    prob = 1 / (1 + np.exp(-(latent - latent.mean()) / latent.std()))
    landslide_occurred = (RNG.uniform(0, 1, n) < prob).astype(int)

    df = pd.DataFrame(
        {
            "slope_degrees": slope_degrees.round(2),
            "lithology_index": lithology_index.round(3),
            "seasonal_rainfall_mm": seasonal_rainfall_mm.round(1),
            "soil_moisture_pct": soil_moisture_pct.round(1),
            "rock_displacement_mm_per_day": rock_displacement_mm_per_day.round(2),
            "elevation_m": elevation_m.round(0),
            "land_cover_index": land_cover_index.round(3),
            "distance_to_fault_km": distance_to_fault_km.round(2),
            "landslide_occurred": landslide_occurred,
        }
    )
    return df


if __name__ == "__main__":
    df = generate()
    out_path = "data/raw/bhukosh_inventory.csv"
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} synthetic records to {out_path}")
    print(df["landslide_occurred"].value_counts(normalize=True))
