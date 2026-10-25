import React from 'react';
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

// The PDF report card. Page 1 is a friendly summary; page 2 is a detail sheet to show a doctor.
// Loaded only when someone downloads a report (see download.js), so the PDF library stays out
// of the main bundle. `report` comes from reportData.js; `t` is the app's translation function.

// Keep words whole; the default hyphenation splits names like "PREVENT"
Font.registerHyphenationCallback((word) => [word]);

const INDIGO = '#4f46e5';
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
// Level 0 (best) to 4 (worst): accent and tint, matching the Dashboard
const LEVELS = [
  ['#059669', '#ecfdf5'],
  ['#65a30d', '#f7fee7'],
  ['#d97706', '#fffbeb'],
  ['#ea580c', '#fff7ed'],
  ['#dc2626', '#fef2f2'],
];

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 60, paddingHorizontal: 0, fontFamily: 'Helvetica', fontSize: 10, color: INK },
  body: { paddingHorizontal: 36 },
  band: { backgroundColor: INDIGO, color: 'white', paddingVertical: 22, paddingHorizontal: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  brand: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1, opacity: 0.85 },
  bandTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  bandRight: { textAlign: 'right' },
  bandName: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  bandDate: { fontSize: 9, opacity: 0.85, marginTop: 2 },
  intro: { marginTop: 16, fontSize: 11, lineHeight: 1.5, color: '#374151' },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 9, marginBottom: 7, borderLeftWidth: 4 },
  tileTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  tileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  tileValue: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  pill: { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 9 },
  tileNote: { fontSize: 8.5, color: MUTED, marginTop: 5, lineHeight: 1.35 },
  step: { flexDirection: 'row', marginBottom: 6, backgroundColor: '#f5f3ff', borderRadius: 8, padding: 9 },
  stepNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: INDIGO, color: 'white', fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 5, marginRight: 10 },
  stepTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  stepBody: { fontSize: 9, color: '#374151', marginTop: 2, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, flexDirection: 'row', fontSize: 7.5, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
  footerText: { flex: 1, marginRight: 16, lineHeight: 1.35 },
  // Doctor page
  docHeader: { paddingTop: 24, paddingHorizontal: 36, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: INDIGO },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  docSubtitle: { fontSize: 9, color: MUTED, marginTop: 3 },
  facts: { flexDirection: 'row', marginTop: 12 },
  fact: { marginRight: 24 },
  factLabel: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  factValue: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  columns: { flexDirection: 'row', justifyContent: 'space-between' },
  column: { width: '48.5%' },
  h3: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4, color: INDIGO },
  kv: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 2.5 },
  kvLabel: { width: '56%', fontSize: 8, color: MUTED, paddingRight: 6 },
  kvValue: { width: '44%', fontSize: 8 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', padding: 4, backgroundColor: '#f9fafb' },
  td: { fontSize: 7.5, paddingVertical: 3.5, paddingHorizontal: 4, lineHeight: 1.3 },
  colScore: { width: '24%' },
  colResult: { width: '13%' },
  colCategory: { width: '16%' },
  colNotes: { width: '47%' },
  small: { fontSize: 6.5, color: MUTED, marginTop: 1.5 },
  empty: { fontSize: 9, color: MUTED },
});

const Footer = ({ text }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>{text}</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>
);

const ScoreTile = ({ score }) => {
  const [accent, tint] = score.status === 'ok' ? LEVELS[score.level] : ['#9ca3af', '#f3f4f6'];
  return (
    <View style={[styles.tile, { borderLeftColor: accent }]} wrap={false}>
      <Text style={styles.tileTitle}>{score.title}</Text>
      {score.status === 'ok' ? (
        <>
          <View style={styles.tileRow}>
            <Text style={[styles.tileValue, { color: accent }]}>{score.value}</Text>
            <Text style={[styles.pill, { color: accent, backgroundColor: tint }]}>{score.category}</Text>
          </View>
          {score.horizon ? <Text style={styles.tileNote}>{score.horizon}</Text> : null}
          {score.notes[0] ? <Text style={styles.tileNote}>{score.notes[0]}</Text> : null}
        </>
      ) : (
        <Text style={[styles.tileNote, { marginTop: 8 }]}>{score.notes[0]}</Text>
      )}
    </View>
  );
};

const KeyValues = ({ rows, emptyText }) =>
  rows.length === 0 ? (
    <Text style={styles.empty}>{emptyText}</Text>
  ) : (
    rows.map((row) => (
      <View key={row.label} style={styles.kv} wrap={false}>
        <Text style={styles.kvLabel}>{row.label}</Text>
        <Text style={styles.kvValue}>{row.value}</Text>
      </View>
    ))
  );

const ReportCard = ({ report, t }) => (
  <Document title={`${t('report.title')} - ${report.name}`} author="HealthNet" creator="HealthNet" language="en">
    {/* Page 1: friendly summary */}
    <Page size="A4" style={styles.page}>
      <View style={styles.band}>
        <View>
          <Text style={styles.brand}>HEALTHNET</Text>
          <Text style={styles.bandTitle}>{t('report.title')}</Text>
        </View>
        <View style={styles.bandRight}>
          <Text style={styles.bandName}>{report.name}</Text>
          <Text style={styles.bandDate}>{report.generatedOn}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.intro}>{t('report.intro', { name: report.name.split(' ')[0] })}</Text>

        <Text style={styles.h2}>{t('report.scoresTitle')}</Text>
        {report.friendlyScores.length === 0 ? (
          <Text style={styles.empty}>{t('report.noScores')}</Text>
        ) : (
          <View style={styles.grid}>
            {report.friendlyScores.map((score) => (
              <ScoreTile key={score.id} score={score} />
            ))}
          </View>
        )}

        <Text style={styles.h2}>{t('report.nextSteps')}</Text>
        {report.suggestions.map((step, index) => (
          <View key={step.title} style={styles.step} wrap={false}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Footer text={report.disclaimer} />
    </Page>

    {/* Page 2: detail sheet for a clinician */}
    <Page size="A4" style={styles.page}>
      <View style={styles.docHeader}>
        <Text style={styles.docTitle}>{t('report.doctorTitle')}</Text>
        <Text style={styles.docSubtitle}>{t('report.doctorSubtitle')}</Text>
        <View style={styles.facts}>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>{t('report.labels.name')}</Text>
            <Text style={styles.factValue}>{report.name}</Text>
          </View>
          {report.person.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.value}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.h3}>{t('report.measurements')}</Text>
            <KeyValues rows={report.measurements} emptyText={t('report.none')} />
          </View>
          <View style={styles.column}>
            <Text style={styles.h3}>{t('report.history')}</Text>
            <KeyValues rows={report.history} emptyText={t('report.none')} />
          </View>
        </View>

        <Text style={styles.h3}>{t('report.scoreTable.title')}</Text>
        <View style={styles.table}>
          <View style={styles.tr} fixed>
            <Text style={[styles.th, styles.colScore]}>{t('report.scoreTable.score')}</Text>
            <Text style={[styles.th, styles.colResult]}>{t('report.scoreTable.result')}</Text>
            <Text style={[styles.th, styles.colCategory]}>{t('report.scoreTable.category')}</Text>
            <Text style={[styles.th, styles.colNotes]}>{t('report.scoreTable.notes')}</Text>
          </View>
          {report.allScores.map((score) => (
            <View key={score.id} style={styles.tr} wrap={false}>
              <View style={[styles.td, styles.colScore]}>
                <Text>{score.title}</Text>
                {score.horizon ? <Text style={styles.small}>{score.horizon}</Text> : null}
              </View>
              <Text style={[styles.td, styles.colResult, { fontFamily: 'Helvetica-Bold' }]}>{score.value || '—'}</Text>
              <Text style={[styles.td, styles.colCategory]}>{score.category || '—'}</Text>
              <View style={[styles.td, styles.colNotes]}>
                {[...score.notes, ...(score.assumptions || [])].map((note) => (
                  <Text key={note}>{note}</Text>
                ))}
                <Text style={styles.small}>{score.model}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.small, { marginTop: 10 }]}>
          {report.calculatedOn ? t('report.engine', { version: report.engineVersion, date: report.calculatedOn }) : ''}
        </Text>
      </View>
      <Footer text={t('report.doctorFooter', { date: report.generatedOn })} />
    </Page>
  </Document>
);

export default ReportCard;
