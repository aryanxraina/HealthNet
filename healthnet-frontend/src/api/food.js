import { apiFetch } from './client';

// Free food databases through the HealthNet API (FINAL YEAR PROJECT/food_api.py).
// Only the search text or barcode is sent. Foods: { id, source, name, brand, per100g, servings }

export const searchFoods = (text) => apiFetch(`/food/search?q=${encodeURIComponent(text)}`).then((body) => body.foods);

export const lookupBarcode = (code) => apiFetch(`/food/barcode/${encodeURIComponent(code.replace(/\D/g, ''))}`);
