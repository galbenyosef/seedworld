// index-inline-1 03 — attachshader
// Lines 364-376 of readable/index-inline-1.pretty.js (statement-aligned).
  function link(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }
  const prog = link(VIEW_FS);
