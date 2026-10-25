import { fixOcrDigits } from './ocrText';

// Finds medicines in the text lines of a prescription (from on-device OCR or a PDF).
// Pure functions, so every way of writing a prescription can be unit-tested.
//
// lines: [{ text, confidence }]
// returns: [{ name, strength, frequency, duration, instructions, sourceText, confidence }]
//   frequency     a code (once | twice | threeTimes | fourTimes | bedtime | asNeeded | weekly)
//                 or a dose pattern such as "1-0-1" (morning-afternoon-night)
//   instructions  a code (afterFood | beforeFood | withFood | emptyStomach)

const FORM = /^(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syr(?:up)?|inj(?:ection)?|oint(?:ment)?|cream|gel|drops?|susp(?:ension)?|inhaler|sachet|t|c)\b\.?\s*/i;
const NUMBERING = /^\s*(?:rx\.?|℞|\d{1,2}\s*[.)]|[•\-–*])\s*/i;
const STRENGTH = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|iu|%)(?![a-z])/i;
const PATTERN = /(?<![\d.])([0-2½](?:\s*[-–]\s*[0-2½]){2,3})(?![\d.])/;
const DURATION = /(?:x|for|×)\s*(\d+)\s*(days?|d|weeks?|wks?|w|months?|m)\b/i;

const FREQUENCIES = [
  ['fourTimes', /\b(?:qid|qds|four times (?:a|per) day|4 times (?:a|per) day)\b/i],
  ['threeTimes', /\b(?:tds|tid|thrice daily|three times (?:a|per) day|3 times (?:a|per) day)\b/i],
  ['twice', /\b(?:bd|bid|b\.d\.|twice (?:a day|daily)|2 times (?:a|per) day|every 12 hours)\b/i],
  ['once', /\b(?:od|qd|o\.d\.|once (?:a day|daily)|daily|every day|every morning)\b/i],
  ['bedtime', /\b(?:hs|at bedtime|at night|before sleep)\b/i],
  ['asNeeded', /\b(?:sos|prn|as needed|when required|if needed)\b/i],
  ['weekly', /\b(?:weekly|once a week)\b/i],
];

const INSTRUCTIONS = [
  ['afterFood', /\b(?:after (?:food|meals?|breakfast|lunch|dinner)|a\/f|pc)\b/i],
  ['beforeFood', /\b(?:before (?:food|meals?|breakfast|lunch|dinner)|b\/f|ac)\b/i],
  ['withFood', /\bwith (?:food|meals?|milk)\b/i],
  ['emptyStomach', /\bempty stomach\b/i],
];

// Lines that belong to the header or footer of a prescription, not to a medicine
const NOT_A_MEDICINE = /\b(?:dr\.?|doctor|clinic|hospital|patient|name|age|sex|date|phone|tel|mobile|address|diagnosis|signature|reg(?:istration)?\.?\s*no|mbbs|md|follow[- ]?up|advice|review|weight|bp|pulse|temp)\b/i;

const firstMatch = (rules, text) => rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

const parts = (text) => {
  const strength = STRENGTH.exec(text);
  const pattern = PATTERN.exec(text);
  const duration = DURATION.exec(text);
  return {
    strength: strength ? `${strength[1]} ${strength[2].toLowerCase() === 'µg' ? 'mcg' : strength[2].toLowerCase()}` : null,
    frequency: pattern ? pattern[1].replace(/\s+/g, '').replace('–', '-') : firstMatch(FREQUENCIES, text),
    duration: duration ? `${duration[1]} ${duration[2]}` : null,
    instructions: firstMatch(INSTRUCTIONS, text),
    // Where the medicine name stops: at the first strength, dose pattern, or instruction
    nameEnd: Math.min(
      ...[strength, pattern, duration].filter(Boolean).map((m) => m.index),
      ...[...FREQUENCIES, ...INSTRUCTIONS].map(([, p]) => p.exec(text)?.index ?? Infinity),
      text.length
    ),
  };
};

const cleanName = (text) =>
  text
    .replace(/[,:;()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s.\-–]+$/, '')
    .trim();

// A line with only dosing details ("1-0-1 x 5 days after food") that continues the line above
const isContinuation = (info, name) => !/[a-z]{4,}/i.test(name) && (info.frequency || info.duration || info.instructions);

export const parsePrescription = (lines) => {
  const medicines = [];
  lines.forEach(({ text, confidence = 1 }) => {
    const raw = text.trim();
    if (!raw) return;
    const body = fixOcrDigits(raw).replace(NUMBERING, '');
    const hasForm = FORM.test(body);
    const withoutForm = body.replace(FORM, '');
    const info = parts(withoutForm);
    const name = cleanName(withoutForm.slice(0, info.nameEnd));
    const previous = medicines[medicines.length - 1];

    if (previous && isContinuation(info, name)) {
      previous.frequency ??= info.frequency;
      previous.duration ??= info.duration;
      previous.instructions ??= info.instructions;
      previous.sourceText += ` ${raw}`;
      return;
    }
    if (NOT_A_MEDICINE.test(body) && !hasForm) return;
    const hasDosing = info.strength || info.frequency;
    if (!/[a-z]{3,}/i.test(name) || !(hasForm || hasDosing)) return;

    medicines.push({
      name,
      strength: info.strength,
      frequency: info.frequency,
      duration: info.duration,
      instructions: info.instructions,
      sourceText: raw,
      confidence: Math.round(confidence * (hasForm && hasDosing ? 1 : 0.8) * 100) / 100,
    });
  });
  return medicines;
};
