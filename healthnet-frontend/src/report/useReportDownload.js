import { useCallback, useState } from 'react';
import { getDisplayName, useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import { useTranslation } from '../i18n';
import { buildProfile, fetchAssessment, profileKey } from '../api/risk';
import { downloadReportCard } from './download';

// Download handler for the report card. Scores are refreshed first if the answers changed since
// they were last calculated, so the PDF always matches the questionnaire.
// error: a translation key, or null; ready: false until the saved answers have loaded
export const useReportDownload = () => {
  const { user } = useAuth();
  const { status, answers, results, settings, storeResults } = useUserData();
  const { t, language } = useTranslation();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const download = useCallback(async () => {
    setError(null);
    const profile = buildProfile(answers);
    if (Object.keys(profile).length === 0) {
      setError('report.errors.noAnswers');
      return;
    }
    setWorking(true);
    try {
      let current = results;
      const key = profileKey(profile);
      if (current?.profileKey !== key) {
        current = { ...(await fetchAssessment(profile)), profileKey: key, calculatedAt: new Date().toISOString() };
        storeResults(current).catch(() => {});
      }
      await downloadReportCard({ name: getDisplayName(user), answers, results: current, settings, t, language });
    } catch (e) {
      setError(e.code ? `dashboard.risk.errors.${e.code}` : 'report.errors.generic');
    } finally {
      setWorking(false);
    }
  }, [answers, results, settings, storeResults, t, language, user]);

  // Saved answers must have loaded before a report can be made from them
  return { download, working, error, ready: status === 'ready' };
};
