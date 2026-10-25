import { apiFetch, apiUpload } from './client';
import { imageAsJpeg } from '../ocr/images';

// Cloud "Enhanced reading" (FINAL YEAR PROJECT/extract_api.py). Only called after the user agrees
// to send a specific file; the server passes it to the configured provider and doesn't store it.

let statusPromise;
// { available, provider, providerName, model } - asked once per visit
export const getExtractionStatus = () => {
  statusPromise ??= apiFetch('/extract/status').catch((error) => {
    statusPromise = undefined;
    throw error;
  });
  return statusPromise;
};

// kind: 'labReport' | 'prescription'. Photos are sent as JPEG; PDFs as they are.
export const extractDocument = async (kind, file) => {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  const body = isPdf ? file : await imageAsJpeg(file);
  return apiUpload(`/extract/${kind}`, body, isPdf ? 'document.pdf' : 'image.jpg');
};
