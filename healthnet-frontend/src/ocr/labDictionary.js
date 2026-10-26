// The lab tests and readings HealthNet can pick out of a report, keyed by the questionnaire's
// Vitals question id (src/questionnaire/sections.js). Labels are matched case-insensitively
// against each line; `exclude` stops look-alikes (e.g. "HDL cholesterol" for total cholesterol).
//
// kind     unit kind in lib/units.js, so values convert to standard units the same way as typed answers
// units    unit spellings found on reports -> the unit name lib/units.js understands for this kind
// guess    when a report leaves out the unit: the unit implied by the size of the number
// loinc    LOINC code, for later export to other health systems

export const LAB_TESTS = [
  {
    field: 'totalCholesterol',
    kind: 'cholesterol',
    loinc: '2093-3',
    labels: ['total cholesterol', 'cholesterol, total', 'cholesterol total', 'cholesterol - total', 'serum cholesterol', 's. cholesterol', 'cholesterol'],
    exclude: ['hdl', 'ldl', 'vldl', 'non-hdl', 'non hdl', 'ratio', '/'],
    units: { 'mg/dl': 'mg/dL', 'mg%': 'mg/dL', 'mmol/l': 'mmol/L' },
    guess: (n) => (n < 20 ? 'mmol/L' : 'mg/dL'),
  },
  {
    field: 'hdlCholesterol',
    kind: 'cholesterol',
    loinc: '2085-9',
    labels: ['hdl cholesterol', 'cholesterol, hdl', 'cholesterol hdl', 'hdl-cholesterol', 'hdl-c', 'high density lipoprotein', 'hdl'],
    exclude: ['non-hdl', 'non hdl', 'ratio', 'ldl/hdl', 'chol/hdl', 'tc/hdl', '/hdl'],
    units: { 'mg/dl': 'mg/dL', 'mg%': 'mg/dL', 'mmol/l': 'mmol/L' },
    guess: (n) => (n < 5 ? 'mmol/L' : 'mg/dL'),
  },
  {
    field: 'hba1c',
    kind: 'hba1c',
    loinc: '4548-4',
    labels: ['hba1c', 'hb a1c', 'hba 1c', 'glycated haemoglobin', 'glycated hemoglobin', 'glycosylated haemoglobin', 'glycosylated hemoglobin', 'glycohemoglobin', 'a1c'],
    exclude: ['estimated average glucose', 'eag'],
    units: { '%': '%', 'mmol/mol': 'mmol/mol' },
    guess: (n) => (n > 20 ? 'mmol/mol' : '%'),
  },
  {
    field: 'fastingGlucose',
    kind: 'glucose',
    loinc: '1558-6',
    labels: [
      'fasting blood glucose', 'fasting plasma glucose', 'fasting blood sugar', 'fasting glucose', 'glucose, fasting',
      'glucose fasting', 'glucose (fasting)', 'blood sugar fasting', 'blood sugar (fasting)', 'fbs', 'fpg', 'fbg',
    ],
    // Plain "glucose" is accepted with lower confidence, since it may not be a fasting sample
    looseLabels: ['plasma glucose', 'blood glucose', 'glucose'],
    exclude: ['post', 'pp', 'random', 'rbs', '2 hr', '2hr', '2-hour', 'ogtt', 'urine', 'average', 'avg', 'mean', 'eag'],
    units: { 'mg/dl': 'mg/dL', 'mg%': 'mg/dL', 'mmol/l': 'mmol/L' },
    guess: (n) => (n < 35 ? 'mmol/L' : 'mg/dL'),
  },
  {
    field: 'creatinine',
    kind: 'creatinine',
    loinc: '2160-0',
    labels: ['serum creatinine', 'creatinine, serum', 's. creatinine', 's.creatinine', 'creatinine'],
    exclude: ['urine', 'ratio', 'clearance', 'albumin', 'gfr', 'egfr', '/'],
    units: { 'mg/dl': 'mg/dL', 'µmol/l': 'µmol/L', 'umol/l': 'µmol/L', 'μmol/l': 'µmol/L' },
    guess: (n) => (n > 20 ? 'µmol/L' : 'mg/dL'),
  },
  {
    field: 'egfr',
    kind: null,
    loinc: '98979-8',
    labels: ['egfr', 'e-gfr', 'estimated gfr', 'gfr, estimated', 'gfr (estimated)', 'estimated glomerular filtration rate', 'glomerular filtration rate'],
    exclude: [],
    units: { 'ml/min/1.73m2': 'mL/min/1.73m²', 'ml/min/1.73 m2': 'mL/min/1.73m²', 'ml/min/1.73m²': 'mL/min/1.73m²', 'ml/min': 'mL/min/1.73m²' },
    guess: () => 'mL/min/1.73m²',
  },
  {
    field: 'systolic',
    kind: null,
    loinc: '8480-6',
    labels: ['systolic blood pressure', 'systolic bp', 'systolic', 'sbp'],
    exclude: [],
    units: { mmhg: 'mmHg', 'mm hg': 'mmHg' },
    guess: () => 'mmHg',
  },
  {
    field: 'diastolic',
    kind: null,
    loinc: '8462-4',
    labels: ['diastolic blood pressure', 'diastolic bp', 'diastolic', 'dbp'],
    exclude: [],
    units: { mmhg: 'mmHg', 'mm hg': 'mmHg' },
    guess: () => 'mmHg',
  },
  {
    field: 'restingHeartRate',
    kind: null,
    loinc: '8867-4',
    labels: ['heart rate', 'pulse rate', 'pulse'],
    exclude: ['oximetry', 'oxygen', 'spo2'],
    units: { bpm: 'bpm', '/min': 'bpm', 'beats/min': 'bpm' },
    guess: () => 'bpm',
  },
  {
    field: 'spo2',
    kind: null,
    loinc: '59408-5',
    labels: ['spo2', 'sp02', 'oxygen saturation', 'o2 saturation'],
    exclude: [],
    units: { '%': '%' },
    guess: () => '%',
  },
  {
    field: 'temperature',
    kind: 'temperature',
    loinc: '8310-5',
    labels: ['body temperature', 'temperature', 'temp'],
    exclude: [],
    units: { '°c': 'C', '°f': 'F', 'deg c': 'C', 'deg f': 'F' },
    guess: (n) => (n > 50 ? 'F' : 'C'),
  },
];

// Blood pressure is written as one reading, e.g. "BP 128/82 mmHg"
export const BLOOD_PRESSURE = {
  labels: ['blood pressure', 'b.p.', 'bp'],
  loinc: { systolic: '8480-6', diastolic: '8462-4' },
};
