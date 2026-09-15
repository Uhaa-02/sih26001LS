"""
scrape_bhukosh.py

TODO (Day 1, first task once you have internet access to GSI's portal):
Bhu-Kosh (https://bhukosh.gsi.gov.in) and Bhusanket landslide inventory
layers are typically distributed as shapefiles / WFS feature layers
through GSI's GIS portal rather than a simple REST API. Two realistic
approaches:

1. Manual export (fastest for a hackathon):
   - Log into Bhu-Kosh / Bhusanket, use the "Landslide Inventory" layer,
     draw an AOI (state/district), and export as Shapefile or CSV.
   - Drop the exported file into ml-service/data/raw/ and adapt the
     loader below to match its actual column names.

2. Programmatic WFS pull (if the portal exposes an OGC WFS endpoint):
   - Use `owslib` or a direct `requests` call to the WFS GetFeature
     endpoint with outputFormat=csv or application/json.
   - Example skeleton (URL/layer names must be confirmed against the
     live portal, they change over time):

       import requests
       WFS_URL = "https://bhukosh.gsi.gov.in/geoserver/wfs"
       params = {
           "service": "WFS",
           "version": "2.0.0",
           "request": "GetFeature",
           "typeName": "geonode:landslide_inventory",
           "outputFormat": "csv",
       }
       resp = requests.get(WFS_URL, params=params, timeout=60)
       with open("data/raw/bhukosh_inventory_raw.csv", "wb") as f:
           f.write(resp.content)

3. Once you have the raw export, write a small normalization step here
   that maps GSI's native column names to the schema xgboost_model.py
   expects:

   slope_degrees, lithology_index, seasonal_rainfall_mm,
   soil_moisture_pct, rock_displacement_mm_per_day, elevation_m,
   land_cover_index, distance_to_fault_km, landslide_occurred

   Slope/elevation usually come from a DEM (e.g., SRTM/Bhuvan DEM) joined
   by lat/lon to each inventory point if not already present in the export.

Until step 1/2 is done, use generate_synthetic_bhukosh.py to keep building
and testing the rest of the pipeline — the column schema is identical.
"""

def normalize_bhukosh_export(raw_csv_path: str, out_csv_path: str):
    import pandas as pd

    df = pd.read_csv(raw_csv_path)

    # EDIT THIS MAPPING once you've inspected the real export's columns:
    column_map = {
        # "GSI_COLUMN_NAME": "expected_column_name",
    }
    df = df.rename(columns=column_map)

    required = [
        "slope_degrees", "lithology_index", "seasonal_rainfall_mm",
        "soil_moisture_pct", "rock_displacement_mm_per_day", "elevation_m",
        "land_cover_index", "distance_to_fault_km", "landslide_occurred",
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing columns after mapping: {missing}. "
            f"Update column_map above to match the real GSI export."
        )

    df[required].to_csv(out_csv_path, index=False)
    print(f"Normalized {len(df)} records -> {out_csv_path}")


if __name__ == "__main__":
    print(__doc__)
