// The shape every calculator returns (port of risk/result.py), so the Dashboard renders all scores the same way.
//
// status
//   ok              value, unit, category and level are set
//   needs_input     `missing` lists the profile fields still needed
//   not_applicable  `reason` is a code the frontend translates; `reasonParams` fills it in
// level
//   0 (best) to 4 (worst), for colour coding

export const ok = (model, value, { unit, category, level, details = {}, assumptions = [] }) => ({
  status: 'ok',
  value,
  unit,
  category,
  level,
  details,
  assumptions: [...assumptions],
  model,
});

export const needsInput = (model, missing) => ({ status: 'needs_input', missing: [...missing], model });

export const notApplicable = (model, reason, params = {}) => ({ status: 'not_applicable', reason, reasonParams: params, model });

// Index of the first cut point the value is below, e.g. band(7, [5, 10]) === 1
export const band = (value, cutPoints) => {
  const index = cutPoints.findIndex((cut) => value < cut);
  return index === -1 ? cutPoints.length : index;
};

// Adds one to a string of decimal digits: '0129' -> '0130', '99' -> '100'
const incrementDigits = (text) => {
  const digits = text.split('');
  let index = digits.length - 1;
  while (index >= 0 && digits[index] === '9') {
    digits[index] = '0';
    index -= 1;
  }
  if (index < 0) return `1${digits.join('')}`;
  digits[index] = String(Number(digits[index]) + 1);
  return digits.join('');
};

// Python's round(): the exact binary value rounded to `digits` decimals, exact ties to even.
// Math.round rounds ties up and works on the already-rounded decimal, so it disagrees with the
// reference engine on values such as 0.25 or 2.675.
export const pyRound = (x, digits = 0) => {
  if (!Number.isFinite(x)) return x;
  // toFixed(100) writes the double's exact decimal expansion (doubles in this engine need far fewer digits)
  const [whole, fraction] = Math.abs(x).toFixed(100).split('.');
  const kept = whole + fraction.slice(0, digits);
  const rest = fraction.slice(digits);
  let up = rest[0] > '5' || (rest[0] === '5' && /[1-9]/.test(rest.slice(1)));
  if (rest[0] === '5' && !up && !/[1-9]/.test(rest.slice(1))) {
    up = Number(kept[kept.length - 1]) % 2 === 1;
  }
  const digitsText = (up ? incrementDigits(kept) : kept).replace(/^0+(?=\d)/, '').padStart(digits + 1, '0');
  const text = digits ? `${digitsText.slice(0, -digits)}.${digitsText.slice(-digits)}` : digitsText;
  const value = Number(text);
  return x < 0 ? -value : value;
};

export const percent = (probability, decimals = 1) => pyRound(probability * 100, decimals);
