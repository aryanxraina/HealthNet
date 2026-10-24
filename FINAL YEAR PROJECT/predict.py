import pickle

import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel, Field

from train_diabetes_model import FEATURES, MODEL_PATH

router = APIRouter()

# Load the model once, from next to this file, so it works from any working directory
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)


class DiabetesInput(BaseModel):
    # 0 means "not measured" for Glucose, BloodPressure, SkinThickness, Insulin and BMI;
    # the model fills those in with typical values
    Pregnancies: int = Field(ge=0, le=25)
    Glucose: float = Field(ge=0, le=400)
    BloodPressure: float = Field(ge=0, le=250)
    SkinThickness: float = Field(ge=0, le=100)
    Insulin: float = Field(ge=0, le=1000)
    BMI: float = Field(ge=0, le=80)
    DiabetesPedigreeFunction: float = Field(ge=0, le=3)
    Age: int = Field(ge=1, le=120)


@router.post("/predict-diabetes")
def predict_diabetes(data: DiabetesInput):
    features = pd.DataFrame([data.model_dump()], columns=FEATURES)
    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0][1]
    return {
        "prediction": int(prediction),
        "probability": round(float(probability), 3)
    }
