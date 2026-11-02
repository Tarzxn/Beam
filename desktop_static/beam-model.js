const viewerEl=html=>{const t=document.createElement('template');t.innerHTML=html;return t.content.firstChild;};
async function mountStl(wrap, url, isGlb=false, headers={}) {
  const response = await fetch(url,{headers});
  if (!response.ok) throw new Error('This model has expired or is unavailable. Generate it again.');
  const buf = await response.arrayBuffer();
  const tris = isGlb ? parseGlb(buf) : parseStl(buf);
  if (tris.count>200000||!tris.pos.every(Number.isFinite)) throw new Error('Invalid or oversized model geometry.');
  if (!tris.count) throw new Error('This STL has no triangles.');
  const canvas = document.createElement('canvas'); wrap.append(canvas);
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) throw new Error('3D view needs WebGL, which is unavailable here.');
  const { pos, nrm, min, max } = tris;
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const radius = Math.hypot(size[0], size[1], size[2]) / 2 || 1;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec3 p;attribute vec3 n;uniform mat4 mvp;uniform mat3 nm;varying vec3 vn;varying float h;void main(){vn=nm*n;h=p.z;gl_Position=mvp*vec4(p,1.0);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec3 vn;varying float h;uniform vec3 col;void main(){vec3 N=normalize(vn);vec3 L=normalize(vec3(-0.45,0.55,0.7));vec3 L2=normalize(vec3(0.6,-0.2,0.4));float d=max(dot(N,L),0.0)*0.7+max(dot(N,L2),0.0)*0.2+0.22;float rim=pow(1.0-max(N.z,0.0),3.0)*0.12;vec3 c=col*d+rim;gl_FragColor=vec4(c,1.0);}'));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buffer = (data, name) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); return b; };
  const normalized = new Float32Array(pos.length); for (let i = 0; i < pos.length; i += 3) { normalized[i] = (pos[i] - center[0]) / radius; normalized[i + 1] = (pos[i + 1] - center[1]) / radius; normalized[i + 2] = (pos[i + 2] - center[2]) / radius; }
  buffer(normalized, 'p'); buffer(nrm, 'n');
  const uMvp = gl.getUniformLocation(prog, 'mvp'), uNm = gl.getUniformLocation(prog, 'nm'), uCol = gl.getUniformLocation(prog, 'col');
  gl.uniform3f(uCol, ...(tris.color||[0.84,0.58,0.40])); gl.enable(gl.DEPTH_TEST);

  const hud = viewerEl(`<div class="stl-hud">${size.map(v => v.toFixed(1)).join(' × ')} mm · ${tris.count.toLocaleString()} triangles · drag to rotate, scroll to zoom</div>`);
  const tools = viewerEl('<div class="stl-tools"><button type="button" data-a="spin">Auto-rotate: on</button><button type="button" data-a="reset">Isometric</button><button type="button" data-a="front">Front</button><button type="button" data-a="right">Right</button><button type="button" data-a="top">Top</button></div>');
  wrap.append(hud, tools);

  let yaw = -0.7, pitch = 0.5, dist = 3.6, spin = true, raf = 0, dead = false, drag = null;
  const dpr = () => Math.min(devicePixelRatio || 1, 2);
  const resize = () => { const w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight); canvas.width = w * dpr(); canvas.height = h * dpr(); gl.viewport(0, 0, canvas.width, canvas.height); };
  const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
  const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const draw = () => {
    if (dead) return; if (spin && !drag) yaw += 0.006;
    const eye = [dist * Math.cos(pitch) * Math.cos(yaw), dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch)];
    const z = norm(eye), x = norm(cross([0, 0, 1], z)), y = cross(z, x);
    const view = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
    const aspect = canvas.width / canvas.height, t = 1 / Math.tan(0.38), n = 0.1, f = 50, nf = 1 / (n - f);
    const proj = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
    gl.uniformMatrix4fv(uMvp, false, mul(proj, view)); gl.uniformMatrix3fv(uNm, false, [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]);
    gl.clearColor(0.09, 0.10, 0.13, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, tris.count * 3); raf = requestAnimationFrame(draw);
  };
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; yaw -= (e.clientX - drag.x) * 0.008; pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - drag.y) * 0.008)); drag = { x: e.clientX, y: e.clientY }; });
  const up = () => { drag = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(1.6, Math.min(9, dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  canvas.addEventListener('dblclick', () => { yaw = -0.7; pitch = 0.5; dist = 3.6; });
  tools.onclick = (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'spin') { spin = !spin; e.target.textContent = `Auto-rotate: ${spin ? 'on' : 'off'}`; } if(['front','right','top'].includes(a)){spin=false;yaw=a==='right'?0:-Math.PI/2;pitch=a==='top'?1.5:0;} if (a === 'reset') { yaw = -0.7; pitch = 0.5; dist = 3.6; } };
  raf = requestAnimationFrame(draw);
  return { dispose() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); gl.getExtension('WEBGL_lose_context')?.loseContext(); } };
}
function parseGlb(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 28 || dv.getUint32(0,true) !== 0x46546c67 || dv.getUint32(4,true) !== 2 || dv.getUint32(8,true) !== buf.byteLength) throw new Error('Invalid GLB file.');
  const size = dv.getUint32(12,true);
  if (size+28 > buf.byteLength) throw new Error('Truncated GLB file.');
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buf,20,size)));
  const base = 28+size, primitive = doc.meshes[0].primitives[0];
  const read = (id,width,type) => {
    const a = doc.accessors[id], view = doc.bufferViews[a.bufferView];
    const offset = base+(view.byteOffset || 0)+(a.byteOffset || 0);
    if (a.componentType !== type || a.count > 600000 || offset+a.count*width*4 > buf.byteLength) throw new Error('Unsupported GLB accessor.');
    return new (type === 5126 ? Float32Array : Uint32Array)(buf,offset,a.count*width);
  };
  const vertices = read(primitive.attributes.POSITION,3,5126), normals = read(primitive.attributes.NORMAL,3,5126), indices = read(primitive.indices,1,5125);
  const count = indices.length/3, pos = new Float32Array(indices.length*3), nrm = new Float32Array(pos.length);
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (let i=0;i<indices.length;i++) {
    const v = indices[i]*3;
    if (v+2 >= vertices.length) throw new Error('GLB index out of range.');
    pos.set([vertices[v]*1000,-vertices[v+2]*1000,vertices[v+1]*1000],i*3);
    nrm.set([normals[v],-normals[v+2],normals[v+1]],i*3);
    for (let k=0;k<3;k++) { min[k]=Math.min(min[k],pos[i*3+k]); max[k]=Math.max(max[k],pos[i*3+k]); }
  }
  return {count,pos,nrm,min,max,color:doc.materials?.[primitive.material||0]?.pbrMetallicRoughness?.baseColorFactor?.slice(0,3)};
}

function parseStl(buf) {
  const dv = new DataView(buf); let count = 0, pos;
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (buf.byteLength >= 84 && buf.byteLength === 84 + 50 * n) {
    count = n; pos = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true); }
  } else { // ASCII fallback
    const text = new TextDecoder().decode(buf), m = [...text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)];
    count = Math.floor(m.length / 3); pos = new Float32Array(count * 9);
    for (let i = 0; i < count * 3; i++) { pos[i * 3] = +m[i][1]; pos[i * 3 + 1] = +m[i][2]; pos[i * 3 + 2] = +m[i][3]; }
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  // face normals, then smooth them across edges flatter than ~38° so curves look round
  const face = new Float32Array(count * 3);
  for (let t = 0; t < count; t++) {
    const o = t * 9, ux = pos[o + 3] - pos[o], uy = pos[o + 4] - pos[o + 1], uz = pos[o + 5] - pos[o + 2], vx = pos[o + 6] - pos[o], vy = pos[o + 7] - pos[o + 1], vz = pos[o + 8] - pos[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; face[t * 3] = nx / l; face[t * 3 + 1] = ny / l; face[t * 3 + 2] = nz / l;
  }
  const keyOf = (i) => `${Math.round(pos[i] * 500)},${Math.round(pos[i + 1] * 500)},${Math.round(pos[i + 2] * 500)}`;
  const adj = new Map();
  for (let c = 0; c < count * 3; c++) { const k = keyOf(c * 3); (adj.get(k) || adj.set(k, []).get(k)).push(c); }
  const nrm = new Float32Array(count * 9), cosT = Math.cos(38 * Math.PI / 180);
  if (count > 120000) { for (let c = 0; c < count * 3; c++) { const t = (c / 3) | 0; nrm.set(face.subarray(t * 3, t * 3 + 3), c * 3); } }
  else for (let c = 0; c < count * 3; c++) {
    const t = (c / 3) | 0, fx = face[t * 3], fy = face[t * 3 + 1], fz = face[t * 3 + 2]; let sx = 0, sy = 0, sz = 0;
    for (const o of adj.get(keyOf(c * 3))) { const u = (o / 3) | 0, ux = face[u * 3], uy = face[u * 3 + 1], uz = face[u * 3 + 2]; if (ux * fx + uy * fy + uz * fz > cosT) { sx += ux; sy += uy; sz += uz; } }
    const l = Math.hypot(sx, sy, sz) || 1; nrm[c * 3] = sx / l; nrm[c * 3 + 1] = sy / l; nrm[c * 3 + 2] = sz / l;
  }
  return { count, pos, nrm, min, max };
}

