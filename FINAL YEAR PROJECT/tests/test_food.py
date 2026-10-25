import pytest
import requests
from fastapi.testclient import TestClient

import food_api
from auth import current_user
from main import app

# Shaped like real USDA FoodData Central search results
USDA_RESPONSE = {
    "totalHits": 3,
    "foods": [
        {
            "fdcId": 2709224, "description": "Banana, raw", "dataType": "Survey (FNDDS)",
            "foodMeasures": [
                {"disseminationText": "1 banana", "gramWeight": 126},
                {"disseminationText": "Quantity not specified", "gramWeight": 118},
                {"disseminationText": "1 cup, mashed", "gramWeight": 225},
            ],
            "foodNutrients": [
                {"nutrientId": 1003, "value": 0.74}, {"nutrientId": 1004, "value": 0.28}, {"nutrientId": 1005, "value": 22.71},
                {"nutrientId": 1008, "value": 97}, {"nutrientId": 2000, "value": 15.8}, {"nutrientId": 1079, "value": 1.7},
            ],
        },
        {
            "fdcId": 1105073, "description": "Bananas, overripe, raw", "dataType": "Foundation", "foodMeasures": [],
            "foodNutrients": [{"nutrientId": 2047, "value": 85.0}, {"nutrientId": 1003, "value": 0.73}, {"nutrientId": 1005, "value": 20.1}, {"nutrientId": 1004, "value": 0.22}],
        },
        {"fdcId": 1, "description": "Banana chips (no energy value)", "dataType": "SR Legacy", "foodNutrients": [{"nutrientId": 1003, "value": 2}]},
    ],
}

# Shaped like a real Open Food Facts product response
OFF_RESPONSE = {
    "status": 1,
    "product": {
        "product_name": "Hazelnut spread", "brands": "Example Foods, Other",
        "serving_size": "15 g", "serving_quantity": "15",
        "nutriments": {"energy-kcal_100g": 539, "proteins_100g": 6.3, "carbohydrates_100g": 57.5, "fat_100g": 30.9, "sugars_100g": 56.3},
    },
}


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))


@pytest.fixture
def http(monkeypatch):
    calls = []
    replies = {}

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        for key, reply in replies.items():
            if key in url:
                if isinstance(reply, Exception):
                    raise reply
                return reply
        raise AssertionError(url)

    food_api._cache.clear()
    monkeypatch.setattr(food_api.requests, "get", fake_get)
    return calls, replies


@pytest.fixture
def client():
    app.dependency_overrides[current_user] = lambda: "test-uid"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_search_normalises_usda_foods(client, http, monkeypatch):
    calls, replies = http
    replies["api.nal.usda.gov"] = FakeResponse(body=USDA_RESPONSE)
    monkeypatch.setenv("USDA_API_KEY", "test-key")

    foods = client.get("/food/search", params={"q": "banana"}).json()["foods"]

    assert foods[0] == {
        "id": "usda:2709224", "source": "usda", "name": "Banana, raw", "brand": None,
        "per100g": {"kcal": 97.0, "protein": 0.7, "carbs": 22.7, "fat": 0.3, "fiber": 1.7, "sugar": 15.8},
        "servings": [{"label": "1 banana", "grams": 126.0}, {"label": "1 cup, mashed", "grams": 225.0}],
    }
    # Foundation foods report energy under the Atwater id
    assert foods[1]["per100g"]["kcal"] == 85.0
    # Foods without an energy value are dropped
    assert len(foods) == 2
    url = calls[0][0]
    assert "api_key=test-key" in url and "query=banana" in url and "%20" in url and "+" not in url


def test_search_is_cached(client, http):
    calls, replies = http
    replies["api.nal.usda.gov"] = FakeResponse(body=USDA_RESPONSE)
    client.get("/food/search", params={"q": "Banana"})
    client.get("/food/search", params={"q": "banana"})
    assert len(calls) == 1


def test_search_limits_and_outages(client, http):
    _, replies = http
    replies["api.nal.usda.gov"] = FakeResponse(429)
    response = client.get("/food/search", params={"q": "rice"})
    assert response.status_code == 429 and response.json()["detail"]["code"] == "rateLimited"
    food_api._cache.clear()
    replies["api.nal.usda.gov"] = requests.ConnectionError("offline")
    assert client.get("/food/search", params={"q": "oats"}).status_code == 503


def test_barcode_lookup(client, http):
    calls, replies = http
    replies["openfoodfacts.org"] = FakeResponse(body=OFF_RESPONSE)

    food = client.get("/food/barcode/3017624010701").json()

    assert food == {
        "id": "off:3017624010701", "source": "openfoodfacts", "name": "Hazelnut spread", "brand": "Example Foods",
        "per100g": {"kcal": 539.0, "protein": 6.3, "carbs": 57.5, "fat": 30.9, "fiber": None, "sugar": 56.3},
        "servings": [{"label": "1 serving (15 g)", "grams": 15.0}],
    }
    headers = calls[0][1]["headers"]
    assert headers["User-Agent"].startswith("HealthNet/")
    assert "@" not in headers["User-Agent"]


def test_unknown_and_invalid_barcodes(client, http):
    _, replies = http
    replies["openfoodfacts.org"] = FakeResponse(body={"status": 0})
    response = client.get("/food/barcode/0000000000000")
    assert response.status_code == 404 and response.json()["detail"]["code"] == "notFound"
    assert client.get("/food/barcode/abc123").status_code == 422


def test_energy_in_kilojoules_is_converted(http):
    product = {"product_name": "Oat drink", "nutriments": {"energy_100g": 196}}
    assert food_api.off_food("123456", product)["per100g"]["kcal"] == pytest.approx(46.8, abs=0.1)


def test_requires_sign_in(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "healthnet-test")
    assert TestClient(app).get("/food/search", params={"q": "rice"}).status_code == 401
