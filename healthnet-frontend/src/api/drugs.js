import { apiFetch } from './client';

// Medicine name matching against RxNorm (FINAL YEAR PROJECT/drugs_api.py).
// Only the medicine text is sent, never anything else about the person.
// Resolves to { query, matches: [{ rxcui, name, termType, ingredient, similarity }] }
export const matchDrug = (text) => apiFetch(`/drugs/match?q=${encodeURIComponent(text)}`);
