"""WHO 2019 cardiovascular disease risk: 10-year risk of fatal or non-fatal heart attack or stroke.

Kaptoge S, Pennells L, De Bacquer D, et al. World Health Organization cardiovascular disease risk
charts: revised models to estimate risk in 21 global regions. Lancet Glob Health 2019;7:e1332-45.

Coefficients and recalibration parameters come from the authors' Stata implementation `whocvdrisk`
(github.com/skkceu/stata): whocvdrisk_erfc_score_v03.ado and whocvdrisk_t10_calparms_gbd_sens0.dta.
The laboratory model is used when total cholesterol is known, otherwise the non-laboratory (BMI) model.
Risk is recalibrated to the person's WHO/GBD region, as in the published charts.
"""
import json
import math
from pathlib import Path

from .result import band, needs_input, not_applicable, ok, percent

MODEL = {
    "id": "whoCvd",
    "name": "WHO CVD risk charts (2019)",
    "reference": "Kaptoge S et al. Lancet Glob Health 2019;7:e1332-45",
}

AGE_RANGE = (40, 80)
CALIBRATION_YEAR = 2017  # latest year of GBD incidence the authors published parameters for
MG_DL_PER_MMOL_CHOLESTEROL = 38.67

_DATA = json.loads((Path(__file__).parent / "data" / "who_cvd.json").read_text(encoding="utf-8"))

# Log hazard ratios per endpoint and sex: main effects, interactions with (age - 60), baseline survival.
# Variables are centred at age 60, SBP 120 mmHg, total cholesterol 6 mmol/L and BMI 25 kg/m².
_LAB = {
    ("chd", "male"): dict(age=0.0719227, chol=0.2284944, sbp=0.0132183, dm=0.6410114, smk=0.5638109,
                          chol_age=-0.0045806, sbp_age=-0.0001576, dm_age=-0.0124966, smk_age=-0.0182545, s0=0.9540108),
    ("chd", "female"): dict(age=0.1020713, chol=0.2050377, sbp=0.015823, dm=1.070358, smk=1.053223,
                            chol_age=-0.0051932, sbp_age=-0.0001378, dm_age=-0.0234174, smk_age=-0.0332666, s0=0.9894159),
    ("stroke", "male"): dict(age=0.0986578, chol=0.029526, sbp=0.0222629, dm=0.6268712, smk=0.4981217,
                             chol_age=0.00142, sbp_age=-0.0004147, dm_age=-0.026302, smk_age=-0.0150561, s0=0.9849257),
    ("stroke", "female"): dict(age=0.1056632, chol=0.0257782, sbp=0.0206278, dm=0.8581998, smk=0.7443627,
                               chol_age=-0.0021387, sbp_age=-0.0004897, dm_age=-0.0209826, smk_age=-0.0200822, s0=0.9890569),
}
_NONLAB = {
    ("chd", "male"): dict(age=0.073593, bmi=0.0337219, sbp=0.0133937, smk=0.5954767,
                          bmi_age=-0.0010432, sbp_age=-0.0001837, smk_age=-0.0200831, s0=0.9544258),
    ("chd", "female"): dict(age=0.1049418, bmi=0.0257616, sbp=0.016726, smk=1.093132,
                            bmi_age=-0.0006537, sbp_age=-0.0001966, smk_age=-0.0343739, s0=0.9887124),
    ("stroke", "male"): dict(age=0.097674, bmi=0.0159518, sbp=0.0227294, smk=0.4999862,
                             bmi_age=-0.0003516, sbp_age=-0.0004374, smk_age=-0.0153895, s0=0.9848260),
    ("stroke", "female"): dict(age=0.1046105, bmi=0.0036406, sbp=0.0216741, smk=0.7399405,
                               bmi_age=-0.0000129, sbp_age=-0.0005311, smk_age=-0.0203997, s0=0.9885706),
}

# The bands used by the WHO charts: <5%, 5-<10%, 10-<20%, 20-<30%, ≥30%
BAND_CUTS = [5, 10, 20, 30]
BAND_NAMES = ["lt5", "5to10", "10to20", "20to30", "gte30"]


def region_for(country):
    return _DATA["countryRegion"].get(country)


def calibration_year(year):
    """Years up to 2015 use the 5-year period they fall in, as in the authors' Stata code."""
    return 5 * (year // 5) if year <= 2015 else year


def _uncalibrated(b, *, age_c, sbp_c, smoking, chol_c=None, diabetes=None, bmi_c=None):
    lp = b["age"] * age_c + b["sbp"] * sbp_c + b["smk"] * smoking
    lp += b["sbp_age"] * sbp_c * age_c + b["smk_age"] * smoking * age_c
    if chol_c is not None:
        lp += b["chol"] * chol_c + b["dm"] * diabetes
        lp += b["chol_age"] * chol_c * age_c + b["dm_age"] * diabetes * age_c
    else:
        lp += b["bmi"] * bmi_c + b["bmi_age"] * bmi_c * age_c
    return 1 - b["s0"] ** math.exp(lp)


def _recalibrate(risk, cons, slope):
    """Complementary log-log recalibration: 1 - exp(-exp(cons + slope * log(-log(1 - risk))))."""
    return 1 - math.exp(-math.exp(cons + slope * math.log(-math.log(1 - risk))))


def ten_year_risk(*, age, sex, sbp, smoking, region, cholesterol_mmol=None, diabetes=False, bmi=None,
                  year=CALIBRATION_YEAR):
    """10-year CVD risk (0-1). Lab model when cholesterol_mmol is given, otherwise the BMI model."""
    lab = cholesterol_mmol is not None
    params = _DATA["calibration"][region][sex][str(calibration_year(year))]
    model_name = "lab" if lab else "nonlab"
    centred = dict(age_c=age - 60, sbp_c=sbp - 120, smoking=float(smoking))
    if lab:
        centred.update(chol_c=cholesterol_mmol - 6, diabetes=float(diabetes))
    else:
        centred.update(bmi_c=bmi - 25)

    calibrated = []
    for endpoint in ("chd", "stroke"):
        coefficients = (_LAB if lab else _NONLAB)[(endpoint, sex)]
        cons, slope = params[f"{model_name}_{endpoint}"]
        calibrated.append(_recalibrate(_uncalibrated(coefficients, **centred), cons, slope))
    chd, stroke = calibrated
    return 1 - (1 - chd) * (1 - stroke)


def assess(profile):
    lab = profile.totalCholesterol is not None
    missing = profile.missing("age", "sex", "country", "smoking", "systolic", *(() if lab else ("height", "weight")))
    if missing:
        return needs_input(MODEL, missing)
    if not AGE_RANGE[0] <= profile.age <= AGE_RANGE[1]:
        return not_applicable(MODEL, "ageRange", min=AGE_RANGE[0], max=AGE_RANGE[1])
    if profile.has_condition("heartDisease") or profile.has_condition("stroke"):
        # Risk charts are for people without established cardiovascular disease
        return not_applicable(MODEL, "existingCvd")
    region = region_for(profile.country)
    if region is None:
        return not_applicable(MODEL, "unknownCountry")

    risk = ten_year_risk(
        age=profile.age,
        sex=profile.sex,
        sbp=profile.systolic,
        smoking=profile.smoking == "current",
        region=region,
        cholesterol_mmol=profile.totalCholesterol / MG_DL_PER_MMOL_CHOLESTEROL if lab else None,
        diabetes=profile.has_diabetes,
        bmi=None if lab else profile.bmi,
    )
    value = percent(risk)
    level = band(value, BAND_CUTS)
    return ok(
        MODEL,
        value,
        unit="%",
        category=BAND_NAMES[level],
        level=level,
        details={"variant": "lab" if lab else "nonlab", "region": region, "horizonYears": 10, "calibrationYear": CALIBRATION_YEAR},
        assumptions=["diabetesFromLabs"] if lab and profile.diabetes_from_labs and not profile.has_condition("diabetes") else [],
    )
