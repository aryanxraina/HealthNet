import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { useUserData } from '../../context/UserDataContext';
import { formatMeasurement } from '../../lib/units';

// The user's own readings from the questionnaire's Vitals section, in their preferred units
const VitalsTiles = () => {
  const { t } = useTranslation();
  const { answers, settings } = useUserData();
  const vitals = answers.vitals || {};
  const has = (value) => value !== undefined && value !== null && value !== '';

  const tiles = [
    { id: 'heartRate', value: has(vitals.restingHeartRate) ? `${vitals.restingHeartRate} bpm` : null },
    {
      id: 'bloodPressure',
      value: has(vitals.systolic) && has(vitals.diastolic) ? `${vitals.systolic}/${vitals.diastolic} mmHg` : has(vitals.systolic) ? `${vitals.systolic} mmHg` : null,
    },
    { id: 'glucose', value: has(vitals.fastingGlucose) ? formatMeasurement('glucose', vitals.fastingGlucose, settings.units) : null },
    { id: 'temperature', value: has(vitals.temperature) ? formatMeasurement('temperature', vitals.temperature, settings.units) : null },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.id} className="rounded-lg bg-gray-50 p-4 text-center dark:bg-slate-800/60">
          {tile.value ? (
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{tile.value}</div>
          ) : (
            <Link
              to="/questionnaire#vitals"
              className="text-sm font-semibold text-gray-400 hover:text-indigo-600 dark:text-gray-500 dark:hover:text-indigo-400"
            >
              {t('dashboard.vitals.notAdded')}
            </Link>
          )}
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t(`dashboard.vitals.${tile.id}`)}</div>
        </div>
      ))}
    </div>
  );
};

export default VitalsTiles;
