import pytest

from risk import Profile, ml_diabetes, screeners


def test_phq4_subscales_and_total():
    result = screeners.phq4(Profile(phq1=2, phq2=1, phq3=1, phq4=0))
    assert result["value"] == 4 and result["category"] == "mild"
    assert result["details"]["anxietyPositive"] is True
    assert result["details"]["depressionPositive"] is False
    assert screeners.phq4(Profile(phq1=3, phq2=3, phq3=3, phq4=3))["category"] == "severe"
    assert screeners.phq4(Profile(phq1=1))["missing"] == ["phq2", "phq3", "phq4"]


STOP_BANG_BASE = dict(snoring="no", tired="no", observedApnea="no", age=40, sex="female", height=165, weight=60,
                      neck=34, bpMedication="no")


def test_stop_bang_scoring():
    assert screeners.stop_bang(Profile(**STOP_BANG_BASE))["category"] == "low"
    three = screeners.stop_bang(Profile(**{**STOP_BANG_BASE, "snoring": "yes", "tired": "yes", "age": 55}))
    assert three["value"] == 3 and three["category"] == "intermediate"
    # Two STOP answers plus male sex counts as high risk even with a total of 3
    refined = screeners.stop_bang(Profile(**{**STOP_BANG_BASE, "snoring": "yes", "tired": "yes", "sex": "male"}))
    assert refined["value"] == 3 and refined["category"] == "high"
    hypertension = screeners.stop_bang(Profile(**{**STOP_BANG_BASE, "conditions": ["hypertension"]}))
    assert hypertension["details"]["items"]["pressure"] is True


def test_audit_c():
    assert screeners.audit_c(Profile(auditFrequency="never", sex="male"))["value"] == 0
    women = screeners.audit_c(Profile(auditFrequency="twoToFourMonth", auditTypical="threeFour", auditBinge="never", sex="female"))
    assert women["value"] == 3 and women["category"] == "positive"
    men = screeners.audit_c(Profile(auditFrequency="twoToFourMonth", auditTypical="threeFour", auditBinge="never", sex="male"))
    assert men["category"] == "negative"
    assert screeners.audit_c(Profile(auditFrequency="monthly", sex="male"))["missing"] == ["auditTypical", "auditBinge"]


@pytest.mark.parametrize("weight, category", [(50, "underweight"), (70, "healthy"), (85, "overweight"), (95, "obese1"), (130, "obese3")])
def test_bmi_categories(weight, category):
    assert screeners.body_composition(Profile(height=175, weight=weight))["category"] == category


def test_waist_to_height():
    result = screeners.body_composition(Profile(height=170, weight=70, waist=90))
    assert result["details"]["waistToHeight"] == 0.53
    assert result["details"]["waistToHeightCategory"] == "increased"


ML_PERSON = dict(age=45, sex="female", fastingGlucose=105, diastolic=78, height=165, weight=75,
                 familyDiabetes="immediate", pregnancies=2)


def test_ml_model_runs_for_women_only():
    result = ml_diabetes.assess(Profile(**ML_PERSON))
    assert result["status"] == "ok" and 0 < result["value"] < 100
    assert result["model"]["experimental"] is True
    assert "fastingGlucoseForOgtt" in result["assumptions"]
    assert ml_diabetes.assess(Profile(**{**ML_PERSON, "sex": "male"}))["reason"] == "womenOnly"
    assert ml_diabetes.assess(Profile(**{**ML_PERSON, "age": 19}))["reason"] == "ageMin"


def test_ml_higher_glucose_means_higher_estimate():
    low = ml_diabetes.assess(Profile(**{**ML_PERSON, "fastingGlucose": 85}))["value"]
    high = ml_diabetes.assess(Profile(**{**ML_PERSON, "fastingGlucose": 160}))["value"]
    assert high > low


def test_pedigree_stand_ins_are_the_dataset_quartiles():
    import pandas as pd

    from train_diabetes_model import DATA_PATH

    quartiles = pd.read_csv(DATA_PATH)["DiabetesPedigreeFunction"].quantile([0.25, 0.5, 0.75]).round(3).tolist()
    assert list(ml_diabetes.PEDIGREE.values()) == quartiles
