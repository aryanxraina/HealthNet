import React from 'react';
import { useTranslation } from '../i18n';

const ComingSoonBadge = ({ className = '' }) => {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200 ${className}`}>
      {t('common.comingSoon')}
    </span>
  );
};

// Marks placeholder numbers that aren't real user data yet
export const SampleDataBadge = ({ className = '' }) => {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 ${className}`}>
      {t('common.sampleData')}
    </span>
  );
};

export default ComingSoonBadge;
