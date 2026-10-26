// Fixes the most common OCR mix-ups (letter O for zero, l / I / | for one) where a number is
// clearly expected: dose patterns like "1-O-1" and values written right before a unit like
// "2O mg" or "1O8 mg/dL". Words are left alone.

const toDigits = (token) => token.replace(/[oO]/g, '0').replace(/[lI|]/g, '1');

const DOSE_PATTERN = /(?<![a-z0-9])[0-2½oOlI|](?:\s*[-–]\s*[0-2½oOlI|]){2,3}(?![a-z0-9])/gi;
// A token with at least one real digit, mixed with look-alike letters, followed by a unit
// (S and B count as 5 and 8 here too: "S7 mL/min")
const VALUE_BEFORE_UNIT = /(?<![a-z0-9])(?=[\doOlI|SB.,]*\d)[\doOlI|SB][\doOlI|SB]*(?:[.,][\doOlI|SB]+)?(?=\s*(?:mg|mcg|µg|g|ml|iu|%|mmol|µmol|umol|mmhg|bpm)(?![a-z]))/gi;

// Numbers with a decimal point or slash, like "l26/79", "O.6" or "98.B": every part is number-like
// and at least one real digit is present, so S and B are taken as 5 and 8 too ("B.P." has no digit)
const SEPARATED_NUMBER = /(?<![a-z0-9])[\doOlI|SB]+(?:[.,/][\doOlI|SB]+)+(?![a-z0-9])/g;
// A range such as a reference interval, "7O - 100" or "20 - 3B": both ends must have a real digit
const RANGE = /(?<![a-z0-9])([\doOlI|SB]+(?:[.,][\doOlI|SB]+)?)(\s*[-–]\s*)([\doOlI|SB]+(?:[.,][\doOlI|SB]+)?)(?![a-z0-9])/g;
// S or B between digits, "1S3"
const DIGITS_AROUND_LETTER = /(?<![a-z0-9])\d+[SB]\d+(?![a-z0-9])/g;
// Plain numbers with at least two real digits, like "1O0"; only O and l/I are swapped, so "B12",
// "O2" and "S3" stay as written
const PLAIN_NUMBER = /(?<![a-z0-9])[\doOlI|]+(?![a-z0-9])/g;

const realDigits = (token) => (token.match(/\d/g) || []).length;
const toNumberDigits = (token) => toDigits(token).replace(/[sS]/g, '5').replace(/[bB]/g, '8');

export const fixOcrDigits = (text) =>
  text
    .replace(DOSE_PATTERN, (match) => (/\d/.test(match) || /^[oO]/.test(match) ? toDigits(match) : match))
    .replace(VALUE_BEFORE_UNIT, toNumberDigits)
    .replace(SEPARATED_NUMBER, (match) => (realDigits(match) >= 1 ? toNumberDigits(match) : match))
    .replace(RANGE, (match, low, dash, high) => (realDigits(low) && realDigits(high) ? `${toNumberDigits(low)}${dash}${toNumberDigits(high)}` : match))
    .replace(DIGITS_AROUND_LETTER, toNumberDigits)
    .replace(PLAIN_NUMBER, (match) => (realDigits(match) >= 2 ? toDigits(match) : match));
