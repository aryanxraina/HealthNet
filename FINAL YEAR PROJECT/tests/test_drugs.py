import pytest
import requests
from fastapi.testclient import TestClient

import drugs_api
from auth import current_user
from main import app

# A small stand-in for RxNav, shaped like its real JSON responses
CONCEPTS = {
    "861007": {"name": "metformin hydrochloride 500 MG Oral Tablet", "tty": "SCD"},
    "6762": {"name": "merbromin", "tty": "IN"},
    "161": {"name": "acetaminophen", "tty": "IN"},
    "198440": {"name": "acetaminophen 500 MG Oral Tablet", "tty": "SCD"},
    "1191": {"name": "aspirin", "tty": "IN"},
    "9999": {"name": "Morning After", "tty": "BN"},
    "5000": {"name": "Alcohol Prep Pad", "tty": "DF"},
}
SEARCH = {
    "metfromin 500 mg": ["861007", "6762"],
    "metfromin": ["6762"],
    "acetaminophen 500 mg": ["198440", "161"],
    "after": ["9999"],
    "food": ["5000"],
}
INGREDIENTS = {"861007": ["metformin"], "198440": ["acetaminophen"]}
SPELLING = {"metfromin": "merbromin"}


@pytest.fixture
def rxnav(monkeypatch):
    calls = []

    def fake_get(path, **params):
        calls.append((path, params))
        if path == "/approximateTerm.json":
            ids = SEARCH.get(params["term"], [])
            return {"approximateGroup": {"candidate": [{"rxcui": i, "rank": str(n + 1), "source": "RXNORM"} for n, i in enumerate(ids)]}}
        if path.endswith("/properties.json"):
            rxcui = path.split("/")[2]
            concept = CONCEPTS.get(rxcui)
            return {"properties": {"rxcui": rxcui, **concept} if concept else None}
        if path.endswith("/related.json"):
            rxcui = path.split("/")[2]
            return {"relatedGroup": {"conceptGroup": [{"tty": "IN", "conceptProperties": [{"name": n} for n in INGREDIENTS.get(rxcui, [])]}]}}
        if path == "/spellingsuggestions.json":
            suggestion = SPELLING.get(params["name"])
            return {"suggestionGroup": {"suggestionList": {"suggestion": [suggestion]} if suggestion else None}}
        raise AssertionError(path)

    drugs_api._cache.clear()
    monkeypatch.setattr(drugs_api, "_get", fake_get)
    return calls


def test_cleans_prescription_text():
    assert drugs_api.clean_query("Tab. Paracetamol 500mg") == "acetaminophen 500 mg"
    assert drugs_api.clean_query("Cap Amoxycillin 250MG") == "amoxicillin 250 mg"


def test_misspelt_name_with_strength_matches(rxnav):
    result = drugs_api.match_drug("Tab. Metfromin 500mg 1-0-1 after food")
    assert result["matches"][0] == {
        "rxcui": "861007",
        "name": "metformin hydrochloride 500 MG Oral Tablet",
        "termType": "SCD",
        "ingredient": "metformin",
        "similarity": 0.89,
    }
    # merbromin was a candidate too, but it doesn't look enough like what was written
    assert all(m["name"] != "merbromin" for m in result["matches"])


def test_spelling_suggestion_cannot_swap_in_a_different_drug(rxnav):
    # RxNav suggests "merbromin" (an antiseptic) for "metfromin"; it must not be accepted
    assert drugs_api.match_drug("Metfromin")["matches"] == []


def test_international_names_are_translated(rxnav):
    match = drugs_api.match_drug("Paracetamol 500 mg")["matches"][0]
    assert match["name"] == "acetaminophen 500 MG Oral Tablet"
    assert match["ingredient"] == "acetaminophen"


def test_instructions_and_non_drugs_are_not_matched(rxnav):
    assert drugs_api.match_drug("take after food")["matches"] == []
    assert drugs_api.match_drug("food")["matches"] == []


def test_results_are_cached(rxnav):
    drugs_api.match_drug("Paracetamol 500 mg")
    count = len(rxnav)
    drugs_api.match_drug("paracetamol 500mg")
    assert len(rxnav) == count


@pytest.fixture
def client():
    app.dependency_overrides[current_user] = lambda: "test-uid"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_endpoint_returns_matches(client, rxnav):
    body = client.get("/drugs/match", params={"q": "Paracetamol 500 mg"}).json()
    assert body["query"] == "acetaminophen 500 mg"
    assert body["matches"][0]["rxcui"] == "198440"


def test_endpoint_reports_unreachable_rxnav(client, monkeypatch):
    def offline(path, **params):
        raise requests.ConnectionError("offline")

    drugs_api._cache.clear()
    monkeypatch.setattr(drugs_api, "_get", offline)
    assert client.get("/drugs/match", params={"q": "aspirin"}).status_code == 503


def test_endpoint_requires_sign_in(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "healthnet-test")
    assert TestClient(app).get("/drugs/match", params={"q": "aspirin"}).status_code == 401
