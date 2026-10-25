import { activitySeries, hasReadings, isSyncDue, latestReading, METRICS } from './activity';

const END = new Date(2026, 9, 25); // 25 Oct 2026, local time

test('activitySeries lists every day, oldest first, with gaps as null', () => {
  const series = activitySeries(
    {
      '2026-10-23': { steps: 9000, restingHeartRate: null, sleepMinutes: 420 },
      '2026-10-25': { steps: 1200, restingHeartRate: 60 },
    },
    END,
    3
  );
  expect(series.map((day) => day.key)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);
  expect(series[0]).toMatchObject({ steps: 9000, restingHeartRate: null, sleepMinutes: 420 });
  expect(series[1]).toMatchObject({ steps: null, restingHeartRate: null, sleepMinutes: null });
  expect(series[2]).toMatchObject({ steps: 1200, restingHeartRate: 60, sleepMinutes: null });
});

test('activitySeries crosses month ends', () => {
  const series = activitySeries({}, new Date(2026, 2, 1), 2);
  expect(series.map((day) => day.key)).toEqual(['2026-02-28', '2026-03-01']);
});

test('hasReadings and latestReading', () => {
  const empty = activitySeries({}, END, 5);
  expect(hasReadings(empty)).toBe(false);
  expect(latestReading(empty, 'steps')).toBeNull();

  const series = activitySeries({ '2026-10-22': { restingHeartRate: 58 }, '2026-10-24': { restingHeartRate: 61 } }, END, 5);
  expect(hasReadings(series)).toBe(true);
  expect(latestReading(series, 'restingHeartRate').key).toBe('2026-10-24');
});

test('a sync is due when there has never been one or the last is over 6 hours old', () => {
  const now = Date.parse('2026-10-25T12:00:00Z');
  expect(isSyncDue(null, now)).toBe(true);
  expect(isSyncDue('2026-10-25T07:00:00Z', now)).toBe(false);
  expect(isSyncDue('2026-10-25T05:59:00Z', now)).toBe(true);
});

test('sleep is shown in hours', () => {
  expect(METRICS.sleep.toDisplay(437)).toBe(7.3);
});
