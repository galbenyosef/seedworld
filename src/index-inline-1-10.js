// index-inline-1 10 — ctx
// Lines 2149-2473 of readable/index-inline-1.pretty.js (statement-aligned).
  function drawSystem() {
    const Wc = canvas.clientWidth,
      Hc = canvas.clientHeight,
      k = canvas.width / Wc;
    if (bgc.width !== canvas.width || bgc.height !== canvas.height) {
      bgc.width = canvas.width;
      bgc.height = canvas.height;
    }
    const ctx = bgx;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const st = SYS.star,
      sc = st.c.map((v) => Math.round(v * 255));
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, Wc, Hc);
    let g = ctx.createRadialGradient(
      Wc / 2,
      Hc / 2,
      0,
      Wc / 2,
      Hc / 2,
      Math.max(Wc, Hc) * 0.7,
    );
    g.addColorStop(0, "rgba(" + sc + ",.10)");
    g.addColorStop(1, "rgba(" + sc + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Wc, Hc);
    if (!BG) genBG();
    const nc = BG.nebA.map((v) => Math.round(v * 255)),
      nd = BG.nebB.map((v) => Math.round(v * 255));
    for (const bl of BG.blobs) {
      const rr = bl.rad * Math.max(Wc, Hc),
        c = bl.k < 0.5 ? nc : nd;
      g = ctx.createRadialGradient(
        bl.x * Wc,
        bl.y * Hc,
        0,
        bl.x * Wc,
        bl.y * Hc,
        rr,
      );
      g.addColorStop(0, "rgba(" + c + "," + 0.2 * P.neb + ")");
      g.addColorStop(1, "rgba(" + c + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, Wc, Hc);
    }
    const ns = Math.floor(300 * P.stars);
    for (let i = 0; i < ns && i < SYS.stars.length; i++) {
      const s = SYS.stars[i];
      ctx.globalAlpha = s[3];
      ctx.fillStyle = "#fff";
      ctx.fillRect(s[0] * Wc, s[1] * Hc, s[2], s[2]);
    }
    ctx.globalAlpha = 1;
    for (const ga of BG.gal) {
      if (ga.sz <= 0) continue;
      const gx = ga.x * Wc,
        gy = ga.y * Hc,
        gr = ga.sz * Math.max(Wc, Hc) * 2.2,
        tc = ga.t.map((v) => Math.round(v * 255));
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(ga.rot);
      ctx.scale(1, 0.38);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
      g.addColorStop(0, "rgba(255,245,225,.85)");
      g.addColorStop(0.12, "rgba(" + tc + ",.5)");
      g.addColorStop(0.5, "rgba(" + tc + ",.14)");
      g.addColorStop(1, "rgba(" + tc + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, gr, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
    for (const fp of BG.far) {
      if (fp.rad <= 0) continue;
      const fx = fp.x * Wc,
        fy = fp.y * Hc,
        fr = fp.rad * Math.min(Wc, Hc) * 1.1,
        fcc = fp.c.map((v) => Math.round(v * 255));
      g = ctx.createRadialGradient(
        fx - fr * 0.35,
        fy - fr * 0.35,
        fr * 0.1,
        fx,
        fy,
        fr,
      );
      g.addColorStop(0, "rgb(" + fcc + ")");
      g.addColorStop(1, "rgb(" + fcc.map((v) => Math.round(v * 0.12)) + ")");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, 6.2832);
      ctx.fill();
    }
    const cx = Wc / 2 + S.shx * Hc,
      cy = Hc / 2 - S.shy * Hc,
      Z = S.sysZoom,
      mn = Math.min(Wc, Hc);
    const freeW = Wc - 2 * Math.max(0, S.shx * Hc);
    const rxMax = Math.min(freeW * 0.46, Hc * 1.0) * Z,
      el = S.sysEl == null ? sysDefEl() : S.sysEl,
      sE = Math.sin(el),
      tilt = Math.max(Math.abs(sE), 0.05),
      cY = Math.cos(S.sysYaw),
      sY = Math.sin(S.sysYaw);
    const proj = (a, th) => {
      const X = Math.cos(th) * a,
        Z = Math.sin(th) * a;
      return [X * cY + Z * sY, -X * sY + Z * cY];
    };
    const sr0 = mn * 0.045 * st.size * Math.pow(Z, 0.6),
      sr = Math.min(sr0 * 5, mn * 0.17);
    const r0 = sr * 1.5,
      apx = (a) => r0 + ((a - 0.24) / 0.76) * Math.max(rxMax - r0, rxMax * 0.3);
    ctx.lineWidth = 1;
    for (const pl of SYS.planets) {
      ctx.strokeStyle = "rgba(236,231,220,.13)";
      ctx.beginPath();
      const ra = apx(pl.a);
      for (let j = 0; j <= 96; j++) {
        const q = proj(ra, (j / 96) * 6.2832);
        j
          ? ctx.lineTo(cx + q[0], cy + q[1] * sE)
          : ctx.moveTo(cx + q[0], cy + q[1] * sE);
      }
      ctx.stroke();
    }
    for (const [rad, al] of [
      [7, 0.1],
      [4, 0.18],
      [2.2, 0.35],
    ]) {
      g = ctx.createRadialGradient(cx, cy, sr * 0.6, cx, cy, sr * rad);
      g.addColorStop(0, "rgba(" + sc + "," + al + ")");
      g.addColorStop(1, "rgba(" + sc + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, sr * rad, 0, 6.2832);
      ctx.fill();
    }
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.55, "rgb(" + sc + ")");
    g.addColorStop(1, "rgb(" + sc.map((v) => Math.round(v * 0.85)) + ")");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, sr, 0, 6.2832);
    ctx.fill();
    const as = SYS.planets.map((q) => apx(q.a)).sort((x, y) => x - y);
    const capOf = (a) => {
      const v = apx(a),
        i = as.indexOf(v);
      const g = Math.min(
        i > 0 ? v - as[i - 1] : 1e9,
        i < as.length - 1 ? as[i + 1] - v : 1e9,
      );
      return Math.max(14, g * 1.5 * Math.max(tilt, 0.62));
    };
    const items = SYS.planets
      .map((pl, i) => {
        const th = pl.ang + S.time * pl.om * S.orb;
        const ra = apx(pl.a),
          q = proj(ra, th);
        const sn =
          (q[1] / ra) * Math.min(1, Math.abs(sE) / 0.38) * (sE < 0 ? -1 : 1);
        const ps = 1 + 0.18 * sn;
        const d = Math.max(
          12,
          Math.min(
            mn * 0.05 * pl.size * ps * Math.pow(Z, 0.4),
            capOf(pl.a) * ps,
            sr0 * Math.max(1.5, pl.size * 1.1),
          ),
        );
        pl.sx = cx + q[0];
        pl.sy = cy + q[1] * sE;
        pl.dep = q[1] * sE;
        pl.sr = d / 2;
        pl.d = d;
        pl.i = i;
        return pl;
      })
      .sort((a, b) => a.dep - b.dep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const cam = camMat(0, 0.3);
    let sunDone = !sunProg;
    const drawSun = () => {
      sunDone = true;
      gl.useProgram(sunProg);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(sunU.c, cx * k, (Hc - cy) * k);
      gl.uniform1f(sunU.r, sr * k);
      gl.uniform3f(sunU.col, st.c[0], st.c[1], st.c[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    for (const pl of items) {
      if (!sunDone && pl.dep >= 0) drawSun();
      const rg = pl.g.p.rings,
        dd = rg ? 9 : 3.9,
        sz = pl.d / (rg ? 0.384 : 0.9),
        sp = Math.round(sz * k);
      const vx = Math.round((pl.sx - sz / 2) * k),
        vy = Math.round((Hc - pl.sy - sz / 2) * k);
      gl.viewport(vx, vy, sp, sp);
      let dx = cx - pl.sx,
        dy = -(cy - pl.sy);
      const L = Math.hypot(dx, dy) || 1;
      dx /= L;
      dy /= L;
      const v = [dx * 0.93, dy * 0.93, 0.36];
      const sun = [0, 1, 2].map(
        (j) => cam.r[j] * v[0] + cam.u[j] * v[1] + cam.b[j] * v[2],
      );
      const sl = Math.hypot(...sun);
      const sn = sun.map((x) => x / sl);
      const p = pl.g.p,
        w = pl.g.w;
      drawPlanetView(
        p,
        w,
        cam,
        [sp, sp],
        [vx, vy],
        true,
        dd,
        w.rot0 + S.time * 0.12 * p.spin,
        w.rot0 + S.time * 0.135 * p.spin,
        sn,
        0,
      );
    }
    if (!sunDone) drawSun();
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    if (S.labels)
      for (const pl of items) {
        const hov = pl.i === hoverI;
        const ly = pl.sy + pl.sr + 17;
        ctx.fillStyle = hov ? "#ffb877" : "rgba(236,231,220,.92)";
        ctx.font = "600 13px Figtree,system-ui,sans-serif";
        ctx.fillText(pl.name, pl.sx, ly);
        ctx.fillStyle = hov ? "rgba(255,184,119,.9)" : "rgba(154,156,166,.95)";
        ctx.font = '400 10.5px "JetBrains Mono",ui-monospace,monospace';
        ctx.fillText(
          (pl.clsId === "gas"
            ? "gas giant"
            : CLASSES.find((c) => c.id === pl.clsId).name.toLowerCase()) +
            (pl.g.p.rings ? " \u00b7 ringed" : ""),
          pl.sx,
          ly + 14,
        );
      }
  }
  function drawPlanet(now) {
    const cam = camMat(S.yaw, S.pitch);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const az = P.sunAz * D2R,
      el = P.sunEl * D2R;
    drawPlanetView(
      P,
      W,
      cam,
      [canvas.width, canvas.height],
      [0, 0],
      false,
      S.dist,
      S.rot,
      S.crot,
      [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)],
      S.moonA,
      [S.shx, S.shy],
    );
  }

  /* ---------- screenshot and video ---------- */
  function recGeom(fmt) {
    const cw = canvas.width,
      ch = canvas.height;
    let ar = cw / ch;
    if (fmt === "9:16") ar = 9 / 16;
    else if (fmt === "1:1") ar = 1;
    else if (fmt === "1080p" || fmt === "1440p") ar = 16 / 9;
    let w = cw,
      h = ch;
    if (cw / ch > ar) w = Math.round(ch * ar);
    else h = Math.round(cw / ar);
    const crop = {
      x: Math.round((cw - w) / 2),
      y: Math.round((ch - h) / 2),
      w,
      h,
    };
    let ow = w & ~1,
      oh = h & ~1;
    if (fmt === "9:16") {
      ow = 1080;
      oh = 1920;
    } else if (fmt === "1:1") {
      ow = 1080;
      oh = 1080;
    } else if (fmt === "1080p") {
      ow = 1920;
      oh = 1080;
    } else if (fmt === "1440p") {
      ow = 2560;
      oh = 1440;
    }
    return { crop, ow, oh };
  }
  function compose(ctx, ow, oh, crop) {
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, ow, oh);
    if (mode === "system")
      ctx.drawImage(bgc, crop.x, crop.y, crop.w, crop.h, 0, 0, ow, oh);
    ctx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, ow, oh);
  }
