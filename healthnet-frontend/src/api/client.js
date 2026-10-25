import { getIdToken } from '../firebase';

// Signed-in requests to the HealthNet API (FINAL YEAR PROJECT/main.py)

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(code, status) {
    super(`HealthNet API error: ${code}`);
    this.code = code; // unavailable | notConfigured | auth | invalid | unknown
    this.status = status;
  }
}

// The API's own error code ({"detail": {"code"}}, e.g. notFound or rateLimited) when it sends one,
// otherwise one based on the HTTP status
const errorFrom = async (response) => {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // No JSON body: fall back to the status
  }
  const code = body?.detail?.code ?? { 401: 'auth', 422: 'invalid', 503: 'notConfigured' }[response.status] ?? 'unknown';
  return new ApiError(code, response.status);
};

// fetch() with the user's Firebase ID token; resolves to the parsed JSON body
export const apiFetch = async (path, { method = 'GET', body } = {}) => {
  let token;
  try {
    token = await getIdToken();
  } catch {
    throw new ApiError('auth');
  }
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('unavailable');
  }
  if (response.ok) {
    return response.json();
  }
  throw await errorFrom(response);
};

// Uploads one file as multipart form data
export const apiUpload = async (path, file, filename) => {
  let token;
  try {
    token = await getIdToken();
  } catch {
    throw new ApiError('auth');
  }
  const form = new FormData();
  form.append('file', file, filename || file.name || 'upload');
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  } catch {
    throw new ApiError('unavailable');
  }
  if (response.ok) {
    return response.json();
  }
  throw await errorFrom(response);
};
