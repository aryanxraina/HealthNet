// Fixes the most common OCR mix-ups (letter O for zero, l / I / | for one) where a number is
// clearly expected: dose patterns like "1-O-1" and values written right before a unit like
// "2O mg" or "1O8 mg/dL". Words are left alone.

const toDigits = (token) => token.replace(/[oO]/g, '0').replace(/[lI|]/g, '1');

const DOSE_PATTERN = /(?<![a-z0-9])[0-2½oOlI|](?:\s*[-–]\s*[0-2½oOlI|]){2,3}(?![a-z0-9])/gi;
// A token with at least one real digit, mixed with look-alike letters, followed by a unit
const VALUE_BEFORE_UNIT = /(?<![a-z0-9])(?=[\doOlI|.,]*\d)[\doOlI|][\doOlI|]*(?:[.,][\doOlI|]+)?(?=\s*(?:mg|mcg|µg|g|ml|iu|%|mmol|µmol|umol|mmhg|bpm)(?![a-z]))/gi;

export const fixOcrDigits = (text) =>
  text.replace(DOSE_PATTERN, (match) => (/\d/.test(match) || /^[oO]/.test(match) ? toDigits(match) : match)).replace(VALUE_BEFORE_UNIT, toDigits);
