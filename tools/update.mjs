// update.mjs — read-only drift probe: re-fetch the live entry and every
// captured file, compare against .upstream/manifest.json. Never rewrites
// the capture. SEEDWORLD (https://openbench.fun/seedworld/).
// usage: node tools/update.mjs [--json]
//
// Route notes (probed 2026-10-13):
//   - the entry document is served at the directory URL /seedworld/
//     (https://openbench.fun/seedworld/index.html answers 307 → /seedworld/),
//     so the entry is fetched at ENTRY_URL;
//   - og.jpg is probed directly at /seedworld/og.jpg;
//   - no dynamic/manifest-flagged files are captured (the /api/hit and
//     /api/stats platform-analytics endpoints are documented gaps, not
//     captured bytes).
// Cloudflare (the origin's front) injects an insights beacon
//   <script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/<rotating>">
// into HTML responses served to browser-like clients only — a plain fetch
// (this probe) receives the pristine document, but the normalize() below
// strips the beacon anyway so a browser-saved copy can never be misread as
// drift.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const ORIGIN = "https://openbench.fun";
const ENTRY = "seedworld/index.html"; // disk path of the entry document
const ENTRY_URL = ORIGIN + "/seedworld/"; // canonical served URL of the entry (307 target)
const DISK_PREFIX = ""; // repo root maps to the origin root (disk seedworld/og.jpg == served /seedworld/og.jpg)
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0" };

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
async function getBuf(url) {
  const r = await fetch(url, { headers: UA });
  return { status: r.status, buf: r.ok ? Buffer.from(await r.arrayBuffer()) : null };
}
// disk rel -> served path ("" = origin root)
const servedOf = (rel) => (rel.startsWith(DISK_PREFIX) ? rel.slice(DISK_PREFIX.length) : rel);
// Rotating per-response noise — everything else must be byte-identical.
const normalize = (s) =>
  s
    .replace(/ nonce="[^"]*"/g, "")
    .replace(/window\.__CF\$cv\$params=\{[^}]*\}/g, "window.__CF$cv$params=<token>")
    // Cloudflare-injected insights beacon (browser-served responses only)
    .replace(/<script[^>]*static\.cloudflareinsights\.com\/beacon\.min\.js[^>]*><\/script>/g, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>");

const manifest = JSON.parse(fs.readFileSync(path.join(proj, ".upstream", "manifest.json"), "utf8"));

const live = {};
const entry = await getBuf(ENTRY_URL);
if (entry.status !== 200) {
  console.error(`live entry ${ENTRY_URL} -> HTTP ${entry.status}`);
  process.exit(2);
}
live[ENTRY] = { buf: entry.buf };
// the same document may also be recorded under its directory-index name
if (manifest.files[ENTRY.replace(/index\.html$/, "")]) live[ENTRY.replace(/index\.html$/, "")] = { buf: entry.buf };

// Probe every captured file directly — the manifest is the authoritative closure.
const rels = Object.keys(manifest.files)
  .filter((r) => r !== ENTRY && !r.endsWith("_mirror-report.json"))
  .sort();
for (const rel of rels) {
  const served = servedOf(rel);
  if (served.startsWith("cdn-cgi/")) continue;
  let r = await getBuf(ORIGIN + "/" + served);
  if (r.status !== 200 && served.endsWith("/index.html"))
    r = await getBuf(ORIGIN + "/" + served.slice(0, -"index.html".length));
  if (r.status === 200 && !live[rel]) live[rel] = { buf: r.buf };
}

const rows = [];
for (const [n, m] of Object.entries(manifest.files).sort()) {
  if (n.endsWith("_mirror-report.json")) continue;
  const l = live[n];
  if (!l) {
    rows.push({ file: n, state: "live-missing" });
    continue;
  }
  if (m.dynamic) continue; // rotating third-party payload: presence is the only stable signal
  if (n === ENTRY || n.endsWith(".html")) {
    const cap = path.join(proj, n);
    if (!fs.existsSync(cap)) continue;
    const a = normalize(l.buf.toString("utf8"));
    const b = normalize(fs.readFileSync(cap, "utf8"));
    if (a !== b) rows.push({ file: n, state: "changed" });
  } else if (m.sha256 !== sha(l.buf)) {
    rows.push({ file: n, state: "changed", mirror: m.sha256.slice(0, 12), live: sha(l.buf).slice(0, 12) });
  }
}
const changed = rows.filter((r) => r.state === "changed").length;
const missing = rows.filter((r) => r.state === "live-missing").length;
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ origin: ORIGIN, checked: Object.keys(manifest.files).length, changed, missing, rows }, null, 2));
} else if (!rows.length) {
  console.log(`up to date: ${Object.keys(manifest.files).length} captured files identical upstream`);
} else {
  console.log(`DRIFT: ${changed} changed, ${missing} live-missing (of ${Object.keys(manifest.files).length} captured)`);
  for (const r of rows.slice(0, 40)) console.log(`  ${r.state.padEnd(14)} ${r.file}`);
  process.exit(1);
}
