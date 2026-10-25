"""Short validated screeners plus body measurements.

PHQ-4      Kroenke K et al. Psychosomatics 2009;50:613-621
STOP-Bang  Chung F et al. Chest 2016;149:631-638 (scoring and the high-risk refinement)
AUDIT-C    Bush K et al. Arch Intern Med 1998;158:1789-1795 (cut-offs: men ≥4, women ≥3)
BMI        WHO adult categories; waist-to-height ratio bands from NICE NG246 (2023)
"""
from .result import band, needs_input, not_applicable, ok

PHQ4 = {"id": "phq4", "name": "PHQ-4", "reference": "Kroenke K et al. Psychosomatics 2009;50:613-621"}
STOP_BANG = {"id": "stopBang", "name": "STOP-Bang", "reference": "Chung F et al. Chest 2016;149:631-638"}
AUDIT_C = {"id": "auditC", "name": "AUDIT-C", "reference": "Bush K et al. Arch Intern Med 1998;158:1789-1795"}
BODY = {"id": "bodyComposition", "name": "BMI and waist-to-height ratio", "reference": "WHO; NICE NG246 (2023)"}


def phq4(profile):
    missing = profile.missing("phq1", "phq2", "phq3", "phq4")
    if missing:
        return needs_input(PHQ4, missing)
    anxiety = profile.phq1 + profile.phq2  # GAD-2
    depression = profile.phq3 + profile.phq4  # PHQ-2
    total = anxiety + depression
    level = band(total, [3, 6, 9])
    return ok(
        PHQ4,
        total,
        unit="points",
        category=["normal", "mild", "moderate", "severe"][level],
        level=[0, 1, 3, 4][level],
        details={
            "maxPoints": 12,
            "anxiety": anxiety,
            "depression": depression,
            # A subscale score of 3 or more is a positive screen and worth discussing with a professional
            "anxietyPositive": anxiety >= 3,
            "depressionPositive": depression >= 3,
        },
    )


def stop_bang(profile):
    missing = profile.missing("snoring", "tired", "observedApnea", "age", "sex", "height", "weight", "neck", "bpMedication")
    if missing:
        return needs_input(STOP_BANG, missing)
    items = {
        "snoring": profile.snoring == "yes",
        "tired": profile.tired == "yes",
        "observed": profile.observedApnea == "yes",
        "pressure": profile.treated_or_known_hypertension,
        "bmi": profile.bmi > 35,
        "age": profile.age > 50,
        "neck": profile.neck > 40,
        "male": profile.sex == "male",
    }
    total = sum(items.values())
    stop = items["snoring"] + items["tired"] + items["observed"] + items["pressure"]
    high = total >= 5 or (stop >= 2 and (items["male"] or items["bmi"] or items["neck"]))
    if high:
        category, level = "high", 4
    elif total >= 3:
        category, level = "intermediate", 2
    else:
        category, level = "low", 0
    return ok(STOP_BANG, total, unit="points", category=category, level=level, details={"maxPoints": 8, "items": items})


AUDIT_POINTS = {
    "auditFrequency": {"never": 0, "monthly": 1, "twoToFourMonth": 2, "twoToThreeWeek": 3, "fourPlusWeek": 4},
    "auditTypical": {"oneTwo": 0, "threeFour": 1, "fiveSix": 2, "sevenNine": 3, "tenPlus": 4},
    "auditBinge": {"never": 0, "lessMonthly": 1, "monthly": 2, "weekly": 3, "daily": 4},
}


def audit_c(profile):
    drinks = profile.auditFrequency not in (None, "never")
    missing = profile.missing("auditFrequency", "sex", *(("auditTypical", "auditBinge") if drinks else ()))
    if missing:
        return needs_input(AUDIT_C, missing)
    # People who never drink score 0 and skip the two follow-up questions
    total = sum(AUDIT_POINTS[field][getattr(profile, field)] for field in AUDIT_POINTS) if drinks else 0
    cut_off = 4 if profile.sex == "male" else 3
    positive = total >= cut_off
    return ok(
        AUDIT_C,
        total,
        unit="points",
        category="positive" if positive else "negative",
        level=(4 if total >= 8 else 3) if positive else 0,
        details={"maxPoints": 12, "cutOff": cut_off},
    )


def body_composition(profile):
    missing = profile.missing("height", "weight")
    if missing:
        return needs_input(BODY, missing)
    if profile.age is not None and profile.age < 18:
        # Children and teens need age- and sex-specific BMI charts
        return not_applicable(BODY, "adultsOnly")
    bmi = round(profile.bmi, 1)
    index = band(bmi, [18.5, 25, 30, 35, 40])
    category = ["underweight", "healthy", "overweight", "obese1", "obese2", "obese3"][index]
    level = [2, 0, 1, 2, 3, 4][index]
    details = {"bmi": bmi}
    if profile.waist is not None:
        ratio = round(profile.waist / profile.height, 2)
        details["waistToHeight"] = ratio
        details["waistToHeightCategory"] = ["healthy", "increased", "high"][band(ratio, [0.5, 0.6])]
    return ok(BODY, bmi, unit="kg/m²", category=category, level=level, details=details)
