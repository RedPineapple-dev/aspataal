// Tiny fetch wrapper that toggles HIPAA Audit Mode on every outgoing request.
// When audit mode is on, the backend hashes PII (names, contact info) before
// returning data, and bucketed ages replace exact ages.

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let auditMode = false;
const listeners = new Set();

export function isAuditMode() {
  return auditMode;
}

export function setAuditMode(next) {
  auditMode = !!next;
  listeners.forEach(fn => {
    try { fn(auditMode); } catch (e) { /* listener errors should not break others */ }
  });
}

export function onAuditModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (auditMode) headers['X-Audit-Mode'] = 'true';
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  return fetch(url, { ...opts, headers });
}
