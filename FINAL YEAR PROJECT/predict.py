from fastapi import APIRouter
from pydantic import BaseModel
import pickle
import numpy as np

router = APIRouter()

# Load model
model = pickle.load(open("models/diabetes_model.pkl", "rb"))

class DiabetesInput(BaseModel):
    Pregnancies: int
    Glucose: float
    BloodPressure: float
    SkinThickness: float
    Insulin: float
    BMI: float
    DiabetesPedigreeFunction: float
    Age: int

@router.post("/predict/diabetes")
def predict_diabetes(data: DiabetesInput):
    features = np.array([[data.Pregnancies, data.Glucose, data.BloodPressure,
                          data.SkinThickness, data.Insulin, data.BMI,
                          data.DiabetesPedigreeFunction, data.Age]])
    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0][1]
    return {
        "prediction": int(prediction),
        "probability": round(probability, 3)
    }
