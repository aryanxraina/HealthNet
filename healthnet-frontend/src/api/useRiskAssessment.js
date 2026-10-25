import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUserData } from '../context/UserDataContext';
import { buildProfile, fetchAssessment, profileKey } from './risk';

// Risk scores for the signed-in user's current answers. Saved results are reused while the
// answers are unchanged; otherwise the engine is asked again and the new results are saved.
// status: loading | empty (nothing answered yet) | error | ready
export const useRiskAssessment = () => {
  const { status: dataStatus, answers, results, storeResults } = useUserData();
  const profile = useMemo(() => buildProfile(answers), [answers]);
  const key = profileKey(profile);
  const hasAnswers = Object.keys(profile).length > 0;
  const current = results?.profileKey === key ? results : null;
  const [request, setRequest] = useState({ loading: false, error: null });
  const [attempt, setAttempt] = useState(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    if (dataStatus !== 'ready' || !hasAnswers || current) return undefined;
    let cancelled = false;
    setRequest({ loading: true, error: null });
    fetchAssessment(profileRef.current)
      .then((data) => {
        if (cancelled) return;
        setRequest({ loading: false, error: null });
        // Save failures show in DataStatusBanner; the scores still show for this visit
        storeResults({ ...data, profileKey: key, calculatedAt: new Date().toISOString() }).catch(() => {});
      })
      .catch((error) => {
        if (!cancelled) setRequest({ loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [dataStatus, hasAnswers, key, current, attempt, storeResults]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  let status;
  if (dataStatus === 'loading' || dataStatus === 'idle') status = 'loading';
  else if (!hasAnswers) status = 'empty';
  else if (current) status = 'ready';
  else if (request.error) status = 'error';
  else status = 'loading';

  return { status, results: current, error: request.error, retry };
};
