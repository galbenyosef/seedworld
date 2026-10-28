#!/usr/bin/env node
// Minimal static server for the seedworld mirror (offline boot test).
// Usage: node tools/serve.mjs <port> [documentRoot]
// Binds 127.0.0.1 only. Document root defaults to the repo root, which
// reproduces the origin sub-path: /seedworld/ -> seedworld/index.html.
// Honest 404s (no SPA fallback), directory indexes, path-traversal guard,
// one log line per request on stdout.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]);
const ROOT = path.resolve(process.argv[3] || path.join(HERE, '..'));

if (!PORT || !Number.isInteger(PORT)) {
  console.error('usage: node tools/serve.mjs <port> [documentRoot]');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.bin': 'application/octet-stream',
  '.dat': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  } catch {
    console.log(`${req.method} ${req.url} 400`);
    return send(res, 400, 'Bad Request');
  }

  const rel = pathname.replace(/^\/+/, '');
  const target = path.resolve(ROOT, rel);

  // Path-traversal guard: the resolved target must stay inside ROOT.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    console.log(`${req.method} ${req.url} 403`);
    return send(res, 403, 'Forbidden');
  }

  fs.stat(target, (err, stat) => {
    if (err) {
      console.log(`${req.method} ${req.url} 404`);
      return send(res, 404, 'Not Found');
    }
    const file = stat.isDirectory() ? path.join(target, 'index.html') : target;
    fs.stat(file, (err2, stat2) => {
      if (err2 || !stat2.isFile()) {
        console.log(`${req.method} ${req.url} 404`);
        return send(res, 404, 'Not Found');
      }
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat2.size });
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      console.log(`${req.method} ${req.url} 200`);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}/`);
});
