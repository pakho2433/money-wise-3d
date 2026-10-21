import * as THREE from './lib/three.module.min.js';

// ---------- basics ----------
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.3 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const FOG_CLEAR = new THREE.Color(0xcfe8f5), FOG_SMOG = new THREE.Color(0x8a8270);
scene.fog = new THREE.Fog(FOG_CLEAR.clone(), 40, 210);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 450);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const hemi = new THREE.HemisphereLight(0xcfeeff, 0x5a7a3a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true; sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
const sc = sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 160;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(0.5, 0.8, 0.35).normalize();
{
  const g = new THREE.SphereGeometry(400, 32, 16);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 sunDir; void main(){ float h = max(vP.y,0.); vec3 c = mix(vec3(.80,.91,.97), vec3(.25,.55,.92), pow(h,.55)); if(vP.y<0.) c=vec3(.75,.86,.9); float s = max(dot(vP,sunDir),0.); c += vec3(1.,.9,.6)*(pow(s,600.)*3.+pow(s,8.)*.25); gl_FragColor = vec4(c,1.); }` });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -1; scene.add(sky); window._sky = sky;
}

// ---------- world (money-wise) ----------
const Z = { home: [0, 0], shop: [0, -27] };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function groundH() { return 0; }
const groundGeo = new THREE.PlaneGeometry(240, 240, 60, 60); groundGeo.rotateX(-Math.PI / 2);
{ const p = groundGeo.attributes.position, cols = []; const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); c.set(0x63a83f); const n = Math.sin(x * .7) * Math.sin(z * .6) * .05; c.offsetHSL(0, 0, n); if (Math.abs(x) < 3.2 && z < -5 && z > -22) c.set(0x8d8f93); if (Math.abs(z + 14) < 3.5) c.set(0x55585e); cols.push(c.r, c.g, c.b); }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); }
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.receiveShadow = true; scene.add(ground);

// ---------- helpers ----------
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r1, r2, h, s = 12, hs = 1, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, hs, open);
const texCache = {};
function labelTex(text, bg = 'rgba(20,40,60,0.85)', fg = '#fff') {
  const key = text + bg + fg; if (texCache[key]) return texCache[key];
  const w = 512, cv = document.createElement('canvas'); cv.width = w; cv.height = 128; const g = cv.getContext('2d');
  g.font = `bold 60px "PingFang HK","Noto Sans CJK TC","Noto Serif CJK TC","Microsoft JhengHei",sans-serif`;
  const tw = Math.min(w - 8, g.measureText(text).width + 50);
  g.fillStyle = bg; const x0 = (w - tw) / 2; g.beginPath(); g.roundRect ? g.roundRect(x0, 14, tw, 100, 40) : g.rect(x0, 14, tw, 100); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 66, w - 40);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texCache[key] = t; return t;
}
function label(text, x, y, z, s = 1, bg, fg, parent = scene) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, bg || undefined, fg || undefined), depthWrite: false }));
  sp.scale.set(4 * s, 1 * s, 1); sp.position.set(x, y, z); parent.add(sp); return sp;
}
const G = (x, z) => groundH(x, z);
const dotTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
function particles(n, color, size, opts = {}) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mat = new THREE.PointsMaterial({ color, size, map: dotTex, transparent: true, opacity: opts.opacity ?? 0.8, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  pts.userData.seed = new Float32Array(n).map(() => Math.random()); return pts;
}
const rand = (a, b) => a + Math.random() * (b - a);
// ---------- player & input ----------
const player = { pos: new THREE.Vector3(0, 1.6, 9), yaw: 0, pitch: -0.05 };
const keys = {}; let started = false, paused = true;
addEventListener('keydown', e => { keys[e.code] = true; if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) { e.preventDefault(); action(); } });
addEventListener('keyup', e => keys[e.code] = false);
const cv = renderer.domElement;
cv.addEventListener('mousedown', e => { if (isTouch || paused) return; if (document.pointerLockElement !== cv) cv.requestPointerLock?.(); else action(); });
addEventListener('mousemove', e => { if (document.pointerLockElement === cv) { player.yaw -= e.movementX * 0.0024; player.pitch = Math.max(-1.3, Math.min(1.2, player.pitch - e.movementY * 0.0024)); } });
const joy = { id: null, x: 0, y: 0 }, look = { id: null, lx: 0, ly: 0 };
const joyEl = $('joy'), knob = $('knob');
if (isTouch) { joyEl.style.display = 'block'; $('act').style.display = 'block'; }
const inModal = e => e.target.closest && e.target.closest('.modal');
function updJoy(t) { const r = joyEl.getBoundingClientRect(); let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2); const L = Math.hypot(dx, dy), mx = r.width / 2; if (L > mx) { dx *= mx / L; dy *= mx / L; } joy.x = dx / mx; joy.y = dy / mx; knob.style.transform = `translate(${dx}px,${dy}px)`; }
document.addEventListener('touchstart', e => {
  if (inModal(e)) return; e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.4 && joy.id === null) { joy.id = t.identifier; updJoy(t); }
    else if (look.id === null) { look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY; }
  }
}, { passive: false });
document.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) updJoy(t);
    else if (t.identifier === look.id) { player.yaw -= (t.clientX - look.lx) * 0.006; player.pitch = Math.max(-1.3, Math.min(1.2, player.pitch - (t.clientY - look.ly) * 0.005)); look.lx = t.clientX; look.ly = t.clientY; }
  }
}, { passive: false });
function onTE(e) { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } if (t.identifier === look.id) look.id = null; } }
document.addEventListener('touchend', onTE); document.addEventListener('touchcancel', onTE);
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
function fastBtn(el, fn) { el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); el.addEventListener('click', e => { e.stopPropagation(); fn(); }); el.addEventListener('mousedown', e => e.stopPropagation()); }
fastBtn($('act'), () => action());
fastBtn($('tp'), () => teleportToTask());

// ---------- interaction system ----------
const inter = [], slots = [];
let carried = null, focus = null;
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffe36e })); ring.rotation.x = -Math.PI / 2; scene.add(ring); ring.visible = false;
function addPickup(obj, name, kind, task, extra = {}) { const it = { type: 'pickup', obj, name, kind, task, ...extra }; inter.push(it); return it; }
function addSwitch(obj, name, task, onUse, verb = '使用') { const it = { type: 'switch', obj, name, task, onUse, verb }; inter.push(it); return it; }
function addDispenser(obj, name, task, make) { const it = { type: 'disp', obj, name, task, make }; inter.push(it); return it; }
function addSlot(pos, name, task, accepts, onPlace, opts = {}) {
  const s = { pos: pos.clone(), name, task, accepts, onPlace, multi: !!opts.multi, filled: false, enabled: opts.enabled ?? true, marker: null };
  const mk = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 24), new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  mk.rotation.x = -Math.PI / 2; mk.position.copy(pos); mk.position.y += 0.08; scene.add(mk); s.marker = mk; mk.visible = false;
  slots.push(s); return s;
}
function removeInter(it) { const i = inter.indexOf(it); if (i >= 0) inter.splice(i, 1); }
const tmpV = new THREE.Vector3();
function computeFocus() {
  const t = curTask(); if (!t) return null;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let best = null, bs = -1e9;
  const list = carried ? slots.filter(s => s.task === t.id && s.enabled && (!s.filled || s.multi) && s.reach !== 0).map(s => ({ s, p: s.pos })) : inter.filter(i => i.task === t.id && !i.done).map(i => ({ i, p: i.obj.getWorldPosition(new THREE.Vector3()) }));
  for (const c of list) {
    const dx = c.p.x - player.pos.x, dz = c.p.z - player.pos.z, d = Math.hypot(dx, dz);
    const reach = (c.s && c.s.reach) || (c.i && c.i.reach) || 4.6; if (d > reach) continue;
    const cos = d < 0.6 ? 1 : (dx * fx + dz * fz) / d; if (cos < 0.6) continue;
    const sc = cos * 2 - d * 0.25; if (sc > bs) { bs = sc; best = c; }
  }
  return best;
}
function action() {
  if (paused) return;
  const t = curTask(); if (!t) return;
  if (carried) {
    if (focus && focus.s) {
      const s = focus.s, r = s.accepts(carried);
      if (r === true) placeInSlot(carried, s);
      else { mistakes++; toast(typeof r === 'string' ? r : '這裏不適合放「' + carried.name + '」', 'bad'); sfx(180, 0.25); }
    } else {
      const it = carried; carried = null; const px = player.pos.x - Math.sin(player.yaw) * 1.5, pz = player.pos.z - Math.cos(player.yaw) * 1.5;
      it.obj.position.set(px, Math.max(G(px, pz), -0.3) + 0.05, pz); it.obj.rotation.set(0, 0, 0); it.float = false; inter.push(it); toast('放下了「' + it.name + '」');
    }
    return;
  }
  if (!focus || !focus.i) return;
  const it = focus.i;
  if (it.type === 'pickup') { carried = it; removeInter(it); sfx(520, 0.08); if (it.onPick) it.onPick(); }
  else if (it.type === 'disp') { carried = it.make(); sfx(520, 0.08); }
  else if (it.type === 'switch') it.onUse(it);
  else if (it.type === 'push') pushBlock(it, 1.0);
}
function placeInSlot(it, s) {
  carried = null; sfx(760, 0.12); sfx(990, 0.12, 0.08);
  it.obj.position.copy(s.pos); it.obj.rotation.set(0, 0, 0);
  if (!s.multi) { s.filled = true; s.marker.visible = false; }
  s.onPlace(it, s); addScore(10);
}
function addPush(obj, name, task, slotList) { const it = { type: 'push', obj, name, task, slotList, reach: 3.2 }; inter.push(it); return it; }
function pushBlock(it, amt, dirx, dirz) {
  if (it.done) return;
  if (dirx === undefined) { const dx = it.obj.position.x - player.pos.x, dz = it.obj.position.z - player.pos.z; if (Math.abs(dx) > Math.abs(dz)) { dirx = Math.sign(dx); dirz = 0; } else { dirx = 0; dirz = Math.sign(dz); } }
  const p = it.obj.position; p.x += dirx * amt; p.z += dirz * amt;
  p.y = G(p.x, p.z) + 0.12;
  for (const s of it.slotList) if (!s.filled && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < 1.0) { p.copy(s.pos); s.filled = true; s.marker.visible = false; it.done = true; removeInter(it); s.onPlace(it, s); addScore(10); sfx(760, 0.12); sfx(990, 0.12, 0.08); break; }
}

// ---------- audio ----------
let actx = null;
function sfx(f, d, delay = 0) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; o.type = 'triangle'; g.gain.setValueAtTime(0.15, actx.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + delay + d); o.connect(g).connect(actx.destination); o.start(actx.currentTime + delay); o.stop(actx.currentTime + delay + d + 0.02); } catch (e) { } }

// ---------- HUD ----------
let score = 0, mistakes = 0, toastT = 0;
function addScore(n) { score += n; $('score').textContent = score; }
function toast(msg, cls = 'good', time = 2.8) { const el = $('toast'); el.innerHTML = msg; el.className = 'panel ' + cls; el.style.display = 'block'; toastT = time; }
function showModal(html, btn, cb) {
  const m = $('modal'); $('card').innerHTML = html + `<button class="go">${btn}</button>`; m.style.display = 'flex'; paused = true; document.exitPointerLock?.();
  joy.id = look.id = null; joy.x = joy.y = 0; knob.style.transform = '';
  const go = $('card').querySelector('.go'); let used = false; const f = e => { e.preventDefault(); e.stopPropagation(); if (used) return; used = true; m.style.display = 'none'; paused = false; cb && cb(); if (!isTouch && !window.__test) cv.requestPointerLock?.(); };
  go.addEventListener('touchstart', f, { passive: false }); go.addEventListener('click', f);
}

// ---------- item factory ----------
function item(build, name, labelBg) { const g = new THREE.Group(); build(g); const lb = label(name || ' ', 0, 1.25, 0, 0.55, labelBg, null, g); lb.visible = !!name; g.userData.label = lb; scene.add(g); return g; }
const S = {
  bottle: g => { mesh(C(0.13, 0.13, 0.55), M(0x6fc6ff, { transparent: true, opacity: 0.75, roughness: 0.1 }), 0, 0.3, 0, g); mesh(C(0.06, 0.06, 0.1), M(0x1a5fd0), 0, 0.62, 0, g); },
  chair: g => { const w = M(0xa8743f); mesh(B(0.6, 0.08, 0.6), w, 0, 0.45, 0, g); mesh(B(0.6, 0.6, 0.08), w, 0, 0.78, -0.26, g); for (const [x, z] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) mesh(B(0.07, 0.45, 0.07), w, x, 0.22, z, g); },
  sweater: g => { const w = M(0xe8d8b8, { roughness: 1 }); mesh(B(0.6, 0.6, 0.18), w, 0, 0.35, 0, g); mesh(B(1.05, 0.16, 0.16), w, 0, 0.58, 0, g); },
  cheese: g => { const m = mesh(C(0.35, 0.35, 0.25, 3), M(0xffcf3a), 0, 0.15, 0, g); m.rotation.y = 0.5; },
  coal: g => { for (let i = 0; i < 5; i++) mesh(new THREE.DodecahedronGeometry(0.18, 0), M(0x1c1c1c, { roughness: 0.6 }), rand(-.2, .2), 0.18 + (i > 2 ? 0.2 : 0), rand(-.2, .2), g); },
  barrel: g => { mesh(C(0.28, 0.28, 0.7, 14), M(0x223344, { metalness: 0.5, roughness: 0.4 }), 0, 0.36, 0, g); mesh(C(0.29, 0.29, 0.06, 14), M(0xd23b2b), 0, 0.5, 0, g); },
  paper: g => { for (let i = 0; i < 5; i++) mesh(B(0.5, 0.03, 0.7), M(0xf6f3ea), rand(-.02, .02), 0.05 + i * 0.035, 0, g); },
  egg: g => { mesh(new THREE.SphereGeometry(0.15, 10, 8), M(0xf3e2c4), 0, 0.2, 0, g).scale.y = 1.3; mesh(new THREE.SphereGeometry(0.15, 10, 8), M(0xf3e2c4), 0.25, 0.2, 0, g).scale.y = 1.3; },
  rubbish: c => g => { const m = mesh(c === 'bag' ? new THREE.IcosahedronGeometry(0.3, 0) : C(0.1, 0.1, 0.45, 8), M(c === 'bag' ? 0xf2f2f2 : c === 'can' ? 0xd23b2b : 0x5ac8fa, { roughness: 0.5 }), 0, 0.15, 0, g); m.rotation.z = Math.PI / 2; },
  sapling: g => { mesh(C(0.25, 0.2, 0.25), M(0x8a5a3a), 0, 0.12, 0, g); mesh(C(0.04, 0.05, 0.6, 5), M(0x6b4a2b), 0, 0.5, 0, g); mesh(new THREE.IcosahedronGeometry(0.28, 0), M(0x4caf50), 0, 0.85, 0, g); },
  fruitTree: g => { mesh(C(0.25, 0.2, 0.25), M(0x8a5a3a), 0, 0.12, 0, g); mesh(C(0.05, 0.06, 0.6, 5), M(0x6b4a2b), 0, 0.5, 0, g); mesh(new THREE.IcosahedronGeometry(0.35, 0), M(0x3f9a3a), 0, 0.9, 0, g); for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.07, 6, 4), M(0xff7a1a), Math.cos(i * 1.6) * 0.3, 0.85 + (i % 2) * 0.15, Math.sin(i * 1.6) * 0.3, g, false); },
  shrub: g => { mesh(new THREE.IcosahedronGeometry(0.35, 0), M(0x7a9a3a), 0, 0.3, 0, g); mesh(new THREE.IcosahedronGeometry(0.25, 0), M(0x8ab04a), 0.25, 0.25, 0.1, g); },
  crop: g => { for (let i = 0; i < 6; i++) mesh(C(0.02, 0.03, 0.8, 4), M(0xd8c050), rand(-.15, .15), 0.4, rand(-.15, .15), g, false); mesh(C(0.2, 0.2, 0.1, 8), M(0xb08a40), 0, 0.4, 0, g); },
  pipe: g => { mesh(C(0.45, 0.45, 2.2, 14, 1, true), M(0x9aa4ac, { metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }), 0, 0.5, 0, g).rotation.x = Math.PI / 2; mesh(C(0.47, 0.47, 0.25, 14), M(0x2f6fd0), 0, 0.5, 0, g).rotation.x = Math.PI / 2; },
  valve: g => { mesh(C(0.5, 0.5, 0.2, 16), M(0x3a7a5a, { metalness: .4 }), 0, 0.5, 0, g).rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), M(0xd23b2b), 0, 0.5, 0.15, g); },
  turbine: g => { mesh(C(0.08, 0.14, 2.2, 8), M(0xf2f2f2), 0, 1.1, 0, g); const h = new THREE.Group(); h.position.set(0, 2.2, 0.15); g.add(h); for (let i = 0; i < 3; i++) { const pv = new THREE.Group(); pv.rotation.z = i * 2.094; h.add(pv); mesh(B(0.12, 1.1, 0.04), M(0xffffff), 0, 0.55, 0, pv); } g.userData.hub = h; },
  solar: g => { mesh(C(0.05, 0.05, 0.6, 6), M(0x888888), 0, 0.3, 0, g); mesh(B(1.2, 0.05, 0.8), M(0x1d3c8a, { metalness: 0.6, roughness: 0.2 }), 0, 0.65, 0, g).rotation.x = -0.5; },
  hydro: g => { mesh(B(0.8, 0.6, 0.6), M(0x2f8fd0, { metalness: 0.3 }), 0, 0.3, 0, g); mesh(C(0.3, 0.3, 0.2, 10), M(0xdddddd), 0, 0.3, 0.38, g).rotation.x = Math.PI / 2; },
  gas: g => { mesh(C(0.3, 0.3, 0.8, 12), M(0x4aa3ff, { metalness: 0.3, roughness: 0.3 }), 0, 0.45, 0, g); mesh(new THREE.SphereGeometry(0.3, 12, 6, 0, 6.3, 0, 1.6), M(0x4aa3ff), 0, 0.85, 0, g); },
  plug: g => { mesh(B(0.18, 0.28, 0.12), M(0x2a2a2a), 0, 0.15, 0, g); mesh(B(0.04, 0.1, 0.04), M(0xd9b23a, { metalness: 0.8 }), 0, 0.33, 0, g); },
  box: c => g => { mesh(B(0.5, 0.5, 0.5), M(c), 0, 0.25, 0, g); },
};
function spawn(shape, name, x, z, task, kind, extra = {}) { const o = item(shape, name, extra.labelBg); o.position.set(x, extra.y ?? G(x, z), z); return addPickup(o, name, kind, task, extra); }

// ---------- task framework ----------
const tasks = []; let ti = 0;
const SKIP = new Set();
const active = () => tasks.filter(t => !SKIP.has(t.id));
const curTask = () => tasks[ti];
const nextTi = i => { let j = i + 1; while (j < tasks.length && SKIP.has(j)) j++; return j; };
const effects = [];
function defTask(t) { t.id = tasks.length; t.done = 0; tasks.push(t); return t; }
function progress(t, n = 1) { t.done += n; updateHUD(); if (t.done >= t.total) setTimeout(() => completeTask(t), 1100); }
function completeTask(t) {
  if (t.finished) return; t.finished = true; addScore(30); sfx(660, .15); sfx(880, .15, .12); sfx(1180, .25, .24);
  if (carried) { scene.remove(carried.obj); carried = null; }
  t.onDone && t.onDone(); updateHUD();
  const last = nextTi(t.id) >= tasks.length;
  showModal(`<h1>✅ 完成：${t.title}</h1>${t.lesson}`, last ? '查看成績 🎉' : '下一個任務 ➡', () => { if (last) finale(); else { ti = nextTi(ti); startTask(); } });
}
function startTask() { const t = curTask(); slots.forEach(s => { s.marker.visible = s.task === t.id && s.enabled && (!s.filled || s.multi); }); t.onStart && t.onStart(); updateHUD(); toast('新任務：' + t.title + '<br><small>跟着黃色箭咀前往，或按「傳送到任務」</small>', 'good', 3); }
function updateHUD() {
  const t = curTask(); if (!t) return;
  $('ttitle').textContent = `任務 ${active().indexOf(t) + 1}／${active().length}：${t.title}`; $('tdesc').innerHTML = t.desc + ` <b>(${Math.min(t.done, t.total)}/${t.total})</b>`;
  $('tbar').firstElementChild.style.width = (100 * Math.min(1, t.done / t.total)) + '%';
  $('tcount').textContent = `${active().filter(x => x.finished).length}/${active().length}`;
}
function teleportToTask() { const t = curTask(); if (!t || paused) return; player.pos.set(t.spawn[0], groundH(t.spawn[0], t.spawn[1]) + 1.6, t.spawn[1]); player.yaw = t.spawn[2] ?? 0; player.pitch = -0.2; toast('已傳送到：' + t.zone); }
const beacon = new THREE.Mesh(C(0.5, 0.5, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe36e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false })); scene.add(beacon);
function zoneSign(text, x, z, h = 5) { const y = G(x, z); mesh(C(0.1, 0.1, h, 6), M(0x7a5a3a), x - 1.6, y + h / 2, z); mesh(C(0.1, 0.1, h, 6), M(0x7a5a3a), x + 1.6, y + h / 2, z); label(text, x, y + h, z, 1.3, 'rgba(30,110,60,0.92)'); }
function crateAt(x, z, txt) { const g = new THREE.Group(); g.position.set(x, G(x, z), z); scene.add(g); mesh(B(1.4, 0.8, 1), M(0xa8743f), 0, 0.4, 0, g); mesh(B(1.5, 0.08, 1.1), M(0x7a4a2a), 0, 0.8, 0, g); label(txt, x, g.position.y + 2.3, z, 0.75); return g; }
const boxes = []; // AABB colliders
function wall(x0, x1, z0, z1, h, mat) { const w = x1 - x0, d = z1 - z0; mesh(B(w, h, d), mat, (x0 + x1) / 2, h / 2, (z0 + z1) / 2); boxes.push([x0, x1, z0, z1]); }
function room(cx, cz, W, D, wallC, floorC, doors) { // doors: {s:[gapx], n:[gapx]}
  const wm = M(wallC), x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, h = 3.4, t = 0.3;
  mesh(B(W, 0.12, D), M(floorC, { roughness: 0.6 }), cx, 0.06, cz, scene, false);
  wall(x0 - t, x0, z0, z1, h, wm); wall(x1, x1 + t, z0, z1, h, wm);
  for (const [side, z] of [['n', z0 - t], ['s', z1]]) { const g = doors[side]; if (g === undefined) wall(x0 - t, x1 + t, z, z + t, h, wm); else { wall(x0 - t, cx + g - 1.4, z, z + t, h, wm); wall(cx + g + 1.4, x1 + t, z, z + t, h, wm); mesh(B(2.8, 0.8, t), wm, cx + g, h - 0.4, z + t / 2); } }
  mesh(B(W + 0.8, 0.25, D + 0.8), M(0x9a5a3a), cx, h + 0.1, cz - D / 2 - 0.2, scene, true).scale.z = 0.08; // roof trim
}
// scenery
{
  const d = new THREE.Object3D(), col = new THREE.Color(); const pts = [];
  for (let i = 0; i < 600 && pts.length < 110; i++) { const x = rand(-90, 90), z = rand(-90, 60); if (Math.abs(x) < 22 && z > -45 && z < 20) continue; pts.push([x, z]); }
  const trunk = new THREE.InstancedMesh(C(0.15, 0.25, 1.6, 6), M(0x6b4a2b), pts.length), crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5, 0), M(0xffffff), pts.length);
  pts.forEach(([x, z], i) => { const s = rand(.9, 1.6); d.position.set(x, .8 * s, z); d.scale.setScalar(s); d.rotation.set(0, rand(0, 6), 0); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix); d.position.y = 2.5 * s; d.updateMatrix(); crown.setMatrixAt(i, d.matrix); col.setHSL(.28 + rand(-.04, .04), .5, rand(.28, .4)); crown.setColorAt(i, col); });
  for (const m of [trunk, crown]) { m.castShadow = true; scene.add(m); }
  const bi = new THREE.InstancedMesh(B(1, 1, 1), M(0xffffff), 26);
  for (let i = 0; i < 26; i++) { const h = rand(14, 40), a = i / 26 * Math.PI * 2, r = rand(70, 95); d.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r - 15); d.scale.set(rand(8, 12), h, rand(8, 12)); d.rotation.set(0, a, 0); d.updateMatrix(); bi.setMatrixAt(i, d.matrix); col.setHSL(rand(0, 1), .2, rand(.65, .85)); bi.setColorAt(i, col); }
  bi.castShadow = true; scene.add(bi);
  const cl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf4f8ff, fog: false }), 40);
  for (let i = 0; i < 40; i++) { d.position.set(rand(-200, 200), rand(80, 100), rand(-200, 200)); d.scale.set(rand(6, 12), rand(2.5, 4), rand(5, 9)); d.updateMatrix(); cl.setMatrixAt(i, d.matrix); } scene.add(cl);
  // road markings + street lamps
  for (let i = 0; i < 12; i++) mesh(B(2, 0.02, 0.2), M(0xffffff), -55 + i * 10, 0.02, -14, scene, false);
}
function setLbl(sp, text, bg) { sp.material.map = labelTex(text, bg); sp.material.needsUpdate = true; }
const moneyS = (v) => g => { if (v >= 10 && v !== 10) { mesh(B(0.62, 0.02, 0.32), M(v === 20 ? 0x3a7ad0 : v === 50 ? 0x3aa060 : 0xd04040), 0, 0.12, 0, g); mesh(B(0.62, 0.02, 0.32), M(0xeeeeee), 0.02, 0.15, 0.02, g).scale.set(0.3, 1, 0.5); } else mesh(C(0.16, 0.16, 0.05, 16), M(0xd8c060, { metalness: .7, roughness: .3 }), 0, 0.1, 0, g); };

// ===== 1. 家中的金錢從哪裏來 =====
{
  const [cx, cz] = Z.home; room(cx, cz, 18, 12, 0xf3e6cf, 0xc49a6c, { s: 0, n: 0 });
  label('🏠 志富的家', cx, 4.6, cz + 6.2, 1.3, 'rgba(180,90,30,0.92)');
  // furniture
  mesh(B(3, 0.8, 1), M(0x4a6a9a), cx + 5.5, 0.5, cz + 4.6); mesh(B(3, 0.9, 0.3), M(0x3a5a8a), cx + 5.5, 1.1, cz + 5.1);
  mesh(B(2.4, 1.4, 0.15), M(0x111111, { roughness: .2 }), cx + 5.5, 1.6, cz - 5.6); const tvScr = mesh(B(2.2, 1.2, 0.05), M(0x2a5aa0, { emissive: 0x4a8ae0 }), cx + 5.5, 1.6, cz - 5.5, scene, false);
  mesh(B(2.2, 0.08, 1.4), M(0x8a5a3a), cx, 0.85, cz + 1); for (const [x, z] of [[-1, .6], [1, .6], [-1, -.6], [1, -.6]]) mesh(B(0.08, 0.8, 0.08), M(0x6a4a2a), cx + x, 0.42, cz + 1 + z);
  mesh(B(4, 1, 1), M(0xdddddd), cx - 6.4, 0.5, cz - 5.2); mesh(B(4, 0.08, 1.05), M(0x777777), cx - 6.4, 1.02, cz - 5.2);
  const fridge = mesh(B(1.1, 2.2, 1), M(0xe8f0f4, { metalness: .3, roughness: .3 }), cx - 8.2 + 0.6, 1.1, cz - 2.8);
  const lamp = new THREE.PointLight(0xffe0a0, 6, 12); lamp.position.set(cx, 3, cz); scene.add(lamp);
  const bulb = mesh(new THREE.SphereGeometry(0.2, 10, 8), M(0xfff0c0, { emissive: 0xffe080 }), cx, 3.1, cz, scene, false);
  const t = defTask({ zone: '志富的家', title: '家中的金錢從哪裏來', total: 5, spawn: [cx, cz + 4.5, 0],
    desc: '爸爸媽媽<b>辛勤工作</b>賺錢養家。① 到<b>工資信封</b>拿錢，交到 3 個<span class=hl>家庭開支</span>：租金、食物、水電費　② <b>珍惜金錢</b>：關掉長開的<span class=hl>水龍頭</span>和沒人看的<span class=hl>電視</span>。',
    lesson: `<p>家中的金錢是<b>爸爸媽媽工作賺取</b>的，得來不易！</p><p>家庭要支付很多開支：🏠 <b>租金</b>、🍚 <b>食物</b>（物價不斷上漲）、💡 <b>水電費</b>……</p><p>我們要<b>珍惜金錢、不浪費</b>：隨手關水龍頭、關電器，就能幫家人節省開支。</p>` });
  const env = new THREE.Group(); env.position.set(cx, 0.9, cz + 1); scene.add(env); mesh(B(0.7, 0.05, 0.45), M(0xd8a040), 0, 0.03, 0, env); label('爸媽的工資信封（拿錢）', cx, 2.3, cz + 1, 0.8, 'rgba(30,110,60,0.92)');
  label('爸爸媽媽辛勤工作賺錢 💼', cx - 4, 3.0, cz + 5.7, 1.0, 'rgba(60,60,140,0.9)');
  addDispenser(env, '工資', t.id, () => ({ type: 'pickup', obj: item(moneyS(500), '家用錢'), name: '家用錢', kind: 'cash', task: t.id }));
  [['🏠 租金', cx - 8.0, cz + 2.5, 0xb04a2a], ['🍚 食物', cx - 6.4, cz - 4.4, 0xe08a20], ['💡 水電費', cx + 8.0, cz + 1.0, 0x2a7ad0]].forEach(([n, x, z, c]) => {
    const lb = label(n + '：未付', x + (x < 0 ? 0.6 : -0.6), 2.4, z, 0.7, 'rgba(160,40,30,0.9)');
    mesh(B(0.6, 0.6, 0.6), M(c), x + (x < 0 ? 0.5 : -0.5), 1.3, z);
    addSlot(new THREE.Vector3(x + (x < 0 ? 0.9 : -0.9), 1.0, z), n, t.id, it => it.kind === 'cash' ? true : '要用錢支付', (it, s) => { it.obj.visible = false; setLbl(lb, n + '：已付 ✔', 'rgba(30,140,60,0.9)'); progress(t); toast(n + ' 已支付！'); }).reach = 3.5;
  });
  const tap = new THREE.Group(); tap.position.set(cx - 5.2, 1.05, cz - 5.3); scene.add(tap); mesh(C(0.05, 0.05, 0.5, 6), M(0xcccccc, { metalness: .8 }), 0, 0.25, 0, tap);
  const water = mesh(C(0.04, 0.04, 0.5, 6), M(0x6ac8ff, { transparent: true, opacity: .7, emissive: 0x2060a0 }), 0.12, 0.25, 0, tap, false);
  const tl = label('水龍頭長開 💧', cx - 5.2, 2.2, cz - 5.0, 0.6, 'rgba(160,40,30,0.9)');
  addSwitch(tap, '長開的水龍頭', t.id, it => { it.done = true; water.visible = false; setLbl(tl, '已關水 ✔', 'rgba(30,140,60,0.9)'); progress(t); toast('節約用水，珍惜金錢！'); }, '關掉');
  const tvl = label('電視沒人看 📺', cx + 5.5, 2.8, cz - 5.2, 0.6, 'rgba(160,40,30,0.9)');
  addSwitch(tvScr, '沒人看的電視', t.id, it => { it.done = true; tvScr.material.color.set(0x050505); tvScr.material.emissive.set(0); setLbl(tvl, '已關電視 ✔', 'rgba(30,140,60,0.9)'); progress(t); toast('節約用電，減少電費！'); }, '關掉');
  effects.push((dt, T) => { if (water.visible) water.scale.y = 1 + Math.sin(T * 30) * 0.05; });
}

// ===== 2. 管理金錢：分配零用錢 =====
{
  const cx = -4, cz = -3.2;
  mesh(B(4.6, 0.1, 1.4), M(0xb0804a), cx, 0.85, cz); mesh(B(4.6, 0.8, 0.1), M(0x8a6040), cx, 0.42, cz - 0.6);
  const t = defTask({ zone: '志富的書桌', title: '分配 $100 零用錢', total: 7, spawn: [cx, cz + 3.6, 0],
    desc: '媽媽給志富 <b>$100</b> 零用錢！把桌上的錢逐張逐個<b>拿起</b>，按計劃放進：<span class=hl>儲蓄 $50、消費 $40、捐款 $10</span>。記住：<b>先儲蓄，後消費</b>！',
    lesson: `<p>管理零用錢：把錢分成<b>儲蓄、消費、捐款</b>三部分。</p><p>✔ <b>先儲蓄，後消費</b>：拿到錢先存起來，餘下的才用。</p><p>✔ <b>量入為出</b>：按收入多少來決定支出，不可花得比收入多。</p><p>✔ 捐款幫助有需要的人 ❤️</p>` });
  const plan = { save: 50, spend: 40, give: 10 }, got = { save: 0, spend: 0, give: 0 };
  const names = { save: '🐷 儲蓄', spend: '👛 消費', give: '❤️ 捐款' };
  const lbls = {};
  [['save', cx - 1.7, 0xff8aa8], ['spend', cx, 0x8a5ad0], ['give', cx + 1.7, 0xe04a4a]].forEach(([k, x, c]) => {
    const g = new THREE.Group(); g.position.set(x, 0.9, -3.0); scene.add(g);
    if (k === 'save') { mesh(new THREE.SphereGeometry(0.38, 16, 12), M(c), 0, 0.35, 0, g).scale.set(1.2, 1, 1); mesh(B(0.2, 0.03, 0.04), M(0x333333), 0, 0.73, 0, g); }
    else mesh(B(0.8, 0.55, 0.6), M(c), 0, 0.28, 0, g);
    lbls[k] = label(`${names[k]} $0/$${plan[k]}`, x, 2.4, -3.0, 0.62, 'rgba(40,40,80,0.9)');
    addSlot(new THREE.Vector3(x, 1.0, -2.7), names[k], t.id, it => {
      if (k !== 'save' && got.save < plan.save) return '記住<b>先儲蓄，後消費</b>！<br>先把 $50 放進儲蓄錢箱。';
      if (got[k] + it.v > plan[k]) return `${names[k]} 只需要 $${plan[k]}，放這 $${it.v} 會超出計劃！<br>量入為出，按計劃分配。`;
      return true;
    }, it => { it.obj.visible = false; got[k] += it.v; setLbl(lbls[k], `${names[k]} $${got[k]}/$${plan[k]}${got[k] === plan[k] ? ' ✔' : ''}`, got[k] === plan[k] ? 'rgba(30,140,60,0.9)' : 'rgba(40,40,80,0.9)'); g.scale.setScalar(1.15); setTimeout(() => g.scale.setScalar(1), 200); progress(t); }, { multi: true }).reach = 3.2;
  });
  label('零用錢 $100', cx, 2.2, cz + 0.2, 0.6);
  [20, 20, 10, 20, 10, 10, 10].forEach((v, i) => spawn(moneyS(v), '$' + v, cx - 1.9 + i * 0.63, cz + 0.25, t.id, 'money', { y: 0.9, v }));
}

// ===== 3. 善用金錢：文具店 =====
{
  const [cx, cz] = Z.shop; room(cx, cz, 16, 10, 0xd8eef0, 0xe8e0d0, { s: 0 });
  label('✏️ 文具店', cx, 4.6, cz + 5.2, 1.3, 'rgba(30,110,160,0.92)');
  const l2 = new THREE.PointLight(0xffffff, 6, 14); l2.position.set(cx, 3, cz); scene.add(l2);
  const t = defTask({ zone: '文具店', title: '勤儉節約．精明購物', total: 4, spawn: [cx, cz + 3.6, 0],
    desc: '① 志富的鉛筆短了：拿<b>筆套（鉛筆延長器）</b>套在<span class=hl>短鉛筆</span>上，繼續使用　② 按<b>購物清單</b>（鉛筆、擦膠、筆記簿），<b>比較價錢</b>，每樣選<b>較便宜</b>的放進購物籃，總數不超過 <b>$12</b>！',
    lesson: `<p>✔ <b>勤儉節約</b>：用筆套延長短鉛筆，物盡其用。</p><p>✔ 購物前寫<b>購物清單</b>、定好<b>預算</b>，只買<b>需要</b>的東西，不買「想要」的玩具。</p><p>✔ <b>比較價錢</b>：同樣用途，選較便宜的，就能用 $10 買齊 3 樣，還省下 $2！</p>` });
  // counter, shelves
  mesh(B(4, 1, 1.2), M(0xa86a3a), cx - 4, 0.5, cz + 1.5); mesh(B(4.2, 0.08, 1.3), M(0x7a4a2a), cx - 4, 1.02, cz + 1.5);
  mesh(B(9, 2.6, 0.6), M(0xf0f0f0), cx + 2, 1.3, cz - 4.4); for (const y of [0.95, 1.65]) mesh(B(9, 0.06, 0.8), M(0xbbbbbb), cx + 2, y, cz - 4.1);
  const pen = new THREE.Group(); pen.position.set(cx - 5, 1.06, cz + 1.5); scene.add(pen); mesh(C(0.04, 0.04, 0.25, 6), M(0xf0c020), 0, 0.04, 0, pen).rotation.z = Math.PI / 2; mesh(new THREE.ConeGeometry(0.04, 0.08, 6), M(0xe8c8a0), -0.16, 0.04, 0, pen).rotation.z = Math.PI / 2;
  label('志富的短鉛筆', cx - 5, 2.0, cz + 1.5, 0.55);
  spawn(g => { mesh(C(0.05, 0.05, 0.45, 8), M(0xb0b8c0, { metalness: .8, roughness: .3 }), 0, 0.06, 0, g).rotation.z = Math.PI / 2; }, '筆套（延長器）', cx - 3, cz + 1.5, t.id, 'ext', { y: 1.06 });
  addSlot(new THREE.Vector3(cx - 4.85, 1.06, cz + 1.5), '短鉛筆', t.id, it => it.kind === 'ext' ? true : '這不是筆套', it => { it.obj.position.x = cx - 4.7; it.obj.userData.label.visible = false; pen.scale.set(1.6, 1, 1); progress(t); toast('短鉛筆變長了，可以繼續用！✏️'); }).reach = 3.5;
  // basket
  let spent = 0; const bought = {};
  const bk = new THREE.Group(); bk.position.set(cx - 1, 1.02, cz + 1.5); mesh(C(0.45, 0.35, 0.4, 12, 1, true), M(0x2fa84f, { side: THREE.DoubleSide }), 0, 0.2, 0, bk); scene.add(bk);
  mesh(B(1.4, 1, 1.2), M(0xa86a3a), cx - 1, 0.5, cz + 1.5);
  const bl = label('🛒 購物籃 $0／預算 $12', cx - 1, 2.3, cz + 1.5, 0.75, 'rgba(30,110,60,0.92)');
  const listSign = label('📝 清單：鉛筆、擦膠、筆記簿', cx + 2, 3.3, cz - 4.0, 1.0, 'rgba(160,90,20,0.92)');
  const goods = [['鉛筆', 2, 'pencil', 0xf0c020], ['卡通鉛筆', 5, 'pencil', 0xff70b0], ['擦膠', 3, 'eraser', 0xffffff], ['香味擦膠', 6, 'eraser', 0x90e0ff], ['筆記簿', 5, 'note', 0x3a7ad0], ['精裝筆記簿', 9, 'note', 0x8a3ad0], ['玩具車', 8, 'toy', 0xe03030]];
  const cheap = { pencil: 2, eraser: 3, note: 5 };
  goods.forEach(([n, p, k, c], i) => spawn(g => mesh(k === 'pencil' ? B(0.5, 0.06, 0.06) : k === 'note' ? B(0.4, 0.06, 0.5) : k === 'toy' ? B(0.5, 0.25, 0.3) : B(0.25, 0.12, 0.15), M(c), 0, 0.08, 0, g), `${n} $${p}`, cx - 2 + i * 1.25, cz - 4.0, t.id, k, { y: i % 2 ? 1.68 : 0.98, price: p, labelBg: 'rgba(60,60,60,0.85)' }));
  addSlot(new THREE.Vector3(cx - 1, 1.1, cz + 1.5), '購物籃', t.id, it => {
    if (it.kind === 'toy') return '玩具車是「想要」，不是清單上「需要」的東西！';
    if (bought[it.kind]) return '這樣東西已經買了，不用買兩件。';
    if (it.price > cheap[it.kind]) return `比較一下價錢：有更便宜的${{ pencil: '鉛筆', eraser: '擦膠', note: '筆記簿' }[it.kind]}，用途一樣！<br>選這個總數可能超出 $12 預算。`;
    return true;
  }, it => { it.obj.visible = false; bought[it.kind] = 1; spent += it.price; setLbl(bl, `🛒 購物籃 $${spent}／預算 $12`, 'rgba(30,110,60,0.92)'); progress(t); }, { multi: true }).reach = 3.5;
}

// ---------- finale ----------
const fireworks = particles(500, 0xffffff, 0.9, { opacity: 1 }); fireworks.visible = false;
function finale() {
  fireworks.visible = true; player.pos.set(0, 1.6, 10); player.yaw = 0; player.pitch = 0.35;
  const stars = mistakes <= 3 ? '⭐⭐⭐' : mistakes <= 8 ? '⭐⭐' : '⭐';
  showModal(`<h1>🎉 志富成為理財小達人！</h1><p style="font-size:34px;text-align:center;margin:0">${stars}</p><p style="text-align:center">總分：<b>${score}</b>　　放錯／提示：${mistakes} 次</p><h3>你學會了：</h3><ul><li>家中金錢由<b>父母工作賺取</b>，要<b>珍惜金錢、不浪費</b></li><li>零用錢分成<b>儲蓄、消費、捐款</b>；<b>先儲蓄後消費、量入為出</b></li><li><b>勤儉節約</b>；按<b>購物清單</b>和<b>預算</b>購物，<b>比較價錢</b></li></ul><p>（試玩版：更多任務即將推出！）</p>`, '欣賞煙花 🎆', () => { $('ttitle').textContent = '🎉 全部任務完成！'; $('tdesc').innerHTML = `總分 ${score}　按 F5 可重新開始`; });
  sfx(523, .2); sfx(659, .2, .2); sfx(784, .2, .4); sfx(1046, .5, .6);
}
effects.push((dt, T) => { if (!fireworks.visible) return; const p = fireworks.geometry.attributes.position, sd = fireworks.userData.seed; for (let i = 0; i < sd.length; i++) { const burst = i % 8, f = (T * 0.4 + burst * 0.13) % 1, a = sd[i] * 6.283, b = (i * 0.37) % 3.14; const bx = -35 + burst * 10, by = 22 + (burst % 3) * 7, bz = -40; const r = f * 11; p.setXYZ(i, bx + Math.cos(a) * Math.sin(b) * r, by + Math.cos(b) * r - f * f * 5, bz + Math.sin(a) * Math.sin(b) * r); } p.needsUpdate = true; fireworks.material.color.setHSL((T * 0.2) % 1, 1, 0.65); });

// ---------- main loop ----------
const clock = new THREE.Clock(); let T = 0;
const colliders = [];
const wp = new THREE.Vector3(), carryOff = new THREE.Vector3();
function update(dt) {
  T += dt;
  if (!paused) {
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    mx += joy.x; mz += joy.y;
    const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
    const sp = (keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.95) ? 10 : 6;
    const sy = Math.sin(player.yaw), cyw = Math.cos(player.yaw);
    const vx = (mx * cyw + mz * sy) * sp, vz = (-mx * sy + mz * cyw) * sp;
    let nx = player.pos.x + vx * dt, nz = player.pos.z + vz * dt;
    for (const [x, z, r] of colliders) { const dx = nx - x, dz = nz - z, d = Math.hypot(dx, dz) || 1e-3; if (d < r + 0.4) { nx = x + dx / d * (r + 0.4); nz = z + dz / d * (r + 0.4); } }
    const hit = (x, z) => boxes.some(b => x > b[0] - .35 && x < b[1] + .35 && z > b[2] - .35 && z < b[3] + .35); if (hit(nx, player.pos.z)) nx = player.pos.x; if (hit(nx, nz)) nz = player.pos.z;
    nx = Math.max(-110, Math.min(110, nx)); nz = Math.max(-80, Math.min(60, nz));
    const t = curTask();
    for (const it of inter) if (it.type === 'push' && it.task === t.id && !it.done) {
      const bp = it.obj.position, dx = bp.x - nx, dz = bp.z - nz, d = Math.hypot(dx, dz);
      if (d < 1.7 && (vx * dx + vz * dz) > 0) { if (Math.abs(dx) > Math.abs(dz)) pushBlock(it, Math.abs(vx) * dt, Math.sign(dx), 0); else pushBlock(it, Math.abs(vz) * dt, 0, Math.sign(dz)); if (!it.done && Math.hypot(bp.x - nx, bp.z - nz) < 1.6) { nx = player.pos.x; nz = player.pos.z; } }
    }
    player.pos.x = nx; player.pos.z = nz;
        player.pos.y = 0 + 1.6 + (L > 0.1 ? Math.sin(T * 9) * 0.04 : 0);
  }
  camera.position.copy(player.pos); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  sun.position.copy(player.pos).addScaledVector(SUN_DIR, 60); sun.target.position.copy(player.pos); window._sky.position.copy(player.pos);
  if (carried) { carryOff.set(0.45, -0.55, -1.3).applyEuler(camera.rotation); carried.obj.position.copy(camera.position).add(carryOff); carried.obj.rotation.set(0, player.yaw, 0); }
  focus = paused ? null : computeFocus();
  const pr = $('prompt');
  if (focus) {
    const p = focus.s ? focus.s.pos : focus.i.obj.getWorldPosition(wp); ring.visible = true; ring.position.set(p.x, (focus.s ? p.y : Math.max(G(p.x, p.z), p.y)) + 0.12, p.z); ring.scale.setScalar(1 + Math.sin(T * 6) * 0.1);
    const k = isTouch ? '按「動作」' : '按 E／左鍵';
    pr.textContent = focus.s ? `${k}：把「${carried.name}」放進「${focus.s.name}」` : `${k}：${focus.i.type === 'switch' ? focus.i.verb : focus.i.type === 'push' ? '推動' : '拿起'}「${focus.i.name}」`; pr.style.display = 'block';
  } else { ring.visible = false; if (carried && !paused) { pr.textContent = `正拿着「${carried.name}」— 走到發光圓圈並對準它`; pr.style.display = 'block'; } else pr.style.display = 'none'; }
  for (const s of slots) if (s.marker.visible) s.marker.material.opacity = 0.45 + Math.sin(T * 4) * 0.3;
  for (const e of effects) e(dt, T);
  const t = curTask();
  if (t && !t.finished) {
    const sl = carried && slots.find(s => s.task === t.id && s.enabled && (!s.filled || s.multi) && s.accepts(carried) === true);
    const near = sl || inter.find(i => i.task === t.id && !i.done) || slots.find(s => s.task === t.id && s.enabled && !s.filled);
    const bp = near ? (near.pos || near.obj.getWorldPosition(wp)) : { x: t.spawn[0], z: t.spawn[1] };
    beacon.visible = !paused; beacon.position.set(bp.x, G(bp.x, bp.z) + 20, bp.z);
    const dx = bp.x - player.pos.x, dz = bp.z - player.pos.z; $('arrow').style.transform = `rotate(${Math.atan2(dx, -dz) + player.yaw}rad)`; $('dist').textContent = `${t.zone}　${Math.round(Math.hypot(dx, dz))} 米`;
  } else beacon.visible = false;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.display = 'none'; }
}
function loop() { const dt = Math.min(0.05, clock.getDelta()); update(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
updateHUD(); loop();

function begin(e) { if (e) { e.preventDefault(); } if (started) return; started = true; $('modal').style.display = 'none'; paused = false; startTask(); sfx(440, .1); if (!isTouch && !window.__test) cv.requestPointerLock?.(); }
$('start').addEventListener('click', begin); $('start').addEventListener('touchstart', begin, { passive: false });

// ---------- test hooks ----------
window.game = {
  tasks, slots, inter, player, renderer, scene, ground, groundH, get ti() { return ti; }, get score() { return score; }, get carried() { return carried; }, get focus() { return focus; },
  begin, teleport: teleportToTask, action, look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; }, at(x, z, yaw = 0, pitch = -0.15) { player.pos.set(x, groundH(x, z) + 1.6, z); player.yaw = yaw; player.pitch = pitch; },
  closeModal() { const g = document.querySelector('#card .go'); if (g && $('modal').style.display !== 'none') g.click(); },
  solveCurrent() {
    const t = curTask(); let guard = 0;
    if (carried) { const s0 = slots.find(s => s.task === t.id && s.enabled && (!s.filled || s.multi) && s.accepts(carried) === true); if (s0) placeInSlot(carried, s0); }
    while (t.done < t.total && guard++ < 50) {
      const pend = inter.filter(i => i.task === t.id && !i.done);
      const push = pend.find(i => i.type === 'push'); if (push) { const s = push.slotList.find(s => !s.filled); push.obj.position.set(s.pos.x, s.pos.y, s.pos.z + 0.5); pushBlock(push, 0.1, 0, -1); continue; }
      let did = false;
      for (const it of [...pend.filter(i => i.type === 'pickup'), ...pend.filter(i => i.type === 'disp')]) {
        const obj = it.type === 'disp' ? it.make() : it; const s = slots.find(s => s.task === t.id && s.enabled && (!s.filled || s.multi) && s.accepts(obj) === true);
        if (s) { if (it.type === 'pickup') removeInter(it); if (obj.onPick) obj.onPick(); placeInSlot(obj, s); did = true; break; } else if (it.type === 'disp') scene.remove(obj.obj);
      }
      if (did) continue;
      const sw = pend.find(i => i.type === 'switch'); if (sw) { sw.onUse(sw); continue; }
      break;
    }
  }
};
