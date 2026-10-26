import { fixOcrDigits } from './ocrText';
import { parsePrescription } from './prescriptionParser';
import { parseLabReport, textToLines } from './labParser';

test('letter O and l look-alikes are fixed where numbers are expected', () => {
  expect(fixOcrDigits('Tab. Metformin 500 mg 1-O-1')).toBe('Tab. Metformin 500 mg 1-0-1');
  expect(fixOcrDigits('Amlodipine 5 mg o-o-1')).toBe('Amlodipine 5 mg 0-0-1');
  expect(fixOcrDigits('Omeprazole 2O mg')).toBe('Omeprazole 20 mg');
  expect(fixOcrDigits('Paracetamol 65o mg')).toBe('Paracetamol 650 mg');
  expect(fixOcrDigits('Glucose 1O8 mg/dL')).toBe('Glucose 108 mg/dL');
  expect(fixOcrDigits('HbA1c 6.O %')).toBe('HbA1c 6.0 %');
});

test('numbers broken by look-alike letters are repaired', () => {
  expect(fixOcrDigits('BP l26/79 mmHg')).toBe('BP 126/79 mmHg');
  expect(fixOcrDigits('Blood Pressure 118/B1')).toBe('Blood Pressure 118/81');
  expect(fixOcrDigits('Creatinine O.6 - 1.2')).toBe('Creatinine 0.6 - 1.2');
  expect(fixOcrDigits('Temp. 98.B °F')).toBe('Temp. 98.8 °F');
  expect(fixOcrDigits('Pulse 60 - 1O0')).toBe('Pulse 60 - 100');
  expect(fixOcrDigits('HDL    4O - 60    72 mg/dL')).toBe('HDL    40 - 60    72 mg/dL');
  expect(fixOcrDigits('GFR, Estimated    S7    mL/min')).toBe('GFR, Estimated    57    mL/min');
  expect(fixOcrDigits('T.Cholesterol (mg/dL)    1S3    < 200')).toBe('T.Cholesterol (mg/dL)    153    < 200');
  expect(fixOcrDigits('Glycated Hb    20 - 3B    51 mmol/mol')).toBe('Glycated Hb    20 - 38    51 mmol/mol');
});

test('codes and abbreviations with digits stay as written', () => {
  expect(fixOcrDigits('Vitamin B12 450 pg/mL')).toBe('Vitamin B12 450 pg/mL');
  expect(fixOcrDigits('O2 Sat 97 %')).toBe('O2 Sat 97 %');
  expect(fixOcrDigits('B.P. 120/80')).toBe('B.P. 120/80');
  expect(fixOcrDigits('S3 heart sound')).toBe('S3 heart sound');
});

test('words are left alone', () => {
  expect(fixOcrDigits('Tab Dolo 650 SOS')).toBe('Tab Dolo 650 SOS');
  expect(fixOcrDigits('Cholesterol, Total 212 mg/dL')).toBe('Cholesterol, Total 212 mg/dL');
  expect(fixOcrDigits('follow up in l week')).toBe('follow up in l week');
  expect(fixOcrDigits('Omega 3 oil 1000 mg')).toBe('Omega 3 oil 1000 mg');
});

test('the prescription parser benefits from the clean-up', () => {
  const [omeprazole, amlodipine] = parsePrescription(textToLines(['3. Cap. Omeprazole 2O mg 1-O-0', '2. Tab.Amlodipine 5 mg o-o-1'].join('\n')));
  expect(omeprazole).toMatchObject({ name: 'Omeprazole', strength: '20 mg', frequency: '1-0-0' });
  expect(amlodipine).toMatchObject({ name: 'Amlodipine', frequency: '0-0-1' });
});

test('the lab parser benefits from the clean-up', () => {
  const [glucose] = parseLabReport(textToLines('Glucose, Fasting 1O8 mg/dL'));
  expect(glucose.standardValue).toBe(108);
  const [systolic, diastolic] = parseLabReport(textToLines('BP l26/79 mmHg'));
  expect([systolic.standardValue, diastolic.standardValue]).toEqual([126, 79]);
});
