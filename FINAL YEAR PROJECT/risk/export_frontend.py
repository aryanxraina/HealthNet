"""Copies the risk engine's data to the frontend's on-device engine and writes its parity fixture.

The browser runs a JavaScript port of this package (healthnet-frontend/src/risk/) so health profiles
never have to leave the device. This Python package stays the reference implementation:

    python -m risk.export_frontend          # from "FINAL YEAR PROJECT/"

writes, under healthnet-frontend/src/risk/:
  data/who_cvd.json, data/prevent.json   identical copies of risk/data/
  data/diabetes_model.json               the experimental model's fitted parameters (no pickle needed)
  __fixtures__/parity.json               Python results for seeded random and edge-case profiles,
                                         plus the WHO Stata reference cases

The frontend tests require identical results, and tests/test_frontend_parity.py fails when these
files are out of date. Re-run this after any change to the engine or its data.
"""
import csv
import json
import pickle
import random
from pathlib import Path

from pydantic import ValidationError

from . import DISCLAIMER, VERSION, assess
from .profile import Profile

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / "data"
FRONTEND = ROOT.parent / "healthnet-frontend" / "src" / "risk"
MODEL_PATH = ROOT / "diabetes_model.pkl"
WHO_REFERENCE = ROOT / "tests" / "fixtures" / "who_stata_reference.csv"
SEED = 2026
RANDOM_CASES = 300

CHOICES = {
    "sex": ["female", "male"],
    "smoking": ["never", "former", "current"],
    "dailyActivity": ["yes", "no"],
    "fruitVeg": ["yes", "no"],
    "auditFrequency": ["never", "monthly", "twoToFourMonth", "twoToThreeWeek", "fourPlusWeek"],
    "auditTypical": ["oneTwo", "threeFour", "fiveSix", "sevenNine", "tenPlus"],
    "auditBinge": ["never", "lessMonthly", "monthly", "weekly", "daily"],
    "bpMedication": ["yes", "no"],
    "statin": ["yes", "no", "unsure"],
    "highGlucoseHistory": ["yes", "no"],
    "familyDiabetes": ["no", "extended", "immediate"],
    "parentsHypertension": ["none", "one", "both", "unsure"],
    "snoring": ["yes", "no"],
    "tired": ["yes", "no"],
    "observedApnea": ["yes", "no"],
}
# (low, high, decimals): ranges a little wider than the validators allow are not used, so every
# random profile is valid; values near the calculators' own limits are covered by EDGE_CASES
NUMBERS = {
    "height": (140, 200, 1), "weight": (40, 140, 1), "waist": (60, 140, 1), "neck": (28, 50, 1),
    "systolic": (90, 200, 0), "diastolic": (55, 110, 0), "fastingGlucose": (65, 220, 0), "hba1c": (4.5, 11, 1),
    "totalCholesterol": (110, 340, 0), "hdlCholesterol": (20, 110, 0), "egfr": (10, 150, 0), "creatinine": (0.4, 4, 2),
}
CONDITIONS = ["diabetes", "hypertension", "heartDisease", "stroke", "kidneyDisease", "asthma"]

FULL = {
    "age": 52, "sex": "female", "country": "GB", "height": 165, "weight": 72, "waist": 88, "neck": 35,
    "smoking": "never", "dailyActivity": "yes", "fruitVeg": "yes", "auditFrequency": "monthly", "auditTypical": "oneTwo",
    "auditBinge": "never", "conditions": ["none"], "bpMedication": "no", "statin": "no", "highGlucoseHistory": "no",
    "familyDiabetes": "no", "parentsHypertension": "none", "pregnancies": 2, "systolic": 124, "diastolic": 78,
    "fastingGlucose": 95, "hba1c": 5.6, "totalCholesterol": 200, "hdlCholesterol": 55, "egfr": 90,
    "phq1": 1, "phq2": 0, "phq3": 1, "phq4": 0, "snoring": "no", "tired": "no", "observedApnea": "no",
}
# Boundaries of every calculator: age limits, lab thresholds, range checks, exact band edges
EDGE_CASES = [
    {}, {"age": 17}, {"age": 18}, {"age": 20}, {"age": 21}, {"age": 29}, {"age": 30}, {"age": 39}, {"age": 40},
    {"age": 59}, {"age": 60}, {"age": 79}, {"age": 80}, {"age": 81}, {"sex": "male"},
    {"hba1c": 6.5}, {"hba1c": None}, {"fastingGlucose": 126}, {"conditions": ["diabetes"]}, {"conditions": ["hypertension"]},
    {"conditions": ["heartDisease"]}, {"conditions": ["stroke", "kidneyDisease"]}, {"bpMedication": "yes"},
    {"systolic": 140}, {"diastolic": 90}, {"systolic": 139, "diastolic": 89}, {"systolic": 180}, {"systolic": 181},
    {"systolic": 90}, {"systolic": 89}, {"totalCholesterol": 130}, {"totalCholesterol": 129}, {"totalCholesterol": 320},
    {"totalCholesterol": 321}, {"hdlCholesterol": 20}, {"hdlCholesterol": 101}, {"totalCholesterol": None},
    {"egfr": None, "creatinine": 1.1}, {"egfr": None, "creatinine": 0.6, "sex": "male"}, {"egfr": 14}, {"egfr": 141},
    {"egfr": None}, {"hba1c": 4.4}, {"hba1c": 15.1, "fastingGlucose": 300}, {"statin": "unsure"}, {"statin": "yes"},
    {"parentsHypertension": "unsure"}, {"parentsHypertension": "both"}, {"smoking": "current"}, {"smoking": "former"},
    {"height": 200, "weight": 100}, {"height": 200, "weight": 74}, {"height": 160, "weight": 76.8},
    {"height": 150, "weight": 90}, {"height": 150, "weight": 110}, {"height": 145, "weight": 40},
    {"waist": 82.5}, {"waist": 80}, {"waist": 88}, {"waist": 89}, {"waist": None}, {"sex": "male", "waist": 94},
    {"sex": "male", "waist": 102}, {"sex": "male", "waist": 103}, {"neck": 40}, {"neck": 41},
    {"snoring": "yes", "tired": "yes"}, {"snoring": "yes", "tired": "yes", "observedApnea": "yes", "age": 60, "sex": "male"},
    {"phq1": 3, "phq2": 3, "phq3": 3, "phq4": 3}, {"phq1": 2, "phq2": 1}, {"phq3": 2, "phq4": 1}, {"phq4": None},
    {"auditFrequency": "never", "auditTypical": None, "auditBinge": None}, {"auditFrequency": "fourPlusWeek", "auditTypical": "tenPlus", "auditBinge": "daily"},
    {"auditFrequency": "monthly", "auditTypical": "fiveSix"}, {"sex": "male", "auditTypical": "threeFour", "auditBinge": "lessMonthly"},
    {"auditTypical": None}, {"familyDiabetes": "immediate", "highGlucoseHistory": "yes"}, {"familyDiabetes": "extended"},
    {"pregnancies": None}, {"pregnancies": 0}, {"fastingGlucose": None}, {"country": "IN"}, {"country": "US"},
    {"country": "NG"}, {"country": "JP"}, {"country": "BR"}, {"country": "ZZ"}, {"country": None},
    {"dailyActivity": "no", "fruitVeg": "no"}, {"sex": None}, {"age": None}, {"height": None},
]
# Profiles the validator rejects; the frontend engine must reject them too
INVALID = [
    {"age": -1}, {"age": 121}, {"age": 50.5}, {"sex": "other"}, {"country": "gb"}, {"country": "GBR"},
    {"height": 49}, {"weight": 301}, {"systolic": 69}, {"diastolic": 151}, {"hba1c": 21}, {"creatinine": 0.1},
    {"smoking": "sometimes"}, {"conditions": ["flu"]}, {"phq1": 4}, {"phq2": -1}, {"pregnancies": 21},
    {"statin": "maybe"}, {"egfr": 4},
]


def random_profile(rng):
    profile = {}
    if rng.random() < 0.95:
        profile["age"] = rng.randint(15, 95)
    for field, options in CHOICES.items():
        if rng.random() < 0.85:
            profile[field] = rng.choice(options)
    if rng.random() < 0.9:
        profile["country"] = rng.choice(COUNTRIES)
    for field, (low, high, decimals) in NUMBERS.items():
        if rng.random() < (0.85 if field not in ("hba1c", "creatinine", "egfr") else 0.5):
            value = round(rng.uniform(low, high), decimals)
            profile[field] = int(value) if decimals == 0 else value
    if rng.random() < 0.85:
        picked = [c for c in CONDITIONS if rng.random() < 0.12]
        profile["conditions"] = picked or ["none"]
    if rng.random() < 0.8:
        profile["pregnancies"] = rng.randint(0, 8)
    for field in ("phq1", "phq2", "phq3", "phq4"):
        if rng.random() < 0.85:
            profile[field] = rng.randint(0, 3)
    return profile


def scores_without_models(result):
    return {score_id: {k: v for k, v in score.items() if k != "model"} for score_id, score in result["scores"].items()}


def diabetes_model():
    with open(MODEL_PATH, "rb") as f:
        pipeline = pickle.load(f)
    fill, scale, classify = (pipeline.named_steps[name] for name in ("fill_missing", "scale", "classify"))
    features = [str(name) for name in fill.feature_names_in_]
    imputer = fill.named_transformers_["median"]
    # The ColumnTransformer outputs its transformed columns first, then the passthrough ones
    order, medians = [], {}
    for name, transformer, columns in fill.transformers_:
        names = [features[c] if isinstance(c, int) else c for c in columns]
        if name == "median":
            medians = {column: float(value) for column, value in zip(names, imputer.statistics_)}
        order.extend(names)
    return {
        "features": features,
        "columnOrder": order,
        "missingValue": imputer.missing_values,
        "medians": medians,
        "mean": [float(x) for x in scale.mean_],
        "scale": [float(x) for x in scale.scale_],
        "coef": [float(x) for x in classify.coef_[0]],
        "intercept": float(classify.intercept_[0]),
    }


def who_reference():
    with open(WHO_REFERENCE) as f:
        rows = list(csv.DictReader(line for line in f if not line.startswith("#")))
    return [
        {"age": float(r["age"]), "sex": r["sex"], "sbp": float(r["sbp"]), "cholesterol": float(r["cholesterol"]),
         "bmi": float(r["bmi"]), "smoking": r["smoking"] == "1", "diabetes": r["diabetes"] == "1",
         "country": r["country"], "year": int(r["year"]), "refLab": float(r["ref_lab"]), "refNonlab": float(r["ref_nonlab"])}
        for r in rows
    ]


COUNTRIES = sorted(json.loads((DATA / "who_cvd.json").read_text(encoding="utf-8"))["countryRegion"])


def build():
    """{relative path: text} for every generated file."""
    rng = random.Random(SEED)
    profiles = [{k: v for k, v in {**FULL, **edge}.items() if v is not None} for edge in EDGE_CASES]
    profiles += [random_profile(rng) for _ in range(RANDOM_CASES)]
    cases, models = [], {}
    for profile in profiles:
        result = assess(Profile(**profile))
        for score_id, score in result["scores"].items():
            models.setdefault(score_id, score["model"])
        cases.append({"profile": profile, "scores": scores_without_models(result)})
    for profile in INVALID:
        try:
            Profile(**{**FULL, **profile})
        except ValidationError:
            continue
        raise AssertionError(f"expected the validator to reject {profile}")

    parity = {
        "engineVersion": VERSION,
        "disclaimer": DISCLAIMER,
        "models": models,
        "cases": cases,
        "invalid": [{**FULL, **profile} for profile in INVALID],
        "whoReference": who_reference(),
    }
    compact = dict(separators=(",", ":"), ensure_ascii=False)
    return {
        "data/who_cvd.json": (DATA / "who_cvd.json").read_text(encoding="utf-8"),
        "data/prevent.json": (DATA / "prevent.json").read_text(encoding="utf-8"),
        "data/diabetes_model.json": json.dumps(diabetes_model(), indent=2) + "\n",
        "__fixtures__/parity.json": json.dumps(parity, **compact) + "\n",
    }


def main():
    for relative, text in build().items():
        path = FRONTEND / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {path.relative_to(ROOT.parent)} ({len(text.encode()) // 1024} KB)")


if __name__ == "__main__":
    main()
