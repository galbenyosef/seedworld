// derive.mjs — rebuild the derived layers (readable/ + src/ + split-spec.json)
// from the seedworld capture (PLAN §3/§5). SEEDWORLD
// (https://openbench.fun/seedworld/) is capture-class: a single-document WebGL
// game ("grow a planet from one number") on the Openbench platform, served
// under the /seedworld/ sub-path. §0.4 fork-over-mirror was checked on
// 2026-10-13 — no public upstream repo exists (openbench.fun publishes
// deployments, not sources; a GitHub code/search look finds no Seedworld
// source repo), so the mirror stands. The capture is untouched; every capture
// file is re-hashed against .upstream/manifest.json before it is rendered, so
// a drifted capture fails loudly instead of being silently re-derived.
//
// Architecture fact that shapes this pipeline: the whole game is ONE inline
// <script> block inside the entry document — raw WebGL (no three.js, no
// engine), GLSL shader sources as template literals, a 2D-canvas solar-system
// pass, a GPU texture baker and an in-browser ZIP encoder. There are:
//   - zero external script/stylesheet references of the game's own
//     (the only <link> is Google Fonts CSS, a CDN dependency that stays CDN
//     per PLAN §1 — socker precedent — never backfilled);
//   - zero captured .js/.css files (nothing else is served under /seedworld/);
//   - one inline <style> (the whole UI stylesheet) and one inline <script>
//     (the whole game).
//
// Pipeline:
//   inline <script> block -> pinned prettier 3.9.6 (module API — the CLI
//                            respects .gitignore and can silently echo its
//                            input), single pass, verified idempotent ->
//                            readable/index-inline-1.pretty.js
//   inline <style> block  -> readable/index-inline-1.pretty.css,
//                            wholeFile section (stylesheet rule).
//   the script is a single top-level IIFE — so statement-aligned slicing
//   descends ONE level, into the IIFE body: its top-level statements are the
//   sliceable units (the wrapper head `(function(){` — plus the `"use strict";`
//   directive prologue, which Babel keeps outside the statement list — and the
//   wrapper tail `})();` are not statements and become skipped sections, never
//   sliced). Statements that cannot stand alone (the two `if(!gl){…return;}`
//   / `if(!prog){…return;}` early-return guards — a bare `return` is illegal
//   outside a function) are indexed as skipped sections as well; every other
//   statement windows into src/index-inline-1-NN.js at top-level declaration
//   boundaries, ~250-350 line windows (oversized single declarations stay
//   whole), exact 2-line provenance header. Every slice is parse-checked with
//   `node --input-type=module --check -` and round-trips byte-exact to its
//   readable line range.
//
//   everything else (og.jpg) -> notRendered (hash + size recorded, no render).
//
// readable/index-inline-map.json records every inline block's byte range and
// sha256 inside the capture document (the deliverable rule for inline twins).
// Identifiers in src/ are the game's own authored names (the entry is NOT
// minified) — so the identifier-rename campaign (PLAN §5) does not apply here;
// that is recorded in README.md. usage:
//   node tools/derive.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const PINNED = "3.9.6";
const MIN_WINDOW = 250;
const MAX_WINDOW = 350;
const TODAY = "2026-10-13";
const ROOT = "seedworld/"; // capture root (the served site root, a sub-path deploy)

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const readLines = (abs) => {
  const t = fs.readFileSync(abs, "utf8");
  const l = t.split("\n");
  if (l.length && l[l.length - 1] === "") l.pop();
  return l;
};
const linesOf = (text) => text.replace(/\n$/, "").split("\n");
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

// capture-relative name -> derived tag (seedworld/ stripped, dirs flattened)
const tagOf = (capRel) => {
  const rel = capRel.startsWith(ROOT) ? capRel.slice(ROOT.length) : capRel;
  return rel.replace(/\.html?$/i, "").split("/").join("__");
};

// ── pinned prettier (module API, exactly 3.9.6) ─────────────────────────
async function loadPrettier() {
  const candidates = [
    process.env.PRETTIER_MJS,
    path.join(proj, "node_modules", "prettier", "index.mjs"),
    "D:/repos/mirrors/metropolygonia/node_modules/prettier/index.mjs",
  ].filter(Boolean);
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(c), "package.json"), "utf8"));
      if (pkg.version !== PINNED) continue;
      const mod = (await import(pathToFileURL(c).href)).default;
      if (mod.version === PINNED) return { mod, at: c };
    } catch {
      /* try next */
    }
  }
  throw new Error(`pinned prettier ${PINNED} not found (set PRETTIER_MJS to its index.mjs)`);
}

// single pass + idempotency proof: prettier output must be a fixed point of
// the same call, so audit's one-pass re-render is byte-exact by construction
async function formatOnce(prettier, text, parser) {
  const out = await prettier.format(text, { parser });
  const again = await prettier.format(out, { parser });
  if (again !== out) throw new Error(`prettier ${parser} is not idempotent on this input`);
  return out;
}

// ── parse check: the exact standalone gate (ESM stdin) ──────────────────
function parses(text) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check", "-"], {
    input: text,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, why: (r.stderr || "").trim().split("\n").slice(-3).join(" | ") };
}

// ── markers for titles (top code tokens, lowercase; fleet convention) ───
const STOP = new Set(
  ("function return typeof undefined object string number boolean prototype length value default " +
    "exports import this that with from then else case break continue delete instanceof constructor " +
    "arguments void null true false call apply name type text target window document globalthis self " +
    "require module async await yield static class const let var new for while switch throw try catch " +
    "finally extends super using debugger of in do if has own hasown get set")
    .split(" ")
    .filter(Boolean),
);
function markers(text, n = 2) {
  // quoted strings (asset names, GLSL fragments inside quotes) are not code
  // tokens — strip them before counting (template literals ARE stripped too:
  // the shader bodies are strings, but their const names survive)
  const code = text.replace(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g, " ");
  const counts = new Map();
  for (const m of code.matchAll(/[A-Za-z][A-Za-z0-9_]{2,}/g)) {
    const w = m[0].toLowerCase();
    if (STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}
const markerText = (ms) => ms.map(([w, c]) => `${w}(${c})`).join(", ");
// title word: top marker; when a window is one giant string-literal declaration
// (a shader) there are no code tokens left in it — fall back to its const name
function topWordOf(body, tag) {
  const ms = markers(body);
  if (ms.length) return { word: ms[0][0], ms };
  const decl = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(body);
  if (decl) return { word: decl[1].toLowerCase(), ms };
  return { word: /^\s*import\b/.test(body) ? "imports" : tag.toLowerCase(), ms };
}

// ── windowize: cut only at statement starts; ≤350 lines, a single ───────
// ── oversized declaration is a window of its own ────────────────────────
function windowize(stmts) {
  const out = [];
  let cur = null;
  for (const s of stmts) {
    if (!cur) {
      cur = { first: s, last: s, count: 1, startLine: s.startLine, endLine: s.endLine };
      continue;
    }
    const projected = s.endLine - cur.startLine + 1;
    if (projected > MAX_WINDOW) {
      out.push(cur);
      cur = { first: s, last: s, count: 1, startLine: s.startLine, endLine: s.endLine };
    } else {
      cur.last = s;
      cur.count++;
      cur.endLine = s.endLine;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ── inline block scan (byte-exact, over the raw entry buffer) ───────────
function scanBlocks(buf) {
  const blocks = [];
  for (const [open, close, kind] of [
    ["<script", "</script", "script"],
    ["<style", "</style", "style"],
  ]) {
    let p = 0;
    let n = 0;
    while (true) {
      const i = buf.indexOf(open, p);
      if (i < 0) break;
      const after = buf[i + open.length];
      const boundary =
        after === 0x3e || after === 0x2f || after === 0x20 || after === 0x09 || after === 0x0a || after === 0x0d;
      if (!boundary) {
        p = i + open.length;
        continue;
      }
      const tagEnd = buf.indexOf(">", i);
      if (tagEnd < 0) break;
      const j = buf.indexOf(close, tagEnd + 1);
      if (j < 0) throw new Error(`unterminated <${kind}> opened at byte ${i}`);
      const tag = buf.subarray(i, tagEnd + 1).toString("utf8");
      const external = /\bsrc\s*=\s*["']/i.test(tag);
      if (external) {
        blocks.push({ kind, external: true, tag, openStart: i, contentStart: tagEnd + 1, contentEnd: j });
      } else {
        n++;
        const content = buf.subarray(tagEnd + 1, j);
        blocks.push({
          kind: /\btype\s*=\s*["']importmap["']/i.test(tag) ? "importmap" : kind,
          external: false,
          block: n,
          tag,
          openStart: i,
          contentStart: tagEnd + 1,
          contentEnd: j,
          bytes: content.length,
          sha256: sha256(content),
          text: content.toString("utf8"),
        });
      }
      p = j + close.length;
    }
  }
  return blocks.sort((a, b) => a.openStart - b.openStart);
}

async function main() {
  const { mod: prettier, at } = await loadPrettier();
  console.log(`pinned prettier ${PINNED} (${at})`);

  const manifest = JSON.parse(fs.readFileSync(path.join(proj, ".upstream", "manifest.json"), "utf8"));
  const captured = Object.keys(manifest.files).map((r) => r.split(path.sep).join("/")).sort();
  const captureBytes = (rel) => {
    const abs = path.join(proj, rel);
    if (!fs.existsSync(abs)) throw new Error(`capture file missing: ${rel}`);
    const buf = fs.readFileSync(abs);
    if (sha256(buf) !== manifest.files[rel].sha256)
      throw new Error(`${rel} on disk does not match .upstream/manifest.json — re-verify the capture first`);
    return buf;
  };

  const readableDir = path.join(proj, "readable");
  const srcDir = path.join(proj, "src");
  fs.mkdirSync(readableDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });
  const written = { readable: new Set(), src: new Set() };

  const sources = [];
  const sections = [];
  const notRendered = [];
  const inlineMapBlocks = [];
  const inlineFiles = [];
  let slicedTotal = 0;
  let skippedTotal = 0;
  let rangedTotal = 0;

  const htmlRels = captured.filter((r) => /\.html$/i.test(r));
  const payloadRels = captured.filter((r) => !/\.(html|js|css)$/i.test(r));

  // ── 1) the entry document: inline <script>/<style> → readable + slices ──
  for (const rel of htmlRels) {
    const buf = captureBytes(rel);
    const blocks = scanBlocks(buf);
    const inline = blocks.filter((b) => !b.external);
    const external = blocks.filter((b) => b.external);
    inlineFiles.push(rel);
    for (const b of external)
      console.log(`derive: ${rel}: external ${b.kind} (not derived): ${b.tag.slice(0, 90)}`);
    if (!inline.length) {
      console.log(`derive: ${rel}: no inline <script>/<style> content blocks — no inline twins`);
      continue;
    }
    const entryTag = tagOf(rel);
    for (const b of inline) {
      const isImportmap = b.kind === "importmap";
      const parser = isImportmap ? "json" : b.kind === "style" ? "css" : "babel";
      const DATA_TYPES = new Set(["application/ld+json", "application/json", "importmap", "speculationrules"]);
      const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(b.tag)?.[1] ?? "").toLowerCase();
      if (parser === "script" && DATA_TYPES.has(type)) {
        notRendered.push({
          capture: rel,
          kind: "inline-data",
          type,
          byteStart: b.contentStart,
          byteEnd: b.contentEnd,
          bytes: b.bytes,
          sha256: b.sha256,
          rendered: false,
          reason: `typed data block (<script type="${type}">) — data, not JS/CSS; recorded with range + sha256, no pretty pass`,
        });
        continue;
      }
      const tag = `${entryTag}-inline-${b.block}`;
      const ext = isImportmap ? "json" : b.kind === "style" ? "css" : "js";
      const prettyFile = `${tag}.pretty.${ext}`;
      const pretty = await formatOnce(prettier, b.text, parser);
      if (pretty === b.text)
        throw new Error(`readable/${prettyFile} would be byte-identical to its capture source`);
      fs.writeFileSync(path.join(readableDir, prettyFile), pretty);
      written.readable.add(prettyFile);
      const prettyBuf = Buffer.from(pretty, "utf8");
      const lines = linesOf(pretty);
      inlineMapBlocks.push({
        file: `readable/${prettyFile}`,
        source: rel,
        kind: b.kind,
        block: b.block,
        byteStart: b.contentStart,
        byteEnd: b.contentEnd,
        bytes: b.bytes,
        sha256: b.sha256,
        prettyBytes: prettyBuf.length,
        prettySha256: sha256(prettyBuf),
      });

      if (b.kind !== "script") {
        // stylesheet / importmap / inline data — wholeFile, never sliced
        sections.push({
          file: `${tag}.${ext}`,
          wholeFile: true,
          title: `${tag} — inline ${b.kind} block (whole-file, never sliced)`,
          desc: `Lines 1-${lines.length} of readable/${prettyFile}. Whole-file: the entry document's inline ${b.kind} block (${b.bytes} B at bytes ${b.contentStart}-${b.contentEnd} of ${rel}) is indexed whole and never sliced.`,
          note: `whole-file (entry inline ${b.kind} block, not sliced)`,
          startLine: 1,
          endLine: lines.length,
          sourceFile: `readable/${prettyFile}`,
        });
        sources.push({
          sourceFile: `readable/${prettyFile}`,
          capture: rel,
          captureKind: `inline-${b.kind}`,
          captureByteStart: b.contentStart,
          captureByteEnd: b.contentEnd,
          captureSha256: b.sha256,
          captureBytes: b.bytes,
          prettyLines: lines.length,
          prettyBytes: prettyBuf.length,
          prettySha256: sha256(prettyBuf),
          tag,
          slices: 0,
          slicedFrom: "whole block",
          derived: "readable only (inline block, wholeFile)",
        });
        console.log(`derive: ${rel} inline ${b.kind} #${b.block} -> readable/${prettyFile} (${lines.length} lines, wholeFile)`);
        continue;
      }

      // ── inline script: statement-aligned slices (descend into the IIFE) ──
      const dbg = await prettier.__debug.parse(pretty, { parser: "babel" });
      const program = (dbg.ast.program || dbg.ast).body;
      if (program.length !== 1)
        throw new Error(`${rel} inline script: expected a single top-level IIFE statement, found ${program.length}`);
      const top = program[0];
      if (top.type !== "ExpressionStatement" || top.expression.type !== "CallExpression" ||
          (top.expression.callee.type !== "FunctionExpression" && top.expression.callee.type !== "ArrowFunctionExpression"))
        throw new Error(`${rel} inline script: top-level statement is not a single IIFE — cannot descend`);
      const bodyBlock = top.expression.callee.body;
      if (bodyBlock.type !== "BlockStatement")
        throw new Error(`${rel} inline script: IIFE has no block body`);
      const inner = bodyBlock.body;
      console.log(`derive: ${rel} inline script #${b.block}: descending into the IIFE body (${inner.length} statements)`);

      const stmts = inner.map((n) => ({
        node: n,
        startLine: lineOf(pretty, n.start),
        endLine: lineOf(pretty, n.end),
        text: pretty.slice(n.start, n.end),
      }));
      for (let i = 1; i < stmts.length; i++)
        if (stmts[i].startLine <= stmts[i - 1].endLine)
          throw new Error(`${rel}: statements ${i - 1}/${i} share a line — cannot slice at line boundaries`);

      // wrapper head/tail (the opening `(function () {` line and the closing
      // `})();` line) are not statements — explicit skipped sections own them
      const headEnd = stmts[0].startLine - 1;
      const tailStart = stmts[stmts.length - 1].endLine + 1;
      if (headEnd >= 1) {
        const headText = lines.slice(0, headEnd).join("\n");
        if (!/\bfunction\b/.test(headText) || !/\(\s*function/.test(headText.replace(/\s+/g, " ")))
          throw new Error(`${rel}: wrapper head does not look like an IIFE opener — readable changed shape`);
      }
      if (tailStart <= lines.length) {
        const tailText = lines.slice(tailStart - 1).join("\n");
        if (!/^\s*\}\s*\)\s*\(\s*\)\s*;?\s*$/.test(tailText))
          throw new Error(`${rel}: wrapper tail does not look like \`})();\` — readable changed shape`);
      }

      // a statement that cannot stand alone (a bare `return`, `break`, …) is
      // indexed as its own skipped section — never sliced, never rewritten
      const nonStandalone = new Map();
      for (const s of stmts) {
        if (!/\b(return|break|continue|yield|await)\b/.test(s.text)) continue;
        const chk = parses(s.text);
        if (!chk.ok) nonStandalone.set(s, chk.why);
      }
      for (const [s, why] of nonStandalone)
        console.log(`derive: ${rel}: non-standalone statement at lines ${s.startLine}-${s.endLine} (${why}) — indexed, not sliced`);

      const specials = [];
      if (headEnd >= 1)
        specials.push({
          kind: "skip",
          file: `${tag}-wrapper-head.js`,
          title: `${tag} — IIFE wrapper head (not a statement, not sliced)`,
          desc: `Lines 1-${headEnd}. The opening \`(function(){...})();\` wrapper line${/["']use strict["']/.test(lines.slice(0, headEnd).join("\n")) ? " plus the script's `\"use strict\";` directive prologue (directives are not statements of the body's statement list)" : ""} — indexed only, never sliced.`,
        });
      for (const s of nonStandalone.keys())
        specials.push({
          kind: "skip",
          file: `${tag}-guard-${lineOf(pretty, s.node.start)}.js`,
          title: `${tag} — early-return guard at line ${s.startLine} (not standalone)`,
          desc: `Lines ${s.startLine}-${s.endLine} guard statement (the section owns the adjoining blank/comment lines up to the next slice). A body-level \`return\` guard clause — a bare \`return\` is illegal outside a function, so this statement cannot stand alone; it is indexed (with its exact range) and never sliced. Statements like it precede every early exit in the script.`,
        });
      if (tailStart <= lines.length)
        specials.push({
          kind: "skip",
          file: `${tag}-wrapper-tail.js`,
          title: `${tag} — IIFE wrapper tail (not a statement, not sliced)`,
          desc: `Lines ${tailStart}-${lines.length}. The closing \`})();\` line of the IIFE — not a statement of its body; indexed only, never sliced.`,
        });

      const runs = [];
      {
        let run = null;
        for (const s of stmts) {
          if (nonStandalone.has(s)) {
            run = null;
            continue;
          }
          if (!run) {
            run = [];
            runs.push(run);
          }
          run.push(s);
        }
      }
      const slices = [];
      for (const run of runs) for (const w of windowize(run)) slices.push(w);

      // blocks in line order, then re-tile so every line of the pretty is owned
      const blocks = [
        ...specials.map((s, idx) => {
          if (s.kind !== "skip") return s;
          // wrapper head is always lines 1..headEnd; wrapper tail tailStart..EOF;
          // guard sections get their statement's own range, fixed below
          return s;
        }),
        ...slices.map((w) => ({ kind: "slice", A: w.startLine, B: w.endLine, count: w.count })),
      ];
      // assign ranges for skip blocks
      const guardRange = new Map();
      for (const s of nonStandalone.keys()) guardRange.set(s, { A: s.startLine, B: s.endLine });
      let gi = 0;
      const guardStmts = [...nonStandalone.keys()];
      for (const s of specials) {
        if (s.file.endsWith("-wrapper-head.js")) {
          s.A = 1;
          s.B = headEnd;
        } else if (s.file.endsWith("-wrapper-tail.js")) {
          s.A = tailStart;
          s.B = lines.length;
        } else {
          const st = guardStmts[gi++];
          const r = guardRange.get(st);
          s.A = r.A;
          s.B = r.B;
        }
      }
      blocks.sort((a, b) => a.A - b.A);
      for (let i = 0; i < blocks.length; i++) {
        if (i === 0) blocks[i].A = 1;
        if (i + 1 < blocks.length) blocks[i].B = blocks[i + 1].A - 1;
        else blocks[i].B = lines.length;
      }
      for (const b of blocks)
        if (b.B < b.A) throw new Error(`${rel}: block ${b.file || b.kind} has inverted range ${b.A}-${b.B}`);

      let nn = 0;
      let perFileSkipped = 0;
      for (const b of blocks) {
        if (b.kind === "slice") {
          nn++;
          const num = String(nn).padStart(2, "0");
          const bodyText = lines.slice(b.A - 1, b.B).join("\n") + "\n";
          const { word, ms } = topWordOf(bodyText, tag);
          const oversized = b.count === 1 && b.B - b.A + 1 > MAX_WINDOW;
          const singleDecl = b.count === 1 && !oversized && b.B - b.A + 1 > 100;
          const file = `${tag}-${num}.js`;
          const sliceText =
            `// ${tag} ${num} — ${word}\n` +
            `// Lines ${b.A}-${b.B} of readable/${prettyFile} (statement-aligned).\n` +
            bodyText;
          const chk = parses(sliceText);
          if (!chk.ok) throw new Error(`generated src/${file} does not parse standalone: ${chk.why}`);
          fs.writeFileSync(path.join(srcDir, file), sliceText);
          written.src.add(file);
          sections.push({
            file,
            title: `${tag} ${num} — ${word}`,
            desc: `${oversized ? "Oversized single declaration (kept whole). " : singleDecl ? "Single huge declaration (kept whole — e.g. a GLSL shader source). " : ""}Lines ${b.A}-${b.B}. Markers: ${markerText(ms)}.`,
            startLine: b.A,
            endLine: b.B,
            sourceFile: `readable/${prettyFile}`,
          });
        } else {
          perFileSkipped++;
          sections.push({
            file: b.file,
            skipped: true,
            title: b.title,
            desc: b.desc,
            startLine: b.A,
            endLine: b.B,
            sourceFile: `readable/${prettyFile}`,
            firstLine: lines[b.A - 1],
            lastLine: lines[b.B - 1],
          });
        }
      }
      slicedTotal += nn;
      skippedTotal += perFileSkipped;
      rangedTotal += nn;
      sources.push({
        sourceFile: `readable/${prettyFile}`,
        capture: rel,
        captureKind: `inline-${b.kind}`,
        captureByteStart: b.contentStart,
        captureByteEnd: b.contentEnd,
        captureSha256: b.sha256,
        captureBytes: b.bytes,
        prettyLines: lines.length,
        prettyBytes: prettyBuf.length,
        prettySha256: sha256(prettyBuf),
        prettyPasses: 1,
        idempotent: true,
        tag,
        slices: nn,
        slicedFrom: "IIFE body (the script is a single top-level IIFE; its body's statements are the sliceable units)",
        derived:
          `readable + ${nn} statement-aligned slice(s)` +
          (perFileSkipped ? ` + ${perFileSkipped} skipped section(s)` : ""),
      });
      console.log(
        `derive: ${rel} inline script #${b.block} -> readable/${prettyFile} (${lines.length} lines, ${nn} slices, ${perFileSkipped} skipped)`,
      );
    }
  }

  // ── 2) non-code payloads: recorded by hash, never rendered ──────────────
  for (const rel of payloadRels) {
    const buf = captureBytes(rel);
    const ext = path.extname(rel).slice(1).toLowerCase();
    const kind = /^(jpe?g|png|gif|webp|avif|svg)$/.test(ext) ? "image" : ext || "binary";
    const why =
      kind === "image"
        ? "image payload referenced by the entry document (og:image social-preview JPEG) but never fetched at runtime — recorded by hash + size, no render pass"
        : "binary payload — recorded by hash + size, no render pass";
    notRendered.push({
      capture: rel,
      kind,
      bytes: buf.length,
      sha256: sha256(buf),
      rendered: false,
      reason: why,
    });
    sources.push({
      sourceFile: null,
      capture: rel,
      captureKind: "payload",
      captureSha256: sha256(buf),
      captureBytes: buf.length,
      tag: tagOf(rel),
      slices: 0,
      derived: "notRendered (hashed payload)",
    });
    console.log(`derive: ${rel} -> notRendered (${buf.length} B, ${kind})`);
  }

  // ── 3) readable/index-inline-map.json (inline twins, byte ranges) ───────
  const inlineMapPath = path.join(readableDir, "index-inline-map.json");
  if (inlineMapBlocks.length) {
    fs.writeFileSync(
      inlineMapPath,
      JSON.stringify(
        {
          generated: TODAY,
          capture: "seedworld/index.html",
          note:
            "Every inline <script>/<style> content block in the captured entry document, with its byte range and sha256 inside the capture (the readable twin is rendered from exactly those bytes by tools/derive.mjs; tools/audit.js re-verifies the ranges).",
          blocks: inlineMapBlocks,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`derive: readable/index-inline-map.json (${inlineMapBlocks.length} inline block(s))`);
  } else if (fs.existsSync(inlineMapPath)) {
    fs.rmSync(inlineMapPath);
    console.log("derive: removed stale readable/index-inline-map.json (capture has no inline blocks)");
  }

  // ── 4) prune orphan derived files (capture untouched) ──────────────────
  let pruned = 0;
  for (const [dir, keep, exts] of [
    [readableDir, written.readable, /\.(pretty\.js|pretty\.css)$/],
    [srcDir, written.src, /\.js$/],
  ]) {
    for (const f of fs.readdirSync(dir)) {
      if (exts.test(f) && !keep.has(f)) {
        fs.rmSync(path.join(dir, f));
        pruned++;
        console.log(`derive: pruned orphan derived file ${path.join(path.basename(dir), f)}`);
      }
    }
  }

  // ── 5) split-spec.json (2-space indent + trailing newline) ─────────────
  const spec = {
    project: "seedworld",
    kind: "statement-aligned-slices",
    slicingContext:
      "the game is a single inline <script> that is one top-level IIFE — slices descend one level into the IIFE body and cut at ITS top-level statement boundaries; the wrapper head/tail and the two early-return guard statements (not standalone) are skipped sections",
    defaultFile: `src/${sections.find((s) => !s.wholeFile && !s.skipped).file}`,
    note:
      "SEEDWORLD (https://openbench.fun/seedworld/) is capture-class: a single-document WebGL game on the " +
      "Openbench platform served under the /seedworld/ sub-path — the entire game (raw WebGL renderer, GLSL " +
      "shaders, 2D-canvas solar system, GPU texture baker, in-browser ZIP encoder) lives in one inline <script> " +
      "block of seedworld/index.html, and the whole UI stylesheet in one inline <style> block; no captured .js " +
      "or .css file exists and the only external <link> is Google Fonts CSS, a CDN dependency that stays CDN " +
      "(PLAN §1, socker precedent — never backfilled). §0.4 fork-over-mirror was checked on 2026-10-13 — no " +
      "public upstream repo exists (openbench.fun publishes deployments, not sources), so the mirror stands. " +
      "Derived pipeline: capture → pinned prettier 3.9.6 (module API, default options, single pass verified " +
      "idempotent — never the CLI: it respects .gitignore and can silently echo its input) → readable/: the " +
      "inline script to index-inline-1.pretty.js and the inline stylesheet to index-inline-1.pretty.css " +
      "(capture-root-relative twin names with the seedworld/ prefix stripped; every pretty provably NOT " +
      "byte-identical to its capture source) → " +
      "statement-aligned slices src/index-inline-1-NN.js cut at the IIFE body's top-level statement " +
      "boundaries (~250-350 line windows; oversized single declarations stay whole) with an exact 2-line " +
      "provenance header. Every slice parses standalone under `node --input-type=module --check -` and " +
      "round-trips byte-exact to its recorded readable line range. Non-standalone parts are skipped sections, " +
      "indexed but never sliced: the IIFE wrapper head (the `(function(){` line plus the `\"use strict\";` " +
      "directive prologue) and tail (`})();`), and the two early-return " +
      "guard statements (`if(!gl){…return;}` / `if(!prog){…return;}` — a bare `return` is illegal outside a " +
      "function). Stylesheet rule — the inline <style> block is wholeFile, never sliced. The entry script is " +
      "authored source, NOT minified — identifiers are the game's own names, so the identifier-rename campaign " +
      "(PLAN §5) does not apply to this mirror. Capture bytes are untouched by everything above; re-cut with " +
      "`node tools/derive.mjs` after any capture refresh. `node tools/audit.js` is the gate.",
    renderOptions: {
      _default:
        "prettier 3.9.6, module API, default options, single pass (re-format verified idempotent at derive time) — never the CLI: it respects .gitignore and can silently echo its input",
      js: "parser babel, no plugins (inline <script> blocks)",
      css: "parser css, no plugins (inline <style> blocks)",
      json: "parser json, no plugins (inline importmap blocks, if any)",
    },
    source:
      `readable/: 1 JS pretty (the inline game script, ${slicedTotal} statement-aligned slices) + 1 CSS pretty ` +
      `(inline stylesheet, wholeFile) + readable/index-inline-map.json; src/: ${slicedTotal} slices; ` +
      `${sections.filter((s) => s.skipped).length} skipped section(s); ` +
      `${sections.filter((s) => s.wholeFile).length} wholeFile section(s); ` +
      `${notRendered.length} notRendered payload(s); capture: ${captured.length} file(s) under .upstream/manifest.json; ` +
      `inline scan: ${inlineFiles.join(", ")}.`,
    inline: {
      scanned: inlineFiles,
      contentBlocks: inlineMapBlocks.length,
      note:
        "the captured entry document carries exactly one inline <style> block and one inline <script> block " +
        "(plus zero external script references; the only external stylesheet is the Google Fonts CDN <link>) — " +
        "the twins live in readable/ and readable/index-inline-map.json records their byte ranges + sha256",
    },
    external: [
      {
        dep: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
        kind: "stylesheet",
        note: "Google Fonts CSS — CDN dependency that stays CDN (PLAN §1, socker precedent): never backfilled into the capture, never re-hosted",
      },
      {
        dep: "https://fonts.gstatic.com/s/…/*.woff2 (4 files: Instrument Serif ×2, Figtree, JetBrains Mono)",
        kind: "font",
        note: "font binaries fetched by the Google Fonts CSS at runtime — stay external with their stylesheet",
      },
      {
        dep: "POST https://openbench.fun/api/hit?p=seedworld&… + GET https://openbench.fun/api/stats",
        kind: "platform-analytics",
        note: "Openbench platform visit counter called once per session by a trailing try/catch block; dynamic POST/GET endpoints, not static files — documented gap, not captured",
      },
      {
        dep: "https://static.cloudflareinsights.com/beacon.min.js/<rotating> + POST /cdn-cgi/rum",
        kind: "platform-infra",
        note: "Cloudflare insights beacon injected into browser-served HTML only (absent from a plain fetch) + CF RUM — infrastructure, not game code",
      },
    ],
    sources,
    sections,
    notRendered,
  };
  fs.writeFileSync(path.join(proj, "split-spec.json"), JSON.stringify(spec, null, 2) + "\n");

  // ── 6) self-check (tools/audit.js is the authoritative gate) ───────────
  let bad = 0;
  const bySource = new Map();
  for (const s of sections) {
    if (!bySource.has(s.sourceFile)) bySource.set(s.sourceFile, []);
    bySource.get(s.sourceFile).push(s);
  }
  for (const [sourceFile, list] of bySource) {
    const lines = readLines(path.join(proj, sourceFile));
    const sorted = [...list].sort((a, b) => a.startLine - b.startLine);
    if (sorted[0].startLine !== 1) {
      console.error(`TILING FAIL ${sourceFile}: starts at line ${sorted[0].startLine}`);
      bad++;
    }
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i].startLine !== sorted[i - 1].endLine + 1) {
        console.error(`TILING FAIL ${sourceFile}: gap/overlap at ${sorted[i].file}`);
        bad++;
      }
    if (sorted[sorted.length - 1].endLine !== lines.length) {
      console.error(`TILING FAIL ${sourceFile}: does not reach EOF (${lines.length})`);
      bad++;
    }
  }
  let parsed = 0;
  let ranged = 0;
  let roundOK = 0;
  for (const s of sections) {
    if (s.wholeFile || s.skipped) continue;
    ranged++;
    const abs = path.join(srcDir, s.file);
    const text = fs.readFileSync(abs, "utf8");
    const nl2 = text.indexOf("\n", text.indexOf("\n") + 1);
    const body = text.slice(nl2 + 1);
    const expected = readLines(path.join(proj, s.sourceFile)).slice(s.startLine - 1, s.endLine).join("\n") + "\n";
    if (body !== expected) {
      console.error(`ROUND-TRIP FAIL ${s.file}`);
      bad++;
    } else roundOK++;
    if (!parses(text).ok) {
      console.error(`PARSE FAIL src/${s.file}`);
      bad++;
    } else parsed++;
  }
  let prettyParsed = 0;
  for (const s of sources) {
    if (!s.sourceFile?.endsWith(".pretty.js")) continue;
    if (!parses(fs.readFileSync(path.join(proj, s.sourceFile), "utf8")).ok) {
      console.error(`PARSE FAIL ${s.sourceFile}`);
      bad++;
    } else prettyParsed++;
  }
  console.log(
    `derive: ${written.readable.size} readable file(s), ${written.src.size} src slices ` +
      `(${parsed}/${ranged} parse standalone, ${roundOK}/${ranged} round-trip byte-exact), ` +
      `${skippedTotal} skipped, ${sections.filter((s) => s.wholeFile).length} wholeFile, ` +
      `${prettyParsed} pretty js parse clean, ${notRendered.length} notRendered, ${pruned} orphan(s) pruned — ` +
      `self-check ${bad ? bad + " FAILURE(S)" : "clean"}`,
  );
  if (bad) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
