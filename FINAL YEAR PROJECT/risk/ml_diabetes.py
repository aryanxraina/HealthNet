"""Experimental diabetes estimate from HealthNet's own model, trained on the Pima Indians Diabetes
dataset (768 women aged 21+ of Pima heritage). See train_diabetes_model.py.

Shown only as an alternative to FINDRISC, and only for women aged 21 or over, because:
- the training data covers a single population of women;
- the dataset's glucose is a 2-hour oral glucose tolerance test, but we pass fasting glucose;
- skin thickness and insulin are not asked, so the model fills in typical values;
- the "diabetes pedigree" input is estimated from the family-history answer.
"""
import pickle

import pandas as pd

from train_diabetes_model import FEATURES, MODEL_PATH

from .result import band, needs_input, not_applicable, ok, percent

MODEL = {
    "id": "mlDiabetes",
    "name": "HealthNet experimental model (logistic regression, Pima dataset)",
    "reference": "Smith JW et al. Proc Annu Symp Comput Appl Med Care 1988:261-265 (dataset)",
    "experimental": True,
}

# Quartiles of DiabetesPedigreeFunction in diabetes.csv, standing in for the family-history answer
PEDIGREE = {"no": 0.244, "extended": 0.372, "immediate": 0.626}

# HealthNet display bands for the estimated probability
BAND_CUTS = [20, 40, 60]
BAND_NAMES = ["low", "moderate", "high", "veryHigh"]

_model = None


def _load():
    global _model
    if _model is None:
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
    return _model


def assess(profile):
    missing = profile.missing("age", "sex", "fastingGlucose", "diastolic", "height", "weight", "familyDiabetes", "pregnancies")
    if profile.sex == "male":
        return not_applicable(MODEL, "womenOnly")
    if missing:
        return needs_input(MODEL, missing)
    if profile.age < 21:
        return not_applicable(MODEL, "ageMin", min=21)
    if profile.has_condition("diabetes"):
        return not_applicable(MODEL, "alreadyDiabetes")

    features = pd.DataFrame([{
        "Pregnancies": profile.pregnancies,
        "Glucose": profile.fastingGlucose,
        "BloodPressure": profile.diastolic,
        "SkinThickness": 0,  # 0 = not measured; the model's pipeline fills in the median
        "Insulin": 0,
        "BMI": profile.bmi,
        "DiabetesPedigreeFunction": PEDIGREE[profile.familyDiabetes],
        "Age": profile.age,
    }], columns=FEATURES)
    probability = float(_load().predict_proba(features)[0][1])
    value = percent(probability)
    level = band(value, BAND_CUTS)
    return ok(
        MODEL,
        value,
        unit="%",
        category=BAND_NAMES[level],
        level=[0, 2, 3, 4][level],
        details={"experimental": True},
        assumptions=["fastingGlucoseForOgtt", "skinInsulinImputed", "pedigreeFromFamilyHistory"],
    )
