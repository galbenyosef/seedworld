// index-inline-1 09 — math
// Lines 1999-2148 of readable/index-inline-1.pretty.js (statement-aligned).
  function up(e) {
    hashSoon();
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch0 = 0;
    if (mode === "system" && moved < 6 && e.type === "pointerup") {
      const i = hitTest(e);
      if (i >= 0) {
        visit(i);
        return;
      }
    }
    if (S.film && moved < 6) setFilm(false);
  }
  function sysDefEl() {
    const Wc = canvas.clientWidth,
      Hc = canvas.clientHeight;
    return Math.asin(Hc > Wc * 1.2 ? 0.8 : 0.38);
  }
  function hitTest(e) {
    if (!SYS) return -1;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left,
      y = e.clientY - r.top;
    let best = -1,
      bd = 1e9;
    SYS.planets.forEach((pl, i) => {
      const d = Math.hypot(pl.sx - x, pl.sy - y);
      if (d < pl.sr * 1.4 + 10 && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      hashSoon();
      if (mode === "system") {
        S.sysZoom = clamp(S.sysZoom * Math.exp(-e.deltaY * 0.0012), 0.4, 10);
        return;
      }
      S.dist = clamp(S.dist * Math.exp(e.deltaY * 0.0012), 1.25, 60);
      S.distTarget = null;
    },
    { passive: false },
  );

  /* ================= render loop ================= */
  const forced = parseFloat(new URLSearchParams(location.search).get("scale"));
  let scale = forced > 0 ? forced : Math.min(window.devicePixelRatio || 1, 1.5),
    maxScale = scale,
    ema = 16,
    cool = 0,
    visible = true,
    last = performance.now();
  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale)),
      h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }).observe(stage);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  const asp = () =>
    clamp(canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.5, 1);
  const baseDist = (ring) =>
    (ring ? 1.4 : 1) * (asp() < 0.75 ? 5.6 / asp() : 10.4);
  const bgc = $("bg"),
    bgx = bgc.getContext("2d");
  function camMat(yaw, pitch) {
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const b = [sy * cp, sp, cy * cp];
    let r = [b[2], 0, -b[0]];
    const rl = Math.hypot(...r) || 1;
    r = r.map((v) => v / rl);
    const u = [
      b[1] * r[2] - b[2] * r[1],
      b[2] * r[0] - b[0] * r[2],
      b[0] * r[1] - b[1] * r[0],
    ];
    return {
      r,
      u,
      b,
      m: [r[0], r[1], r[2], u[0], u[1], u[2], b[0], b[1], b[2]],
    };
  }
  function drawPlanetView(
    p,
    w,
    cam,
    res,
    orig,
    sys,
    dist,
    rot,
    crot,
    sun,
    moonA,
    shift,
  ) {
    shift = shift || [0, 0];
    gl.useProgram(prog);
    gl.uniform2f(UV.uShift, shift[0], shift[1]);
    pushShared(UV, octForView(dist, p.scale, res[1]), S.time, p, w);
    gl.uniformMatrix3fv(UV.uCam, false, cam.m);
    gl.uniform2f(UV.uRes, res[0], res[1]);
    gl.uniform2f(UV.uOrig, orig[0], orig[1]);
    gl.uniform1f(UV.uSys, sys ? 1 : 0);
    gl.uniform1f(UV.uRot, rot);
    gl.uniform1f(UV.uCloudRot, crot);
    gl.uniform1f(UV.uDist, dist);
    gl.uniform1f(UV.uRelief, p.relief);
    gl.uniform3f(UV.uSun, sun[0], sun[1], sun[2]);
    if (!sys) pushBG();
    gl.uniform1f(UV.uRing, p.rings ? 1 : 0);
    gl.uniform1f(UV.uRingIn, w.ringIn);
    gl.uniform1f(UV.uRingOut, w.ringOut);
    gl.uniform1f(UV.uMoon, p.moon ? 1 : 0);
    if (p.moon)
      gl.uniform3f(
        UV.uMoonPos,
        3.4 * Math.cos(moonA),
        0.7 * Math.sin(moonA * 0.7),
        3.4 * Math.sin(moonA),
      );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
