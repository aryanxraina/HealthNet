"""AHA PREVENT equations: 10- and 30-year risk of total cardiovascular disease, atherosclerotic CVD
(heart attack and stroke) and heart failure, for adults aged 30-79 without known CVD.

Khan SS, Matsushita K, Sang Y, et al. Development and validation of the American Heart Association's
PREVENT equations. Circulation 2024;149:430-449 (with the 2026 erratum swapping the HbA1c terms).

Coefficients from the `preventr` R package (MIT licence, M. Mayer), which follows the published
supplement. The HbA1c model is used when HbA1c is known, otherwise the base model.
"""
import json
import math
from pathlib import Path

from .result import band, needs_input, not_applicable, ok, percent

MODEL = {
    "id": "prevent",
    "name": "AHA PREVENT equations",
    "reference": "Khan SS et al. Circulation 2024;149:430-449",
}

AGE_RANGE = (30, 79)
THIRTY_YEAR_MAX_AGE = 59  # 30-year estimates are not advised beyond this age
MMOL_PER_MG_DL_CHOLESTEROL = 0.02586

# Ranges the equations were developed for (preventr's validity checks)
VALID = {
    "totalCholesterol": (130, 320),
    "hdlCholesterol": (20, 100),
    "systolic": (90, 180),
    "bmi": (18.5, 39.9),
    "egfr": (15, 140),
    "hba1c": (4.5, 15),
}

_COEFFICIENTS = json.loads((Path(__file__).parent / "data" / "prevent.json").read_text(encoding="utf-8"))

# The bands of the WHO charts, so all 10-year CVD risks in HealthNet read the same way
BAND_CUTS = [5, 10, 20, 30]
BAND_NAMES = ["lt5", "5to10", "10to20", "20to30", "gte30"]


def terms(*, age, total_c, hdl_c, sbp, diabetes, smoking, bmi, egfr, bp_tx, statin, hba1c=None):
    """Model terms, centred as in the published equations. Cholesterol in mg/dL."""
    age_t = (age - 55) / 10
    non_hdl = (total_c - hdl_c) * MMOL_PER_MG_DL_CHOLESTEROL - 3.5
    hdl = (hdl_c * MMOL_PER_MG_DL_CHOLESTEROL - 1.3) / 0.3
    sbp_gte_110 = (max(sbp, 110) - 130) / 20
    bmi_gte_30 = (max(bmi, 30) - 30) / 5
    egfr_lt_60 = (min(egfr, 60) - 60) / -15
    dm, smk, bp, st = (float(x) for x in (diabetes, smoking, bp_tx, statin))
    values = {
        "age": age_t,
        "ageSquared": age_t**2,
        "nonHdl": non_hdl,
        "hdl": hdl,
        "sbpLt110": (min(sbp, 110) - 110) / 20,
        "sbpGte110": sbp_gte_110,
        "diabetes": dm,
        "smoking": smk,
        "bmiLt30": (min(bmi, 30) - 25) / 5,
        "bmiGte30": bmi_gte_30,
        "egfrLt60": egfr_lt_60,
        "egfrGte60": (max(egfr, 60) - 90) / -15,
        "bpTx": bp,
        "statin": st,
        "bpTxSbpGte110": bp * sbp_gte_110,
        "statinNonHdl": st * non_hdl,
        "ageNonHdl": age_t * non_hdl,
        "ageHdl": age_t * hdl,
        "ageSbpGte110": age_t * sbp_gte_110,
        "ageDiabetes": age_t * dm,
        "ageSmoking": age_t * smk,
        "ageBmiGte30": age_t * bmi_gte_30,
        "ageEgfrLt60": age_t * egfr_lt_60,
        "constant": 1.0,
    }
    if hba1c is not None:
        values["hba1cNoDm"] = 0.0 if diabetes else hba1c - 5.3
        values["hba1cDm"] = hba1c - 5.3 if diabetes else 0.0
        values["missingHba1c"] = 0.0
    return values


def estimate(sex, horizon, values, model):
    """{outcome: probability} for one sex and horizon ('10yr' or '30yr')."""
    results = {}
    for outcome, betas in _COEFFICIENTS[model][horizon][sex].items():
        log_odds = sum(beta * values[term] for term, beta in betas.items())
        results[outcome] = 1 / (1 + math.exp(-log_odds))
    return results


def assess(profile):
    missing = profile.missing(
        "age", "sex", "systolic", "totalCholesterol", "hdlCholesterol", ("egfr", "creatinine"),
        "bpMedication", "statin", "smoking", "height", "weight",
    )
    if missing:
        return needs_input(MODEL, missing)
    if not AGE_RANGE[0] <= profile.age <= AGE_RANGE[1]:
        return not_applicable(MODEL, "ageRange", min=AGE_RANGE[0], max=AGE_RANGE[1])
    if profile.has_condition("heartDisease") or profile.has_condition("stroke"):
        return not_applicable(MODEL, "existingCvd")

    egfr, egfr_source = profile.egfr_value
    measured = {
        "totalCholesterol": profile.totalCholesterol,
        "hdlCholesterol": profile.hdlCholesterol,
        "systolic": profile.systolic,
        "bmi": profile.bmi,
        "egfr": egfr,
        "hba1c": profile.hba1c,
    }
    for field, value in measured.items():
        low, high = VALID[field]
        if value is not None and not low <= value <= high:
            return not_applicable(MODEL, "outOfRange", field=field, min=low, max=high)

    assumptions = []
    if profile.statin == "unsure":
        assumptions.append("statinAssumedNo")
    if profile.diabetes_from_labs and not profile.has_condition("diabetes"):
        assumptions.append("diabetesFromLabs")
    model = "hba1c" if profile.hba1c is not None else "base"
    values = terms(
        age=profile.age,
        total_c=profile.totalCholesterol,
        hdl_c=profile.hdlCholesterol,
        sbp=profile.systolic,
        diabetes=profile.has_diabetes,
        smoking=profile.smoking == "current",
        bmi=profile.bmi,
        egfr=egfr,
        bp_tx=profile.bpMedication == "yes",
        statin=profile.statin == "yes",
        hba1c=profile.hba1c,
    )
    ten_year = estimate(profile.sex, "10yr", values, model)
    thirty_year = estimate(profile.sex, "30yr", values, model) if profile.age <= THIRTY_YEAR_MAX_AGE else None

    value = percent(ten_year["totalCvd"])
    level = band(value, BAND_CUTS)
    return ok(
        MODEL,
        value,
        unit="%",
        category=BAND_NAMES[level],
        level=level,
        details={
            "variant": model,
            "horizonYears": 10,
            "tenYear": {outcome: percent(p) for outcome, p in ten_year.items()},
            "thirtyYear": {outcome: percent(p) for outcome, p in thirty_year.items()} if thirty_year else None,
            "egfr": round(egfr),
            "egfrSource": egfr_source,
        },
        assumptions=assumptions,
    )
