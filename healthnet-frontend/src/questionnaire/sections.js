import { Activity, Brain, ClipboardCheck, Flower2, HeartPulse, Moon, Stethoscope, User, Watch } from 'lucide-react';
import { riskSexOf } from './answers';

// Every questionnaire section and question. The wizard renders straight from this list,
// and the risk engine reads answers by these ids, so rename ids with care.
//
// Question fields:
//   type      choice | multi | number | date | country | text | textarea | medicationList
//   options   allowed values (labels: questionnaire.options.<id>.<value>, or optionSets.<optionSet>.<value>)
//   kind      unit kind for numbers stored in standard units (see lib/units.js); `unit` is a fixed label instead
//   min/max   allowed range in standard units
//   required  must be answered before Next (only in required sections)
//   help      has a "Why we ask" note (questionnaire.questions.<id>.help)
//   exclusive (multi) option that clears the others, e.g. "none"
//   showIf    (answers) => boolean; hidden questions are skipped and their answers dropped

const isWoman = (answers) => riskSexOf(answers) === 'female';
const drinks = (answers) => {
  const frequency = answers.lifestyle?.auditFrequency;
  return Boolean(frequency) && frequency !== 'never';
};
const tracksCycle = (answers) => answers.womens?.trackCycle === 'yes';

export const SECTIONS = [
  {
    id: 'about',
    icon: User,
    questions: [
      { id: 'dateOfBirth', type: 'date', required: true, help: true },
      { id: 'gender', type: 'choice', options: ['female', 'male', 'nonBinary', 'preferNot'], required: true },
      {
        id: 'riskSex',
        type: 'choice',
        options: ['female', 'male'],
        required: true,
        help: true,
        showIf: (answers) => ['nonBinary', 'preferNot'].includes(answers.about?.gender),
      },
      { id: 'country', type: 'country', required: true, help: true },
      { id: 'height', type: 'number', kind: 'height', min: 50, max: 250, required: true },
      { id: 'weight', type: 'number', kind: 'weight', min: 20, max: 300, required: true },
      { id: 'waist', type: 'number', kind: 'length', min: 40, max: 200, help: true },
      { id: 'neck', type: 'number', kind: 'length', min: 20, max: 70, help: true },
    ],
  },
  {
    id: 'lifestyle',
    icon: Activity,
    questions: [
      { id: 'smoking', type: 'choice', options: ['never', 'former', 'current'], required: true },
      { id: 'dailyActivity', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'], required: true, help: true },
      { id: 'fruitVeg', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'], required: true },
      {
        id: 'exerciseFrequency',
        type: 'choice',
        options: ['never', 'rarely', 'sometimes', 'regularly', 'daily'],
      },
      // AUDIT-C, in its validated wording
      {
        id: 'auditFrequency',
        type: 'choice',
        options: ['never', 'monthly', 'twoToFourMonth', 'twoToThreeWeek', 'fourPlusWeek'],
        required: true,
      },
      {
        id: 'auditTypical',
        type: 'choice',
        options: ['oneTwo', 'threeFour', 'fiveSix', 'sevenNine', 'tenPlus'],
        required: true,
        help: true,
        showIf: drinks,
      },
      {
        id: 'auditBinge',
        type: 'choice',
        options: ['never', 'lessMonthly', 'monthly', 'weekly', 'daily'],
        required: true,
        showIf: drinks,
      },
    ],
  },
  {
    id: 'medical',
    icon: Stethoscope,
    questions: [
      {
        id: 'conditions',
        type: 'multi',
        options: ['diabetes', 'hypertension', 'heartDisease', 'stroke', 'kidneyDisease', 'asthma', 'none'],
        exclusive: 'none',
        required: true,
      },
      { id: 'bpMedication', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'], required: true },
      { id: 'statin', type: 'choice', optionSet: 'yesNoUnsure', options: ['yes', 'no', 'unsure'], required: true },
      { id: 'highGlucoseHistory', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'], required: true, help: true },
      { id: 'familyDiabetes', type: 'choice', options: ['no', 'extended', 'immediate'], required: true },
      { id: 'parentsHypertension', type: 'choice', options: ['none', 'one', 'both', 'unsure'], required: true },
      { id: 'pregnancies', type: 'number', unit: '', min: 0, max: 20, integer: true, help: true, showIf: isWoman },
      // Structured list, filled by typing or from a prescription (components/questionnaire/MedicationList.js)
      { id: 'medicationList', type: 'medicationList', help: true },
      { id: 'medications', type: 'textarea' },
      { id: 'allergies', type: 'textarea' },
    ],
  },
  {
    id: 'vitals',
    icon: HeartPulse,
    optional: true,
    questions: [
      { id: 'systolic', type: 'number', unit: 'mmHg', min: 70, max: 250, help: true },
      { id: 'diastolic', type: 'number', unit: 'mmHg', min: 40, max: 150 },
      { id: 'restingHeartRate', type: 'number', unit: 'bpm', min: 30, max: 220 },
      { id: 'fastingGlucose', type: 'number', kind: 'glucose', min: 40, max: 600 },
      { id: 'hba1c', type: 'number', unit: '%', min: 3, max: 20 },
      { id: 'totalCholesterol', type: 'number', kind: 'cholesterol', min: 70, max: 500 },
      { id: 'hdlCholesterol', type: 'number', kind: 'cholesterol', min: 10, max: 150 },
      { id: 'egfr', type: 'number', unit: 'mL/min/1.73m²', min: 5, max: 200, help: true },
      { id: 'creatinine', type: 'number', kind: 'creatinine', min: 0.2, max: 15 },
      { id: 'spo2', type: 'number', unit: '%', min: 70, max: 100 },
      { id: 'temperature', type: 'number', kind: 'temperature', min: 34, max: 43 },
    ],
  },
  {
    // PHQ-4, in its validated wording
    id: 'mental',
    icon: Brain,
    optional: true,
    questions: ['phq1', 'phq2', 'phq3', 'phq4'].map((id) => ({
      id,
      type: 'choice',
      optionSet: 'phq',
      options: ['0', '1', '2', '3'],
      layout: 'row',
    })),
  },
  {
    // STOP-Bang's own questions; blood pressure, BMI, age, neck size and sex come from other sections
    id: 'sleep',
    icon: Moon,
    optional: true,
    questions: [
      { id: 'snoring', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'], help: true },
      { id: 'tired', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'] },
      { id: 'observedApnea', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'] },
      { id: 'sleepHours', type: 'choice', options: ['lt5', 'h5to6', 'h6to7', 'h7to8', 'gt8'] },
    ],
  },
  {
    id: 'checkups',
    icon: ClipboardCheck,
    optional: true,
    questions: [
      { id: 'lastCheckup', type: 'choice', options: ['lt6m', 'm6to12', 'y1to2', 'gt2y', 'never'] },
      { id: 'vaccinations', type: 'choice', optionSet: 'yesNoUnsure', options: ['yes', 'no', 'unsure'] },
      { id: 'dental', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'] },
    ],
  },
  {
    id: 'womens',
    icon: Flower2,
    optional: true,
    showIf: isWoman,
    questions: [
      { id: 'trackCycle', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'] },
      { id: 'lastPeriod', type: 'date', showIf: tracksCycle },
      { id: 'cycleLength', type: 'number', unit: 'days', min: 15, max: 60, integer: true, showIf: tracksCycle },
      { id: 'cycleRegular', type: 'choice', options: ['yes', 'no', 'sometimes'], showIf: tracksCycle },
      { id: 'contraceptivePill', type: 'choice', optionSet: 'yesNo', options: ['yes', 'no'] },
    ],
  },
  {
    id: 'devices',
    icon: Watch,
    optional: true,
    questions: [
      { id: 'wearable', type: 'choice', options: ['none', 'appleWatch', 'fitbit', 'garmin', 'wearOs', 'other'] },
      {
        id: 'wantsSync',
        type: 'choice',
        optionSet: 'yesNo',
        options: ['yes', 'no'],
        showIf: (answers) => Boolean(answers.devices?.wearable) && answers.devices.wearable !== 'none',
      },
    ],
  },
];

export const sectionById = (id) => SECTIONS.find((section) => section.id === id);
