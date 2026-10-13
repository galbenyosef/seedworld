// index-inline-1 12 — data
// Lines 2794-3138 of readable/index-inline-1.pretty.js (statement-aligned).
  async function bake(mode, w, h, onProg, opt) {
    opt = opt || {};
    const T = Math.max(8, Math.min(h, Math.floor(524288 / w)));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
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
    const ok =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      throw new Error(
        "This graphics card could not allocate a " +
          w +
          " px wide render target.",
      );
    }
    const out = new Uint8Array(w * h * 4),
      buf = new Uint8Array(w * T * 4);
    const oct = octForBake(w);
    let n = 0;
    try {
      for (let row0 = 0; row0 < h; row0 += T) {
        const th = Math.min(T, h - row0);
        gl.useProgram(bakeProg);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, w, th);
        pushShared(UB, oct, 0);
        gl.uniform2f(UB.uSize, w, h);
        gl.uniform1f(UB.uRow0, row0);
        gl.uniform1f(UB.uMode, mode);
        gl.uniform1f(UB.uStrength, opt.strength || 0.15);
        gl.uniform1f(UB.uFlip, opt.flip || 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, w, th, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(prog);
        gl.viewport(0, 0, canvas.width, canvas.height);
        for (let k = 0; k < th; k++) {
          const dst = (h - 1 - (row0 + k)) * w * 4;
          out.set(buf.subarray(k * w * 4, (k + 1) * w * 4), dst);
        }
        if (onProg && ++n % 3 === 0) {
          onProg(Math.min(1, (row0 + th) / h));
          await tick();
        }
      }
    } finally {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
    }
    return out;
  }
  let chain = Promise.resolve();
  function bakeQ(mode, w, h, onProg, opt) {
    const run = () => bake(mode, w, h, onProg, opt);
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }

  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  async function deflate(u8) {
    const cs = new CompressionStream("deflate");
    const wr = cs.writable.getWriter();
    wr.write(u8);
    wr.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  function pngChunk(type, data) {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }
  async function encodePNG(w, h, depth, ctype, pix) {
    const bpp = (ctype === 2 ? 3 : 1) * (depth / 8),
      stride = w * bpp;
    const raw = new Uint8Array((stride + 1) * h);
    for (let y = 0; y < h; y++) {
      const s = y * stride,
        d = y * (stride + 1);
      raw[d] = 1;
      for (let x = 0; x < stride; x++)
        raw[d + 1 + x] = (pix[s + x] - (x >= bpp ? pix[s + x - bpp] : 0)) & 255;
    }
    const z = await deflate(raw);
    const ih = new Uint8Array(13);
    const dv = new DataView(ih.buffer);
    dv.setUint32(0, w);
    dv.setUint32(4, h);
    ih[8] = depth;
    ih[9] = ctype;
    const parts = [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", ih),
      pngChunk("IDAT", z),
      pngChunk("IEND", new Uint8Array(0)),
    ];
    let len = 0;
    parts.forEach((p) => (len += p.length));
    const res = new Uint8Array(len);
    let o = 0;
    parts.forEach((p) => {
      res.set(p, o);
      o += p.length;
    });
    return res;
  }
  async function encodeMap(m, data, w, h) {
    const n = w * h;
    if (m.kind === "rgb") {
      const px = new Uint8Array(n * 3);
      for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += 3) {
        px[k] = data[j];
        px[k + 1] = data[j + 1];
        px[k + 2] = data[j + 2];
      }
      return encodePNG(w, h, 8, 2, px);
    }
    if (m.kind === "h16") {
      const px = new Uint8Array(n * 2);
      for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += 2) {
        px[k] = data[j];
        px[k + 1] = data[j + 1];
      }
      return encodePNG(w, h, 16, 0, px);
    }
    const px = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) px[i] = data[j];
    return encodePNG(w, h, 8, 0, px);
  }
  function makeZip(files) {
    const enc = new TextEncoder(),
      parts = [],
      cen = [];
    let off = 0;
    const d = new Date();
    const dtime =
      (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const ddate =
      ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const nb = enc.encode(f.name),
        crc = crc32(f.data);
      const lh = new Uint8Array(30 + nb.length);
      const lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dtime, true);
      lv.setUint16(12, ddate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, f.data.length, true);
      lv.setUint32(22, f.data.length, true);
      lv.setUint16(26, nb.length, true);
      lv.setUint16(28, 0, true);
      lh.set(nb, 30);
      const ch = new Uint8Array(46 + nb.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dtime, true);
      cv.setUint16(14, ddate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, f.data.length, true);
      cv.setUint32(24, f.data.length, true);
      cv.setUint16(28, nb.length, true);
      cv.setUint32(42, off, true);
      ch.set(nb, 46);
      parts.push(lh, f.data);
      cen.push(ch);
      off += lh.length + f.data.length;
    }
    let cl = 0;
    cen.forEach((c) => (cl += c.length));
    const eo = new Uint8Array(22);
    const ev = new DataView(eo.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cl, true);
    ev.setUint32(16, off, true);
    return new Blob([...parts, ...cen, eo], { type: "application/zip" });
  }

  const MAPS = [
    {
      id: "albedo",
      mode: 0,
      kind: "rgb",
      label: "Albedo",
      hint: () => "sRGB colour, no lighting",
    },
    {
      id: "height",
      mode: 1,
      kind: "h16",
      label: "Height",
      hint: () =>
        "16-bit grey, sea level at " +
        Math.round(((P.sea - HLO) / HSPAN) * 100) +
        "%",
    },
    {
      id: "normal",
      mode: 2,
      kind: "rgb",
      label: "Normal",
      hint: () => "tangent space, see format above",
    },
    {
      id: "roughness",
      mode: 3,
      kind: "gray",
      label: "Roughness",
      hint: () => "linear grey, water is smooth",
    },
    {
      id: "clouds",
      mode: 4,
      kind: "gray",
      label: "Clouds",
      hint: () => "linear grey, use as opacity",
    },
    {
      id: "emissive",
      mode: 5,
      kind: "rgb",
      label: "Emissive",
      hint: () => (W.cls.emit > 0 ? "lava glow" : "city lights, night side"),
      cond: () => W.cls.emit > 0 || (P.cities && W.cityAmt > 0),
    },
    {
      id: "ocean",
      mode: 6,
      kind: "gray",
      label: "Ocean mask",
      hint: () => "white is open water",
    },
  ];
  const xsize = () => {
    const w = Math.min(+$("x-size").value, MAXTEX);
    return { w, h: w / 2 };
  };
  const bopt = () => ({
    strength: +$("x-rel").value,
    flip: +$("x-flip").value,
  });
  let busy = false;
  function setBusy(v) {
    busy = v;
    $("x-all").disabled = v;
    document.querySelectorAll(".x-dl").forEach((b) => (b.disabled = v));
  }
  function progress(msg, frac) {
    const bar = $("x-bar");
    $("x-msg").textContent = msg || "";
    if (frac == null) {
      bar.hidden = true;
    } else {
      bar.hidden = false;
      bar.value = frac;
    }
  }
  function fileName(m, w) {
    return slug() + "-" + W.seed + "-" + m.id + "-" + w + ".png";
  }

  function buildCards() {
    const root = $("maps");
    for (const m of MAPS) {
      const fig = document.createElement("figure");
      fig.className = "xcard";
      const cv = document.createElement("canvas");
      cv.width = 512;
      cv.height = 256;
      cv.setAttribute("aria-label", m.label + " map preview");
      const cap = document.createElement("figcaption");
      cap.className = "xcap";
      const tx = document.createElement("div");
      const st = document.createElement("strong");
      st.textContent = m.label;
      const sp = document.createElement("span");
      tx.append(st, sp);
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "x-dl";
      bt.textContent = "PNG";
      bt.addEventListener("click", () => downloadOne(m));
      cap.append(tx, bt);
      fig.append(cv, cap);
      root.appendChild(fig);
      m.card = fig;
      m.canvas = cv;
      m.hintEl = sp;
    }
    if (!bakeProg || !UB) {
      $("export").hidden = true;
    }
  }
