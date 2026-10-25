"""Framingham hypertension risk: 1-, 2- and 4-year risk of developing high blood pressure,
for adults without hypertension or diabetes.

Parikh NI, Pencina MJ, Wang TJ, et al. A risk score for predicting near-term incidence of
hypertension: the Framingham Heart Study. Ann Intern Med 2008;148:102-110.

Weibull model with the full-precision coefficients of the Framingham Heart Study's online
calculator (framinghamheartstudy.org/fhs-risk-functions/hypertension/):
    risk(t) = 1 - exp(-exp((ln t - (intercept + Σ βx)) / scale))
"""
import math

from .result import band, needs_input, not_applicable, ok, percent

MODEL = {
    "id": "framinghamHtn",
    "name": "Framingham hypertension risk score",
    "reference": "Parikh NI et al. Ann Intern Med 2008;148:102-110",
}

INTERCEPT = 22.949536
SCALE = 0.876925
BETA = {
    "female": -0.202933,
    "age": -0.156412,
    "bmi": -0.033881,
    "sbp": -0.05933,
    "dbp": -0.128468,
    "smoker": -0.190731,
    "parents": -0.166121,  # number of parents with high blood pressure (0-2)
    "age_dbp": 0.001624,
}

# Limits of the official calculator; at 140/90 or above, blood pressure is already high
AGE_RANGE = (20, 80)
SBP_LIMIT = 140
DBP_LIMIT = 90

# HealthNet display bands for 4-year risk (the paper defines no categories)
BAND_CUTS = [10, 20]
BAND_NAMES = ["low", "moderate", "high"]

PARENTS = {"none": 0, "one": 1, "both": 2, "unsure": 0}

# The calculator's "optimal" comparison person: same age and sex, BMI 22.5, BP 110.5/70.5, non-smoker
OPTIMAL = {"bmi": 22.5, "sbp": 110.5, "dbp": 70.5, "smoker": 0, "parents": 0}


def risks(*, age, female, bmi, sbp, dbp, smoker, parents):
    """{1: p, 2: p, 4: p} - probability of new hypertension within 1, 2 and 4 years."""
    x = {"female": float(female), "age": age, "bmi": bmi, "sbp": sbp, "dbp": dbp,
         "smoker": float(smoker), "parents": parents, "age_dbp": age * dbp}
    mu = INTERCEPT + sum(BETA[name] * value for name, value in x.items())
    return {years: 1 - math.exp(-math.exp((math.log(years) - mu) / SCALE)) for years in (1, 2, 4)}


def assess(profile):
    missing = profile.missing("age", "sex", "systolic", "diastolic", "height", "weight", "smoking", "parentsHypertension")
    if missing:
        return needs_input(MODEL, missing)
    if profile.treated_or_known_hypertension:
        return not_applicable(MODEL, "alreadyHypertension")
    if profile.systolic >= SBP_LIMIT or profile.diastolic >= DBP_LIMIT:
        return not_applicable(MODEL, "highReading", systolic=SBP_LIMIT, diastolic=DBP_LIMIT)
    if profile.has_diabetes:
        return not_applicable(MODEL, "diabetes")
    if not AGE_RANGE[0] <= profile.age <= AGE_RANGE[1]:
        return not_applicable(MODEL, "ageRange", min=AGE_RANGE[0], max=AGE_RANGE[1])

    person = dict(age=profile.age, female=profile.sex == "female")
    result = risks(**person, bmi=profile.bmi, sbp=profile.systolic, dbp=profile.diastolic,
                   smoker=profile.smoking == "current", parents=PARENTS[profile.parentsHypertension])
    optimal = risks(**person, **OPTIMAL)

    value = percent(result[4])
    level = band(value, BAND_CUTS)
    return ok(
        MODEL,
        value,
        unit="%",
        category=BAND_NAMES[level],
        level=min(level * 2, 4),
        details={
            "horizonYears": 4,
            "oneYear": percent(result[1]),
            "twoYear": percent(result[2]),
            "fourYear": value,
            "optimalFourYear": percent(optimal[4]),
        },
        assumptions=["parentsAssumedNone"] if profile.parentsHypertension == "unsure" else [],
    )
