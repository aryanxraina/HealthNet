"""Reference-value tests for the published risk equations."""
import csv
from pathlib import Path

import pytest

from risk import Profile, findrisc, framingham_htn, prevent, who_cvd
from risk.profile import ckd_epi_2021

FIXTURES = Path(__file__).parent / "fixtures"


def who_reference_rows():
    with open(FIXTURES / "who_stata_reference.csv") as f:
        return list(csv.DictReader(line for line in f if not line.startswith("#")))


# ---------------------------------------------------------------- WHO 2019


@pytest.mark.parametrize("row", who_reference_rows(), ids=lambda r: f"{r['country']}-{r['year']}-{r['sex']}-{r['age']}")
def test_who_matches_stata_reference(row):
    common = dict(
        age=float(row["age"]),
        sex=row["sex"],
        sbp=float(row["sbp"]),
        smoking=row["smoking"] == "1",
        region=who_cvd.region_for(row["country"]),
        year=int(row["year"]),
    )
    lab = who_cvd.ten_year_risk(cholesterol_mmol=float(row["cholesterol"]), diabetes=row["diabetes"] == "1", **common)
    nonlab = who_cvd.ten_year_risk(bmi=float(row["bmi"]), **common)
    assert lab == pytest.approx(float(row["ref_lab"]), abs=1e-9)
    assert nonlab == pytest.approx(float(row["ref_nonlab"]), abs=1e-9)


WHO_PERSON = dict(age=55, sex="male", country="GB", smoking="current", systolic=140, height=178, weight=88)


def test_who_uses_lab_model_when_cholesterol_is_known():
    nonlab = who_cvd.assess(Profile(**WHO_PERSON))
    lab = who_cvd.assess(Profile(**WHO_PERSON, totalCholesterol=213, conditions=["none"]))
    assert nonlab["status"] == lab["status"] == "ok"
    assert nonlab["details"]["variant"] == "nonlab" and lab["details"]["variant"] == "lab"
    assert lab["details"]["region"] == "western_europe"
    expected = who_cvd.ten_year_risk(age=55, sex="male", sbp=140, smoking=True, region="western_europe",
                                     cholesterol_mmol=213 / 38.67, diabetes=False)
    assert lab["value"] == round(expected * 100, 1)


def test_who_explains_when_it_cannot_run():
    assert who_cvd.assess(Profile(age=55, sex="male"))["missing"] == ["country", "smoking", "systolic", "height", "weight"]
    assert who_cvd.assess(Profile(**{**WHO_PERSON, "age": 35}))["reason"] == "ageRange"
    assert who_cvd.assess(Profile(**WHO_PERSON, conditions=["stroke"]))["reason"] == "existingCvd"


def test_every_app_country_has_a_who_region():
    countries_js = Path(__file__).parents[2] / "healthnet-frontend" / "src" / "questionnaire" / "countries.js"
    if not countries_js.exists():
        pytest.skip("frontend not checked out next to the API")
    import re

    codes = re.search(r"const CODES = `([^`]*)`", countries_js.read_text(encoding="utf-8")).group(1).split()
    assert [code for code in codes if who_cvd.region_for(code) is None] == []


# ---------------------------------------------------------------- PREVENT

# preventr's own test cases (tests/testthat/test-estimate_risk.R), values rounded to 3 decimals:
# age 50, SBP 160 on treatment, total cholesterol 200, HDL 45, no statin, diabetes, non-smoker, eGFR 90, BMI 35
PREVENT_CASE = dict(age=50, systolic=160, bpMedication="yes", totalCholesterol=200, hdlCholesterol=45,
                    statin="no", conditions=["diabetes"], smoking="never", egfr=90)
PREVENT_REFERENCE = [
    ("female", None, (0.147, 0.092, 0.081, 0.044, 0.054), (0.53, 0.354, 0.39, 0.198, 0.221)),
    ("male", None, (0.163, 0.102, 0.106, 0.056, 0.052), (0.514, 0.349, 0.424, 0.216, 0.197)),
    ("female", 9.2, (0.181, 0.112, 0.106, 0.054, 0.067), (0.557, 0.378, 0.433, 0.214, 0.241)),
    ("male", 9.2, (0.185, 0.117, 0.124, 0.061, 0.063), (0.525, 0.36, 0.442, 0.212, 0.214)),
]
OUTCOMES = ("totalCvd", "ascvd", "heartFailure", "chd", "stroke")


def bmi_35_body():
    # 35 kg/m² at 170 cm
    return dict(height=170, weight=35 * 1.7**2)


@pytest.mark.parametrize("sex, hba1c, ten_year, thirty_year", PREVENT_REFERENCE)
def test_prevent_matches_preventr(sex, hba1c, ten_year, thirty_year):
    result = prevent.assess(Profile(**PREVENT_CASE, **bmi_35_body(), sex=sex, hba1c=hba1c))
    assert result["status"] == "ok"
    assert result["details"]["variant"] == ("hba1c" if hba1c else "base")
    for outcome, expected in zip(OUTCOMES, ten_year):
        assert result["details"]["tenYear"][outcome] / 100 == pytest.approx(expected, abs=0.0006)
    for outcome, expected in zip(OUTCOMES, thirty_year):
        assert result["details"]["thirtyYear"][outcome] / 100 == pytest.approx(expected, abs=0.0006)


def test_prevent_estimates_egfr_from_creatinine_and_flags_assumptions():
    case = {**PREVENT_CASE, "egfr": None, "creatinine": 1.0, "statin": "unsure"}
    result = prevent.assess(Profile(**case, **bmi_35_body(), sex="male"))
    assert result["details"]["egfrSource"] == "creatinine"
    assert result["details"]["egfr"] == round(ckd_epi_2021(1.0, 50, "male"))
    assert "statinAssumedNo" in result["assumptions"]


def test_prevent_limits():
    base = dict(PREVENT_CASE, **bmi_35_body(), sex="female")
    assert prevent.assess(Profile(**{**base, "age": 62}))["details"]["thirtyYear"] is None
    assert prevent.assess(Profile(**{**base, "age": 82}))["reason"] == "ageRange"
    out = prevent.assess(Profile(**{**base, "totalCholesterol": 360}))
    assert out["reason"] == "outOfRange" and out["reasonParams"]["field"] == "totalCholesterol"
    assert prevent.assess(Profile(**{**base, "egfr": None}))["missing"] == ["egfr"]


def test_ckd_epi_2021():
    # 50-year-old man, creatinine 1.0 mg/dL: 142 x (1.0/0.9)^-1.2 x 0.9938^50 = 91.7
    assert ckd_epi_2021(1.0, 50, "male") == pytest.approx(91.7, abs=0.05)
    # 60-year-old woman, 0.8 mg/dL: 142 x (0.8/0.7)^-1.2 x 0.9938^60 x 1.012 = 84.3
    assert ckd_epi_2021(0.8, 60, "female") == pytest.approx(84.3, abs=0.05)
    # Below the knot only the alpha exponent applies: woman 0.5 mg/dL at 40 -> 142 x (0.5/0.7)^-0.241 x 0.9938^40 x 1.012
    assert ckd_epi_2021(0.5, 40, "female") == pytest.approx(142 * (0.5 / 0.7) ** -0.241 * 0.9938**40 * 1.012)


# ---------------------------------------------------------------- Framingham hypertension

# Independent JavaScript transcription of the Framingham Heart Study calculator's formula
FRAMINGHAM_REFERENCE = [
    (dict(age=45, female=True, sbp=125, dbp=82, smoker=False, parents=1, bmi=27.5), (0.0474267434, 0.1015688254, 0.2102955264)),
    (dict(age=60, female=False, sbp=135, dbp=85, smoker=True, parents=2, bmi=31.2), (0.1954669618, 0.3808635529, 0.6524431477)),
    (dict(age=30, female=True, sbp=110, dbp=70, smoker=False, parents=0, bmi=21.0), (0.0025543552, 0.0056220143, 0.0123509060)),
]


@pytest.mark.parametrize("person, expected", FRAMINGHAM_REFERENCE)
def test_framingham_matches_calculator(person, expected):
    result = framingham_htn.risks(**person)
    assert (result[1], result[2], result[4]) == pytest.approx(expected, abs=1e-9)


def test_framingham_eligibility():
    person = dict(age=45, sex="female", systolic=125, diastolic=82, height=165, weight=75, smoking="never",
                  parentsHypertension="one", conditions=["none"], bpMedication="no")
    result = framingham_htn.assess(Profile(**person))
    assert result["status"] == "ok" and result["details"]["optimalFourYear"] < result["value"]
    assert framingham_htn.assess(Profile(**{**person, "bpMedication": "yes"}))["reason"] == "alreadyHypertension"
    assert framingham_htn.assess(Profile(**{**person, "systolic": 145}))["reason"] == "highReading"
    assert framingham_htn.assess(Profile(**{**person, "hba1c": 7.1}))["reason"] == "diabetes"
    unsure = framingham_htn.assess(Profile(**{**person, "parentsHypertension": "unsure"}))
    assert unsure["assumptions"] == ["parentsAssumedNone"]


# ---------------------------------------------------------------- FINDRISC


def test_findrisc_points():
    # 58-year-old woman, BMI 27.5, waist 85 cm, inactive, eats fruit daily, on BP medication,
    # never had high glucose, a parent with diabetes: 3 + 1 + 3 + 2 + 0 + 2 + 0 + 5 = 16 points (high)
    profile = Profile(age=58, sex="female", height=160, weight=27.5 * 1.6**2, waist=85, dailyActivity="no",
                      fruitVeg="yes", bpMedication="yes", highGlucoseHistory="no", familyDiabetes="immediate")
    result = findrisc.assess(profile)
    assert result["value"] == 16
    assert result["category"] == "high" and result["details"]["tenYearRisk"] == "1 in 3"


@pytest.mark.parametrize("total, category", [(0, "low"), (6, "low"), (7, "slightlyElevated"), (11, "slightlyElevated"),
                                             (12, "moderate"), (14, "moderate"), (15, "high"), (20, "high"), (21, "veryHigh")])
def test_findrisc_bands(total, category):
    from risk.result import band

    assert findrisc.BAND_NAMES[band(total, findrisc.BAND_CUTS)] == category


def test_findrisc_skips_people_with_diabetes():
    profile = Profile(age=50, sex="male", height=180, weight=80, waist=90, dailyActivity="yes", fruitVeg="yes",
                      bpMedication="no", highGlucoseHistory="no", familyDiabetes="no", conditions=["diabetes"])
    assert findrisc.assess(profile)["reason"] == "alreadyDiabetes"
