import { parseLabReport, textToLines } from './labParser';

// Made-up reports in common layouts. No real person's report is used.

const byField = (items) => Object.fromEntries(items.map((item) => [item.field, item]));
const parse = (text) => byField(parseLabReport(textToLines(text)));

test('US-style lipid panel and chemistry in mg/dL', () => {
  const found = parse(`
    LIPID PANEL
    Cholesterol, Total        195   mg/dL     <200
    HDL Cholesterol            52   mg/dL     >39
    LDL Cholesterol Calc      118   mg/dL     0-99
    Cholesterol/HDL Ratio     3.8              0.0-5.0
    Glucose, Fasting           98   mg/dL     65-99
    Hemoglobin A1c            5.6   %         4.8-5.6
    Creatinine               0.92   mg/dL     0.57-1.00
    eGFR                      >90   mL/min/1.73m2  >59
  `);
  expect(found.totalCholesterol).toMatchObject({ value: 195, unit: 'mg/dL', standardValue: 195, loinc: '2093-3', inRange: true });
  expect(found.hdlCholesterol).toMatchObject({ value: 52, standardValue: 52 });
  expect(found.fastingGlucose.standardValue).toBe(98);
  expect(found.hba1c).toMatchObject({ value: 5.6, unit: '%' });
  expect(found.creatinine).toMatchObject({ value: 0.92, standardValue: 0.92 });
  expect(found.egfr).toMatchObject({ value: 90, notes: ['approximate'] });
  // The ratio line must not be read as total cholesterol
  expect(found.totalCholesterol.sourceText).toMatch(/^Cholesterol, Total/);
});

test('UK-style report in SI units is converted to standard units', () => {
  const found = parse(`
    Serum cholesterol 5.2 mmol/L
    HDL cholesterol 1.3 mmol/L
    HbA1c 42 mmol/mol (IFCC)
    Fasting plasma glucose 5.4 mmol/L
    Serum creatinine 80 umol/L
    eGFR 85 mL/min/1.73 m2
  `);
  expect(found.totalCholesterol).toMatchObject({ unit: 'mmol/L', standardValue: 201 });
  expect(found.hdlCholesterol.standardValue).toBe(50);
  expect(found.hba1c).toMatchObject({ unit: 'mmol/mol', standardValue: 6 });
  expect(found.fastingGlucose.standardValue).toBe(97);
  expect(found.creatinine).toMatchObject({ unit: 'µmol/L', standardValue: 0.9 });
  expect(found.egfr.standardValue).toBe(85);
});

test('table layout with results on the next line and missing units', () => {
  const found = parse(`
    TEST NAME            RESULT   UNIT    BIOLOGICAL REF. INTERVAL
    Blood Sugar (Fasting)
    104
    S. Creatinine        1.1      mg/dl   0.6 - 1.2
    Glycated Haemoglobin (HbA1c)  6.2 %   4.0 - 5.6
  `);
  expect(found.fastingGlucose).toMatchObject({ value: 104, unit: 'mg/dL', notes: ['unitGuessed'] });
  expect(found.fastingGlucose.confidence).toBeLessThan(0.9);
  expect(found.creatinine.standardValue).toBe(1.1);
  expect(found.hba1c.standardValue).toBe(6.2);
});

test('clinic note with several readings on one line', () => {
  const found = parse('BP: 128/82 mmHg   Pulse: 76 bpm   SpO2 98 %   Temp 98.6 °F');
  expect(found.systolic).toMatchObject({ value: 128, standardValue: 128 });
  expect(found.diastolic.standardValue).toBe(82);
  expect(found.restingHeartRate.standardValue).toBe(76);
  expect(found.spo2.standardValue).toBe(98);
  expect(found.temperature).toMatchObject({ unit: 'F', standardValue: 37 });
});

test('the unit next to the value wins when both units are printed', () => {
  const found = parse('HbA1c 6.1 % (43 mmol/mol)\nTotal cholesterol 190 mg/dL (4.9 mmol/L)');
  expect(found.hba1c).toMatchObject({ unit: '%', standardValue: 6.1 });
  expect(found.totalCholesterol).toMatchObject({ unit: 'mg/dL', standardValue: 190 });
});

test('look-alike tests are not confused', () => {
  const found = parse(`
    Non-HDL Cholesterol 140 mg/dL
    Glucose Post Prandial 160 mg/dL
    Estimated Average Glucose 117 mg/dL
    Urine Albumin/Creatinine Ratio 12 mg/g
    Pulse oximetry 97 %
  `);
  expect(found.hdlCholesterol).toBeUndefined();
  expect(found.totalCholesterol).toBeUndefined();
  expect(found.fastingGlucose).toBeUndefined();
  expect(found.creatinine).toBeUndefined();
  expect(found.restingHeartRate).toBeUndefined();
});

test('plain "glucose" is kept but flagged as possibly not fasting', () => {
  const found = parse('Glucose 112 mg/dL');
  expect(found.fastingGlucose.notes).toContain('notFasting');
  expect(found.fastingGlucose.confidence).toBeLessThan(0.75);
});

test('implausible values are flagged and a plausible duplicate is preferred', () => {
  const found = parse('Total Cholesterol 1950 mg/dL\nTotal Cholesterol 195 mg/dL');
  expect(found.totalCholesterol).toMatchObject({ standardValue: 195, inRange: true });
  const odd = parse('HDL Cholesterol 450 mg/dL');
  expect(odd.hdlCholesterol).toMatchObject({ inRange: false });
  expect(odd.hdlCholesterol.notes).toContain('outOfRange');
});

test('OCR confidence lowers the reading confidence', () => {
  const [item] = parseLabReport([{ text: 'HbA1c 5.9 %', confidence: 0.6 }]);
  expect(item.confidence).toBeCloseTo(0.57, 2);
});

test('comma decimals and spaced units are understood', () => {
  const found = parse('Glucose nüchtern / fasting glucose 5,6 mmol / l');
  expect(found.fastingGlucose).toMatchObject({ value: 5.6, unit: 'mmol/L', standardValue: 101 });
});
