"""FINDRISC: Finnish Diabetes Risk Score for the 10-year risk of type 2 diabetes (0-26 points).

Lindström J, Tuomilehto J. The diabetes risk score: a practical tool to predict type 2 diabetes
risk. Diabetes Care 2003;26:725-731. Points and risk bands as on the published questionnaire.
"""
from .result import band, needs_input, not_applicable, ok

MODEL = {
    "id": "findrisc",
    "name": "FINDRISC (Finnish Diabetes Risk Score)",
    "reference": "Lindström J, Tuomilehto J. Diabetes Care 2003;26:725-731",
}

# Total score bands and the published estimate of how many people in each band develop diabetes in 10 years
BAND_CUTS = [7, 12, 15, 21]
BAND_NAMES = ["low", "slightlyElevated", "moderate", "high", "veryHigh"]
TEN_YEAR_RISK = ["1 in 100", "1 in 25", "1 in 6", "1 in 3", "1 in 2"]

WAIST_CUTS = {"male": (94, 102), "female": (80, 88)}  # cm


def points(*, age, bmi, waist, sex, active, fruit_veg, bp_medication, high_glucose, family):
    low, high = WAIST_CUTS[sex]
    return {
        "age": 0 if age < 45 else 2 if age < 55 else 3 if age < 65 else 4,
        "bmi": 0 if bmi < 25 else 1 if bmi <= 30 else 3,
        "waist": 0 if waist < low else 3 if waist <= high else 4,
        "activity": 0 if active else 2,
        "fruitVeg": 0 if fruit_veg else 1,
        "bpMedication": 2 if bp_medication else 0,
        "highGlucose": 5 if high_glucose else 0,
        "family": {"no": 0, "extended": 3, "immediate": 5}[family],
    }


def assess(profile):
    missing = profile.missing(
        "age", "sex", "height", "weight", "waist", "dailyActivity", "fruitVeg",
        "bpMedication", "highGlucoseHistory", "familyDiabetes",
    )
    if missing:
        return needs_input(MODEL, missing)
    if profile.age < 18:
        return not_applicable(MODEL, "adultsOnly")
    if profile.has_condition("diabetes"):
        return not_applicable(MODEL, "alreadyDiabetes")

    breakdown = points(
        age=profile.age,
        bmi=profile.bmi,
        waist=profile.waist,
        sex=profile.sex,
        active=profile.dailyActivity == "yes",
        fruit_veg=profile.fruitVeg == "yes",
        bp_medication=profile.bpMedication == "yes",
        high_glucose=profile.highGlucoseHistory == "yes",
        family=profile.familyDiabetes,
    )
    total = sum(breakdown.values())
    level = band(total, BAND_CUTS)
    return ok(
        MODEL,
        total,
        unit="points",
        category=BAND_NAMES[level],
        level=level,
        details={"maxPoints": 26, "points": breakdown, "tenYearRisk": TEN_YEAR_RISK[level], "horizonYears": 10},
    )
