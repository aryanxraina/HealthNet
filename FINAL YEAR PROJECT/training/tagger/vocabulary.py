"""How lab reports name the tests HealthNet reads, and the look-alikes it must not read.

Written from general lab-reporting conventions, independently of the frontend's dictionary and of the
benchmark's spellings (healthnet-frontend/src/benchmark/labNames.json). train.py removes anything that
matches a benchmark spelling, so the benchmark measures how well the model handles names it never saw.

Labels are the frontend's field ids, plus:
  glucoseUnspecified  a glucose result not marked as fasting (read, but flagged)
  bloodPressure       a combined "120/80" reading
  other               anything else
"""

SPELLINGS = {
    "totalCholesterol": [
        "total cholesterol", "cholesterol total", "serum cholesterol", "cholesterol", "tot cholesterol",
        "cholesterol serum", "total chol", "chol total", "cholesterol (total)", "chol", "total cholestrol",
        "cholestrol", "plasma cholesterol", "cholesterol, serum", "t-cholesterol", "total serum cholesterol",
        "cholesterol level", "serum total cholesterol",
    ],
    "hdlCholesterol": [
        "hdl cholesterol", "hdl", "hdl-c", "hdl chol", "high density lipoprotein", "high-density lipoprotein cholesterol",
        "cholesterol hdl", "hdl direct", "direct hdl", "hdl cholesterol direct", "serum hdl", "hdl-cholesterol",
        "hdl cholestrol", "high density lipoprotein cholesterol", "hdlc", "cholesterol - hdl",
    ],
    "hba1c": [
        "hba1c", "hb a1c", "a1c", "glycated haemoglobin", "glycated hemoglobin", "glycosylated haemoglobin",
        "glycosylated hemoglobin", "glycohaemoglobin", "glycohemoglobin", "haemoglobin a1c", "hemoglobin a1c",
        "hba1c (ngsp)", "hba1c (hplc)", "glycated haemoglobin a1c", "hba 1c", "hgba1c", "hgb a1c",
        "glycated haemoglobin (hplc)",
    ],
    "fastingGlucose": [
        "fasting blood sugar", "fasting blood glucose", "fasting plasma glucose", "fasting glucose", "glucose fasting",
        "glucose (fasting)", "fbs", "fbg", "fpg", "blood sugar fasting", "glucose - fasting", "fasting sugar",
        "sugar fasting", "plasma glucose fasting", "fasting serum glucose", "glucose, fasting plasma", "bsf",
        "blood sugar (fasting)", "fasting blood sugar (fbs)", "glucose fasting (fpg)",
    ],
    "glucoseUnspecified": [
        "glucose", "blood glucose", "plasma glucose", "serum glucose", "blood sugar", "glucose level", "sugar",
        "glucose (plasma)", "glucose, serum", "glucose serum", "glucose, plasma", "venous glucose",
    ],
    "creatinine": [
        "creatinine", "serum creatinine", "creatinine serum", "s creatinine", "creatinine (enzymatic)",
        "creatinine (jaffe)", "crea", "creatinine level", "plasma creatinine", "creatinine, plasma",
        "serum creatinine (enzymatic)", "creatinine - serum", "creatinin", "kreatinin",
    ],
    "egfr": [
        "egfr", "estimated gfr", "gfr estimated", "egfr (ckd-epi)", "egfr ckd epi", "estimated glomerular filtration rate",
        "gfr", "egfr (mdrd)", "egfr creatinine", "e-gfr", "egfr (ckd-epi 2009)", "gfr (calculated)",
        "glomerular filtration rate", "egfr cr", "estimated gfr (ckd-epi)", "egfr (calculated)",
    ],
    "restingHeartRate": [
        "pulse", "pulse rate", "heart rate", "heart beat", "pulse (radial)", "resting pulse", "resting heart rate",
        "heartrate", "pr", "pulse rate (bpm)", "heart rate (resting)", "radial pulse", "pulse/min",
    ],
    "spo2": [
        "spo2", "sp o2", "oxygen saturation", "o2 saturation", "saturation", "sao2", "pulse oximetry",
        "pulse ox", "spo2 room air", "oxygen saturation (spo2)", "spo2 (%)", "peripheral oxygen saturation",
        "sp02", "oxygen sat",
    ],
    "temperature": [
        "temperature", "temp", "body temperature", "body temp", "oral temperature", "axillary temperature",
        "tympanic temperature", "temp (oral)", "temperature (axillary)", "core temperature", "body temperature (oral)",
    ],
    "bloodPressure": [
        "blood pressure", "bp", "b p", "b/p", "bp (sitting)", "arterial blood pressure", "blood pressure (right arm)",
        "nibp", "bp sitting", "blood pressure sitting", "blood pressure (left arm)", "bp (seated)",
    ],
    "systolic": [
        "systolic", "systolic bp", "systolic blood pressure", "sbp", "sys bp", "bp systolic", "systolic pressure",
        "blood pressure systolic",
    ],
    "diastolic": [
        "diastolic", "diastolic bp", "diastolic blood pressure", "dbp", "dia bp", "bp diastolic", "diastolic pressure",
        "blood pressure diastolic",
    ],
}

# Look-alikes and everything else on a report: other tests, section headings, header lines
OTHER = [
    "ldl cholesterol", "ldl", "ldl-c", "ldl direct", "vldl", "vldl cholesterol", "non-hdl cholesterol", "non hdl cholesterol",
    "cholesterol/hdl ratio", "total cholesterol/hdl ratio", "tc/hdl ratio", "ldl/hdl ratio", "chol/hdl ratio",
    "hdl/ldl ratio", "triglycerides", "triglyceride", "tg", "lipoprotein (a)", "apolipoprotein b", "apo a1",
    "estimated average glucose", "eag", "estimated average glucose (eag)", "mean blood glucose", "post prandial blood sugar",
    "postprandial glucose", "ppbs", "glucose pp", "glucose post prandial", "random blood sugar", "rbs", "random glucose",
    "2 hr glucose", "glucose 2 hours", "ogtt", "glucose tolerance test", "urine glucose", "urine sugar", "glucose urine",
    "fasting insulin", "insulin fasting", "insulin", "c-peptide", "fructosamine", "glycated albumin",
    "urine creatinine", "creatinine urine", "creatinine clearance", "albumin/creatinine ratio", "urine albumin creatinine ratio",
    "acr", "bun/creatinine ratio", "urea", "blood urea", "blood urea nitrogen", "bun", "uric acid", "cystatin c",
    "haemoglobin", "hemoglobin", "hb", "hgb", "mch", "mchc", "mcv", "hematocrit", "haematocrit", "pcv", "rbc count",
    "wbc count", "total leucocyte count", "platelet count", "platelets", "esr", "crp", "hs-crp", "neutrophils", "lymphocytes",
    "respiratory rate", "resp rate", "mean arterial pressure", "pulse pressure", "weight", "height", "bmi", "waist circumference",
    "total protein", "total bilirubin", "direct bilirubin", "indirect bilirubin", "albumin", "globulin", "a/g ratio",
    "sgot", "sgpt", "ast", "alt", "alkaline phosphatase", "ggt", "sodium", "potassium", "chloride", "calcium", "calcium total",
    "phosphorus", "magnesium", "iron", "total iron binding capacity", "ferritin", "vitamin d", "vitamin d (25-oh)",
    "vitamin b12", "folate", "tsh", "t3 total", "t4 total", "free t4", "free t3", "psa total", "cortisol morning", "lipase",
    "amylase", "hbsag", "hiv", "dengue ns1",
    "lipid profile", "kidney function test", "renal function test", "liver function test", "diabetes profile",
    "complete blood count", "vitals", "biochemistry", "haematology", "test", "test name", "result", "units", "unit",
    "reference range", "biological reference interval", "normal range", "flag", "method", "specimen", "sample type",
    "patient name", "patient", "age", "sex", "age sex", "patient id", "lab no", "sample collected", "collected on",
    "reported on", "registered on", "referred by", "ref by dr", "phone", "page", "page of", "end of report",
    "signature", "pathologist", "consultant", "remarks", "interpretation", "note", "comments", "barcode", "visit no",
]

# Ways reports decorate a name
PREFIXES = ["", "", "", "", "s. ", "serum ", "plasma ", "blood ", "whole blood "]
SUFFIXES = [
    "", "", "", "", "", ":", " :", " *", " (serum)", " - direct", ", serum", " (calculated)", " (mg/dl)", " (mmol/l)",
    " (%)", " [enzymatic]", " (plasma)", " - serum", " (method: enzymatic)", " ref",
]
CONFUSIONS = {"o": "0", "l": "1", "i": "l", "s": "5", "e": "c"}
