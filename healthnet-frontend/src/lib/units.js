// HealthNet stores every measurement in one standard unit (cm, kg, mg/dL, °C, mmHg)
// and converts to each user's preferred units only for input and display.

export const DEFAULT_UNITS = { system: 'metric', lab: 'mg/dL', temperature: 'C' };

const CM_PER_INCH = 2.54;
const LB_PER_KG = 2.2046226218;
const GLUCOSE_MGDL_PER_MMOL = 18.016;
const CHOLESTEROL_MGDL_PER_MMOL = 38.67;
const CREATININE_UMOL_PER_MGDL = 88.42;

const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

// Unit label a measurement kind is shown in, given the user's preferences
export const unitFor = (kind, units = DEFAULT_UNITS) => {
  const imperial = units.system === 'imperial';
  const mmol = units.lab === 'mmol/L';
  switch (kind) {
    case 'height':
      return imperial ? 'ft/in' : 'cm';
    case 'length':
      return imperial ? 'in' : 'cm';
    case 'weight':
      return imperial ? 'lb' : 'kg';
    case 'glucose':
    case 'cholesterol':
      return mmol ? 'mmol/L' : 'mg/dL';
    case 'creatinine':
      return mmol ? 'µmol/L' : 'mg/dL';
    case 'temperature':
      return units.temperature === 'F' ? '°F' : '°C';
    default:
      return '';
  }
};

// Convert a value entered in the user's units to the standard unit.
// Imperial height is passed as total inches (the form combines feet and inches).
export const toStandard = (kind, value, units = DEFAULT_UNITS) => {
  if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  const n = Number(value);
  const imperial = units.system === 'imperial';
  const mmol = units.lab === 'mmol/L';
  switch (kind) {
    case 'height':
    case 'length':
      return imperial ? n * CM_PER_INCH : n;
    case 'weight':
      return imperial ? n / LB_PER_KG : n;
    case 'glucose':
      return mmol ? n * GLUCOSE_MGDL_PER_MMOL : n;
    case 'cholesterol':
      return mmol ? n * CHOLESTEROL_MGDL_PER_MMOL : n;
    case 'creatinine':
      return mmol ? n / CREATININE_UMOL_PER_MGDL : n;
    case 'temperature':
      return units.temperature === 'F' ? ((n - 32) * 5) / 9 : n;
    default:
      return n;
  }
};

// Convert a standard-unit value to the user's units (imperial height comes back as total inches)
export const fromStandard = (kind, value, units = DEFAULT_UNITS) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  const n = Number(value);
  const imperial = units.system === 'imperial';
  const mmol = units.lab === 'mmol/L';
  switch (kind) {
    case 'height':
    case 'length':
      return imperial ? n / CM_PER_INCH : n;
    case 'weight':
      return imperial ? n * LB_PER_KG : n;
    case 'glucose':
      return mmol ? n / GLUCOSE_MGDL_PER_MMOL : n;
    case 'cholesterol':
      return mmol ? n / CHOLESTEROL_MGDL_PER_MMOL : n;
    case 'creatinine':
      return mmol ? n * CREATININE_UMOL_PER_MGDL : n;
    case 'temperature':
      return units.temperature === 'F' ? (n * 9) / 5 + 32 : n;
    default:
      return n;
  }
};

export const cmToFeetInches = (cm) => {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
};

export const feetInchesToCm = (feet, inches) => (Number(feet || 0) * 12 + Number(inches || 0)) * CM_PER_INCH;

// Decimal places that make sense for each kind in each unit
const decimalsFor = (kind, unit) => {
  if (unit === 'mmol/L') return 1;
  if (kind === 'weight' || kind === 'temperature' || kind === 'length' || unit === 'µmol/L') return 1;
  if (kind === 'creatinine') return 2;
  return 0;
};

// Human-readable value in the user's units, e.g. "5 ft 7 in", "154.3 lb", "5.6 mmol/L"
export const formatMeasurement = (kind, standardValue, units = DEFAULT_UNITS) => {
  if (standardValue === null || standardValue === undefined || standardValue === '') {
    return '—';
  }
  const unit = unitFor(kind, units);
  if (kind === 'height' && unit === 'ft/in') {
    const { feet, inches } = cmToFeetInches(Number(standardValue));
    return `${feet} ft ${inches} in`;
  }
  const value = round(fromStandard(kind, standardValue, units), decimalsFor(kind, unit));
  return `${value} ${unit}`;
};
