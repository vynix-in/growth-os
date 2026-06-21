// PUBLICATION_GATE
//
// Nothing this system produces may be published until it passes this gate.
// The gate scans text (and files) for things that must never go public:
// secrets, API keys, internal hostnames, database names, customer
// identifiers, source-code fragments from the private backend, and
// proprietary architecture terms. Any hit blocks publication and flags the
// asset for manual review.
import fs from 'node:fs';
import { db } from './db.js';
import { logger } from './logger.js';
import { now } from './util.js';

const log = logger('gate');
const scans = db('gate_scans');

// Each rule has an id, a human reason, a severity, and a matcher.
const RULES = [
  {
    id: 'private-key',
    reason: 'Private key block found',
    severity: 'critical',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
  },
  {
    id: 'aws-access-key',
    reason: 'AWS access key id',
    severity: 'critical',
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: 'generic-secret-assignment',
    reason: 'Secret, password or token assigned a real-looking value',
    severity: 'critical',
    re: /\b(?:api[_-]?key|secret|password|passwd|client[_-]?secret|access[_-]?token|private[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{12,}/i,
  },
  {
    id: 'bearer-token',
    reason: 'Bearer or provider token',
    severity: 'critical',
    re: /\b(?:gho_|ghp_|github_pat_|rzp_(?:live|test)_|sk-[A-Za-z0-9]{20}|xox[baprs]-)[A-Za-z0-9_-]{10,}/,
  },
  {
    id: 'jwt',
    reason: 'JSON Web Token',
    severity: 'high',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: 'internal-host',
    reason: 'Internal hostname or private resource',
    severity: 'high',
    re: /\b(?:epichostphp|pinpoint-mysql|epichost-ai-resource|127\.0\.0\.1:\d+|localhost:\d+|20\.193\.138\.207)\b/i,
  },
  {
    id: 'db-name',
    reason: 'Database name or connection string',
    severity: 'high',
    re: /\b(?:mysql:\/\/|postgres:\/\/|DB_PASS|DB_PASSWORD|JWT_SECRET|database\s*=\s*pinpoint)\b/i,
  },
  {
    id: 'env-file',
    reason: 'Environment file content',
    severity: 'high',
    re: /\b(?:AZURE_OPENAI_API_KEY|LINKEDIN_OAUTH_CLIENT_SECRET|PAYPAL_SECRET|RAZORPAY_KEY_SECRET|X_OAUTH_CLIENT_SECRET)\b/,
  },
  {
    id: 'private-namespace',
    reason: 'Private backend source namespace or path',
    severity: 'medium',
    re: /\b(?:PinPoint\\(?:Service|Domain|Infrastructure|Application)|backend\/src\/(?:Service|Domain|Infrastructure))\b/,
  },
  {
    id: 'proprietary-internal',
    reason: 'Proprietary internal implementation term',
    severity: 'medium',
    re: /\b(?:DiagnosisService|AiModelPolicy|AiKeyResolver|WalletService|SecretBox|PostPublisher)\b/,
  },
  {
    id: 'customer-email',
    reason: 'Possible customer or internal email address',
    severity: 'medium',
    re: /\b[A-Za-z0-9._%+-]+@(?!vynix\.in|example\.com|x\.oauth\.local)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  },
];

// Scan a string. Returns { clean, violations, scannedAt }.
// To keep the database from growing without bound (the reviewer scans every
// page on every hourly run), only violations are stored, capped to the most
// recent few hundred. Running totals are kept as single-row counters.
export function scanText(text, label = 'text') {
  const content = String(text || '');
  const violations = [];
  for (const rule of RULES) {
    const m = content.match(rule.re);
    if (m) {
      violations.push({
        rule: rule.id,
        reason: rule.reason,
        severity: rule.severity,
        sample: m[0].slice(0, 40),
      });
    }
  }
  const clean = violations.length === 0;

  // Counters (one row each, never grows).
  const counters = db('counters');
  const total = counters.findOne({ key: 'gate_total' });
  counters.upsert({ key: 'gate_total', n: (total?.n || 0) + 1 }, 'key');
  if (!clean) {
    const blocked = counters.findOne({ key: 'gate_blocked' });
    counters.upsert({ key: 'gate_blocked', n: (blocked?.n || 0) + 1 }, 'key');
    // Keep only the most recent violation records.
    const rows = scans.all();
    if (rows.length > 400) scans.replaceAll(rows.slice(-300));
    scans.insert({ label, clean, violations, count: violations.length });
    log.warn(`gate blocked "${label}"`, { violations: violations.map((v) => v.rule) });
  }
  return { label, clean, violations, scannedAt: now() };
}

// Scan a file on disk.
export function scanFile(file) {
  if (!fs.existsSync(file)) return { label: file, clean: false, violations: [{ rule: 'missing', reason: 'file not found', severity: 'high' }] };
  return scanText(fs.readFileSync(file, 'utf8'), file);
}

// Scan a whole asset record (title + body + any string fields).
export function scanAsset(asset, label) {
  const flat = JSON.stringify(asset);
  return scanText(flat, label || asset.title || asset.id || 'asset');
}

// True only when every input passes.
export function gateAllows(...texts) {
  return texts.every((t) => scanText(t).clean);
}
