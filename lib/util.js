// Small helpers shared across the system.
import crypto from 'node:crypto';

// A short, stable id for records.
export function id(prefix = 'rec') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

// A url-friendly slug.
export function slug(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Current time as an ISO string.
export function now() {
  return new Date().toISOString();
}

// A readable date, e.g. "21 June 2026".
export function humanDate(iso = now()) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Deterministic hash of a string, used for change detection.
export function hash(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 16);
}

// Pause helper for rate-limited loops.
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Title-case a phrase.
export function title(text) {
  return String(text).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}
