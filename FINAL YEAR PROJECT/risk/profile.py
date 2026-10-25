"""The health profile every calculator reads.

Field names match the questionnaire question ids (healthnet-frontend/src/questionnaire/sections.js),
so a missing field can be traced back to the question that asks for it. All measurements are in
standard units: cm, kg, mmHg, mg/dL, %, mL/min/1.73m².
"""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

YesNo = Literal["yes", "no"]
PhqAnswer = Literal[0, 1, 2, 3]

Condition = Literal["diabetes", "hypertension", "heartDisease", "stroke", "kidneyDisease", "asthma", "none"]


class Profile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # About you
    age: Optional[int] = Field(None, ge=0, le=120)
    sex: Optional[Literal["female", "male"]] = None  # sex used for the risk equations
    country: Optional[str] = Field(None, pattern=r"^[A-Z]{2}$")  # ISO 3166-1 alpha-2
    height: Optional[float] = Field(None, ge=50, le=250)
    weight: Optional[float] = Field(None, ge=20, le=300)
    waist: Optional[float] = Field(None, ge=40, le=200)
    neck: Optional[float] = Field(None, ge=20, le=70)

    # Lifestyle
    smoking: Optional[Literal["never", "former", "current"]] = None
    dailyActivity: Optional[YesNo] = None
    fruitVeg: Optional[YesNo] = None
    auditFrequency: Optional[Literal["never", "monthly", "twoToFourMonth", "twoToThreeWeek", "fourPlusWeek"]] = None
    auditTypical: Optional[Literal["oneTwo", "threeFour", "fiveSix", "sevenNine", "tenPlus"]] = None
    auditBinge: Optional[Literal["never", "lessMonthly", "monthly", "weekly", "daily"]] = None

    # Medical history
    conditions: Optional[list[Condition]] = None
    bpMedication: Optional[YesNo] = None
    statin: Optional[Literal["yes", "no", "unsure"]] = None
    highGlucoseHistory: Optional[YesNo] = None
    familyDiabetes: Optional[Literal["no", "extended", "immediate"]] = None
    parentsHypertension: Optional[Literal["none", "one", "both", "unsure"]] = None
    pregnancies: Optional[int] = Field(None, ge=0, le=20)

    # Vitals and lab values
    systolic: Optional[float] = Field(None, ge=70, le=250)
    diastolic: Optional[float] = Field(None, ge=40, le=150)
    fastingGlucose: Optional[float] = Field(None, ge=40, le=600)
    hba1c: Optional[float] = Field(None, ge=3, le=20)
    totalCholesterol: Optional[float] = Field(None, ge=70, le=500)
    hdlCholesterol: Optional[float] = Field(None, ge=10, le=150)
    egfr: Optional[float] = Field(None, ge=5, le=200)
    creatinine: Optional[float] = Field(None, ge=0.2, le=15)

    # Mental wellbeing (PHQ-4) and sleep (STOP-Bang)
    phq1: Optional[PhqAnswer] = None
    phq2: Optional[PhqAnswer] = None
    phq3: Optional[PhqAnswer] = None
    phq4: Optional[PhqAnswer] = None
    snoring: Optional[YesNo] = None
    tired: Optional[YesNo] = None
    observedApnea: Optional[YesNo] = None

    def missing(self, *fields):
        """Names of the fields that are still empty. A tuple means "any one of these"; its first name is reported."""
        names = []
        for field in fields:
            options = field if isinstance(field, tuple) else (field,)
            if all(getattr(self, name) is None for name in options):
                names.append(options[0])
        return names

    @property
    def bmi(self):
        if self.height is None or self.weight is None:
            return None
        return self.weight / (self.height / 100) ** 2

    def has_condition(self, condition):
        return condition in (self.conditions or [])

    @property
    def diabetes_from_labs(self):
        """HbA1c ≥ 6.5% or fasting glucose ≥ 126 mg/dL meets the diagnostic threshold for diabetes."""
        return (self.hba1c is not None and self.hba1c >= 6.5) or (
            self.fastingGlucose is not None and self.fastingGlucose >= 126
        )

    @property
    def has_diabetes(self):
        return self.has_condition("diabetes") or self.diabetes_from_labs

    @property
    def treated_or_known_hypertension(self):
        return self.bpMedication == "yes" or self.has_condition("hypertension")

    @property
    def egfr_value(self):
        """Entered eGFR, or one estimated from creatinine with the race-free CKD-EPI 2021 equation."""
        if self.egfr is not None:
            return self.egfr, "entered"
        if self.creatinine is None or self.age is None or self.sex is None:
            return None, None
        return ckd_epi_2021(self.creatinine, self.age, self.sex), "creatinine"


def ckd_epi_2021(creatinine_mg_dl, age, sex):
    """Inker LA et al. N Engl J Med 2021;385:1737-49 (race-free CKD-EPI creatinine equation)."""
    female = sex == "female"
    kappa = 0.7 if female else 0.9
    alpha = -0.241 if female else -0.302
    ratio = creatinine_mg_dl / kappa
    egfr = 142 * min(ratio, 1) ** alpha * max(ratio, 1) ** -1.200 * 0.9938**age
    return egfr * 1.012 if female else egfr
