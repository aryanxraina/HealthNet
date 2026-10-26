import { parseLabReport, textToLines } from './labParser';

// Layouts found by the synthetic benchmark (src/benchmark) that used to save the wrong number

const read = (text) => Object.fromEntries(parseLabReport(textToLines(text)).map((item) => [item.field, item.standardValue]));

test('reference ranges printed before the result are not read as the result', () => {
  expect(read('FBS    70 - 100    85 mg/dL')).toEqual({ fastingGlucose: 85 });
  expect(read('Cholesterol, Total    < 200    180 mg/dL')).toEqual({ totalCholesterol: 180 });
  expect(read('HDL Cholesterol    > 1.0    1.50 mmol/L').hdlCholesterol).toBe(58);
});

test('a range with no result gives nothing rather than a range limit', () => {
  expect(read('Creatinine    0.6 - 1.2')).toEqual({});
});

test('a lone comparator result is still read, as approximate', () => {
  const [item] = parseLabReport(textToLines('Cholesterol < 200 mg/dL'));
  expect(item).toMatchObject({ field: 'totalCholesterol', standardValue: 200 });
  expect(item.notes).toContain('approximate');
});

test('numbers in brackets in the name, and units next to the value, are handled', () => {
  expect(read('eGFR (CKD-EPI 2021)    88    mL/min/1.73m2')).toEqual({ egfr: 88 });
  expect(read('eGFR (mL/min/1.73 m²)    97    > 90')).toEqual({ egfr: 97 });
  expect(read('Estimated GFR: 78mL/min/1.73 m² (Ref: > 90)')).toEqual({ egfr: 78 });
  expect(read('eGFR (CKD-EPI 2021)\n71 mL/min/1.73m2')).toEqual({ egfr: 71 });
});

test('look-alikes stay excluded', () => {
  expect(read('H.D.L. Cholesterol    42    mg/dL    40 - 60')).toEqual({ hdlCholesterol: 42 });
  expect(read('eGFR-Creatinine    85    mL/min/1.73m2')).toEqual({ egfr: 85 });
  expect(read('Glucose, 2 hr PP    199 mg/dL')).toEqual({});
});

test('a high flag between the value and the unit is not mistaken for anything else', () => {
  expect(read('Total Cholesterol    212  H  mg/dL    < 200')).toEqual({ totalCholesterol: 212 });
});

test('a unit printed in the name is not mistaken for a ratio', () => {
  expect(read('Creatinine, Serum (µmol/L)    96    53 - 106')).toEqual({ creatinine: 1.09 });
  expect(read('Total Cholesterol (mg/dL)    274    < 200')).toEqual({ totalCholesterol: 274 });
  expect(read('Total Cholesterol/HDL Ratio    4.1')).toEqual({});
  expect(read('Cholesterol (HDL)    45 mg/dL')).toEqual({ hdlCholesterol: 45 });
});

test('OCR noise in ranges and look-alike names does not produce a wrong value', () => {
  expect(read('Fasting Glucose    7O - 100    67 mg/dL')).toEqual({ fastingGlucose: 67 });
  expect(read('N0n-HDL Cholesterol    121   mg/dL')).toEqual({});
  expect(read('GFR, Estimated    S7    mL/min    >60')).toEqual({ egfr: 57 });
  expect(read('HbA1c    6.1 %')).toEqual({ hba1c: 6.1 });
});
