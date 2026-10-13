// index-inline-1 11 — math
// Lines 2474-2793 of readable/index-inline-1.pretty.js (statement-aligned).
  async function hiShotRun(W_, H_) {
    const T = Math.min(1024, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      T,
      T,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    const okf =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!okf) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      throw new Error("render target");
    }
    const img = new ImageData(W_, H_),
      buf = new Uint8Array(T * T * 4);
    const cam = camMat(S.yaw, S.pitch),
      az = P.sunAz * D2R,
      el = P.sunEl * D2R,
      sun = [
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az),
      ];
    const nx = Math.ceil(W_ / T),
      ny = Math.ceil(H_ / T);
    let n = 0;
    try {
      for (let ty = 0; ty < ny; ty++)
        for (let tx = 0; tx < nx; tx++) {
          const x0 = tx * T,
            y0 = ty * T,
            tw = Math.min(T, W_ - x0),
            th = Math.min(T, H_ - y0);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.disable(gl.BLEND);
          gl.viewport(0, 0, tw, th);
          drawPlanetView(
            P,
            W,
            cam,
            [W_, H_],
            [-x0, -y0],
            false,
            S.dist,
            S.rot,
            S.crot,
            sun,
            S.moonA,
          );
          gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, canvas.width, canvas.height);
          for (let r = 0; r < th; r++) {
            const dst = ((H_ - 1 - (y0 + r)) * W_ + x0) * 4;
            img.data.set(buf.subarray(r * tw * 4, (r + 1) * tw * 4), dst);
          }
          n++;
          $("rec").title = "";
          progress2(n / (nx * ny));
          await tick();
        }
    } finally {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
    }
    const cv = document.createElement("canvas");
    cv.width = W_;
    cv.height = H_;
    cv.getContext("2d").putImageData(img, 0, 0);
    return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
  }
  function progress2(f) {
    $("shot").textContent =
      f >= 1 ? "Screenshot" : "Rendering " + Math.round(f * 100) + "%";
  }
  let shotBusy = false;
  async function hiShot(w, h) {
    if (shotBusy) return;
    shotBusy = true;
    $("shot").disabled = true;
    try {
      const run = () => hiShotRun(w, h);
      const pr = chain.then(run, run);
      chain = pr.catch(() => {});
      const blob = await pr;
      if (blob)
        saveBlob(blob, slug() + "-" + W.seed + "-" + w + "x" + h + ".png");
    } catch (e) {
      console.error(e);
      S.snap = true;
    }
    shotBusy = false;
    $("shot").disabled = false;
    $("shot").textContent = "Screenshot";
  }
  let rec = null;
  const MIMES = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const recMime = window.MediaRecorder
    ? MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || ""
    : null;
  if (recMime === null) $("rec").hidden = true;
  function recName() {
    return (
      (mode === "system" && SYS
        ? "system-" + SYS.seed
        : slug() + "-" + W.seed) +
      "-" +
      (recMime.indexOf("mp4") >= 0 ? "video.mp4" : "video.webm")
    );
  }
  function toggleRec() {
    if (recMime === null) return;
    if (rec) {
      rec.mr.stop();
      return;
    }
    const fmt = $("rec-fmt").value,
      g = recGeom(fmt);
    const cv = document.createElement("canvas");
    cv.width = g.ow;
    cv.height = g.oh;
    const stream = cv.captureStream(60);
    let mr;
    try {
      mr = new MediaRecorder(
        stream,
        recMime
          ? { mimeType: recMime, videoBitsPerSecond: 14e6 }
          : { videoBitsPerSecond: 14e6 },
      );
    } catch (e) {
      console.error(e);
      return;
    }
    const chunks = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const name = recName();
    mr.onstop = () => {
      const mt = mr.mimeType || recMime || "video/webm";
      saveBlob(
        new Blob(chunks, { type: mt }),
        name.replace(
          /\.(mp4|webm)$/,
          mt.indexOf("mp4") >= 0 ? ".mp4" : ".webm",
        ),
      );
      rec = null;
      $("rec").classList.remove("on");
      $("rec").textContent = "Record video";
      $("rectag").hidden = true;
    };
    rec = {
      mr,
      cv,
      ctx: cv.getContext("2d"),
      fmt,
      ow: g.ow,
      oh: g.oh,
      t0: performance.now(),
    };
    mr.start(500);
    $("rec").classList.add("on");
    $("rectag").hidden = false;
  }
  function recTick(now) {
    if (!rec) return;
    const g = recGeom(rec.fmt);
    compose(rec.ctx, rec.ow, rec.oh, g.crop);
    const t = Math.floor((now - rec.t0) / 1000),
      txt = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    $("rec").textContent = "Stop " + txt;
    $("rectime").textContent = "REC " + txt;
    if (t >= 180) rec.mr.stop();
  }

  function layoutShift() {
    if (S.film || rec || window.__manual) return [0, 0];
    const cr = canvas.getBoundingClientRect(),
      pr = $("panel").getBoundingClientRect(),
      hr = document.querySelector(".hud").getBoundingClientRect();
    const Wc = cr.width,
      Hc = cr.height,
      open = $("panel").classList.contains("open");
    let cx = Wc / 2,
      cy = Hc / 2;
    if (Wc <= 700) {
      const top = Math.max(0, hr.bottom - cr.top) + 6,
        bot = pr.top - cr.top - 8;
      if (bot > top + 80) cy = (top + bot) / 2;
    } else if (open) {
      cx = (pr.right - cr.left + 30 + Wc) / 2;
    }
    return [(cx - Wc / 2) / Hc, (Hc / 2 - cy) / Hc];
  }
  function renderNow() {
    resize();
    if (mode === "system" && SYS) drawSystem();
    else drawPlanet(0);
  }
  function frame(now) {
    if (window.__manual) return;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    ema = ema * 0.92 + dt * 1000 * 0.08;
    if (!(forced > 0) && --cool <= 0) {
      if (ema > 26 && scale > 0.5) {
        scale *= 0.85;
        cool = 40;
      } else if (ema < 15 && scale < maxScale) {
        scale = Math.min(maxScale, scale * 1.08);
        cool = 60;
      }
    }
    resize();
    {
      const sh = layoutShift(),
        k = Math.min(1, dt * 6);
      S.shx += (sh[0] - S.shx) * k;
      S.shy += (sh[1] - S.shy) * k;
    }
    if (!ptrs.size && mode === "system") {
      S.sysYaw += S.svy;
      if (S.sysEl != null) S.sysEl = clamp(S.sysEl + S.svp, -1.5, 1.5);
      S.svy *= 0.92;
      S.svp *= 0.92;
    }
    if (!ptrs.size) {
      S.yaw += S.vy;
      S.pitch = clamp(S.pitch + S.vp, -1.3, 1.3);
      S.vy *= 0.92;
      S.vp *= 0.92;
    }
    if (S.distTarget) {
      S.dist += (S.distTarget - S.dist) * Math.min(1, dt * 3);
      if (Math.abs(S.distTarget - S.dist) < 0.01) S.distTarget = null;
    }
    if (S.film && mode === "planet") {
      S.yaw += dt * 0.06;
      const base = baseDist(P.rings || P.moon);
      S.dist += (base + Math.sin(now * 0.00015) * 0.25 - S.dist) * dt * 0.4;
      S.pitch += (0.22 - S.pitch) * dt * 0.3;
    }
    if (!S.paused) {
      S.rot += dt * 0.12 * P.spin;
      S.crot += dt * 0.135 * P.spin;
      S.time += dt;
      S.moonA += dt * 0.05;
    }
    if (mode === "system" && SYS) drawSystem();
    else drawPlanet(now);
    if (S.snap) {
      S.snap = false;
      const g = recGeom("screen");
      const cv = document.createElement("canvas");
      cv.width = g.ow;
      cv.height = g.oh;
      compose(cv.getContext("2d"), g.ow, g.oh, g.crop);
      cv.toBlob((bl) => {
        if (bl)
          saveBlob(
            bl,
            (mode === "system" && SYS
              ? "system-" + SYS.seed
              : slug() + "-" + W.seed) + "-view.png",
          );
      }, "image/png");
    }
    recTick(now);
    requestAnimationFrame(frame);
  }

  /* ================= texture export ================= */
  const MAXTEX = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const HLO = 0.15,
    HSPAN = 1.2;
  const slug = () =>
    (W.name || "planet").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

