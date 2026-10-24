import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

// Axis, legend and grid colours that stay readable in both light and dark mode
export const useChartColors = () => {
  const { isDark } = useTheme();
  return useMemo(
    () => ({
      text: isDark ? '#cbd5e1' : '#4b5563',
      grid: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 0, 0, 0.08)',
    }),
    [isDark]
  );
};

// Copies a line chart's options with those colours applied
export const themedOptions = (options, colors) => ({
  ...options,
  plugins: {
    ...options.plugins,
    legend: { ...options.plugins?.legend, labels: { color: colors.text } },
    title: { ...options.plugins?.title, color: colors.text },
  },
  scales: Object.fromEntries(
    ['x', 'y'].map((axis) => [
      axis,
      { ...options.scales?.[axis], ticks: { color: colors.text }, grid: { color: colors.grid } },
    ])
  ),
});
