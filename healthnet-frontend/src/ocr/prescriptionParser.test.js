import { parsePrescription } from './prescriptionParser';
import { textToLines } from './labParser';

// Made-up prescriptions only.
const parse = (text) => parsePrescription(textToLines(text));

test('a typed prescription with forms, strengths, dose patterns and durations', () => {
  const meds = parse(`
    City Care Clinic (sample)            Dr. A. Example, MBBS
    Patient: Test Person    Age: 45    Date: 20/10/2026
    Rx
    1. Tab. Metformin 500 mg   1-0-1   x 30 days   after food
    2. Tab Amlodipine 5mg  0-0-1
    3. Cap. Omeprazole 20 mg  1-0-0  before breakfast  x 14 days
    4. Syp. Cough relief 10 ml TDS
    Follow up after 2 weeks
  `);
  expect(meds.map((m) => m.name)).toEqual(['Metformin', 'Amlodipine', 'Omeprazole', 'Cough relief']);
  expect(meds[0]).toMatchObject({ strength: '500 mg', frequency: '1-0-1', duration: '30 days', instructions: 'afterFood', confidence: 1 });
  expect(meds[1]).toMatchObject({ strength: '5 mg', frequency: '0-0-1' });
  expect(meds[2]).toMatchObject({ frequency: '1-0-0', duration: '14 days', instructions: 'beforeFood' });
  expect(meds[3]).toMatchObject({ strength: '10 ml', frequency: 'threeTimes' });
});

test('abbreviations and plain-English dosing', () => {
  const meds = parse(`
    T. Atorvastatin 10mg HS
    Tab Paracetamol 650 mg SOS for fever
    Salbutamol inhaler 2 puffs as needed
    Vitamin D3 60000 IU once a week
    Tab Losartan 50 mg twice daily
  `);
  expect(meds.map((m) => [m.name, m.frequency])).toEqual([
    ['Atorvastatin', 'bedtime'],
    ['Paracetamol', 'asNeeded'],
    ['Salbutamol inhaler 2 puffs', 'asNeeded'],
    ['Vitamin D3', 'weekly'],
    ['Losartan', 'twice'],
  ]);
  expect(meds[3].strength).toBe('60000 iu');
});

test('dosing written on the next line joins the medicine above', () => {
  const meds = parse(`
    Tab Amoxicillin 500 mg
    1-1-1 x 5 days after food
    Tab Cetirizine 10 mg
  `);
  expect(meds).toHaveLength(2);
  expect(meds[0]).toMatchObject({ name: 'Amoxicillin', frequency: '1-1-1', duration: '5 days', instructions: 'afterFood' });
  expect(meds[0].sourceText).toBe('Tab Amoxicillin 500 mg 1-1-1 x 5 days after food');
});

test('header, footer and instructions are not mistaken for medicines', () => {
  expect(
    parse(`
      Dr. Jane Sample MD, Reg. No 12345
      Phone: 555 0100
      Diagnosis: viral fever
      Drink plenty of water
      Review after 5 days
      Signature
    `)
  ).toEqual([]);
});

test('brand names without a unit keep their number', () => {
  const [med] = parse('Tab. Dolo 650 1-0-1 x 3 days');
  expect(med).toMatchObject({ name: 'Dolo 650', strength: null, frequency: '1-0-1', duration: '3 days' });
});

test('lines without a form word need a strength or dosing, and confidence reflects it', () => {
  const meds = parse('Metformin 500 mg\nMetformin');
  expect(meds).toHaveLength(1);
  expect(meds[0].confidence).toBe(0.8);
});
