import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ComingSoonBadge from '../components/ComingSoonBadge';

const SECTIONS = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Add your basic information',
    tileClass: 'bg-blue-50 border-blue-500',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    available: true
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle & Habits',
    description: 'Add your lifestyle habits',
    tileClass: 'bg-green-50 border-green-500',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    available: true
  },
  {
    id: 'medical',
    title: 'Medical History',
    description: 'Add your medical history',
    tileClass: 'bg-red-50 border-red-500',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    available: true
  },
  {
    id: 'vitals',
    title: 'Vitals Tracking',
    description: 'Add your vital measurements',
    tileClass: 'bg-orange-50 border-orange-500',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z'
  },
  {
    id: 'mental',
    title: 'Mental Health',
    description: 'Add your mental health info',
    tileClass: 'bg-purple-50 border-purple-500',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
  },
  {
    id: 'checkups',
    title: 'Preventive Checkups',
    description: 'Add checkup information',
    tileClass: 'bg-gray-50 border-gray-500',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
  },
  {
    id: 'device',
    title: 'Wellness Device Tracking',
    description: 'Add device tracking info',
    tileClass: 'bg-emerald-50 border-emerald-500',
    icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'
  }
];

const AVAILABLE_SECTIONS = SECTIONS.filter(section => section.available);

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' }
];

const EXERCISE_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely (1-2 times/month)' },
  { value: 'sometimes', label: 'Sometimes (1-2 times/week)' },
  { value: 'regularly', label: 'Regularly (3-5 times/week)' },
  { value: 'daily', label: 'Daily' }
];

const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never smoked' },
  { value: 'former', label: 'Former smoker' },
  { value: 'current', label: 'Current smoker' }
];

const ALCOHOL_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' }
];

const CONDITION_OPTIONS = [
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'heart_disease', label: 'Heart Disease' },
  { value: 'asthma', label: 'Asthma' },
  { value: 'none', label: 'None' }
];

// Answers stay in this browser, per signed-in user, until there's a backend to store them
const storageKey = (uid) => `healthnet:questionnaire:${uid}`;

const loadAnswers = (uid) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(uid))) || {};
  } catch {
    return {};
  }
};

const labelClass = 'block text-sm font-medium text-gray-700 mb-2';

// Full class names (not built from strings) so Tailwind can find them
const THEMES = {
  blue: { input: 'focus:ring-blue-500', button: 'bg-blue-600 hover:bg-blue-700' },
  green: { input: 'focus:ring-green-500', button: 'bg-green-600 hover:bg-green-700' },
  red: { input: 'focus:ring-red-500', button: 'bg-red-600 hover:bg-red-700' }
};

const inputClass = (theme) =>
  `w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${THEMES[theme].input} focus:border-transparent`;

const Modal = ({ title, onClose, children }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="questionnaire-modal-title"
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center p-6 border-b">
          <h2 id="questionnaire-modal-title" className="text-2xl font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const FormActions = ({ onCancel, theme }) => (
  <div className="flex justify-end space-x-3 pt-4">
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
    >
      Cancel
    </button>
    <button type="submit" className={`px-4 py-2 text-white rounded-md transition-colors ${THEMES[theme].button}`}>
      Save
    </button>
  </div>
);

const RadioGroup = ({ legend, name, options, value, onChange }) => (
  <fieldset>
    <legend className={labelClass}>{legend}</legend>
    <div className="flex flex-wrap gap-4">
      {options.map(option => (
        <label key={option.value} className="flex items-center">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            className="mr-2"
            required
          />
          {option.label}
        </label>
      ))}
    </div>
  </fieldset>
);

const PersonalForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState({ name: '', gender: '', age: '', height: '', weight: '', ...initial });
  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      name: form.name.trim(),
      age: Number(form.age),
      height: Number(form.height),
      weight: Number(form.weight)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div>
        <label htmlFor="personal-name" className={labelClass}>What is your full name?</label>
        <input
          id="personal-name"
          type="text"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          autoComplete="name"
          className={inputClass('blue')}
          required
        />
      </div>

      <RadioGroup
        legend="What is your gender?"
        name="gender"
        options={GENDER_OPTIONS}
        value={form.gender}
        onChange={(value) => setField('gender', value)}
      />

      <div>
        <label htmlFor="personal-age" className={labelClass}>What is your age?</label>
        <input
          id="personal-age"
          type="number"
          min="1"
          max="120"
          value={form.age}
          onChange={(e) => setField('age', e.target.value)}
          className={inputClass('blue')}
          required
        />
      </div>

      <div>
        <label htmlFor="personal-height" className={labelClass}>What is your height (cm)?</label>
        <input
          id="personal-height"
          type="number"
          min="50"
          max="250"
          step="0.1"
          value={form.height}
          onChange={(e) => setField('height', e.target.value)}
          className={inputClass('blue')}
          required
        />
      </div>

      <div>
        <label htmlFor="personal-weight" className={labelClass}>What is your weight (kg)?</label>
        <input
          id="personal-weight"
          type="number"
          min="20"
          max="300"
          step="0.1"
          value={form.weight}
          onChange={(e) => setField('weight', e.target.value)}
          className={inputClass('blue')}
          required
        />
      </div>

      <FormActions onCancel={onCancel} theme="blue" />
    </form>
  );
};

const LifestyleForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState({ exercise: '', smoking: '', alcohol: '', ...initial });
  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <RadioGroup
        legend="How often do you exercise?"
        name="exercise"
        options={EXERCISE_OPTIONS}
        value={form.exercise}
        onChange={(value) => setField('exercise', value)}
      />
      <RadioGroup
        legend="Do you smoke?"
        name="smoking"
        options={SMOKING_OPTIONS}
        value={form.smoking}
        onChange={(value) => setField('smoking', value)}
      />
      <RadioGroup
        legend="How much alcohol do you consume?"
        name="alcohol"
        options={ALCOHOL_OPTIONS}
        value={form.alcohol}
        onChange={(value) => setField('alcohol', value)}
      />

      <FormActions onCancel={onCancel} theme="green" />
    </form>
  );
};

const MedicalForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState({ conditions: [], medications: '', allergies: '', ...initial });
  const [error, setError] = useState('');

  // "None" can't be combined with a condition, so ticking one clears the other
  const toggleCondition = (value) => {
    setError('');
    setForm(prev => {
      if (value === 'none') {
        return { ...prev, conditions: prev.conditions.includes('none') ? [] : ['none'] };
      }
      const conditions = prev.conditions.filter(condition => condition !== 'none');
      return {
        ...prev,
        conditions: conditions.includes(value)
          ? conditions.filter(condition => condition !== value)
          : [...conditions, value]
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.conditions.length === 0) {
      setError('Select at least one option, or choose "None".');
      return;
    }
    onSave({ ...form, medications: form.medications.trim(), allergies: form.allergies.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <fieldset>
        <legend className={labelClass}>Do you have any chronic conditions?</legend>
        <div className="flex flex-wrap gap-4">
          {CONDITION_OPTIONS.map(option => (
            <label key={option.value} className="flex items-center">
              <input
                type="checkbox"
                checked={form.conditions.includes(option.value)}
                onChange={() => toggleCondition(option.value)}
                className="mr-2"
              />
              {option.label}
            </label>
          ))}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </fieldset>

      <div>
        <label htmlFor="medical-medications" className={labelClass}>Are you currently taking any medications?</label>
        <textarea
          id="medical-medications"
          value={form.medications}
          onChange={(e) => setForm(prev => ({ ...prev, medications: e.target.value }))}
          className={inputClass('red')}
          rows="3"
          placeholder="List your current medications..."
        />
      </div>

      <div>
        <label htmlFor="medical-allergies" className={labelClass}>Do you have any allergies?</label>
        <textarea
          id="medical-allergies"
          value={form.allergies}
          onChange={(e) => setForm(prev => ({ ...prev, allergies: e.target.value }))}
          className={inputClass('red')}
          rows="3"
          placeholder="List any allergies..."
        />
      </div>

      <FormActions onCancel={onCancel} theme="red" />
    </form>
  );
};

const FORMS = {
  personal: PersonalForm,
  lifestyle: LifestyleForm,
  medical: MedicalForm
};

const Questionnaire = () => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState(() => loadAnswers(user.uid));
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user.uid), JSON.stringify(answers));
    } catch {
      // Storage can be unavailable (e.g. private browsing); answers still work for this visit
    }
  }, [answers, user.uid]);

  const closeModal = useCallback(() => setActiveSection(null), []);

  const saveSection = (data) => {
    setAnswers(prev => ({ ...prev, [activeSection]: data }));
    setActiveSection(null);
  };

  const completedCount = AVAILABLE_SECTIONS.filter(section => answers[section.id]).length;
  const progress = (completedCount / AVAILABLE_SECTIONS.length) * 100;
  const comingSoonCount = SECTIONS.length - AVAILABLE_SECTIONS.length;

  const activeConfig = SECTIONS.find(section => section.id === activeSection);
  const ActiveForm = activeSection ? FORMS[activeSection] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Health Questionnaire</h1>
            <p className="mt-2 text-lg text-gray-600">Complete each section to create your personalized health profile</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{completedCount} of {AVAILABLE_SECTIONS.length} sections complete</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div
              className="h-2 bg-gray-200 rounded-full overflow-hidden"
              role="progressbar"
              aria-label="Questionnaire progress"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-500">{comingSoonCount} more sections are coming soon.</p>
          </div>

          {/* Tiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SECTIONS.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                disabled={!section.available}
                className={`${section.tileClass} border-l-4 rounded-lg shadow-md p-6 aspect-square flex flex-col justify-between text-left transition-all duration-300 ${
                  section.available ? 'hover:shadow-lg' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{index + 1}. {section.title}</h2>
                  <p className="mt-2 text-gray-600">{section.description}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={section.icon} />
                  </svg>
                  {!section.available && <ComingSoonBadge />}
                  {section.available && answers[section.id] && (
                    <span className="inline-flex items-center text-sm font-medium text-green-700">
                      <CheckCircle2 className="h-5 w-5 mr-1" />
                      Completed
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {ActiveForm && (
        <Modal title={activeConfig.title} onClose={closeModal}>
          <ActiveForm initial={answers[activeSection]} onSave={saveSection} onCancel={closeModal} />
        </Modal>
      )}
    </div>
  );
};

export default Questionnaire;
