import { sectionById } from '../questionnaire/sections';
import { toStandard } from '../lib/units';
import { BLOOD_PRESSURE, LAB_TESTS } from './labDictionary';
import { fixOcrDigits } from './ocrText';
import { classifyName } from './tagger/tagger';

// Turns the text lines of a lab report (from a PDF's text layer or on-device OCR) into
// Vitals answers. Pure functions only, so every lab layout can be unit-tested.
//
// lines: [{ text, confidence }]  (confidence 0-1; 1 for PDF text)
// returns items: [{ field, value, unit, standardValue, loinc, confidence, sourceText, inRange, notes }]
//   value/unit         as printed on the report
//   standardValue      converted to HealthNet's standard unit (the questionnaire's), rounded
//   notes              codes for the review screen: unitGuessed, notFasting, approximate, outOfRange

const VITALS = sectionById('vitals');
const rangeOf = (field) => VITALS.questions.find((question) => question.id === field);

// A number that isn't glued to letters, so the "1" in HbA1c, the "2" in SpO2 and the "1" of
// "1.73m2" in an eGFR unit don't count. A unit may touch the number ("78ml/min", "5.6mmol/l").
const NUMBER = /(^|[^a-z0-9.,])([<>≤≥]=?\s*)?(\d+(?:[.,]\d+)?)(?!(?!(?:mg|mmol|ml|µmol|umol|mmhg|bpm)(?![a-z]))[a-z0-9]|[.,]\d)/i;

const normalise = (text) =>
  fixOcrDigits(text)
    .toLowerCase()
    // Dotted abbreviations: "h.d.l." -> "hdl", so look-alike exclusions still apply
    .replace(/\b(?:[a-z]\.){2,}/g, (abbreviation) => abbreviation.replace(/\./g, ''))
    // A zero between letters is an OCR'd "o" ("n0n-hdl"); a one is left alone, for "hba1c"
    .replace(/([a-z])0(?=[a-z])/g, '$1o')
    .replace(/[μ]/g, 'µ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();

const hasWord = (text, word) => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
};

const toNumber = (raw) => Number(raw.replace(',', '.'));

// Every number in a line with the words before it (its name) and after it (where its unit is):
// "pulse: 76 bpm spo2 98 %" -> [{ name: 'pulse:', value: 76, after: ' bpm spo2 ' }, { name: 'bpm spo2', value: 98, after: ' %' }]
// trailing: the words after the last number, for layouts that print the result on the next line
const readingsOf = (text) => {
  const pattern = new RegExp(NUMBER.source, 'gi');
  const readings = [];
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index + match[1].length;
    const comparator = match[2] || '';
    const end = start + comparator.length + match[3].length;
    readings.push({ name: text.slice(last, start).trim(), comparator: comparator.trim(), value: toNumber(match[3]), start, end });
    last = end;
    pattern.lastIndex = end;
  }
  readings.forEach((reading, index) => {
    reading.after = text.slice(reading.end, index + 1 < readings.length ? readings[index + 1].start : text.length);
  });
  return { readings, trailing: text.slice(last).trim() };
};

// The readings that can be a result: reference ranges ("70 - 100", or "< 200" when another number
// follows), numbers inside the name's brackets ("eGFR (CKD-EPI 2021)") and durations that are part
// of the name ("Glucose, 2 hr PP") are skipped, and their text joins the next reading's name
// (not a bare "h", which is how reports flag a high result: "212 H mg/dL")
const DURATION = /^\s*(?:hr|hrs|hour|hours)(?![a-z])/;

const resultReadings = (readings) => {
  const skip = new Set();
  readings.forEach((reading, index) => {
    const next = readings[index + 1];
    if (next && /^\s*[-–]\s*$/.test(reading.after)) {
      skip.add(index).add(index + 1);
    }
    if (DURATION.test(reading.after)) skip.add(index);
  });
  readings.forEach((reading, index) => {
    if (reading.comparator && readings.some((other, later) => later > index && !skip.has(later) && !other.comparator)) skip.add(index);
  });
  const results = [];
  let carried = '';
  readings.forEach((reading, index) => {
    const name = `${carried} ${reading.name}`.trim();
    const open = (name.match(/\(/g) || []).length - (name.match(/\)/g) || []).length;
    if (skip.has(index) || (open > 0 && reading.after.includes(')'))) {
      carried = `${name} ${reading.value}${reading.after}`;
      return;
    }
    results.push({ ...reading, name });
    carried = '';
  });
  return results;
};

// The unit printed nearest after the value ("6.1 % (43 mmol/mol)" -> %); on a tie the longer
// spelling wins, so "ml/min/1.73m2" beats "ml/min"
const findUnit = (test, ...texts) => {
  for (const text of texts) {
    let found = null;
    Object.keys(test.units).forEach((spelling) => {
      const at = text.indexOf(spelling);
      if (at >= 0 && (!found || at < found.at || (at === found.at && spelling.length > found.spelling.length))) {
        found = { at, spelling };
      }
    });
    if (found) return test.units[found.spelling];
  }
  return null;
};

// Short words ("pp", "hdl") must match whole words; longer ones and symbols match anywhere,
// so "post" also catches "postprandial". The test's own unit in brackets ("Creatinine (mg/dL)")
// is ignored, so its "/" isn't mistaken for a ratio.
const excluded = (test, name) => {
  const units = Object.keys(test.units);
  const text = name.replace(/\(([^)]*)\)/g, (bracket, inside) => (units.some((unit) => inside.trim() === unit) ? ' ' : bracket));
  return test.exclude.some((word) => (/^[a-z]{1,3}$/.test(word) ? hasWord(text, word) : text.includes(word)));
};

// Converts a printed value to the questionnaire's standard unit
const standardise = (test, value, unit) => {
  if (test.field === 'hba1c') {
    // IFCC mmol/mol -> NGSP % (NGSP = 0.09148 x IFCC + 2.152)
    return unit === 'mmol/mol' ? 0.09148 * value + 2.152 : value;
  }
  if (test.kind === 'temperature') return toStandard('temperature', value, { temperature: unit });
  if (!test.kind) return value;
  // lib/units.js converts from "the user's lab unit"; mmol/L stands for SI units here (µmol/L for creatinine)
  const si = unit === 'mmol/L' || unit === 'µmol/L';
  return toStandard(test.kind, value, { lab: si ? 'mmol/L' : 'mg/dL' });
};

const round = (value, field) => {
  const decimals = field === 'creatinine' ? 2 : field === 'hba1c' || field === 'temperature' ? 1 : 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const matchLabel = (test, name) => {
  if (test.labels.some((label) => hasWord(name, label))) return 'exact';
  if (test.looseLabels?.some((label) => hasWord(name, label))) return 'loose';
  return null;
};

const item = (test, { value, unit, unitGuessed, comparator, looseLabel, lineConfidence, sourceText }) => {
  const standardValue = round(standardise(test, value, unit), test.field);
  const range = rangeOf(test.field);
  const inRange = !range || (standardValue >= range.min && standardValue <= range.max);
  const notes = [];
  let confidence = 0.95;
  if (unitGuessed) {
    notes.push('unitGuessed');
    confidence -= 0.2;
  }
  if (looseLabel) {
    notes.push('notFasting');
    confidence -= 0.25;
  }
  if (comparator) {
    notes.push('approximate');
    confidence -= 0.1;
  }
  if (!inRange) {
    notes.push('outOfRange');
    confidence -= 0.4;
  }
  return {
    field: test.field,
    value,
    unit,
    standardValue,
    loinc: test.loinc,
    confidence: Math.max(0.05, Math.round(confidence * lineConfidence * 100) / 100),
    sourceText,
    inRange,
    notes,
  };
};

const reading = (test, { name, value, comparator, unitTexts, labelMatch, lineConfidence, sourceText }) => {
  const printedUnit = findUnit(test, ...unitTexts);
  return item(test, {
    value,
    unit: printedUnit || test.guess(value),
    unitGuessed: !printedUnit,
    comparator,
    looseLabel: labelMatch === 'loose',
    lineConfidence,
    sourceText,
  });
};

// The first reading on the line whose name is this test (and not a look-alike)
const parseTestLine = (test, lines, index) => {
  const raw = lines[index].text;
  const { readings, trailing } = readingsOf(normalise(raw));
  const lineConfidence = lines[index].confidence ?? 1;
  const results = resultReadings(readings);
  for (const r of results) {
    const labelMatch = matchLabel(test, r.name);
    if (labelMatch && !excluded(test, r.name)) {
      return reading(test, { ...r, unitTexts: [r.after, r.name], labelMatch, lineConfidence, sourceText: raw.trim() });
    }
  }
  // Some layouts put the result on the line below the test name. A line with no possible result
  // (e.g. "eGFR (CKD-EPI 2021)") is all name.
  const nameText = results.length ? trailing : normalise(raw);
  const labelMatch = matchLabel(test, nameText);
  if (labelMatch && !excluded(test, nameText) && lines[index + 1]) {
    const next = readingsOf(normalise(lines[index + 1].text)).readings[0];
    if (next && !next.name) {
      return reading(test, {
        ...next,
        unitTexts: [next.after, nameText],
        labelMatch,
        lineConfidence: Math.min(lineConfidence, lines[index + 1].confidence ?? 1),
        sourceText: `${raw.trim()} ${lines[index + 1].text.trim()}`,
      });
    }
  }
  return null;
};

const SYSTOLIC = { field: 'systolic', kind: null, loinc: BLOOD_PRESSURE.loinc.systolic };
const DIASTOLIC = { field: 'diastolic', kind: null, loinc: BLOOD_PRESSURE.loinc.diastolic };

const parseBloodPressure = (line) => {
  const text = normalise(line.text);
  if (!BLOOD_PRESSURE.labels.some((label) => hasWord(text, label))) return [];
  const match = /(\d{2,3})\/(\d{2,3})/.exec(text);
  if (!match) return [];
  const shared = { unit: 'mmHg', unitGuessed: false, comparator: '', lineConfidence: line.confidence ?? 1, sourceText: line.text.trim() };
  return [
    item(SYSTOLIC, { ...shared, value: Number(match[1]) }),
    item(DIASTOLIC, { ...shared, value: Number(match[2]) }),
  ];
};

// The Tagger (src/ocr/tagger) reads a line only when the rules found nothing on it, and only when it
// is at least this sure. Its items are marked nameGuessed and their confidence scaled by its certainty.
export const TAGGER_MIN_PROBABILITY = 0.8;
const TAGGER_MAX_SHARE = 0.9;
const hasLetters = (text) => /[a-z]{2}/.test(text);

const parseWithTagger = (tagger, lines, index) => {
  const raw = lines[index].text;
  const text = normalise(raw);
  if (!hasLetters(text)) return [];
  const lineConfidence = lines[index].confidence ?? 1;
  const results = resultReadings(readingsOf(text).readings);
  let candidate;
  if (results.length) {
    // The first reading that follows a name. Everything before it is the name, so a number OCR made
    // out of letters ("02 Sat" for "O2 Sat") stays part of it.
    const first = results.find((r) => hasLetters(r.name));
    if (!first) return [];
    const name = text.slice(0, first.start).trim();
    candidate = { name, found: first, unitTexts: [first.after, name], lineConfidence, sourceText: raw.trim() };
  } else {
    // The result may be on the next line, as in the rules
    const next = lines[index + 1] && readingsOf(normalise(lines[index + 1].text)).readings[0];
    if (!next || next.name) return [];
    candidate = {
      name: text,
      found: next,
      unitTexts: [next.after, text],
      lineConfidence: Math.min(lineConfidence, lines[index + 1].confidence ?? 1),
      sourceText: `${raw.trim()} ${lines[index + 1].text.trim()}`,
    };
  }

  const { label, probability } = classifyName(tagger, candidate.name);
  if (label === 'other' || probability < TAGGER_MIN_PROBABILITY) return [];
  // A guessed name never looks as certain as a dictionary match, however sure the model is
  const confidence = candidate.lineConfidence * Math.min(probability, TAGGER_MAX_SHARE);
  let items;
  if (label === 'bloodPressure') {
    const match = /(\d{2,3})\/(\d{2,3})/.exec(text);
    if (!match) return [];
    const shared = { unit: 'mmHg', unitGuessed: false, comparator: '', lineConfidence: confidence, sourceText: raw.trim() };
    items = [item(SYSTOLIC, { ...shared, value: Number(match[1]) }), item(DIASTOLIC, { ...shared, value: Number(match[2]) })];
  } else {
    const spec = LAB_TESTS.find((test) => test.field === (label === 'glucoseUnspecified' ? 'fastingGlucose' : label));
    // The dictionary's look-alike exclusions still apply ("urine", "ratio", "post"...)
    if (!spec || excluded(spec, candidate.name)) return [];
    items = [
      reading(spec, {
        ...candidate.found,
        unitTexts: candidate.unitTexts,
        labelMatch: label === 'glucoseUnspecified' ? 'loose' : 'exact',
        lineConfidence: confidence,
        sourceText: candidate.sourceText,
      }),
    ];
  }
  items.forEach((found) => found.notes.push('nameGuessed'));
  return items;
};

// Best reading per field: in-range beats out-of-range, then higher confidence, then earlier in the report
const better = (a, b) => (a.inRange !== b.inRange ? a.inRange : a.confidence > b.confidence);

// options.tagger: the Tagger model (loadTagger in src/ocr/tagger/tagger.js); without it, rules only
export const parseLabReport = (lines, { tagger } = {}) => {
  const best = {};
  const keep = (found) => {
    if (found && (!best[found.field] || better(found, best[found.field]))) best[found.field] = found;
  };
  lines.forEach((line, index) => {
    const fromRules = [...parseBloodPressure(line), ...LAB_TESTS.map((test) => parseTestLine(test, lines, index)).filter(Boolean)];
    fromRules.forEach(keep);
    if (tagger && fromRules.length === 0) parseWithTagger(tagger, lines, index).forEach(keep);
  });
  const order = VITALS.questions.map((question) => question.id);
  return Object.values(best).sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field));
};

// Readings transcribed by the cloud reader ({ test, value, unit, sourceText }) -> the same items, with
// the same unit handling and range checks, as on-device parsing. "glucoseUnspecified" is a glucose
// result not marked as fasting, flagged like a plain "glucose" line.
export const labItemsFromCloud = (results, confidence = 0.9) => {
  const best = {};
  results.forEach(({ test, value, unit, sourceText }) => {
    const field = test === 'glucoseUnspecified' ? 'fastingGlucose' : test;
    const spec = LAB_TESTS.find((candidate) => candidate.field === field);
    if (!spec || typeof value !== 'number') return;
    const printedUnit = unit ? findUnit(spec, normalise(unit)) : null;
    const found = item(spec, {
      value,
      unit: printedUnit || spec.guess(value),
      unitGuessed: !printedUnit,
      comparator: '',
      looseLabel: test === 'glucoseUnspecified',
      lineConfidence: confidence,
      sourceText,
    });
    if (!best[field] || better(found, best[field])) best[field] = found;
  });
  const order = VITALS.questions.map((question) => question.id);
  return Object.values(best).sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field));
};

// Plain text (e.g. pasted) -> the lines shape the parser expects
export const textToLines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line, confidence: 1 }));
