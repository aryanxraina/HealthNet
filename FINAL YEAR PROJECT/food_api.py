"""Food search and barcode lookup from free, open databases.

- Search: USDA FoodData Central (https://fdc.nal.usda.gov/api-guide). Set USDA_API_KEY to a free key
  from https://api.data.gov/signup/ - the shared DEMO_KEY allows only about 10 requests an hour.
- Barcodes: Open Food Facts (https://world.openfoodfacts.org/data), worldwide, no key.

Only the search text or barcode is sent to these services. Every food comes back in one shape:
  { id, source, name, brand, per100g: { kcal, protein, carbs, fat, fiber, sugar }, servings: [{ label, grams }] }
"""
import os
import re
import time
from urllib.parse import quote, urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from auth import current_user

router = APIRouter(prefix="/food", tags=["food"])

USDA_SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search"
OFF_PRODUCT = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
# Open Food Facts asks apps to identify themselves
USER_AGENT = "HealthNet/1.0 (health tracking web app)"
TIMEOUT_SECONDS = 8
CACHE_SECONDS = 24 * 3600
CACHE_SIZE = 1000

# USDA nutrient ids. Energy appears as 1008, or as Atwater energy 2047/2048 in Foundation foods.
ENERGY_IDS = (1008, 2047, 2048)
NUTRIENTS = {"protein": 1003, "fat": 1004, "carbs": 1005, "fiber": 1079, "sugar": 2000}

_cache = {}


def _cached(key, compute):
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    value = compute()
    if len(_cache) >= CACHE_SIZE:
        _cache.pop(next(iter(_cache)))
    _cache[key] = (time.monotonic(), value)
    return value


def _round(value):
    return None if value is None else round(float(value), 1)


def usda_food(food):
    values = {n["nutrientId"]: n.get("value") for n in food.get("foodNutrients", []) if "nutrientId" in n}
    kcal = next((values[i] for i in ENERGY_IDS if values.get(i) is not None), None)
    servings = [
        {"label": m["disseminationText"], "grams": round(float(m["gramWeight"]), 1)}
        for m in food.get("foodMeasures", [])
        if m.get("disseminationText") and m.get("gramWeight") and m["disseminationText"].lower() != "quantity not specified"
    ][:6]
    if food.get("servingSize") and str(food.get("servingSizeUnit", "")).lower() in ("g", "grm"):
        servings.insert(0, {"label": f"1 serving ({_round(food['servingSize'])} g)", "grams": _round(food["servingSize"])})
    return {
        "id": f"usda:{food['fdcId']}",
        "source": "usda",
        "name": food.get("description", "").strip().capitalize() if food.get("description", "").isupper() else food.get("description", "").strip(),
        "brand": food.get("brandOwner") or food.get("brandName") or None,
        "per100g": {"kcal": _round(kcal), **{name: _round(values.get(nid)) for name, nid in NUTRIENTS.items()}},
        "servings": servings,
    }


def off_food(code, product):
    nutriments = product.get("nutriments", {})
    kcal = nutriments.get("energy-kcal_100g")
    if kcal is None and nutriments.get("energy_100g") is not None:
        kcal = float(nutriments["energy_100g"]) / 4.184  # kJ -> kcal
    servings = []
    if product.get("serving_quantity"):
        try:
            grams = float(product["serving_quantity"])
            servings.append({"label": f"1 serving ({product.get('serving_size') or f'{grams:g} g'})", "grams": round(grams, 1)})
        except (TypeError, ValueError):
            pass
    return {
        "id": f"off:{code}",
        "source": "openfoodfacts",
        "name": (product.get("product_name") or product.get("generic_name") or "").strip(),
        "brand": (product.get("brands") or "").split(",")[0].strip() or None,
        "per100g": {
            "kcal": _round(kcal),
            "protein": _round(nutriments.get("proteins_100g")),
            "carbs": _round(nutriments.get("carbohydrates_100g")),
            "fat": _round(nutriments.get("fat_100g")),
            "fiber": _round(nutriments.get("fiber_100g")),
            "sugar": _round(nutriments.get("sugars_100g")),
        },
        "servings": servings,
    }


def search_foods(query):
    def fetch():
        params = [
            ("api_key", os.getenv("USDA_API_KEY") or "DEMO_KEY"),
            ("query", query),
            ("pageSize", 20),
            # Generic foods with reliable per-100 g values; branded US products are left out
            ("dataType", "Survey (FNDDS)"),
            ("dataType", "Foundation"),
            ("dataType", "SR Legacy"),
        ]
        # USDA rejects "+" for spaces, so encode them as %20
        response = requests.get(f"{USDA_SEARCH}?{urlencode(params, quote_via=quote)}", timeout=TIMEOUT_SECONDS)
        if response.status_code == 429:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, {"code": "rateLimited", "message": "Food search limit reached. Set USDA_API_KEY for a higher limit."})
        if response.status_code == 403:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"code": "notConfigured", "message": "The USDA_API_KEY was rejected."})
        response.raise_for_status()
        foods = [usda_food(food) for food in response.json().get("foods", [])]
        return [food for food in foods if food["name"] and food["per100g"]["kcal"] is not None]

    return _cached(("search", query.lower()), fetch)


def lookup_barcode(code):
    def fetch():
        response = requests.get(
            OFF_PRODUCT.format(code=code),
            params={"fields": "product_name,generic_name,brands,nutriments,serving_size,serving_quantity"},
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT_SECONDS,
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        body = response.json()
        if body.get("status") != 1 or not body.get("product"):
            return None
        food = off_food(code, body["product"])
        return food if food["name"] else None

    return _cached(("barcode", code), fetch)


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=80), uid: str = Depends(current_user)):
    try:
        return {"query": q, "foods": search_foods(q.strip())}
    except requests.RequestException:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"code": "unavailable", "message": "Couldn't reach the food database."})


@router.get("/barcode/{code}")
def barcode(code: str = Path(pattern=r"^\d{6,14}$"), uid: str = Depends(current_user)):
    try:
        food = lookup_barcode(re.sub(r"\D", "", code))
    except requests.RequestException:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"code": "unavailable", "message": "Couldn't reach Open Food Facts."})
    if food is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, {"code": "notFound", "message": "This barcode isn't in Open Food Facts yet."})
    return food
