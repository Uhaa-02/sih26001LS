from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import xgboost as xgb
import pandas as pd

app = FastAPI()

# Load model
model = xgb.Booster()
model.load_model("landslide_model.json")

class TelemetryInput(BaseModel):
    precipitation_mm: float
    soil_moisture: float
    slope_angle: float
    elevation: float

@app.post("/predict")
def predict_risk(data: TelemetryInput):
    try:
        # Pass data as a Pandas DataFrame with explicit feature names
        input_df = pd.DataFrame([{
            "precipitation_mm": data.precipitation_mm,
            "soil_moisture": data.soil_moisture,
            "slope_angle": data.slope_angle,
            "elevation": data.elevation
        }])
        
        # Convert to DMatrix
        dmatrix = xgb.DMatrix(input_df)
        prediction = model.predict(dmatrix)
        risk_prob = float(prediction[0])
        
        return {"riskProbability": round(risk_prob, 2)}
    
    except Exception as e:
        print(f"❌ Prediction Error Trace: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))