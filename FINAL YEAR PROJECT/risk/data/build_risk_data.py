"""Regenerate risk/data/who_cvd.json and risk/data/prevent.json from the original sources.

Download these into one folder (<sources>):
  whocvdrisk_t10_calparms_gbd_sens0.dta  https://raw.githubusercontent.com/skkceu/stata/main/whocvdrisk_t10_calparms_gbd_sens0.dta
  all.json (ISO 3166 codes)              https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json
  sysdata.rda (preventr 0.12.1)          https://raw.githubusercontent.com/martingmayer/preventr/main/R/sysdata.rda

Then, with `pip install pandas pyreadr`:
  python build_risk_data.py <sources> ../../../healthnet-frontend/src/questionnaire/countries.js .
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

sources, countries_js, out_dir = (Path(p) for p in sys.argv[1:4])
out_dir.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- WHO 2019
REGIONS = [
    "north_africa_middle_east", "central_subsaharan_africa", "eastern_subsaharan_africa",
    "southern_subsaharan_africa", "western_subsaharan_africa", "southern_latin_america",
    "high_income_north_america", "caribbean", "andean_latin_america", "central_latin_america",
    "tropical_latin_america", "east_asia", "south_asia", "southeast_asia", "central_asia",
    "high_income_asia_pacific", "western_europe", "central_europe", "eastern_europe",
    "oceania", "australasia",
]
dta = pd.read_stata(sources / "whocvdrisk_t10_calparms_gbd_sens0.dta", convert_categoricals=False)
dta = dta[dta.gbdregid.between(1, 21)]
region_rows = dta[dta.ccode.str.contains("GBDR")]

calibration = {}
for row in region_rows.itertuples():
    region = REGIONS[int(row.gbdregid) - 1]
    sex = {1: "male", 2: "female"}[int(row.sex)]
    params = {}
    for model, m in (("lab", 1), ("nonlab", 2)):
        for endpoint, ep in (("chd", "ep_chdmi"), ("stroke", "ep_crbv")):
            params[f"{model}_{endpoint}"] = [
                float(getattr(row, f"cal2_m{m}_cons_{ep}")),
                float(getattr(row, f"cal2_m{m}_slope_{ep}")),
            ]
    calibration.setdefault(region, {}).setdefault(sex, {})[str(int(row.year))] = params

alpha3_region = {
    row.ccode: REGIONS[int(row.gbdregid) - 1]
    for row in dta[~dta.ccode.str.contains("GBDR")].drop_duplicates("ccode").itertuples()
}
iso = json.loads((sources / "all.json").read_text(encoding="utf-8"))
alpha2_to_3 = {c["alpha-2"]: c["alpha-3"] for c in iso}
alpha2_to_3["XK"] = "XKX"

frontend_codes = re.search(r"const CODES = `([^`]*)`", Path(countries_js).read_text(encoding="utf-8")).group(1).split()

# Territories without their own WHO estimates use the region they sit in geographically
TERRITORY_REGION = {
    "AI": "caribbean", "AW": "caribbean", "BL": "caribbean", "BQ": "caribbean", "CW": "caribbean",
    "KN": "caribbean", "KY": "caribbean", "MF": "caribbean", "MS": "caribbean", "SX": "caribbean",
    "TC": "caribbean", "VG": "caribbean", "GP": "caribbean", "MQ": "caribbean", "GF": "tropical_latin_america",
    "AX": "western_europe", "FO": "western_europe", "GG": "western_europe", "GI": "western_europe",
    "IM": "western_europe", "JE": "western_europe", "LI": "western_europe", "MC": "western_europe",
    "SM": "western_europe", "VA": "western_europe", "SJ": "western_europe", "PM": "high_income_north_america",
    "XK": "central_europe", "HK": "east_asia", "MO": "east_asia", "RE": "southeast_asia", "YT": "eastern_subsaharan_africa",
    "EH": "north_africa_middle_east", "IO": "south_asia", "CC": "australasia", "CX": "australasia", "NF": "australasia",
    "CK": "oceania", "GU": "oceania", "MP": "oceania", "NC": "oceania", "NR": "oceania", "NU": "oceania",
    "PF": "oceania", "PN": "oceania", "PW": "oceania", "TK": "oceania", "TV": "oceania", "WF": "oceania",
    "FK": "southern_latin_america", "SH": "western_subsaharan_africa",
}
country_region, used_fallback, unmapped = {}, [], []
for code in frontend_codes:
    region = alpha3_region.get(alpha2_to_3.get(code, ""))
    if region is None and code in TERRITORY_REGION:
        region = TERRITORY_REGION[code]
        used_fallback.append(code)
    if region is None:
        unmapped.append(code)
    else:
        country_region[code] = region

(out_dir / "who_cvd.json").write_text(
    json.dumps({"countryRegion": country_region, "calibration": calibration}, separators=(",", ":"), sort_keys=True),
    encoding="utf-8",
)
print(f"WHO: {len(calibration)} regions, {len(country_region)} countries ({len(used_fallback)} territories by geography)")
print("  territories:", " ".join(used_fallback))
print("  UNMAPPED:", unmapped)

# ---------------------------------------------------------------- PREVENT
TERMS = {
    "Age, per 10 years": "age", "Age, 10 years": "age", "Age squared": "ageSquared",
    "non-HDL-C per 1 mmol/L": "nonHdl", "HDL-C per 0.3 mmol/L": "hdl",
    "SBP <110 per 20 mmHg": "sbpLt110", "SBP ≥110 per 20 mmHg": "sbpGte110",
    "Diabetes": "diabetes", "Current smoking": "smoking",
    "BMI <30, per 5 kg/m2": "bmiLt30", "BMI 30+, per 5 kg/m2": "bmiGte30",
    "eGFR <60, per -15 ml": "egfrLt60", "eGFR 60+, per -15 ml": "egfrGte60",
    "Anti-hypertensive use": "bpTx", "Statin use": "statin",
    "Treated SBP ≥110 mm Hg per 20 mm Hg": "bpTxSbpGte110", "Treated non-HDL-C": "statinNonHdl",
    "Age per 10yr * non-HDL-C per 1 mmol/L": "ageNonHdl", "Age per 10yr * HDL-C per 0.3 mmol/L": "ageHdl",
    "Age per 10yr * SBP ≥110 mm Hg per 20 mmHg": "ageSbpGte110", "Age per 10yr * diabetes": "ageDiabetes",
    "Age per 10yr * current smoking": "ageSmoking", "Age per 10yr * BMI 30+ per 5 kg/m2": "ageBmiGte30",
    "Age per 10yr * eGFR <60, per -15 ml": "ageEgfrLt60",
    "HbA1c no DM, per 1%": "hba1cNoDm", "HbA1c in DM, per 1%": "hba1cDm", "Missing HbA1c": "missingHba1c",
    "Constant": "constant",
}
OUTCOMES = {"total_cvd": "totalCvd", "ascvd": "ascvd", "heart_failure": "heartFailure", "chd": "chd", "stroke": "stroke"}
import pyreadr  # noqa: E402  (only needed for this half)

tables = pyreadr.read_r(str(sources / "sysdata.rda"))
prevent = {}
for model in ("base", "hba1c"):
    for horizon in ("10yr", "30yr"):
        for row in tables[f"{model}_{horizon}"].to_dict("records"):
            term = TERMS[row["beta_coefficients"]]
            for column, value in row.items():
                if column == "beta_coefficients":
                    continue
                sex, outcome = column.split("_", 1)
                node = prevent.setdefault(model, {}).setdefault(horizon, {}).setdefault(sex, {})
                node.setdefault(OUTCOMES[outcome], {})[term] = float(value)
(out_dir / "prevent.json").write_text(json.dumps(prevent, indent=1, sort_keys=True), encoding="utf-8")
print("PREVENT terms per model:", {f"{m}/{h}": len(prevent[m][h]["female"]["totalCvd"]) for m in prevent for h in prevent[m]})
