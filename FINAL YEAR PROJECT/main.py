from fastapi import FastAPI
from pydantic import BaseModel
import pickle
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

model = pickle.load(open("diabetes_model.pkl", "rb"))

class DiabetesInput(BaseModel):
    Pregnancies: int
    Glucose: float
    BloodPressure: float
    SkinThickness: float
    Insulin: float
    BMI: float
    DiabetesPedigreeFunction: float
    Age: int

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/predict-diabetes")
def predict(data: DiabetesInput):
    features = np.array([[data.Pregnancies, data.Glucose, data.BloodPressure,
                          data.SkinThickness, data.Insulin, data.BMI,
                          data.DiabetesPedigreeFunction, data.Age]])
    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0][1]
    return {
        "prediction": int(prediction),
        "probability": round(probability, 2)
    }
