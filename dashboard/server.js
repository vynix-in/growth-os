// Dashboard web server. Serves the command center UI and a small JSON API for
// the snapshot, the approval queue, and approve/reject actions. Pure Node, no
// framework, so it runs with plain `node`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../lib/config.js';
import { queue } from '../lib/queue.js';
import { buildSnapshot } from '../agents/dashboard-agent.js';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger('dashboard-server');
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(res, file) {
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function startDashboard(opts = {}) {
  const host = opts.host || config.dashboard.host;
  const port = opts.port || config.dashboard.port;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    const route = url.pathname;

    // API
    if (route === '/api/snapshot') {
      return sendJson(res, 200, buildSnapshot());
    }
    if (route === '/api/queue') {
      return sendJson(res, 200, { awaiting: queue.awaitingApproval(), stats: queue.stats() });
    }
    if (route === '/api/approve' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.id) return sendJson(res, 400, { error: 'id required' });
      queue.approve(body.id);
      log.info('task approved', { id: body.id });
      return sendJson(res, 200, { ok: true });
    }
    if (route === '/api/reject' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.id) return sendJson(res, 400, { error: 'id required' });
      queue.reject(body.id, body.reason || '');
      log.info('task rejected', { id: body.id });
      return sendJson(res, 200, { ok: true });
    }

    // Static
    if (route === '/' || route === '') return serveStatic(res, path.join(PUBLIC, 'index.html'));
    return serveStatic(res, path.join(PUBLIC, route.replace(/^\//, '')));
  });

  server.listen(port, host, () => {
    log.info(`dashboard running at http://${host}:${port}`);
    process.stdout.write(`\nVynix Growth OS dashboard: http://${host}:${port}\n`);
  });
  return server;
}
