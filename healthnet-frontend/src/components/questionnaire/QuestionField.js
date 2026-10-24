import React, { useMemo, useState } from 'react';
import { Check, Info } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { countryOptions } from '../../questionnaire/countries';
import { todayIso } from '../../questionnaire/progress';
import { cmToFeetInches, feetInchesToCm, formatMeasurement, fromStandard, toStandard, unitFor } from '../../lib/units';

// Renders one question from questionnaire/sections.js. Values are kept in standard units;
// number fields convert to and from the user's preferred units as they type.

const labelClass = 'block text-base font-medium text-gray-900 dark:text-gray-100';
const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100';
const invalidClass = 'border-red-400 dark:border-red-500';

// Fixed unit labels that are words rather than symbols
const UNIT_KEYS = { days: 'questionnaire.days' };

// Rounded for display: 2 decimals for creatinine in mg/dL, otherwise 1
const displayNumber = (kind, standardValue, units) => {
  if (standardValue === null || standardValue === undefined || standardValue === '') return '';
  const value = kind ? fromStandard(kind, standardValue, units) : Number(standardValue);
  const decimals = kind === 'creatinine' && unitFor(kind, units) === 'mg/dL' ? 2 : 1;
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
};

// Kept to 3 decimals so values typed in other units round-trip cleanly
const storeNumber = (kind, text, units) => {
  const standard = kind ? toStandard(kind, text, units) : text === '' ? null : Number(text);
  return standard === null || Number.isNaN(standard) ? null : Math.round(standard * 1000) / 1000;
};

const FieldShell = ({ as: Tag = 'div', question, fieldId, label, labelFor, optional, error, children }) => {
  const { t } = useTranslation();
  const LabelTag = Tag === 'fieldset' ? 'legend' : 'label';
  return (
    <Tag className="space-y-3" aria-describedby={Tag === 'fieldset' ? describedBy(question, fieldId, error) : undefined}>
      {/* A legend only names its fieldset when it is the first direct child */}
      <LabelTag htmlFor={LabelTag === 'label' ? labelFor : undefined} className={labelClass}>
        {label}
        {optional && (
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-xs font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300">
            {t('questionnaire.optional')}
          </span>
        )}
      </LabelTag>
      {(question.help || question.type === 'multi') && (
        <div className="!mt-1 space-y-1">
          {question.help && (
            <p id={`${fieldId}-help`} className="flex items-start gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">{t('questionnaire.whyWeAsk')}: </span>
                {t(`questionnaire.questions.${question.id}.help`)}
              </span>
            </p>
          )}
          {question.type === 'multi' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('questionnaire.selectAll')}</p>
          )}
        </div>
      )}
      {children}
      {error && (
        <p id={`${fieldId}-error`} className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Tag>
  );
};

const describedBy = (question, fieldId, error) =>
  [question.help && `${fieldId}-help`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined;

const gridFor = (question) => {
  if (question.layout === 'row') return 'grid-cols-2 sm:grid-cols-4';
  if (question.options.length === 2) return 'grid-cols-2';
  if (question.options.length === 3) return 'grid-cols-1 sm:grid-cols-3';
  return 'grid-cols-1 sm:grid-cols-2';
};

const OptionCard = ({ type, name, checked, onChange, label, firstRef }) => (
  <label
    className={`group relative flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 ${
      checked
        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100'
        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-indigo-500/60 dark:hover:bg-slate-800'
    }`}
  >
    <input ref={firstRef} type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 transition ${type === 'radio' ? 'rounded-full' : 'rounded-md'} ${
        checked ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400' : 'border-gray-300 dark:border-slate-500'
      }`}
    >
      {checked && <Check className="h-3.5 w-3.5 text-white dark:text-slate-900" strokeWidth={3} />}
    </span>
    <span>{label}</span>
  </label>
);

const ChoiceInput = ({ question, fieldId, value, onChange, optionLabel, firstRef }) => (
  <div className={`grid gap-3 ${gridFor(question)}`}>
    {question.options.map((option, index) => (
      <OptionCard
        key={option}
        type="radio"
        name={fieldId}
        checked={value === option}
        onChange={() => onChange(option)}
        label={optionLabel(option)}
        firstRef={index === 0 ? firstRef : undefined}
      />
    ))}
  </div>
);

// "None of these" style options clear the others, and picking anything else clears them
const MultiInput = ({ question, fieldId, value = [], onChange, optionLabel, firstRef }) => {
  const toggle = (option) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
    } else if (option === question.exclusive) {
      onChange([option]);
    } else {
      onChange([...value.filter((item) => item !== question.exclusive), option]);
    }
  };
  return (
    <div className={`grid gap-3 ${gridFor(question)}`}>
      {question.options.map((option, index) => (
        <OptionCard
          key={option}
          type="checkbox"
          name={fieldId}
          checked={value.includes(option)}
          onChange={() => toggle(option)}
          label={optionLabel(option)}
          firstRef={index === 0 ? firstRef : undefined}
        />
      ))}
    </div>
  );
};

const UnitSuffix = ({ id, children }) => (
  <span id={id} className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
    {children}
  </span>
);

const NumberInput = ({ question, fieldId, value, onChange, units, invalid, describedById, firstRef }) => {
  const { t } = useTranslation();
  const { kind } = question;
  const unit = kind ? unitFor(kind, units) : UNIT_KEYS[question.unit] ? t(UNIT_KEYS[question.unit]) : question.unit;
  const [text, setText] = useState(() => displayNumber(kind, value, units));

  const handleChange = (event) => {
    setText(event.target.value);
    onChange(storeNumber(kind, event.target.value, units));
  };

  return (
    <div className="relative max-w-xs">
      <input
        ref={firstRef}
        id={fieldId}
        type="number"
        inputMode={question.integer ? 'numeric' : 'decimal'}
        step={question.integer ? 1 : 'any'}
        value={text}
        onChange={handleChange}
        aria-invalid={invalid || undefined}
        aria-describedby={[describedById, unit && `${fieldId}-unit`].filter(Boolean).join(' ') || undefined}
        className={`${inputClass} ${unit ? 'pr-20' : ''} ${invalid ? invalidClass : ''}`}
      />
      {unit && <UnitSuffix id={`${fieldId}-unit`}>{unit}</UnitSuffix>}
    </div>
  );
};

// Imperial height is entered as feet + inches and stored in cm
const FeetInchesInput = ({ fieldId, value, onChange, invalid, describedById, firstRef }) => {
  const { t } = useTranslation();
  const [parts, setParts] = useState(() => {
    if (value === null || value === undefined) return { feet: '', inches: '' };
    const { feet, inches } = cmToFeetInches(value);
    return { feet: String(feet), inches: String(inches) };
  });

  const update = (field) => (event) => {
    const next = { ...parts, [field]: event.target.value };
    setParts(next);
    const empty = next.feet === '' && next.inches === '';
    onChange(empty ? null : Math.round(feetInchesToCm(next.feet, next.inches) * 1000) / 1000);
  };

  return (
    <div className="flex max-w-xs gap-3">
      {[
        ['feet', t('questionnaire.feet'), 8],
        ['inches', t('questionnaire.inches'), 11],
      ].map(([field, label, max], index) => (
        <div key={field} className="relative flex-1">
          <input
            ref={index === 0 ? firstRef : undefined}
            id={index === 0 ? fieldId : `${fieldId}-${field}`}
            type="number"
            inputMode="numeric"
            min="0"
            max={max}
            value={parts[field]}
            onChange={update(field)}
            aria-label={label}
            aria-invalid={invalid || undefined}
            aria-describedby={describedById}
            className={`${inputClass} pr-12 ${invalid ? invalidClass : ''}`}
          />
          <UnitSuffix>{label}</UnitSuffix>
        </div>
      ))}
    </div>
  );
};

const CountrySelect = ({ fieldId, value, onChange, invalid, describedById, firstRef }) => {
  const { t, language } = useTranslation();
  const countries = useMemo(() => countryOptions(language), [language]);
  return (
    <select
      ref={firstRef}
      id={fieldId}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      autoComplete="country"
      className={`${inputClass} max-w-md ${invalid ? invalidClass : ''}`}
    >
      <option value="">{t('questionnaire.chooseCountry')}</option>
      {countries.map(({ code, name }) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
};

const QuestionField = ({ question, sectionId, value, onChange, error, units, optional, firstRef }) => {
  const { t } = useTranslation();
  const fieldId = `q-${sectionId}-${question.id}`;
  const label = t(`questionnaire.questions.${question.id}.label`);
  const invalid = Boolean(error);

  let errorText = null;
  if (error) {
    const limit = (n) =>
      question.kind ? formatMeasurement(question.kind, n, units) : [n, question.unit].filter(Boolean).join(' ');
    errorText = t(error.key, error.min !== undefined ? { min: limit(error.min), max: limit(error.max) } : undefined);
  }

  const optionLabel = (option) =>
    question.optionSet
      ? t(`questionnaire.optionSets.${question.optionSet}.${option}`)
      : t(`questionnaire.options.${question.id}.${option}`);

  const shell = { question, fieldId, label, optional, error: errorText };
  const describedById = describedBy(question, fieldId, errorText);
  const inputProps = { question, fieldId, value, onChange, invalid, describedById, firstRef };

  switch (question.type) {
    case 'choice':
      return (
        <FieldShell as="fieldset" {...shell}>
          <ChoiceInput {...inputProps} optionLabel={optionLabel} />
        </FieldShell>
      );
    case 'multi':
      return (
        <FieldShell as="fieldset" {...shell}>
          <MultiInput {...inputProps} optionLabel={optionLabel} />
        </FieldShell>
      );
    case 'number':
      if (question.kind === 'height' && units.system === 'imperial') {
        return (
          <FieldShell as="fieldset" {...shell}>
            <FeetInchesInput {...inputProps} />
          </FieldShell>
        );
      }
      return (
        <FieldShell {...shell} labelFor={fieldId}>
          <NumberInput {...inputProps} units={units} />
        </FieldShell>
      );
    case 'date':
      return (
        <FieldShell {...shell} labelFor={fieldId}>
          <input
            ref={firstRef}
            id={fieldId}
            type="date"
            min="1900-01-01"
            max={todayIso()}
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={describedById}
            className={`${inputClass} max-w-xs ${invalid ? invalidClass : ''}`}
          />
        </FieldShell>
      );
    case 'country':
      return (
        <FieldShell {...shell} labelFor={fieldId}>
          <CountrySelect {...inputProps} />
        </FieldShell>
      );
    default:
      return (
        <FieldShell {...shell} labelFor={fieldId}>
          <textarea
            ref={firstRef}
            id={fieldId}
            rows={3}
            maxLength={1000}
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={describedById}
            className={inputClass}
          />
        </FieldShell>
      );
  }
};

export default QuestionField;
