// Scores a lab report reader against synthetic documents with known answers.
//
// reader(lines) -> items like parseLabReport's: [{ field, standardValue, confidence, inRange, notes }]
//
// An item is correct when its value is within the document's tolerance (the rounding of the printed
// number) and it carries any flag the truth requires. A wrong value counts as both a false positive
// and a miss. "Pre-ticked" mirrors the review screen (ImportReportDialog): in range with confidence
// of at least 0.5, so the user saves it unless they untick it. A wrong pre-ticked value is the
// dangerous error the roadmap's ship gates are built around.

export const PRE_TICK_CONFIDENCE = 0.5;
const isPreTicked = (item) => item.inRange && item.confidence >= PRE_TICK_CONFIDENCE;

const emptyCounts = () => ({ documents: 0, truth: 0, predicted: 0, correct: 0, preTicked: 0, dangerous: 0, dangerousDocuments: 0 });

const summarise = (c) => {
  const precision = c.predicted ? c.correct / c.predicted : 1;
  const recall = c.truth ? c.correct / c.truth : 1;
  return {
    documents: c.documents,
    values: c.truth,
    precision: round(precision),
    recall: round(recall),
    f1: round(precision + recall ? (2 * precision * recall) / (precision + recall) : 0),
    // Of the values the review screen would pre-tick, the share that are wrong
    dangerousErrorRate: round(c.preTicked ? c.dangerous / c.preTicked : 0),
    // Documents where accepting every pre-ticked value would save at least one wrong number
    documentsWithDangerousError: round(c.documents ? c.dangerousDocuments / c.documents : 0),
  };
};

const round = (x) => Math.round(x * 10000) / 10000;

const judge = (item, truth) => {
  const expected = truth[item.field];
  if (!expected) return 'falsePositive';
  if (Math.abs(item.standardValue - expected.value) > expected.tolerance + 1e-9) return 'wrongValue';
  if (expected.note && !item.notes.includes(expected.note)) return 'missingFlag';
  return 'correct';
};

export const scoreReader = (reader, documents) => {
  const groups = {}; // "overall", "layout:table", "noise:light", "field:hba1c" -> counts
  const counts = (key) => {
    groups[key] = groups[key] || emptyCounts();
    return groups[key];
  };
  const errors = { falsePositive: 0, wrongValue: 0, missingFlag: 0, missed: 0 };
  const calibration = Array.from({ length: 5 }, () => ({ items: 0, correct: 0 })); // confidence 0-0.2, ..., 0.8-1
  const examples = [];

  documents.forEach((document) => {
    const items = reader(document.lines);
    const docKeys = ['overall', `layout:${document.layout}`, `noise:${document.noise}`];
    let dangerousHere = false;
    docKeys.forEach((key) => {
      counts(key).documents += 1;
      counts(key).truth += Object.keys(document.truth).length;
    });
    Object.keys(document.truth).forEach((field) => {
      counts(`field:${field}`).truth += 1;
    });

    const found = new Set();
    items.forEach((item) => {
      found.add(item.field);
      const verdict = judge(item, document.truth);
      const correct = verdict === 'correct';
      const preTicked = isPreTicked(item);
      const dangerous = preTicked && !correct;
      if (!correct) errors[verdict] += 1;
      if (dangerous) {
        dangerousHere = true;
        if (examples.length < 25) {
          examples.push({ document: document.id, layout: document.layout, noise: document.noise, verdict, field: item.field, read: item.standardValue, expected: document.truth[item.field]?.value ?? null, sourceText: item.sourceText });
        }
      }
      [...docKeys, `field:${item.field}`].forEach((key) => {
        const c = counts(key);
        c.predicted += 1;
        if (correct) c.correct += 1;
        if (preTicked) c.preTicked += 1;
        if (dangerous) c.dangerous += 1;
      });
      const bucket = calibration[Math.min(4, Math.floor(item.confidence * 5))];
      bucket.items += 1;
      if (correct) bucket.correct += 1;
    });
    Object.keys(document.truth).forEach((field) => {
      if (!found.has(field)) errors.missed += 1;
    });
    if (dangerousHere) docKeys.forEach((key) => { counts(key).dangerousDocuments += 1; });
  });

  const section = (prefix) =>
    Object.fromEntries(Object.entries(groups).filter(([key]) => key.startsWith(prefix)).map(([key, c]) => [key.slice(prefix.length), summarise(c)]));
  return {
    overall: summarise(groups.overall),
    byLayout: section('layout:'),
    byNoise: section('noise:'),
    byField: section('field:'),
    errors,
    calibration: calibration.map((bucket, index) => ({
      confidence: `${(index / 5).toFixed(1)}-${((index + 1) / 5).toFixed(1)}`,
      items: bucket.items,
      accuracy: bucket.items ? round(bucket.correct / bucket.items) : null,
    })),
    dangerousExamples: examples,
  };
};
