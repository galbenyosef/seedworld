// index-inline-1 01 — canvas
// Lines 3-11 of readable/index-inline-1.pretty.js (statement-aligned).
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"),
    canvas = $("c");
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
