import React from 'react';
import { saveFile, todayStamp } from '../lib/saveFile';
import { buildReport } from './reportData';

// Builds and downloads the PDF report card. The PDF library (and the layout that uses it) is
// fetched only now, as a separate chunk, so it never slows down normal page loads.
export const downloadReportCard = async ({ name, answers, results, settings, t, language }) => {
  const [{ pdf }, { default: ReportCard }] = await Promise.all([import('@react-pdf/renderer'), import('./ReportCard')]);
  const report = buildReport({ name, answers, results, settings, t, language });
  const blob = await pdf(<ReportCard report={report} t={t} />).toBlob();
  saveFile(blob, `healthnet-report-card-${todayStamp()}.pdf`);
};
