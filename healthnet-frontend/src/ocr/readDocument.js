// Reads a lab report file in the browser and returns its text lines: [{ text, confidence }].
// Nothing is uploaded. PDFs with a text layer (most lab PDFs) are read directly; photos and
// scanned PDFs go through on-device OCR (PaddleOCR on ONNX Runtime). Both libraries are loaded
// only when needed, as separate chunks.
//
// onProgress(step): 'readingPdf' | 'loadingOcr' | 'recognising'

import { imageCanvas } from './images';

const MAX_SCANNED_PAGES = 3;

let pdfjsPromise;
const loadPdfjs = () => {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
};

let ocrPromise;
const loadOcr = () => {
  ocrPromise ??= import('ppu-paddle-ocr/web').then(async ({ PaddleOcrService }) => {
    // Model files (~6 MB) are fetched once and then served from the browser cache
    const service = new PaddleOcrService();
    await service.initialize();
    return service;
  });
  // Let a failed download be retried next time
  ocrPromise.catch(() => {
    ocrPromise = undefined;
  });
  return ocrPromise;
};

// Groups a PDF page's text items into lines by their vertical position
const pageLines = (items) => {
  const rows = [];
  items
    .filter((item) => item.str.trim())
    .forEach((item) => {
      const [, , , , x, y] = item.transform;
      const row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, item.height * 0.4));
      if (row) row.items.push({ x, str: item.str });
      else rows.push({ y, items: [{ x, str: item.str }] });
    });
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join('  '));
};

const ocrCanvas = async (canvas, onProgress) => {
  onProgress?.('loadingOcr');
  const service = await loadOcr();
  onProgress?.('recognising');
  const result = await service.recognize(canvas);
  return result.lines.map((words) => ({
    text: words.map((w) => w.text).join(' '),
    confidence: words.reduce((sum, w) => sum + w.confidence, 0) / words.length,
  }));
};

const readPdf = async (file, onProgress) => {
  onProgress?.('readingPdf');
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pageLines(content.items).forEach((text) => lines.push({ text, confidence: 1 }));
  }
  if (lines.length > 0) return { lines, method: 'pdfText' };

  // A scanned PDF has no text layer: render the first pages and read them like photos
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_SCANNED_PAGES); n += 1) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    lines.push(...(await ocrCanvas(canvas, onProgress)));
  }
  return { lines, method: 'ocr' };
};

export const readDocument = async (file, onProgress) => {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return readPdf(file, onProgress);
  }
  const lines = await ocrCanvas(await imageCanvas(file), onProgress);
  return { lines, method: 'ocr' };
};
