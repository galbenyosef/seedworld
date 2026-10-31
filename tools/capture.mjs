// capture.mjs — byte-exact capture of THIS mirror's served site, with the
// runtime closure walked to a fixpoint (PLAN §4) and a fail-closed refresh
// gate for `--apply`.
//
// Adapted from the fleet template (`_standard/templates/capture.mjs`, read-only
// reference) for SEEDWORLD (https://openbench.fun/seedworld/). The site is
// served under /seedworld/ and the capture preserves that served path
// structure, so a served path maps 1:1 onto disk under the repo root
// (/seedworld/x -> seedworld/x, /seedworld/ -> seedworld/index.html).
//
// What it does
//   1. Fetches the entry document, then BFS over every reference it can see:
//      - HTML: script src, link href, img/source src+srcset, video/audio src,
//        video poster, embed/object, <style> and style="" url(), and — because
//        this page's social card lives only there — same-origin URLs in
//        <meta content> (og:image, twitter:image, og:url, …)
//      - CSS:  url(), @import
//      - JS:   a real string scanner over the inline <script> (never a text
//              regex on code): asset-shaped string literals, template
//              literals, and /api/* endpoints (recorded, never captured)
//   2. Saves the exact response bytes (never normalised) and rewrites
//      .upstream/manifest.json (Gen-A: { generated, origin, files }).
//   3. Records everything that is NOT a captured byte in the refresh report:
//      upstream-gone files, cross-origin refs (never vendored), /api/* refs
//      (never captured), 404s.
//
// Every captured file is also re-probed: a captured file that is still served
// upstream stays in the closure even when the new entry no longer references
// it (this page's old social card og.jpg), because "upstream-gone" means the
// origin no longer serves it — never "unreferenced".
//
// Modes
//   --dry-run   fetch the live origin and compare with the CURRENT capture.
//               NOTHING is written. The trust gate passes only when every
//               captured file upstream still serves with the captured bytes is
//               reproduced byte-for-byte (and every fetch is byte-stable on a
//               second request). Exit 0 pass, 1 gate failure, 2 upstream error.
//   --apply     run the same gate, then (only on pass) archive every file being
//               replaced or dropped into legacy/<date>/, write the new bytes,
//               remove upstream-gone files and rewrite the manifest.
//               --expect <spec> pins the reviewed drift set; --apply refuses to
//               write if the live drift differs from it.
//
// usage:
//   node tools/capture.mjs --dry-run [--json]
//   node tools/capture.mjs --apply --expect "changed:<rel>,gone:<rel>,new:<rel>"
//                          [--date YYYY-MM-DD]
//
// exit: 0 captured/verified, 1 gate failure, 2 upstream error
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");

// ---------------------------------------------------------------- config
const ORIGIN = "https://openbench.fun";
const ENTRY_URL = "/seedworld/";
const MANIFEST_REL = ".upstream/manifest.json";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ASSET_EXT_RE =
  /\.(m?js|cjs|css|html?|json|map|wasm|glb|gltf|bin|data|pack|png|jpe?g|webp|avif|gif|svg|ico|ktx2?|basis|hdr|exr|dds|mp3|ogg|oga|wav|m4a|aac|flac|mp4|webm|mov|ogv|woff2?|ttf|otf|eot|zip|gz|br|txt|xml|webmanifest|vtt|srt)$/i;
const HTML_LIKE = new Set(["html", "htm"]);

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY = has("--dry-run");
const APPLY = has("--apply");
const JSON_OUT = has("--json");
const TODAY = valOf("--date") || new Date().toISOString().slice(0, 10);
const EXPECT = valOf("--expect");
if (!DRY && !APPLY) {
  console.error("capture: pass --dry-run (trust gate, writes nothing) or --apply");
  process.exit(2);
}
if (DRY && APPLY) {
  console.error("capture: --dry-run and --apply are exclusive");
  process.exit(2);
}

// ---------------------------------------------------------------- helpers
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const diskRelOf = (urlPath) => {
  let p = urlPath.replace(/^\/+/, "");
  if (p === "" || p.endsWith("/")) p += "index.html";
  return p.split("?")[0].split("#")[0];
};
const servedPathOf = (diskRel) => {
  // seedworld/index.html is served at the directory URL /seedworld/ (the
  // origin answers 307 on the filename form), everything else at its path.
  if (diskRel === "seedworld/index.html") return "/seedworld/";
  return "/" + diskRel.split(path.sep).join("/");
};
const extOf = (p) => (p.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
const normPath = (p) => {
  // resolve ".."/"." against a served path, keeping the leading slash
  const segs = p.split("/");
  const out = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return "/" + out.join("/") + (p.endsWith("/") ? "/" : "");
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(absUrl, attempt = 0) {
  try {
    const r = await fetch(absUrl, { headers: { "User-Agent": UA } });
    if (r.status >= 500 && attempt < 2) {
      await sleep(500 * (attempt + 1));
      return get(absUrl, attempt + 1);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, buf, type: r.headers.get("content-type") || "" };
  } catch (e) {
    if (attempt < 2) {
      await sleep(500 * (attempt + 1));
      return get(absUrl, attempt + 1);
    }
    return { status: 0, buf: null, type: "", error: String(e && e.message) };
  }
}

// ---------------------------------------------------------------- ref extraction
const SKIP_SCHEMES = /^(data|blob|mailto|tel|javascript|about|file):/i;
const REGEX_PRECEDERS = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "~", "^", "<", ">", "/", "\n"]);

function hasJunk(s) {
  const withoutEscapes = s.replace(/%[0-9A-Fa-f]{2}/g, "");
  return /[,;(){}<>|\\^$[\]'"=+`!*]/.test(withoutEscapes);
}

// HTML/CSS attribute values are references by definition; allow extensionless
// paths, reject prose.
function refShapeAttr(s) {
  if (!s || s.length > 500) return null;
  if (SKIP_SCHEMES.test(s)) return null;
  if (s.startsWith("#") || /\s/.test(s)) return null;
  if (/^https?:\/\//i.test(s)) {
    const clean = s.split(/[?#]/)[0];
    return clean.length > "https://x".length ? clean : null;
  }
  const clean = s.split(/[?#]/)[0];
  if (!clean || hasJunk(clean)) return null;
  if (/^\/[A-Za-z0-9._~\-/%]*$/.test(clean) && clean.length > 1) return clean;
  if (/^\.{0,2}\/[A-Za-z0-9._~\-/%]+$/.test(clean)) return clean;
  if (/^[A-Za-z0-9._~\-%]+(\/[A-Za-z0-9._~\-/%]+)*$/.test(clean) && (clean.includes("/") || ASSET_EXT_RE.test(clean))) return clean;
  return null;
}

// A string swept out of code is a reference only if it is path-shaped.
function refShape(s) {
  if (!s || s.length > 400) return null;
  if (SKIP_SCHEMES.test(s)) return null;
  if (s.startsWith("#") || /\s/.test(s) || s.includes("${")) return null;
  const clean = s.split(/[?#]/)[0];
  if (!clean || hasJunk(clean)) return null;
  if (/^\.[A-Za-z0-9]+$/.test(clean)) return null; // a bare extension
  if (/^\/api(\/|$)/.test(clean)) return clean; // policy exclusion, recorded
  if (ASSET_EXT_RE.test(clean)) return clean;
  if (/^\/[A-Za-z0-9._~\-/]+$/.test(clean) && clean.length > 2) return clean;
  return null;
}

// A real scanner, not a regex over code: tracks comments, template literals and
// regex literals so prose or a UI label is never mistaken for a reference.
function skipInterpolation(text, i) {
  const n = text.length;
  i += 2;
  let depth = 1;
  while (i < n && depth > 0) {
    const c = text[i];
    if (c === "\\") { i += 2; continue; }
    if (c === "{") { depth++; i++; continue; }
    if (c === "}") { depth--; i++; continue; }
    if (c === "`" || c === '"' || c === "'") { i = skipQuoted(text, i); continue; }
    if (c === "/" && text[i + 1] === "/") { while (i < n && text[i] !== "\n") i++; continue; }
    if (c === "/" && text[i + 1] === "*") { i += 2; while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue; }
    i++;
  }
  return i;
}

function skipQuoted(text, i) {
  const n = text.length;
  const quote = text[i];
  i++;
  while (i < n) {
    const d = text[i];
    if (d === "\\") { i += 2; continue; }
    if (d === quote) return i + 1;
    if (quote === "`" && d === "$" && text[i + 1] === "{") { i = skipInterpolation(text, i); continue; }
    if (d === "\n" && quote !== "`") return i;
    i++;
  }
  return i;
}

function scanStrings(text) {
  const out = [];
  const n = text.length;
  let i = 0;
  let prevSig = "";
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/" && (prevSig === "" || REGEX_PRECEDERS.has(prevSig))) {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "/" && REGEX_PRECEDERS.has(prevSig)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const d = text[j];
        if (d === "\\") { j += 2; continue; }
        if (d === "\n") break;
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) { closed = true; j++; break; }
        j++;
      }
      if (closed) { i = j; prevSig = "/"; continue; }
      i++;
      prevSig = "/";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      const start = ++i;
      let value = "";
      let closed = false;
      while (i < n) {
        const d = text[i];
        if (d === "\\") { value += text[i + 1] ?? ""; i += 2; continue; }
        if (d === quote) { closed = true; i++; break; }
        if (quote === "`" && d === "$" && text[i + 1] === "{") {
          i = skipInterpolation(text, i);
          value += "${...}"; // interpolated paths are dynamic — refShape rejects
          continue;
        }
        if (d === "\n" && quote !== "`") break;
        value += d;
        i++;
      }
      if (closed) out.push({ value, isTemplate: quote === "`", at: start });
      prevSig = quote;
      continue;
    }
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out;
}

function cssRefs(css, refs) {
  for (const m of css.matchAll(/url\(\s*("([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi)) {
    refs.push({ ref: (m[2] ?? m[3] ?? m[4] ?? "").trim(), why: "css url()" });
  }
  for (const m of css.matchAll(/@import\s+(?:url\()?\s*("([^"]*)"|'([^']*)')/gi)) {
    refs.push({ ref: (m[2] ?? m[3] ?? "").trim(), why: "css @import" });
  }
}

/** Collect raw reference strings from an HTML document. */
function refsFromHtml(text) {
  const refs = [];
  const push = (v, why) => {
    if (!v) return;
    for (const part of String(v).split(",")) {
      const t = part.trim().split(/\s+/)[0]; // srcset "url 2x"
      if (!t || SKIP_SCHEMES.test(t)) continue;
      refs.push({ ref: t, why });
    }
  };
  const attrRe = (tagSrc, attr, why) => {
    const re = new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "gi");
    let m;
    while ((m = re.exec(tagSrc))) push(m[2] ?? m[3], why);
  };
  for (const m of text.matchAll(/<script\b([^>]*)>/gi)) attrRe(m[1], "src", "html-script");
  for (const m of text.matchAll(/<link\b([^>]*)>/gi)) attrRe(m[1], "href", "html-link");
  for (const m of text.matchAll(/<(?:img|source|iframe|embed|audio|video)\b([^>]*)>/gi)) {
    attrRe(m[1], "src", "html-media");
    attrRe(m[1], "srcset", "html-srcset");
    attrRe(m[1], "poster", "html-poster");
    attrRe(m[1], "data", "html-media");
  }
  for (const m of text.matchAll(/<object\b([^>]*)>/gi)) attrRe(m[1], "data", "html-object");
  // <meta content> URLs — this page's social card is referenced ONLY here
  // (og:image / twitter:image), so an HTML scan that reads attributes but not
  // meta content silently drops a real runtime asset.
  for (const m of text.matchAll(/<meta\b([^>]*)>/gi)) {
    const tag = m[1];
    const name = (tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [, ""])[1].toLowerCase();
    if (!name) continue;
    const c = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!c) continue;
    const v = c[1].trim();
    if (/^(og:image|og:image:url|og:url|twitter:image|twitter:image:src|msapplication-tileimage|image)$/.test(name)) push(v, "html-meta");
    else if (/^https?:\/\//i.test(v)) push(v, "html-meta");
  }
  for (const m of text.matchAll(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const list = [];
    cssRefs(m[2] ?? m[3] ?? "", list);
    refs.push(...list);
  }
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const list = [];
    cssRefs(m[1], list);
    refs.push(...list);
  }
  // Inline scripts: walk the code with the string scanner.
  for (const m of text.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const body = m[2];
    if (/\ssrc\s*=/i.test(attrs) || !body.trim()) continue;
    const type = (attrs.match(/\stype\s*=\s*["']([^"']+)["']/i) || [, ""])[1].toLowerCase();
    if (type && type !== "module" && !/javascript/.test(type)) continue; // data block, not code
    for (const s of scanStrings(body)) {
      const r = refShape(s.value);
      if (r) refs.push({ ref: r, why: s.isTemplate ? "js-template" : "js-string" });
    }
  }
  return refs.filter((r) => r.ref);
}

// A subpath-hosted site resolves a relative ref against its own directory. An
// absolute same-origin URL (meta og:image is written absolute) is its pathname.
function candidatePaths(ref, fromUrlPath) {
  let clean = ref.split("?")[0].split("#")[0];
  if (!clean) return [];
  if (/^https?:\/\//i.test(clean) || clean.startsWith("//")) {
    try {
      const u = new URL(clean.startsWith("//") ? "https:" + clean : clean);
      clean = u.pathname;
    } catch {
      return [];
    }
  }
  const out = [];
  const fromDir = fromUrlPath.endsWith("/") ? fromUrlPath : fromUrlPath.replace(/[^/]*$/, "");
  if (clean.startsWith("/")) out.push(clean);
  else out.push(fromDir + clean, ENTRY_URL + clean, "/" + clean);
  return [...new Set(out.map(normPath))];
}

// ---------------------------------------------------------------- capture
const manifestPath = path.join(proj, MANIFEST_REL);
const oldManifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { origin: ORIGIN, files: {} };
const oldFiles = oldManifest.files || {};

const fetched = new Map(); // diskRel -> { urlPath, bytes, buf, sha256, why }
const missing = []; // { ref, tried, why, from }
const external = []; // { ref, why, from }
const excluded = []; // { urlPath, why, from }
const queue = []; // unresolved refs
const seenRefs = new Set();
const pathState = new Map(); // urlPath -> "queued" | "done"

function isExternal(ref, why, fromRel) {
  if (!/^https?:\/\//i.test(ref) && !/^\/\//.test(ref)) return false;
  const abs = ref.startsWith("//") ? "https:" + ref : ref;
  let host;
  try {
    host = new URL(abs).host;
  } catch {
    return true;
  }
  if (host !== new URL(ORIGIN).host) {
    external.push({ ref, why, from: fromRel });
    return true;
  }
  return false;
}

function enqueueRef(ref, why, fromRel, fromUrlPath) {
  const clean = (ref || "").split("?")[0].split("#")[0].trim();
  if (!clean || SKIP_SCHEMES.test(clean)) return;
  if (isExternal(clean, why, fromRel)) return;
  const key = fromUrlPath + "|" + clean;
  if (seenRefs.has(key)) return;
  seenRefs.add(key);
  queue.push({ ref: clean, why, fromRel, fromUrlPath });
}

// entry
const entryRes = await get(ORIGIN + ENTRY_URL);
if (entryRes.status !== 200 || !entryRes.buf) {
  console.error(`capture: entry ${ORIGIN + ENTRY_URL} -> HTTP ${entryRes.status || entryRes.error}`);
  process.exit(2);
}
{
  const rel = diskRelOf(ENTRY_URL);
  fetched.set(rel, {
    urlPath: ENTRY_URL,
    buf: entryRes.buf,
    bytes: entryRes.buf.length,
    sha256: sha256(entryRes.buf),
    why: "entry document",
  });
  pathState.set(ENTRY_URL, "done");
  for (const r of refsFromHtml(entryRes.buf.toString("utf8"))) enqueueRef(r.ref, r.why, rel, ENTRY_URL);
}

while (queue.length) {
  const { ref, why, fromRel, fromUrlPath } = queue.shift();
  const cands = candidatePaths(ref, fromUrlPath);
  let done = false;
  const tried = [];
  for (const urlPath of cands) {
    if (/\/api(\/|$)/.test(urlPath)) {
      excluded.push({ urlPath, why, from: fromRel, rule: "no /api/*" });
      done = true;
      break;
    }
    if (pathState.has(urlPath)) {
      done = true;
      break;
    }
    pathState.set(urlPath, "queued");
    const res = await get(ORIGIN + urlPath);
    const ext = extOf(urlPath);
    const looksHtml = (res.type || "").includes("text/html");
    // an SPA/soft 404 answering 200 with HTML for a missing asset is NOT the asset
    const soft404 = res.status === 200 && ASSET_EXT_RE.test(urlPath) && looksHtml && !HTML_LIKE.has(ext);
    if (res.status !== 200 || !res.buf || soft404) {
      pathState.delete(urlPath);
      tried.push({ urlPath, status: res.status, soft404 });
      continue;
    }
    pathState.set(urlPath, "done");
    const rel = diskRelOf(urlPath);
    fetched.set(rel, { urlPath, buf: res.buf, bytes: res.buf.length, sha256: sha256(res.buf), why });
    const text = res.buf.toString("utf8");
    let refs = [];
    if (HTML_LIKE.has(ext) || (!ext && looksHtml)) refs = refsFromHtml(text);
    else if (ext === "css") {
      const list = [];
      cssRefs(text, list);
      refs = list;
    } else if (/^(m?js|cjs)$/.test(ext)) {
      for (const s of scanStrings(text)) {
        const r = refShape(s.value);
        if (r) refs.push({ ref: r, why: s.isTemplate ? "js-template" : "js-string" });
      }
    }
    for (const r of refs) enqueueRef(r.ref, r.why, rel, urlPath);
    done = true;
    break;
  }
  if (!done) missing.push({ ref, from: fromRel, why, tried });
}

// A captured file upstream still serves stays in the closure even when the new
// entry no longer references it (this page's previous social card og.jpg).
// "upstream-gone" means the origin answers 404 — never "unreferenced".
for (const rel of Object.keys(oldFiles).sort()) {
  if (fetched.has(rel)) continue;
  if (rel.endsWith("_mirror-report.json")) continue;
  const urlPath = servedPathOf(rel);
  if (pathState.get(urlPath) === "done") continue;
  const res = await get(ORIGIN + urlPath);
  if (res.status === 200 && res.buf) {
    const ext = extOf(urlPath);
    const looksHtml = (res.type || "").includes("text/html");
    const soft404 = ASSET_EXT_RE.test(urlPath) && looksHtml && !HTML_LIKE.has(ext);
    if (!soft404) {
      fetched.set(rel, { urlPath, buf: res.buf, bytes: res.buf.length, sha256: sha256(res.buf), why: "still-served capture" });
      continue;
    }
  }
  // not served: left out of `fetched` → classified upstream-gone below
}

// ---------------------------------------------------------------- determinism + comparison
const rows = [];
let gateFail = false;
for (const [rel, live] of [...fetched].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  const prev = oldFiles[rel];
  const disk = path.join(proj, rel);
  const onDisk = fs.existsSync(disk) ? fs.readFileSync(disk) : null;
  const liveSha = live.sha256;
  // byte-stability of the fetch itself
  const again = await get(ORIGIN + live.urlPath);
  const stable = again.status === 200 && again.buf && sha256(again.buf) === liveSha;
  if (!stable) {
    gateFail = true;
    rows.push({ file: rel, state: "unstable-fetch", live: liveSha.slice(0, 12) });
    continue;
  }
  if (!prev) {
    rows.push({ file: rel, state: "new", bytes: live.bytes, sha256: liveSha, live: liveSha.slice(0, 12) });
    continue;
  }
  if (prev.sha256 === liveSha) {
    const sameDisk = onDisk && sha256(onDisk) === liveSha;
    if (!sameDisk) gateFail = true;
    rows.push({
      file: rel,
      state: sameDisk ? "identical" : "GATE-DISK-MISMATCH",
      bytes: live.bytes,
      sha256: liveSha,
      live: liveSha.slice(0, 12),
    });
    continue;
  }
  rows.push({
    file: rel,
    state: "changed",
    bytes: live.bytes,
    sha256: liveSha,
    mirror: prev.sha256.slice(0, 12),
    live: liveSha.slice(0, 12),
  });
}
// upstream-gone: in the manifest, not served now
for (const rel of Object.keys(oldFiles).sort()) {
  if (!fetched.has(rel)) {
    rows.push({ file: rel, state: "upstream-gone", bytes: oldFiles[rel].bytes, mirror: oldFiles[rel].sha256.slice(0, 12) });
  }
}

const identical = rows.filter((r) => r.state === "identical");
const changedRows = rows.filter((r) => r.state === "changed");
const goneRows = rows.filter((r) => r.state === "upstream-gone");
const newRows = rows.filter((r) => r.state === "new");
const servedCount = Object.keys(oldFiles).length - goneRows.length;

// The trust gate: every still-served captured file that upstream still serves
// with the captured bytes must be reproduced byte-for-byte from the live
// origin, and no fetch may be byte-unstable. Changed/gone/new are the reviewed
// drift set (they cannot equal the old capture by definition).
if (rows.some((r) => r.state === "unstable-fetch" || r.state === "GATE-DISK-MISMATCH")) gateFail = true;
// Every manifest file must be accounted for: identical, changed, or gone.
const accounted = identical.length + changedRows.length + goneRows.length;
if (accounted !== Object.keys(oldFiles).length) gateFail = true;
const gatePass = !gateFail;

const driftSpec = [...changedRows.map((r) => `changed:${r.file}`), ...goneRows.map((r) => `gone:${r.file}`), ...newRows.map((r) => `new:${r.file}`)]
  .sort()
  .join(",");

const report = {
  generated: new Date().toISOString(),
  date: TODAY,
  origin: ORIGIN,
  entry: ENTRY_URL,
  mode: DRY ? "dry-run" : "apply",
  capture: { captured: fetched.size, manifest: Object.keys(oldFiles).length },
  gate: {
    pass: gatePass,
    identical: identical.map((r) => r.file),
    changed: changedRows.map((r) => r.file),
    gone: goneRows.map((r) => r.file),
    new: newRows.map((r) => r.file),
    servedUpstream: servedCount,
    drift: driftSpec,
  },
  rows,
  upstreamGone: goneRows.map((r) => ({ file: r.file, bytes: r.bytes, sha256: oldFiles[r.file].sha256, note: "no longer served by the origin; bytes preserved under legacy/" + TODAY + "/" })),
  external, // cross-origin refs: kept as CDN references, never vendored
  excluded, // /api/* and other policy exclusions: never captured
  missing, // referenced but 404/soft-404 upstream: recorded, never invented
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`capture ${DRY ? "dry-run" : "apply"} — ${ORIGIN}${ENTRY_URL}`);
  console.log(`captured ${fetched.size} file(s); manifest holds ${Object.keys(oldFiles).length}`);
  for (const r of rows) {
    const extra = r.state === "changed" ? `  ${r.mirror} -> ${r.live}` : r.state === "identical" ? `  ${r.sha256?.slice(0, 12)}` : "";
    console.log(`  ${r.state.padEnd(18)} ${r.file}${extra}`);
  }
  if (external.length) for (const e of external) console.log(`  external-ref       ${e.ref}  (${e.why}, from ${e.from}) — kept as CDN, never vendored`);
  if (excluded.length) for (const e of excluded) console.log(`  excluded           ${e.urlPath}  (${e.rule}) — recorded, never captured`);
  if (missing.length)
    for (const m of missing)
      console.log(
        `  missing-upstream   ${m.ref}  (${m.why}, from ${m.from}; tried ${m.tried.map((t) => `${t.urlPath}=${t.status}`).join(", ")}) — recorded, not invented`
      );
  console.log(
    `TRUST GATE: ${gatePass ? "PASS" : "FAIL"} — ${identical.length} identical, ${changedRows.length} changed, ${goneRows.length} upstream-gone, ${newRows.length} new (of ${Object.keys(oldFiles).length} captured)`
  );
  if (driftSpec) console.log(`drift set: ${driftSpec}`);
}

if (DRY) process.exit(gatePass ? 0 : 1);

// ---------------------------------------------------------------- apply
if (!gatePass) {
  console.error("capture: gate failed — nothing written");
  process.exit(1);
}
if (EXPECT) {
  const want = EXPECT.split(",").map((s) => s.trim()).filter(Boolean).sort().join(",");
  if (want !== driftSpec) {
    console.error(`capture: drift set does not match --expect\n  expected: ${want}\n  live:     ${driftSpec}`);
    process.exit(1);
  }
}

const legacyRoot = path.join(proj, "legacy", TODAY);
const archived = [];
const writeFileDated = (rel, buf) => {
  const dst = path.join(proj, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, buf);
};
// archive every file this refresh replaces or drops (bytes remain reachable)
for (const rel of [...changedRows.map((r) => r.file), ...goneRows.map((r) => r.file)]) {
  const src = path.join(proj, rel);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(legacyRoot, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  archived.push(rel);
}
// write new + changed bytes exactly as served
for (const [rel, live] of fetched) writeFileDated(rel, live.buf);
// remove upstream-gone files only (never cull whole directories)
for (const r of goneRows) {
  const p = path.join(proj, r.file);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
// rewrite the manifest (Gen-A)
const files = {};
for (const rel of [...fetched.keys()].sort()) files[rel] = { bytes: fetched.get(rel).bytes, sha256: fetched.get(rel).sha256 };
const newManifest = { generated: TODAY, origin: ORIGIN, files };
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + "\n");

// post-write proof: every written file hashes to the live sha, and the manifest
// agrees — a write that silently altered bytes cannot pass.
let writeOk = true;
for (const [rel, live] of fetched) {
  const onDisk = fs.readFileSync(path.join(proj, rel));
  if (sha256(onDisk) !== live.sha256) {
    writeOk = false;
    console.error(`capture: POST-WRITE MISMATCH ${rel}`);
  }
}

// machine record of the refresh (upstream-gone never invented)
report.archived = archived;
report.postWriteVerified = writeOk;
fs.writeFileSync(path.join(proj, ".upstream", `refresh-${TODAY}.json`), JSON.stringify(report, null, 2) + "\n");

console.log(`capture: wrote ${fetched.size} file(s), archived ${archived.length} under legacy/${TODAY}/, removed ${goneRows.length} upstream-gone`);
console.log(`capture: post-write verification ${writeOk ? "PASS" : "FAIL"} (${fetched.size} files re-hashed on disk)`);
process.exit(writeOk ? 0 : 1);
