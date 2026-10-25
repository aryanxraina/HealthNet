import pytest
from fastapi.testclient import TestClient

import auth
from auth import current_user
from main import app

PROFILE = {
    "age": 52, "sex": "male", "country": "IN", "height": 172, "weight": 80, "waist": 96, "neck": 41,
    "smoking": "former", "dailyActivity": "yes", "fruitVeg": "no", "auditFrequency": "never",
    "conditions": ["none"], "bpMedication": "no", "statin": "no", "highGlucoseHistory": "no",
    "familyDiabetes": "extended", "parentsHypertension": "one",
    "systolic": 132, "diastolic": 84, "totalCholesterol": 190, "hdlCholesterol": 44, "egfr": 95,
    "phq1": 0, "phq2": 1, "phq3": 0, "phq4": 0, "snoring": "yes", "tired": "no", "observedApnea": "no",
}


@pytest.fixture
def client():
    app.dependency_overrides[current_user] = lambda: "test-uid"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_assessment_returns_every_score(client):
    response = client.post("/risk/assessment", json=PROFILE)
    assert response.status_code == 200
    body = response.json()
    assert set(body["scores"]) == {"bodyComposition", "whoCvd", "prevent", "framinghamHtn", "findrisc",
                                   "mlDiabetes", "phq4", "stopBang", "auditC"}
    assert body["scores"]["whoCvd"]["details"] == {"variant": "lab", "region": "south_asia", "horizonYears": 10,
                                                   "calibrationYear": 2017}
    assert body["scores"]["mlDiabetes"]["reason"] == "womenOnly"
    assert all(score["status"] == "ok" for key, score in body["scores"].items() if key != "mlDiabetes")
    assert "not a diagnosis" in body["disclaimer"]


def test_partial_profiles_say_what_is_missing(client):
    body = client.post("/risk/assessment", json={"age": 30, "sex": "female", "height": 160, "weight": 55}).json()
    assert body["scores"]["bodyComposition"]["status"] == "ok"
    assert body["scores"]["prevent"]["status"] == "needs_input"
    assert "systolic" in body["scores"]["prevent"]["missing"]


def test_invalid_values_are_rejected(client):
    assert client.post("/risk/assessment", json={**PROFILE, "systolic": 400}).status_code == 422
    assert client.post("/risk/assessment", json={**PROFILE, "country": "India"}).status_code == 422


def test_requires_sign_in(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "healthnet-test")
    response = TestClient(app).post("/risk/assessment", json=PROFILE)
    assert response.status_code == 401


def test_rejects_invalid_tokens(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "healthnet-test")

    def reject(token, request, audience):
        raise ValueError("bad token")

    monkeypatch.setattr(auth.id_token, "verify_firebase_token", reject)
    response = TestClient(app).post("/risk/assessment", json=PROFILE, headers={"Authorization": "Bearer nope"})
    assert response.status_code == 401


def test_rejects_tokens_from_another_project(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "healthnet-test")
    monkeypatch.setattr(auth.id_token, "verify_firebase_token",
                        lambda token, request, audience: {"iss": "https://securetoken.google.com/other", "sub": "u1"})
    response = TestClient(app).post("/risk/assessment", json=PROFILE, headers={"Authorization": "Bearer t"})
    assert response.status_code == 401


def test_accepts_valid_tokens(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "healthnet-test")
    monkeypatch.setattr(auth.id_token, "verify_firebase_token",
                        lambda token, request, audience: {"iss": "https://securetoken.google.com/healthnet-test", "sub": "u1"})
    response = TestClient(app).post("/risk/assessment", json=PROFILE, headers={"Authorization": "Bearer t"})
    assert response.status_code == 200


def test_unconfigured_server_says_so(monkeypatch):
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    response = TestClient(app).post("/risk/assessment", json=PROFILE, headers={"Authorization": "Bearer t"})
    assert response.status_code == 503
    assert "FIREBASE_PROJECT_ID" in response.json()["detail"]
