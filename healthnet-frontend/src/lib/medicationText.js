// Words for the frequency and instruction codes from ocr/prescriptionParser.js, shared by the
// prescription review, the medicines list and the PDF report

const DOSE_PATTERN = /^[0-2½](?:-[0-2½]){2,3}$/;

export const frequencyText = (frequency, t) => {
  if (!frequency) return '';
  if (DOSE_PATTERN.test(frequency)) return t('prescription.pattern', { pattern: frequency });
  const key = `prescription.frequency.${frequency}`;
  const text = t(key);
  return text === key ? frequency : text;
};

export const instructionsText = (instructions, t) => {
  if (!instructions) return '';
  const key = `prescription.instructions.${instructions}`;
  const text = t(key);
  return text === key ? instructions : text;
};

// "Metformin 500 mg · 1-0-1 (morning–afternoon–night) · after food · for 30 days"
export const medicationSummary = (medication) =>
  [
    [medication.name, medication.strength].filter(Boolean).join(' '),
    medication.frequency,
    medication.instructions,
    medication.duration,
  ]
    .filter(Boolean)
    .join(' · ');
