import NAMES from './labNames.json';
import { seededRandom } from './random';

// Synthetic lab reports with exact ground truth, for measuring report readers (R0 of
// docs/on-device-model-roadmap.md). No real person's data is involved.
//
// Each document is the text lines a reader would get from a PDF text layer or OCR, in one of several
// real-world layouts, optionally with OCR-style noise. Test names, units and reference ranges are
// written independently of src/ocr/labDictionary.js (test names in labNames.json, which the
// Tagger's training script also reads, to keep every one of them out of its training data), including spellings the parser doesn't
// know, so the benchmark measures coverage instead of agreeing with itself.
//
// document: { id, layout, noise, decimalComma, lines: [{ text, confidence }], truth }
// truth: { field: { value, tolerance, name, note? } }   values in HealthNet's standard units; `name` as printed; `note` is a
//        flag the reader must raise (plain "Glucose" isn't known to be fasting)

export const LAYOUTS = ['table', 'colon', 'flagged', 'split', 'unitInName', 'rangeFirst'];
export const NOISE_LEVELS = ['clean', 'light', 'heavy'];

// Conversion factors as many labs print them (deliberately not lib/units.js)
const GLUCOSE = 18.0;
const CHOLESTEROL = 38.67;
const CREATININE = 88.4;

const fixed = (value, decimals) => value.toFixed(decimals);

// How each test is written. value: a realistic true value in standard units.
// printings: [unit, printed number from the true value, tolerance on the standard value]
const TESTS = {
  totalCholesterol: {
    names: NAMES.totalCholesterol,
    value: (r) => Math.round(r.normal(195, 40, 110, 330)),
    printings: [['mg/dL', (v) => fixed(v, 0), 0.6], ['mmol/L', (v) => fixed(v / CHOLESTEROL, 2), 2.5], ['mg%', (v) => fixed(v, 0), 0.6]],
    range: { 'mg/dL': '< 200', 'mmol/L': '< 5.2', 'mg%': '125 - 200' },
    section: 'LIPID PROFILE',
  },
  hdlCholesterol: {
    names: NAMES.hdlCholesterol,
    value: (r) => Math.round(r.normal(50, 13, 25, 100)),
    printings: [['mg/dL', (v) => fixed(v, 0), 0.6], ['mmol/L', (v) => fixed(v / CHOLESTEROL, 2), 2.5]],
    range: { 'mg/dL': '40 - 60', 'mmol/L': '> 1.0' },
    section: 'LIPID PROFILE',
  },
  hba1c: {
    names: NAMES.hba1c,
    value: (r) => Math.round((r.chance(0.6) ? r.normal(5.5, 0.4, 4.5, 6.4) : r.normal(7.6, 1.2, 6.0, 12)) * 10) / 10,
    printings: [['%', (v) => fixed(v, 1), 0.06], ['mmol/mol', (v) => fixed((v - 2.152) / 0.09148, 0), 0.12]],
    range: { '%': '4.0 - 5.6', 'mmol/mol': '20 - 38' },
    section: 'DIABETES',
  },
  fastingGlucose: {
    names: NAMES.fastingGlucose,
    value: (r) => Math.round(r.normal(102, 25, 65, 260)),
    printings: [['mg/dL', (v) => fixed(v, 0), 0.6], ['mmol/L', (v) => fixed(v / GLUCOSE, 1), 1.6]],
    range: { 'mg/dL': '70 - 100', 'mmol/L': '3.9 - 5.5' },
    section: 'DIABETES',
  },
  creatinine: {
    names: NAMES.creatinine,
    value: (r) => Math.round(r.normal(0.95, 0.25, 0.4, 3) * 100) / 100,
    printings: [['mg/dL', (v) => fixed(v, 2), 0.006], ['µmol/L', (v) => fixed(v * CREATININE, 0), 0.016], ['umol/L', (v) => fixed(v * CREATININE, 0), 0.016]],
    range: { 'mg/dL': '0.6 - 1.2', 'µmol/L': '53 - 106', 'umol/L': '53 - 106' },
    section: 'KIDNEY FUNCTION',
  },
  egfr: {
    names: NAMES.egfr,
    value: (r) => Math.round(r.normal(90, 20, 15, 130)),
    printings: [['mL/min/1.73m2', (v) => fixed(v, 0), 0.6], ['mL/min/1.73 m²', (v) => fixed(v, 0), 0.6], ['mL/min', (v) => fixed(v, 0), 0.6]],
    range: { 'mL/min/1.73m2': '> 90', 'mL/min/1.73 m²': '> 90', 'mL/min': '> 60' },
    section: 'KIDNEY FUNCTION',
  },
  restingHeartRate: {
    names: NAMES.restingHeartRate,
    value: (r) => Math.round(r.normal(74, 10, 48, 110)),
    printings: [['bpm', (v) => fixed(v, 0), 0.6], ['/min', (v) => fixed(v, 0), 0.6], ['beats/min', (v) => fixed(v, 0), 0.6]],
    range: { bpm: '60 - 100', '/min': '60 - 100', 'beats/min': '60 - 100' },
    section: 'VITALS',
  },
  spo2: {
    names: NAMES.spo2,
    value: (r) => Math.round(r.between(93, 100.4)),
    printings: [['%', (v) => fixed(v, 0), 0.6]],
    range: { '%': '95 - 100' },
    section: 'VITALS',
  },
  temperature: {
    names: NAMES.temperature,
    value: (r) => Math.round(r.normal(36.8, 0.4, 35.8, 39) * 10) / 10,
    printings: [['°C', (v) => fixed(v, 1), 0.06], ['°F', (v) => fixed((v * 9) / 5 + 32, 1), 0.1]],
    range: { '°C': '36.1 - 37.2', '°F': '97 - 99' },
    section: 'VITALS',
  },
};

// A glucose line that doesn't say fasting: readers should read it but flag it
const PLAIN_GLUCOSE = NAMES.plainGlucose;

const BLOOD_PRESSURE_NAMES = NAMES.bloodPressure;

// Look-alikes that must never be read as one of HealthNet's tests
const DISTRACTORS = [
  ['LDL Cholesterol', 'mg/dL', 90, 190, 0, 'LIPID PROFILE'],
  ['VLDL Cholesterol', 'mg/dL', 12, 45, 0, 'LIPID PROFILE'],
  ['Triglycerides', 'mg/dL', 70, 320, 0, 'LIPID PROFILE'],
  ['Non-HDL Cholesterol', 'mg/dL', 90, 210, 0, 'LIPID PROFILE'],
  ['Total Cholesterol/HDL Ratio', '', 2.5, 6.5, 1, 'LIPID PROFILE'],
  ['LDL/HDL Ratio', '', 1.2, 4.5, 1, 'LIPID PROFILE'],
  ['Estimated Average Glucose (eAG)', 'mg/dL', 90, 230, 0, 'DIABETES'],
  ['Est. Avg Glucose', 'mg/dL', 90, 230, 0, 'DIABETES'],
  ['Mean Plasma Glucose', 'mg/dL', 90, 230, 0, 'DIABETES'],
  ['Post Prandial Blood Sugar', 'mg/dL', 100, 260, 0, 'DIABETES'],
  ['Random Blood Sugar', 'mg/dL', 85, 220, 0, 'DIABETES'],
  ['Glucose, 2 hr PP', 'mg/dL', 100, 240, 0, 'DIABETES'],
  ['Urine Creatinine', 'mg/dL', 20, 300, 0, 'KIDNEY FUNCTION'],
  ['Albumin/Creatinine Ratio', 'mg/g', 5, 60, 0, 'KIDNEY FUNCTION'],
  ['Blood Urea Nitrogen', 'mg/dL', 8, 25, 0, 'KIDNEY FUNCTION'],
  ['Uric Acid', 'mg/dL', 3, 8, 1, 'KIDNEY FUNCTION'],
  ['Haemoglobin', 'g/dL', 11, 17, 1, 'HAEMATOLOGY'],
  ['Respiratory Rate', '/min', 12, 20, 0, 'VITALS'],
  ['Mean Arterial Pressure', 'mmHg', 70, 105, 0, 'VITALS'],
];

const LAB_NAMES = ['Northfield Diagnostics', 'Riverside Pathology Lab', 'Bluebell Health Laboratory', 'Meridian Clinical Labs', 'Cedar Medical Testing'];
const FIRST = ['Alex', 'Sam', 'Jordan', 'Riya', 'Chen', 'Amara', 'Lukas', 'Sofia'];
const LAST = ['Doe', 'Rivera', 'Okafor', 'Novak', 'Sharma', 'Lindqvist', 'Tanaka', 'Moreau'];

const headerLines = (r) => {
  const day = String(Math.floor(r.between(1, 29))).padStart(2, '0');
  const month = String(Math.floor(r.between(1, 13))).padStart(2, '0');
  return r.shuffle([
    `Patient: ${r.pick(FIRST)} ${r.pick(LAST)}`,
    `Age / Sex: ${Math.floor(r.between(25, 80))} Y / ${r.pick(['M', 'F'])}`,
    `Patient ID: ${Math.floor(r.between(100000, 999999))}`,
    `Sample collected: ${day}/${month}/2026 ${String(Math.floor(r.between(7, 11))).padStart(2, '0')}:${String(Math.floor(r.between(0, 60))).padStart(2, '0')}`,
    `Phone: +44 20 ${Math.floor(r.between(1000, 9999))} ${Math.floor(r.between(1000, 9999))}`,
  ]).slice(0, 3 + Math.floor(r.between(0, 3)));
};

// One test as a line (or two, for the split layout)
const row = (layout, name, number, unit, range, flag) => {
  const unitText = unit ? ` ${unit}` : '';
  switch (layout) {
    case 'colon':
      return [`${name}: ${number}${unitText}${range ? ` (Ref: ${range})` : ''}`];
    case 'flagged':
      return [`${name}    ${number}  ${flag || ' '}  ${unit}    ${range}`.replace(/\s+$/, '')];
    case 'split':
      return [name, `${number}${unitText}    ${range}`.replace(/\s+$/, '')];
    case 'unitInName':
      return [`${name}${unit ? ` (${unit})` : ''}    ${number}    ${range}`.replace(/\s+$/, '')];
    case 'rangeFirst':
      return [`${name}    ${range}    ${number}${unitText}`];
    default:
      return [`${name}    ${number}    ${unit}    ${range}`.replace(/\s+$/, '')];
  }
};

const withComma = (number, decimalComma) => (decimalComma ? number.replace('.', ',') : number);

const flagFor = (field, value) => {
  const high = { totalCholesterol: 200, hba1c: 5.7, fastingGlucose: 100, creatinine: 1.2 }[field];
  return high !== undefined && value > high ? 'H' : '';
};

// OCR-style mistakes: digit/letter confusions, lost or extra spaces, and (heavy) lost decimal points
const CONFUSE_DIGIT = { 0: 'O', 1: 'l', 5: 'S', 8: 'B' };
const CONFUSE_LETTER = { O: '0', o: '0', l: '1', I: '1', S: '5' };
const addNoise = (r, text, level) => {
  if (level === 'clean') return text;
  const p = level === 'light' ? 0.015 : 0.04;
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\d/.test(ch) && CONFUSE_DIGIT[ch] && r.chance(p)) out += CONFUSE_DIGIT[ch];
    else if (CONFUSE_LETTER[ch] && r.chance(p)) out += CONFUSE_LETTER[ch];
    else if (ch === ' ' && r.chance(p * 2)) out += '';
    else if (ch === '.' && level === 'heavy' && /\d/.test(text[i - 1] || '') && r.chance(0.03)) out += '';
    else out += ch;
  }
  return out;
};

const makeDocument = (r, id, options) => {
  const layout = options.layout || r.pick(LAYOUTS);
  const noise = options.noise || (r.chance(0.5) ? 'clean' : r.chance(0.6) ? 'light' : 'heavy');
  const decimalComma = r.chance(0.1);
  const truth = {};
  const entries = []; // { section, lines }

  Object.entries(TESTS).forEach(([field, test]) => {
    if (!r.chance(field === 'totalCholesterol' || field === 'hdlCholesterol' ? 0.75 : 0.55)) return;
    const value = test.value(r);
    const [unit, print, tolerance] = r.pick(test.printings);
    let name = r.pick(test.names);
    let note;
    if (field === 'fastingGlucose' && r.chance(0.25)) {
      name = r.pick(PLAIN_GLUCOSE);
      note = 'notFasting';
    }
    truth[field] = { value, tolerance, name, ...(note ? { note } : {}) };
    entries.push({
      section: test.section,
      lines: row(layout, name, withComma(print(value), decimalComma), unit, withComma(test.range[unit] || '', decimalComma), flagFor(field, value)),
    });
  });

  if (r.chance(0.5)) {
    const systolic = Math.round(r.normal(126, 15, 95, 185));
    const diastolic = Math.round(Math.min(systolic - 25, r.normal(80, 10, 55, 110)));
    const name = r.pick(BLOOD_PRESSURE_NAMES);
    truth.systolic = { value: systolic, tolerance: 0.6, name };
    truth.diastolic = { value: diastolic, tolerance: 0.6, name };
    entries.push({ section: 'VITALS', lines: layout === 'colon' ? [`${name}: ${systolic}/${diastolic} mmHg`] : [`${name}    ${systolic}/${diastolic}    mmHg    120/80`] });
  }

  r.shuffle(DISTRACTORS).slice(0, 3 + Math.floor(r.between(0, 5))).forEach(([name, unit, low, high, decimals, section]) => {
    entries.push({ section, lines: row(layout, name, withComma(fixed(r.between(low, high), decimals), decimalComma), unit, '', '') });
  });

  // Group by section, as reports do
  const sections = [...new Set(entries.map((entry) => entry.section))];
  const body = r.shuffle(sections).flatMap((section) => [
    section,
    ...(layout === 'table' || layout === 'flagged' ? ['Test    Result    Unit    Reference Range'] : []),
    ...r.shuffle(entries.filter((entry) => entry.section === section)).flatMap((entry) => entry.lines),
  ]);
  const text = [r.pick(LAB_NAMES), ...headerLines(r), ...body, 'Page 1 of 1', '*** End of report ***'];
  const confidence = noise === 'clean' ? 1 : noise === 'light' ? 0.93 : 0.85;
  return {
    id,
    layout,
    noise,
    decimalComma,
    lines: text.map((line) => ({ text: addNoise(r, line, noise), confidence })),
    truth,
  };
};

// count documents from a seed; options.layout / options.noise fix those for every document
export const generateLabReports = (seed, count, options = {}) => {
  const r = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => makeDocument(r, `${seed}-${index}`, options));
};
