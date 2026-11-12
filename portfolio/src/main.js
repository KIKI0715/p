import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PROFILE } from './profile.js';

const ASSETS = import.meta.env.BASE_URL + 'assets/';

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
let seed = 715;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];

/* ---------- glyphs (drawn, shared by world + UI) ---------- */
function drawGlyph(id, size, color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), u = size / 100;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 7 * u; g.lineCap = 'square'; g.lineJoin = 'miter';
  const L = (...p) => { g.beginPath(); g.moveTo(p[0] * u, p[1] * u); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * u, p[i + 1] * u); g.stroke(); };
  if (id === 'about') { g.beginPath(); g.arc(50 * u, 42 * u, 20 * u, 0, 7); g.stroke(); L(50, 62, 50, 76); L(32, 92, 50, 76, 68, 92); g.beginPath(); g.arc(50 * u, 42 * u, 5 * u, 0, 7); g.fill(); }
  if (id === 'skills') { L(22, 18, 78, 82); L(78, 18, 22, 82); L(50, 34, 66, 50, 50, 66, 34, 50, 50, 34); }
  if (id === 'projects') { L(22, 40, 50, 16, 78, 40); L(22, 62, 50, 38, 78, 62); L(22, 84, 50, 60, 78, 84); }
  if (id === 'contact') { L(50, 88, 50, 20); L(50, 14, 24, 44); L(50, 14, 76, 44); L(30, 66, 50, 52, 70, 66); }
  return cv;
}
const GLYPH_URL = {};
PROFILE.realms.forEach(r => { GLYPH_URL[r.id] = drawGlyph(r.id, 120, '#ff8a3c').toDataURL(); });

/* ---------- content rendering ---------- */
function blocksHTML(blocks) {
  return blocks.map(b => {
    if (b.p) return `<p>${esc(b.p)}</p>`;
    if (b.h) return `<h3>${esc(b.h)}</h3>`;
    if (b.tags) return `<ul class="tags">${b.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    if (b.kv) return `<dl class="kv">${b.kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v && v.href ? `<a href="${esc(v.href)}" target="_blank" rel="noopener">${esc(v.text)}</a>` : esc(v)}</dd>`).join('')}</dl>`;
    if (b.loot) return `<ul class="loot">${b.loot.map(i => `<li><h3>${i.href ? `<a href="${esc(i.href)}" target="_blank" rel="noopener">${esc(i.t)}</a>` : esc(i.t)}</h3><p>${esc(i.d)}</p>${i.tags ? `<ul class="tags">${i.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`;
    return '';
  }).join('');
}

/* ---------- state ---------- */
const save = { opened: [], xp: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem('emberfall-v2') || '{}')); } catch (e) {}
if (!Array.isArray(save.opened)) save.opened = [];
if (!Array.isArray(save.runes)) save.runes = [];
const ALL_TAGS = []; PROFILE.realms.forEach(r => r.blocks.forEach(b => { if (b.tags) b.tags.forEach(t => { if (!ALL_TAGS.includes(t)) ALL_TAGS.push(t); }); }));
const persist = () => { try { localStorage.setItem('emberfall-v2', JSON.stringify(save)); } catch (e) {} };
let state = 'title';           // title | play | cine | panel | journal
let revealAll = false, returnState = 'title', ready = false, noGL = false;
let creditsHTML = '';
fetch(ASSETS + 'CREDITS.md').then(r => r.ok ? r.text() : '').then(t => {
  const lines = t.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
  const short = lines.map(l => { const m = l.match(/^"(.+?)" by (.+?) \((.+?), (https?:[^)]+)\), licensed (.+?) \(/); return m ? `<li>${esc(m[1])} · ${esc(m[2])} (${esc(m[3])}) · ${esc(m[5])}</li>` : `<li>${esc(l)}</li>`; });
  creditsHTML = `<details class="credits"><summary>사용한 에셋과 출처 (${lines.length})</summary><p>모델·효과음·음악은 Patch 에셋 라이브러리에서 가져온 CC0 / CC BY 4.0 작품입니다. 전체 문구는 assets/CREDITS.md에 있습니다.</p><ul>${short.join('')}</ul></details>`;
}).catch(() => {});

$('#tKicker').textContent = `${PROFILE.name} · ${PROFILE.role}`;
$('#tLead').textContent = PROFILE.lead;
$('#whoName').textContent = PROFILE.name;

function openJournal(all) {
  if (all) revealAll = true;
  if (state !== 'journal') returnState = state;
  state = 'journal';
  if (document.pointerLockElement) document.exitPointerLock();
  const n = save.opened.length, total = PROFILE.realms.length;
  $('#journalSheet').innerHTML =
    `<header><div><span class="label">${esc(PROFILE.role)}</span><h2>${esc(PROFILE.name)}의 일지</h2></div></header>` +
    PROFILE.realms.map(r => {
      const open = revealAll || save.opened.includes(r.id);
      return `<section id="sec-${r.id}" class="realm-block${open ? '' : ' locked'}"><span class="label">${esc(r.label)} · ${esc(r.place)}</span>` +
        (open ? `<h3 style="font-size:20px">${esc(r.title)}</h3>${blocksHTML(r.blocks)}` : `<p>아직 깨우지 못한 기록입니다. 나침반의 푸른 표식을 따라가세요.</p>`) + `</section>`;
    }).join('') + creditsHTML +
    `<div class="foot"><small>깨운 기록 ${n} / ${total} · 기술 룬 ${save.runes.length} / ${ALL_TAGS.length}</small><span style="display:flex;gap:10px;flex-wrap:wrap">` +
    (revealAll || n === total ? '' : `<button class="btn ghost" id="jAll">전부 펼쳐 보기</button>`) +
    `<button class="btn" id="jClose">${returnState === 'play' ? '여정으로 돌아가기' : (noGL || !ready ? '닫기' : '여정 시작')}</button></span></div>`;
  $('#journal').hidden = false; $('#title').hidden = true;
  $('#journal').scrollTop = 0;
  const a = $('#jAll'); if (a) a.onclick = () => openJournal(true);
  $('#jClose').onclick = closeJournal;
  $('#jClose').focus({ preventScroll: true });
}
function closeJournal() {
  $('#journal').hidden = true;
  if (returnState === 'play') { state = 'play'; return; }
  if (noGL || !ready) { state = 'title'; $('#title').hidden = false; return; }
  startGame();
}
$('#btnSkip').onclick = () => openJournal(true);
$('#btnJournal').onclick = () => openJournal(false);
// shareable links: #about, #skills, #projects, #contact, #journal open the reading view directly
function hashRoute() { const h = location.hash.slice(1); if (h !== 'journal' && !PROFILE.realms.some(r => r.id === h)) return; openJournal(true); const el = document.getElementById('sec-' + h); if (el) el.scrollIntoView(); }
addEventListener('hashchange', hashRoute);

/* ---------- renderer ---------- */
const app = $('#app'), canvas = $('#c');
let renderer = null;
try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer) {
  noGL = true; $('#btnStart').hidden = true;
  $('#tLead').textContent = '이 기기에서는 3D 세계를 띄울 수 없어 기록만 보여 드립니다.';
  openJournal(true); hashRoute();
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2));
const SHADOWS = !TOUCH;
renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new T.Scene();
const SKY = 0x0d1626;
scene.background = new T.Color(SKY);
scene.fog = new T.FogExp2(SKY, 0.024);
const camera = new T.PerspectiveCamera(55, 1, 0.1, 500);
let composer = null, bloom = null;
if (!TOUCH) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new T.Vector2(256, 256), 0.55, 0.7, 0.82);
  composer.addPass(bloom); composer.addPass(new OutputPass());
}

scene.add(new T.HemisphereLight(0x7f9cd6, 0x1a2018, 1.25));
const moon = new T.DirectionalLight(0xa9c4ff, 1.5); moon.position.set(-30, 50, -20); scene.add(moon, moon.target);
if (SHADOWS) { moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); const sc = moon.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 160; moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.06; }
const fireLight = new T.PointLight(0xff8a3c, 46, 40, 1.7); fireLight.position.set(0, 2.6, 0); scene.add(fireLight);
const fill = new T.PointLight(0xffc89a, 5, 9, 1.6); scene.add(fill);

const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
function glow(color, size, op) { const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, blending: T.AdditiveBlending, transparent: true, opacity: op || 0.7, depthWrite: false, fog: false })); sp.scale.setScalar(size); return sp; }
const SPECTRAL = new T.Color(0x5fe8c8), EMBER = new T.Color(0xff8a3c);

/* =====================================================================
   ASSETS
   ===================================================================== */
const MODELS = ['Barbarian', 'Skeleton_Warrior', 'Skeleton_Minion', 'Skeleton_Mage', 'axe_1handed', 'Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff', 'Skeleton_Shield_Large_A',
  'arch', 'crypt', 'fence', 'fence_broken', 'fence_pillar', 'grave_A', 'grave_A_destroyed', 'grave_B', 'gravemarker_A', 'gravemarker_B', 'gravestone', 'lantern_standing', 'post_lantern', 'post_skull', 'pillar', 'plaque_candles', 'shrine', 'shrine_candles', 'skull', 'skull_candle', 'ribcage', 'bone_A', 'bone_C', 'coffin_decorated', 'pumpkin_orange_jackolantern', 'pumpkin_orange', 'tree_dead_large', 'tree_dead_medium', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium', 'path_A', 'path_B', 'path_C', 'candle_triple', 'floor_dirt_grave',
  'Tree_1_A_Color1', 'Tree_2_A_Color1', 'Tree_3_A_Color1', 'Tree_4_A_Color1', 'Rock_1_A_Color1', 'Rock_1_D_Color1', 'Rock_2_A_Color1', 'Rock_3_A_Color1', 'Rock_3_F_Color1', 'Bush_1_A_Color1', 'Bush_2_A_Color1', 'Bush_4_A_Color1', 'Grass_1_A_Color1', 'Grass_1_C_Color1', 'Grass_2_B_Color1', 'campfire_logs', 'campfire_bricks'];
const SOUNDS = ['chop', 'knifeSlice', 'knifeSlice2', 'drawKnife1', 'metalClick', 'metalLatch', 'cloth1', 'bookOpen', 'handleCoins', 'footstep00', 'footstep_grass_000', 'impactMetal_heavy_000', 'impactPlate_heavy_000', 'impactPunch_heavy_000', 'impactPunch_medium_000', 'impactSoft_heavy_000', 'impactWood_heavy_000', 'impactBell_heavy_000', 'impactMining_000', 'dark_hallway', 'epic_boss_battle'];
const M = {}, CLIPS = {}, AUDIO_RAW = {}, BUF = {};
const loader = new GLTFLoader();
let loaded = 0;
const total = MODELS.length + SOUNDS.length;
const tick = () => { loaded++; if (!ready) $('#btnStart').textContent = `불러오는 중 ${Math.round(loaded / total * 100)}%`; };
const MODEL_EXT = import.meta.env.VITE_MODEL_EXT || '.glb';   // the hosted preview serves models as embedded-glTF .json
const loadModel = name => loader.loadAsync(ASSETS + 'models/' + name + MODEL_EXT).then(g => { M[name] = g.scene; if (g.animations.length) g.animations.forEach(c => { CLIPS[c.name] = c; }); tick(); });
// audio is fetched up front but decoded only after the first click, when an AudioContext is allowed
const loadSound = name => fetch(ASSETS + 'audio/' + name + '.mp3').then(r => r.arrayBuffer()).then(b => { AUDIO_RAW[name] = b; tick(); }).catch(() => tick());

/* =====================================================================
   WORLD (built once the models are in)
   ===================================================================== */
const obstacles = [{ x: 0, z: 0, r: 1.5 }];
const SHR = 26;
const SITE = {
  about: { pos: [0, -SHR], center: 'shrine', scale: 1.7, rad: 0.9 },
  skills: { pos: [SHR, 0], center: 'pillar', scale: 1.25, rad: 0.8 },
  projects: { pos: [-SHR, 0], center: 'coffin_decorated', scale: 1.25, rad: 1.5 },
  contact: { pos: [0, SHR], center: 'crypt', scale: 1, rad: 3.6 }
};
const dummy = new T.Object3D(), mtx = new T.Matrix4();
function scatter(name, list) {
  if (!list.length) return;
  const src = M[name]; src.updateMatrixWorld(true);
  src.traverse(o => {
    if (!o.isMesh) return;
    const im = new T.InstancedMesh(o.geometry, o.material, list.length); im.castShadow = SHADOWS; im.receiveShadow = true;
    list.forEach((t, i) => { dummy.position.set(t.x, t.y || 0, t.z); dummy.rotation.set(0, t.ry || 0, 0); dummy.scale.setScalar(t.s || 1); dummy.updateMatrix(); mtx.multiplyMatrices(dummy.matrix, o.matrixWorld); im.setMatrixAt(i, mtx); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); scene.add(im);
  });
}
function put(name, x, z, ry, s, parent) { const o = M[name].clone(); o.position.set(x, 0, z); o.rotation.y = ry || 0; o.scale.setScalar(s || 1); o.traverse(c => { if (c.isMesh) { c.castShadow = SHADOWS; c.receiveShadow = true; } }); (parent || scene).add(o); return o; }
const sizeOf = name => new T.Box3().setFromObject(M[name]).getSize(new T.Vector3());

const sites = [];
let auroraTex = null, leaves = null, leafPos = null;
const flames = [];
const LN = 500;
function buildWorld() {
  // ground: a flat clearing with mottled grass, rising into dark hills beyond the arena
  {
    const g = new T.PlaneGeometry(340, 340, 110, 110); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color(), c1 = new T.Color(0x2c3d2c), c2 = new T.Color(0x3b4a2e), c3 = new T.Color(0x4a3f2c);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
      let y = 0;
      if (d > 53) y = Math.pow((d - 53) / 14, 1.7) * (2.4 + Math.sin(x * 0.11) * Math.cos(z * 0.13) * 2.4) + rnd() * 0.9;
      p.setY(i, y);
      const n = Math.sin(x * 0.21 + Math.cos(z * 0.17) * 2) * 0.5 + 0.5, m = Math.sin(x * 0.07 - z * 0.09) * 0.5 + 0.5;
      c.copy(c1).lerp(c2, n).lerp(c3, m * 0.45 + (d < 7 ? (7 - d) / 7 * 0.6 : 0));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    const gm = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); gm.receiveShadow = true; scene.add(gm);
  }
  // sky: stars, moon, a slow spectral ribbon
  {
    const n = 700, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = rnd() * 6.283, ph = rnd() * 1.25 + 0.12, r = 380; a[i * 3] = Math.cos(th) * Math.cos(ph) * r; a[i * 3 + 1] = Math.sin(ph) * r; a[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xcfe0ff, size: 1.7, sizeAttenuation: false, fog: false })));
    const mo = glow(0xdfe9ff, 60, 0.95); mo.position.set(-150, 190, -210); scene.add(mo);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x2 = c.getContext('2d');
    for (let x = 0; x < 256; x++) { const al = 0.2 + 0.8 * Math.abs(Math.sin(x * 0.0736) * Math.sin(x * 0.0245 + 1)); const gr = x2.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(120,255,200,0)'); gr.addColorStop(0.6, 'rgba(110,240,200,' + (0.5 * al).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(90,140,255,0)'); x2.fillStyle = gr; x2.fillRect(x, 0, 1, 64); }
    auroraTex = new T.CanvasTexture(c); auroraTex.wrapS = T.RepeatWrapping; auroraTex.repeat.x = 2; auroraTex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.CylinderGeometry(300, 300, 90, 48, 1, true, 2.0, 2.3), new T.MeshBasicMaterial({ map: auroraTex, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.BackSide }));
    m.position.y = 120; scene.add(m);
  }
  // campfire
  {
    const w = sizeOf('campfire_bricks').x || 1, s = 2.3 / w;
    [put('campfire_bricks', 0, 0, 0, s), put('campfire_logs', 0, 0, 0.4, s)].forEach(o => o.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.multiplyScalar(0.3); } }));
    const fg = glow(0xff8a3c, 8, 0.3); fg.position.y = 1.3; scene.add(fg);
    [[0xff5a1f, 1.5, 0.75, 0.9], [0xff9a3c, 1.1, 0.95, 0.9], [0xffe08a, 0.6, 0.8, 1]].forEach(([c, sz, y, op], i) => { const f = glow(new T.Color(c).multiplyScalar(1.8), sz, op); f.position.set((i - 1) * 0.12, y, 0); f.userData.s = sz; scene.add(f); flames.push(f); });
  }
  // paths to the four graveyards
  const inst = {};
  const add = (name, t) => { (inst[name] || (inst[name] = [])).push(t); };
  for (let k = 0; k < 4; k++) {
    const ax = Math.sin(k * Math.PI / 2), az = Math.cos(k * Math.PI / 2);
    for (let d = 3.4; d < SHR - 4; d += 1.3) { const j = (rnd() - 0.5) * 0.7; add(pick(['path_A', 'path_B', 'path_C']), { x: ax * d + az * j, z: az * d - ax * j, ry: rnd() * 6.28, s: 0.9 + rnd() * 0.4 }); }
  }
  // the four graveyards
  PROFILE.realms.forEach(r => {
    const cfg = SITE[r.id], [x, z] = cfg.pos, toC = Math.atan2(-x, -z), out = toC + Math.PI;
    const fx = Math.sin(toC), fz = Math.cos(toC), px = Math.cos(toC), pz = -Math.sin(toC);   // forward (to the fire) and sideways
    const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
    const center = put(cfg.center, 0, 0, toC, cfg.scale, g);
    const top = new T.Box3().setFromObject(center).max.y;
    obstacles.push({ x, z, r: cfg.rad });
    // fence arc around the back, open towards the fire
    const R = cfg.rad + 7.5, segs = Math.round(R * 3.3 / 3);
    for (let i = 0; i < segs; i++) {
      const a = out - 1.65 + (i + 0.5) / segs * 3.3, wx = x + Math.sin(a) * R, wz = z + Math.cos(a) * R;
      add(rnd() < 0.25 ? 'fence_broken' : 'fence', { x: wx, z: wz, ry: a + Math.PI / 2 });
      obstacles.push({ x: wx, z: wz, r: 1.45 });
      const b = a - 1.65 / segs; add('fence_pillar', { x: x + Math.sin(b) * R, z: z + Math.cos(b) * R, ry: b });
    }
    // gate and lantern posts on the approach
    const gd = cfg.rad + 8.5;
    add('arch', { x: x + fx * gd, z: z + fz * gd, ry: toC });
    [-1, 1].forEach(sd => obstacles.push({ x: x + fx * gd + px * sd * 1.45, z: z + fz * gd + pz * sd * 1.45, r: 0.4 }));
    const lamps = [];
    [-1, 1].forEach(sd => { const lx = x + fx * (cfg.rad + 4.2) + px * sd * 2.6, lz = z + fz * (cfg.rad + 4.2) + pz * sd * 2.6; add('post_lantern', { x: lx, z: lz, ry: toC + (sd > 0 ? Math.PI : 0) }); const sp = glow(0x5fe8c8, 1.6, 0.8); sp.position.set(lx, 1.75, lz); scene.add(sp); lamps.push(sp); obstacles.push({ x: lx, z: lz, r: 0.3 }); });
    // graves and clutter, keeping the approach lane clear
    for (let i = 0, n = 0; i < 80 && n < 11; i++) {
      const a = rnd() * 6.283, d = cfg.rad + 1.8 + rnd() * 5, lx = Math.sin(a) * d, lz = Math.cos(a) * d;
      const fwd = lx * fx + lz * fz, side = lx * px + lz * pz;
      if (fwd > 0 && Math.abs(side) < 2.4) continue;
      const kind = pick(['grave_A', 'grave_B', 'grave_A_destroyed', 'gravestone', 'gravestone', 'gravemarker_A', 'gravemarker_B']);
      add(kind, { x: x + lx, z: z + lz, ry: toC + (rnd() - 0.5) * 0.5 }); n++;
      if (kind.startsWith('grave_')) obstacles.push({ x: x + lx, z: z + lz, r: 0.7 });
    }
    for (let i = 0; i < 9; i++) { const a = rnd() * 6.283, d = cfg.rad + 1 + rnd() * 7; add(pick(['skull', 'bone_A', 'bone_C', 'ribcage', 'pumpkin_orange', 'skull_candle', 'candle_triple']), { x: x + Math.sin(a) * d, z: z + Math.cos(a) * d, ry: rnd() * 6.28, s: 0.8 + rnd() * 0.4 }); }
    add('post_skull', { x: x + fx * (gd + 2.5) + px * 3.4, z: z + fz * (gd + 2.5) + pz * 3.4, ry: toC });
    add('pumpkin_orange_jackolantern', { x: x + fx * (gd + 0.6) - px * 2.6, z: z + fz * (gd + 0.6) - pz * 2.6, ry: toC + 0.4 });
    // the record: glyph, seal dome, beam, light
    const gt = new T.CanvasTexture(drawGlyph(r.id, 256, '#ffffff')); gt.colorSpace = T.SRGBColorSpace;
    const glyph = new T.Sprite(new T.SpriteMaterial({ map: gt, color: SPECTRAL.clone().multiplyScalar(1.6), transparent: true, depthWrite: false, fog: false })); glyph.scale.setScalar(1.7); glyph.position.set(0, top + 1.4, 0); g.add(glyph);
    const halo = glow(0x5fe8c8, 6, 0.4); halo.position.set(0, top + 1.4, 0); g.add(halo);
    const dome = new T.Mesh(new T.IcosahedronGeometry(cfg.rad + 2.4, 1), new T.MeshBasicMaterial({ color: 0x5fe8c8, transparent: true, opacity: 0.13, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, wireframe: false }));
    dome.position.y = 1.2; g.add(dome);
    const domeW = new T.Mesh(dome.geometry, new T.MeshBasicMaterial({ color: 0x8ff5dd, transparent: true, opacity: 0.35, wireframe: true, depthWrite: false, fog: false })); dome.add(domeW);
    const beamMat = new T.MeshBasicMaterial({ color: SPECTRAL.clone(), transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide });
    const beam = new T.Mesh(new T.CylinderGeometry(0.25, 0.7, 80, 6, 1, true), beamMat); beam.position.y = 42; g.add(beam);
    const light = new T.PointLight(0x5fe8c8, 22, 18, 1.6); light.position.set(fx * 1.5, 3, fz * 1.5); g.add(light);
    sites.push({ r, x, z, rad: cfg.rad, top, toC, fx, fz, px, pz, g, glyph, halo, dome, beamMat, light, lamps, guards: [], sealed: true, opened: false, hold: 0 });
  });
  // forest
  {
    const kinds = ['tree_pine_orange_large', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium', 'Tree_1_A_Color1', 'Tree_2_A_Color1', 'Tree_3_A_Color1', 'Tree_4_A_Color1', 'tree_dead_large', 'tree_dead_medium'];
    const spots = [];
    for (let i = 0; i < 1400 && spots.length < 230; i++) {
      const a = rnd() * 6.283, d = 11 + rnd() * 78, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if ((Math.abs(x) < 3.4 || Math.abs(z) < 3.4) && d < SHR + 6) continue;
      if (sites.some(s => Math.hypot(x - s.x, z - s.z) < s.rad + 11.5)) continue;
      if (spots.some(s => Math.hypot(s.x - x, s.z - z) < 3)) continue;
      spots.push({ x, z }); const y = d > 53 ? Math.pow((d - 53) / 14, 1.7) * 2.2 : 0;
      add(pick(kinds), { x, z, y, ry: rnd() * 6.28, s: (d > 50 ? 1.5 : 1.05) + rnd() * 0.55 });
      if (d < 51) obstacles.push({ x, z, r: 0.5 });
    }
    for (let i = 0; i < 70; i++) { const a = rnd() * 6.283, d = 8 + rnd() * 62, x = Math.cos(a) * d, z = Math.sin(a) * d; if ((Math.abs(x) < 2.6 || Math.abs(z) < 2.6) && d < SHR) continue; add(pick(['Rock_1_A_Color1', 'Rock_1_D_Color1', 'Rock_2_A_Color1', 'Rock_3_A_Color1', 'Rock_3_F_Color1']), { x, z, ry: rnd() * 6.28, s: 0.8 + rnd() * 1.2 }); }
    for (let i = 0; i < 90; i++) { const a = rnd() * 6.283, d = 7 + rnd() * 58, x = Math.cos(a) * d, z = Math.sin(a) * d; if ((Math.abs(x) < 2.4 || Math.abs(z) < 2.4) && d < SHR) continue; add(pick(['Bush_1_A_Color1', 'Bush_2_A_Color1', 'Bush_4_A_Color1']), { x, z, ry: rnd() * 6.28, s: 0.8 + rnd() * 0.7 }); }
    for (let i = 0; i < 650; i++) { const a = rnd() * 6.283, d = 4 + Math.sqrt(rnd()) * 52, x = Math.cos(a) * d, z = Math.sin(a) * d; add(pick(['Grass_1_A_Color1', 'Grass_1_C_Color1', 'Grass_2_B_Color1']), { x, z, ry: rnd() * 6.28, s: 0.7 + rnd() * 0.8 }); }
  }
  Object.keys(inst).forEach(k => scatter(k, inst[k]));
  // drifting leaves
  leafPos = new Float32Array(LN * 3);
  for (let i = 0; i < LN; i++) { leafPos[i * 3] = (Math.random() - 0.5) * 44; leafPos[i * 3 + 1] = Math.random() * 14; leafPos[i * 3 + 2] = (Math.random() - 0.5) * 44; }
  const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(leafPos, 3));
  leaves = new T.Points(lg, new T.PointsMaterial({ color: 0xd9843a, size: 0.085, transparent: true, opacity: 0.85, depthWrite: false })); leaves.frustumCulled = false; scene.add(leaves);
}
function updateLeaves(dt) {
  const cx = camera.position.x, cz = camera.position.z;
  for (let i = 0; i < LN; i++) {
    const j = i * 3; leafPos[j + 1] -= (0.5 + (i % 5) * 0.12) * dt; leafPos[j] += (0.5 + Math.sin(time * 0.7 + i) * 0.5) * dt; leafPos[j + 2] += Math.cos(time * 0.5 + i * 1.7) * 0.3 * dt;
    if (leafPos[j + 1] < 0) leafPos[j + 1] += 14;
    if (leafPos[j] - cx > 22) leafPos[j] -= 44; else if (leafPos[j] - cx < -22) leafPos[j] += 44;
    if (leafPos[j + 2] - cz > 22) leafPos[j + 2] -= 44; else if (leafPos[j + 2] - cz < -22) leafPos[j + 2] += 44;
  }
  leaves.geometry.attributes.position.needsUpdate = true;
}

/* ---------- particles ---------- */
const PN = 900, pPos = new Float32Array(PN * 3).fill(-999), pCol = new Float32Array(PN * 3), pBase = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pGrav = new Float32Array(PN);
const pGeo = new T.BufferGeometry(); pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
const pts = new T.Points(pGeo, new T.PointsMaterial({ size: 0.13, map: glowTex, vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); pts.frustumCulled = false; scene.add(pts);
let pi = 0;
function spark(x, y, z, vx, vy, vz, life, r, g, b, grav) { const i = pi; pi = (pi + 1) % PN; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz; pLife[i] = life; pBase[i * 3] = r * 2; pBase[i * 3 + 1] = g * 2; pBase[i * 3 + 2] = b * 2; pGrav[i] = grav || 0; }
function burst(x, y, z, n, sp, life, r, g, b, grav) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u) * sp * (0.4 + Math.random()); spark(x, y, z, Math.cos(a) * s, u * sp + sp * 0.3, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), r, g, b, grav); } }
function updateParticles(dt) {
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt; const j = i * 3;
    if (pLife[i] <= 0) { pPos[j + 1] = -999; continue; }
    pVel[j + 1] -= pGrav[i] * dt;
    pPos[j] += pVel[j] * dt; pPos[j + 1] += pVel[j + 1] * dt; pPos[j + 2] += pVel[j + 2] * dt;
    if (pPos[j + 1] < 0.03 && pGrav[i] > 0) { pPos[j + 1] = 0.03; pVel[j + 1] *= -0.3; pVel[j] *= 0.6; pVel[j + 2] *= 0.6; }
    const f = Math.min(1, pLife[i] / 0.35); pCol[j] = pBase[j] * f; pCol[j + 1] = pBase[j + 1] * f; pCol[j + 2] = pBase[j + 2] * f;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

/* =====================================================================
   CHARACTERS
   ===================================================================== */
class Actor {
  constructor(name, scale, tint) {
    this.root = SkeletonUtils.clone(M[name]); this.root.scale.setScalar(scale || 1);
    this.mixer = new T.AnimationMixer(this.root); this.acts = {}; this.cur = null; this.curName = ''; this.mats = [];
    this.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = SHADOWS; o.frustumCulled = false;
        if (tint) { o.material = o.material.clone(); o.material.emissive = new T.Color(0); o.material.emissiveMap = o.material.map || null; o.material.emissiveIntensity = 1; this.mats.push(o.material); }
      }
      if (/^handslot\.?r$/.test(o.name)) this.handR = o;
      if (/^handslot\.?l$/.test(o.name)) this.handL = o;
      if (o.name === 'head') this.head = o;
    });
    scene.add(this.root);
  }
  hold(model, left) { const w = M[model].clone(); w.traverse(c => { if (c.isMesh) c.castShadow = SHADOWS; }); (left ? this.handL : this.handR).add(w); return w; }
  play(name, o) {
    o = o || {};
    const clip = CLIPS[name]; if (!clip) return null;
    if (this.curName === name && !o.once) { this.cur.timeScale = o.scale || 1; return this.cur; }
    const a = this.acts[name] || (this.acts[name] = this.mixer.clipAction(clip));
    a.reset(); a.setLoop(o.once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    a.timeScale = o.dur ? clip.duration / o.dur : (o.scale || 1); a.enabled = true; a.setEffectiveWeight(1);
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade === undefined ? 0.14 : o.fade, false);
    a.play(); this.cur = a; this.curName = name; return a;
  }
  tint(color, k) { for (const m of this.mats) { m.emissive.copy(color); m.emissiveIntensity = k; } }
}

const P = { x: 0, z: 2.9, face: 0, hp: 100, inv: 0, dodge: 0, dx: 0, dz: 0, cd: 0, lock: 0, dead: false, healed: false, rage: 0, raged: false, combo: 0, comboT: 0, swing: 0, swingDur: 1, hitDone: true, queued: false, lunge: 0, throwT: 0, step: 0, moving: false, sprint: false };
let hero = null, handAxe = null, fly = null, flyIn = null, arc = null;
const G = { state: 'held', pos: new T.Vector3(), dir: new T.Vector3(), dist: 0, hit: new Set(), spin: 0, pending: null };
const enemies = [], bolts = [], runes = [];
const prints = []; let printI = 0, printD = 0;
const wave = { m: null, r: 0, live: false, hit: false };
const cRed = new T.Color(0xff3b2e), cWhite = new T.Color(0xffffff), cBlack = new T.Color(0);

const KIND = {
  minion: { model: 'Skeleton_Minion', scale: 1, hp: 100, dmg: 10, speed: 3.0, wind: 0.6, reach: 1, weapon: 'Skeleton_Blade', attack: 'Melee_1H_Attack_Chop' },
  mage: { model: 'Skeleton_Mage', scale: 1, hp: 70, dmg: 12, speed: 2.4, wind: 0.75, reach: 1, weapon: 'Skeleton_Staff', attack: 'Ranged_Magic_Shoot' },
  boss: { model: 'Skeleton_Warrior', scale: 1.65, hp: 380, dmg: 18, speed: 2.5, wind: 0.85, reach: 1.55, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Large_A', attack: 'Melee_1H_Attack_Chop' }
};
function makeEnemy(site, ox, oz, kind, risen) {
  const k = KIND[kind], a = new Actor(k.model, k.scale, true);
  a.hold(k.weapon); if (k.shield) a.hold(k.shield, true);
  const eye = glow(0x5fe8c8, 0.9 * k.scale, 0.9); if (a.head) { eye.position.set(0, 0.45, 0.25); a.head.add(eye); }
  const e = { a, kind, k, site, boss: kind === 'boss', sc: k.scale, eye, hx: site.x + ox, hz: site.z + oz, x: site.x + ox, z: site.z + oz, hp: k.hp, max: k.hp, speed: k.speed, state: risen ? 'awaken' : 'dormant', key: '', t: 0, stun: 0, flash: 0, dead: false, cool: 1.2, side: Math.random() < 0.5 ? -1 : 1, atk: 0, p2: false, rot: site.toC + (Math.random() - 0.5) };
  a.root.position.set(e.x, 0, e.z); a.root.rotation.y = e.rot;
  if (risen) { a.play('Skeletons_Spawn_Ground', { once: true, fade: 0, scale: 2 }); e.key = 'awaken'; e.awake = CLIPS.Skeletons_Spawn_Ground.duration / 2 * 0.92; }
  else { a.play('Skeletons_Inactive_Floor_Pose', { fade: 0 }); e.key = 'dormant'; }
  a.mixer.update(0.01);
  enemies.push(e); site.guards.push(e); return e;
}

function buildActors() {
  hero = new Actor('Barbarian', 1, true);
  handAxe = hero.hold('axe_1handed'); handAxe.scale.setScalar(1.25);
  hero.root.position.set(P.x, 0, P.z); hero.root.rotation.y = P.face + Math.PI;
  hero.play('Sit_Floor_Idle', { fade: 0 });
  // the thrown axe: spins out, comes back to the hand
  fly = new T.Group(); flyIn = M.axe_1handed.clone(); flyIn.scale.setScalar(1.45); flyIn.position.y = -0.35; const piv = new T.Group(); piv.add(flyIn); fly.add(piv); fly.userData.piv = piv;
  fly.add(glow(0xff8a3c, 2.2, 0.5)); const fl = new T.PointLight(0xff8a3c, 10, 9, 1.8); fly.add(fl); fly.visible = false; scene.add(fly);
  arc = new T.Mesh(new T.RingGeometry(1.0, 2.7, 20, 1, -1.15, 2.3), new T.MeshBasicMaterial({ color: new T.Color(0xffa053).multiplyScalar(1.6), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  arc.rotation.order = 'YXZ'; scene.add(arc);
  const printMat = new T.MeshBasicMaterial({ color: 0x1b241b, transparent: true, opacity: 0.45, depthWrite: false });
  for (let i = 0; i < 40; i++) { const m = new T.Mesh(new T.CircleGeometry(0.12, 6), printMat); m.rotation.x = -Math.PI / 2; m.position.y = -5; scene.add(m); prints.push(m); }

  sites.forEach(s => {
    const { fx, fz, px, pz } = s, d = s.rad + 4.5;
    if (s.r.id === 'contact') makeEnemy(s, fx * (d + 1), fz * (d + 1), 'boss');
    else if (s.r.id === 'about') makeEnemy(s, fx * d, fz * d, 'minion');
    else if (s.r.id === 'skills') { makeEnemy(s, fx * d + px * 2.2, fz * d + pz * 2.2, 'minion'); makeEnemy(s, fx * 2.5 - px * 4.5, fz * 2.5 - pz * 4.5, 'mage'); }
    else { makeEnemy(s, fx * d + px * 2.6, fz * d + pz * 2.6, 'minion'); makeEnemy(s, fx * d - px * 2.6, fz * d - pz * 2.6, 'minion'); makeEnemy(s, fx * 2 + px * 5, fz * 2 + pz * 5, 'mage'); }
  });
  sites.forEach(s => { if (save.opened.includes(s.r.id)) { lightSite(s, false); s.guards.forEach(e => { e.dead = true; e.a.root.visible = false; }); } });

  { const geo = new T.IcosahedronGeometry(0.26, 0), mat = new T.MeshBasicMaterial({ color: new T.Color(0x9fffe0).multiplyScalar(2), fog: false });
    for (let i = 0; i < 8; i++) { const m = new T.Mesh(geo, mat); m.add(glow(0x5fe8c8, 2, 0.6)); m.visible = false; scene.add(m); bolts.push({ m, live: false, vx: 0, vz: 0, t: 0 }); } }
  wave.m = new T.Mesh(new T.RingGeometry(0.88, 1, 64), new T.MeshBasicMaterial({ color: new T.Color(0x8ff5dd).multiplyScalar(1.6), transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false }));
  wave.m.rotation.x = -Math.PI / 2; wave.m.position.y = 0.14; scene.add(wave.m);
  { const geo = new T.OctahedronGeometry(0.2, 0), mat = new T.MeshBasicMaterial({ color: new T.Color(0xffd27a), fog: false });
    ALL_TAGS.forEach((tag, i) => { if (save.runes.includes(tag)) return; const o = { x: 0, z: 0 }, a = i * 2.399 + 0.6, d = 9 + ((i * 7) % 11) * 3.3; o.x = Math.cos(a) * d; o.z = Math.sin(a) * d; collide(o, 1.4);
      const m = new T.Mesh(geo, mat); m.add(glow(0xffd27a, 1.5, 0.3)); m.position.set(o.x, 1.1, o.z); scene.add(m); runes.push({ tag, m, x: o.x, z: o.z, got: false }); }); }
}
function lightSite(s, withFx) {
  s.opened = true; s.sealed = false; s.dome.visible = false;
  s.glyph.material.color.copy(EMBER).multiplyScalar(1.8); s.beamMat.color.copy(EMBER); s.beamMat.opacity = 0.28; s.light.color.copy(EMBER); s.light.intensity = 34; s.halo.material.color.copy(EMBER);
  s.lamps.forEach(l => l.material.color.copy(EMBER));
  if (withFx) burst(s.x, s.top * 0.7, s.z, 70, 5, 1.4, 1, 0.5, 0.15, 3);
}

/* ---------- camera + input ---------- */
let yaw = 0, pitch = 0.16, shake = 0, hitstop = 0, slowT = 0, time = 0, fovKick = 0;
const keys = new Set();
const aim = new T.Vector2(0, 0), ray = new T.Raycaster();
const fwd = new T.Vector3(0, 0, -1), right = new T.Vector3(1, 0, 0), tmp = new T.Vector3(), tmp2 = new T.Vector3(), v3 = new T.Vector3();
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
let useHeld = false, mouseDown = null, lockAt = 0;
document.addEventListener('pointerlockchange', () => { lockAt = performance.now(); aim.set(0, 0); });

addEventListener('keydown', e => {
  if (e.repeat) { if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); return; }
  if (state === 'panel') { if (['KeyE', 'Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); closePanel(); } return; }
  if (state === 'journal') { if (['KeyJ', 'Escape'].includes(e.code)) { e.preventDefault(); closeJournal(); } return; }
  if (state !== 'play') return;
  keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); dodge(); }
  if (e.code === 'KeyJ' || e.code === 'Tab' || e.code === 'Escape') { e.preventDefault(); openJournal(false); }
  if (e.code === 'KeyF' || e.code === 'KeyQ') throwAxe();
  if (e.code === 'KeyR') nova();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  if (e.pointerType === 'touch') {
    const r = app.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.45 && joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0; const s = $('#stick'); s.hidden = false; s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px'; s.firstElementChild.style.transform = ''; }
    else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
    return;
  }
  if (document.pointerLockElement === canvas) { if (e.button === 0) slash(); else if (e.button === 2) throwAxe(); return; }
  mouseDown = { x: e.clientX, y: e.clientY, moved: 0, b: e.button };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener('pointermove', e => {
  if (state !== 'play') return;
  if (e.pointerType === 'touch') {
    if (e.pointerId === joy.id) { let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), m = 44; if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = dy / m; $('#stick').firstElementChild.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === look.id) { yaw -= (e.clientX - look.x) * 0.006; pitch = clamp(pitch + (e.clientY - look.y) * 0.004, -0.2, 0.85); look.x = e.clientX; look.y = e.clientY; }
    return;
  }
  if (document.pointerLockElement === canvas) { aim.set(0, 0); if (performance.now() - lockAt < 160 || Math.abs(e.movementX) > 160 || Math.abs(e.movementY) > 160) return; yaw -= e.movementX * 0.0024; pitch = clamp(pitch + e.movementY * 0.0018, -0.2, 0.85); return; }
  const r = app.getBoundingClientRect();
  aim.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  if (mouseDown) { const dx = e.movementX, dy = e.movementY; mouseDown.moved += Math.abs(dx) + Math.abs(dy); if (mouseDown.moved > 6) { yaw -= dx * 0.005; pitch = clamp(pitch + dy * 0.003, -0.2, 0.85); } }
});
const pointerEnd = e => {
  if (e.pointerType === 'touch') { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('#stick').hidden = true; } if (e.pointerId === look.id) look.id = null; return; }
  if (mouseDown && state === 'play') {
    if (mouseDown.moved <= 6 && mouseDown.b === 2) throwAxe();
    if (mouseDown.moved <= 6 && mouseDown.b === 0) {
      slash();
      if (!TOUCH && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {} }
    }
  }
  mouseDown = null;
};
canvas.addEventListener('pointerup', pointerEnd); canvas.addEventListener('pointercancel', pointerEnd);
const hold = (el, down, up) => { el.addEventListener('pointerdown', e => { e.preventDefault(); down(); }); if (up) ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => el.addEventListener(n, up)); };
hold($('#tThrow'), () => throwAxe(true));
hold($('#tSlash'), () => slash());
hold($('#tNova'), () => nova());
hold($('#tDodge'), () => dodge());
hold($('#tUse'), () => { useHeld = true; }, () => { useHeld = false; });

/* ---------- sound ---------- */
let AC = null, master = null, muted = false, musicA = null, musicB = null;
function sfx(name, vol, rate) {
  if (!AC || muted || !BUF[name]) return;
  try { const s = AC.createBufferSource(); s.buffer = BUF[name]; s.playbackRate.value = (rate || 1) * (0.94 + Math.random() * 0.12); const g = AC.createGain(); g.gain.value = vol === undefined ? 0.5 : vol; s.connect(g); g.connect(master); s.start(); } catch (e) {}
}
function tone(type, f0, f1, dur, vol) { if (!AC || muted) return; try { const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03); } catch (e) {} }
function loopTrack(name, vol) { if (!BUF[name]) return null; const s = AC.createBufferSource(); s.buffer = BUF[name]; s.loop = true; const g = AC.createGain(); g.gain.value = vol; s.connect(g); g.connect(master); s.start(); return g; }
function initAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = muted ? 0 : 1; master.connect(AC.destination);
      const jobs = Object.keys(AUDIO_RAW).map(n => new Promise(res => { try { AC.decodeAudioData(AUDIO_RAW[n].slice(0), b => { BUF[n] = b; res(); }, () => res()); } catch (e) { res(); } }));
      Promise.all(jobs).then(() => { musicA = loopTrack('dark_hallway', 0.22); musicB = loopTrack('epic_boss_battle', 0); });
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) {}
}
$('#btnSound').onclick = () => { muted = !muted; if (master) master.gain.value = muted ? 0 : 1; $('#btnSound').textContent = muted ? '소리 끔' : '소리 켬'; $('#btnSound').setAttribute('aria-pressed', String(!muted)); };

/* ---------- HUD ---------- */
const compassItems = [];
function buildHud() {
  const c = $('#compass');
  const add = (txt, cls, getA, ref) => { const d = document.createElement('span'); d.className = 'cm ' + cls; d.textContent = txt; c.appendChild(d); compassItems.push({ d, getA, ref }); };
  [['북', 0], ['서', Math.PI / 2], ['남', Math.PI], ['동', -Math.PI / 2]].forEach(([t, a]) => add(t, '', () => a));
  sites.forEach(s => add('◆' + s.r.label, 'realm', () => Math.atan2(-(s.x - P.x), -(s.z - P.z)), s));
  add('✦', 'fire', () => (Math.hypot(P.x, P.z) < 3 ? null : Math.atan2(P.x, P.z)));
  $('#questList').innerHTML = sites.map(s => `<li data-id="${s.r.id}">${esc(s.r.place)}</li>`).join('');
}
function updateCompass() {
  const half = $('#compass').clientWidth / 2;
  for (const it of compassItems) {
    const a = it.getA(); if (a === null) { it.d.style.opacity = 0; continue; }
    const d = wrapA(a - yaw);
    if (Math.abs(d) > 1.15) { it.d.style.opacity = 0; continue; }
    it.d.style.opacity = 1; it.d.style.transform = `translateX(${(-d / 1.15 * half).toFixed(1)}px)`;
    if (it.ref) it.d.classList.toggle('done', it.ref.opened);
  }
}
function refreshQuest() {
  const n = sites.filter(s => s.opened).length;
  $('#questHead').textContent = n === sites.length ? '사가 완성' : `기록 깨우기 ${n} / ${sites.length}`;
  sites.forEach(s => $(`#questList li[data-id="${s.r.id}"]`).classList.toggle('done', s.opened));
  $('#questRunes').textContent = `기술 룬 ${save.runes.length} / ${ALL_TAGS.length}`;
  const lv = 1 + Math.floor(save.xp / 150);
  $('#lvl').textContent = 'Lv ' + lv; $('#xpBar').style.transform = `scaleX(${(save.xp % 150) / 150})`;
}
let toastT = 0;
function toast(msg, sub, dur) { const t = $('#toast'); t.innerHTML = esc(msg) + (sub ? `<small>${esc(sub)}</small>` : ''); t.classList.add('on'); toastT = dur || 3.2; }
function dmgNum(x, y, z, n, big) { v3.set(x, y, z).project(camera); if (v3.z > 1) return; const d = document.createElement('span'); d.className = 'dmg' + (big ? ' big' : ''); d.textContent = n; d.style.transform = `translate(${((v3.x + 1) / 2 * app.clientWidth).toFixed(0)}px,${((1 - v3.y) / 2 * app.clientHeight).toFixed(0)}px)`; $('#hud').appendChild(d); d.addEventListener('animationend', () => d.remove()); }
function flash(o) { if (REDUCED) return; const el = $('#flash'); el.style.transition = 'none'; el.style.opacity = o; requestAnimationFrame(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 0; }); }
function gainRage(n) { P.rage = Math.min(100, P.rage + n); if (P.rage >= 100 && !P.raged) { P.raged = true; toast('불씨가 가득 찼다', TOUCH ? '폭발 버튼으로 주변을 휩쓸 수 있습니다' : 'R을 눌러 주변을 휩쓸 수 있습니다'); } }
function addXP(n) { const before = Math.floor(save.xp / 150); save.xp += n; persist(); refreshQuest(); if (Math.floor(save.xp / 150) > before) toast('레벨 ' + (1 + Math.floor(save.xp / 150)), '여정이 깊어졌다'); }

/* ---------- actions ---------- */
const moveX = () => (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + joy.x;
const moveZ = () => (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
const busy = () => P.dead || P.lock > 0 || P.dodge > 0;
function handPos(out) { return out.set(P.x + Math.cos(P.face) * 0.4, 1.25, P.z - Math.sin(P.face) * 0.4); }
const ATTACKS = [['Melee_1H_Attack_Slice_Diagonal', 0.5], ['Melee_1H_Attack_Slice_Horizontal', 0.5], ['Melee_1H_Attack_Jump_Chop', 0.8]];
function slash() {
  if (state !== 'play' || busy()) return;
  if (G.state !== 'held') { if (G.state === 'out') { G.state = 'back'; G.hit.clear(); } return; }
  if (P.swing > 0) { if (P.swing < P.swingDur * 0.55) P.queued = true; return; }
  P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0;
  const [clip, dur] = ATTACKS[P.combo];
  P.swingDur = P.swing = dur; P.comboT = dur + 0.45; P.hitDone = false; P.queued = false;
  let tx = fwd.x, tz = fwd.z, best = 5.5;
  for (const e of enemies) { if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; if (d < best && (dx * fwd.x + dz * fwd.z) / d > -0.2) { best = d; tx = dx / d; tz = dz / d; } }
  P.face = Math.atan2(-tx, -tz); P.dx = tx; P.dz = tz; P.lunge = best > 2 && best < 5.5 ? 0.16 : 0.05;
  hero.play(clip, { once: true, dur: dur * 1.25, fade: 0.08 });
  sfx(P.combo === 2 ? 'drawKnife1' : (P.combo ? 'knifeSlice2' : 'knifeSlice'), 0.5, P.combo === 2 ? 0.7 : 0.85);
}
function throwAxe(auto) {
  if (state !== 'play' || busy()) return;
  if (G.state === 'out') { G.state = 'back'; G.hit.clear(); return; }
  if (G.state !== 'held' || P.cd > 0 || P.swing > 0 || P.throwT > 0) return;
  let target = null, best = auto ? 0.5 : 0.985;
  ray.setFromCamera(auto ? tmp2.set(0, 0, 0) : aim, camera);
  for (const e of enemies) {
    if (e.dead) continue;
    tmp.set(e.x, 1.2 * e.sc, e.z).sub(ray.ray.origin); const d = tmp.length(); if (d > 40) continue;
    const dot = tmp.normalize().dot(ray.ray.direction) - (auto ? d * 0.004 : 0);
    if (dot > best) { best = dot; target = e; }
  }
  if (target) tmp.set(target.x, 1.2 * target.sc, target.z);
  else { tmp.copy(ray.ray.direction).multiplyScalar(30).add(ray.ray.origin); if (tmp.y < 0.6) tmp.y = 0.6; }
  handPos(G.pos); G.dir.copy(tmp).sub(G.pos).normalize();
  P.face = Math.atan2(-G.dir.x, -G.dir.z); P.throwT = 0.5; P.cd = 0.55; G.pending = 0.2;
  hero.play('Throw', { once: true, dur: 0.6, fade: 0.06 });
}
function dodge() {
  if (state !== 'play' || P.dead || P.lock > 0 || P.dodge > 0 || P.cd > 0.4) return;
  let mx = moveX(), mz = moveZ(), back = false;
  if (!mx && !mz) { P.dx = Math.sin(P.face); P.dz = Math.cos(P.face); back = true; }
  else { const l = Math.hypot(mx, mz); mx /= l; mz /= l; P.dx = right.x * mx + fwd.x * mz; P.dz = right.z * mx + fwd.z * mz; P.face = Math.atan2(-P.dx, -P.dz); }
  P.dodge = 0.42; P.inv = 0.46; P.cd = 0.65; P.swing = 0; P.queued = false;
  hero.play(back ? 'Dodge_Backward' : 'Dodge_Forward', { once: true, dur: 0.48, fade: 0.05 });
  sfx('cloth1', 0.5);
}
function nova() {
  if (state !== 'play' || busy() || P.rage < 100) return;
  P.rage = 0; P.raged = false; P.inv = Math.max(P.inv, 0.9); P.lock = 0.7; P.swing = 0;
  hero.play('Melee_2H_Attack_Spin', { once: true, dur: 0.8, fade: 0.06 });
  for (const e of enemies) { if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; if (d < 8) hitEnemy(e, 70, dx / d, dz / d, 2.6); }
  bolts.forEach(b => { if (b.live) killBolt(b); });
  burst(P.x, 1, P.z, 160, 10, 1, 1, 0.6, 0.2, 2); if (!REDUCED) { shake = 0.9; slowT = 0.5; } flash(0.4);
  sfx('impactBell_heavy_000', 0.6, 0.5); tone('sawtooth', 95, 30, 0.7, 0.14);
}
function hurtPlayer(n) {
  if (P.inv > 0 || P.dead) return;
  P.hp -= n; P.inv = 0.55; shake = 0.5; gainRage(5);
  sfx('impactPunch_medium_000', 0.7); sfx('impactSoft_heavy_000', 0.5);
  const h = $('#hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = ''; h.style.opacity = 0; });
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; P.swing = 0; hero.play('Death_A', { once: true });
    setTimeout(() => { $('#fade').style.opacity = 1; }, 900);
    setTimeout(() => {
      P.x = 0; P.z = 3; P.hp = 100; P.dead = false; P.inv = 2; yaw = 0; P.face = 0; G.state = 'held'; fly.visible = false; handAxe.visible = true;
      bolts.forEach(b => { if (b.live) killBolt(b); }); wave.live = false; wave.m.material.opacity = 0;
      enemies.forEach(e => { if (!e.dead && e.state !== 'dormant') { e.x = e.hx; e.z = e.hz; e.state = 'idle'; } });
      hero.play('Idle_A', { fade: 0 }); $('#fade').style.opacity = 0; toast('모닥불 곁에서 다시 일어섰다', '해골의 눈이 붉게 빛나면 Space로 구르세요');
    }, 1900);
  } else if (P.swing <= 0 && P.dodge <= 0 && P.lock <= 0) { hero.play('Hit_A', { once: true, dur: 0.45, fade: 0.05 }); P.lock = 0.28; }
}
function hitEnemy(e, n, dx, dz, kb) {
  const k = (kb || 0.5) * (e.boss ? 0.3 : 1);
  e.hp -= n; e.flash = 1; e.stun = e.boss ? 0.12 : 0.38; e.x += dx * k; e.z += dz * k;
  if (e.state === 'dormant') { e.state = 'awaken'; e.t = 0; }
  else if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
  burst(e.x, 1.3 * e.sc, e.z, 14, 4, 0.5, 1, 0.85, 0.6, 7);
  dmgNum(e.x, 2.3 * e.sc, e.z, n, n >= 40);
  if (!REDUCED) { hitstop = n >= 40 ? 0.11 : 0.07; shake = Math.max(shake, n >= 40 ? 0.45 : 0.25); }
  sfx(n >= 40 ? 'impactPlate_heavy_000' : 'impactPunch_heavy_000', 0.7); sfx('impactWood_heavy_000', 0.35, 1.3);
  if (e.boss && !e.p2 && e.hp > 0 && e.hp <= e.max / 2) {
    e.p2 = true; e.speed = 3.1; e.state = 'taunt'; e.t = 0; toast('해골왕이 격노한다', '땅을 내리치면 고리가 퍼집니다. 구르기로 뚫으세요', 4.5);
    [-1, 1].forEach(s => { const w = makeEnemy(e.site, e.x - e.site.x + s * 3.5, e.z - e.site.z, 'minion', true); burst(w.x, 0.3, w.z, 30, 4, 0.8, 0.4, 0.9, 0.8, 4); });
    sfx('impactMining_000', 0.7, 0.6);
  }
  if (e.hp <= 0) {
    e.dead = true; e.t = 0; e.eye.visible = false; sfx('impactWood_heavy_000', 0.7, 0.7); burst(e.x, 1.2 * e.sc, e.z, e.boss ? 90 : 36, 5, 1.1, 0.4, 0.9, 0.8, 3); save.kills = (save.kills || 0) + 1; addXP(e.boss ? 80 : 20);
    const s = e.site;
    if (s.sealed && s.guards.every(g => g.dead)) { s.sealed = false; s.dome.visible = false; burst(s.x, 2, s.z, 80, 7, 1, 0.4, 0.9, 0.8, 5); sfx('metalLatch', 0.8, 0.6); sfx('impactBell_heavy_000', 0.4, 0.8); if (!REDUCED) slowT = 0.9; toast('봉인이 깨졌다', `${s.r.place}에 다가가 기록을 깨우세요`); }
  }
}
function fireBolt(e) { const b = bolts.find(b => !b.live); if (!b) return; const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1; b.live = true; b.t = 3.2; b.vx = dx / d * 11; b.vz = dz / d * 11; b.m.position.set(e.x + dx / d, 1.3, e.z + dz / d); b.m.visible = true; tone('square', 700, 300, 0.15, 0.03); }
function killBolt(b) { b.live = false; b.m.visible = false; burst(b.m.position.x, 1.3, b.m.position.z, 10, 3, 0.4, 0.4, 0.9, 0.8, 4); }
function startWave(e) { wave.live = true; wave.r = 1.5; wave.hit = false; wave.m.position.x = e.x; wave.m.position.z = e.z; burst(e.x, 0.4, e.z, 50, 7, 0.7, 0.4, 0.9, 0.8, 6); if (!REDUCED) shake = Math.max(shake, 0.7); sfx('impactMining_000', 0.9, 0.5); tone('sawtooth', 90, 30, 0.6, 0.12); }

/* ---------- records: cinematic, panel, ending ---------- */
const cine = { s: null, t: 0, a0: 0, lit: false };
function openPanel(s) {
  if (s.opened) { showPanel(s, false); return; }
  save.opened.push(s.r.id); addXP(100);
  state = 'cine'; cine.s = s; cine.t = 0; cine.lit = false; cine.a0 = Math.atan2(P.x - s.x, P.z - s.z) + 0.5;
  app.classList.add('cine'); $('#toast').classList.remove('on'); toastT = 0; keys.clear(); useHeld = false; joy.x = joy.y = 0; $('#prompt').hidden = true;
  if (document.pointerLockElement) document.exitPointerLock();
  P.face = Math.atan2(-(s.x - P.x), -(s.z - P.z)); hero.root.rotation.y = P.face + Math.PI; hero.play('Interact', { once: true, dur: 1.6 });
  sfx('metalLatch', 0.7, 0.5);
}
function updateCine(dt) {
  const s = cine.s; cine.t += dt; const k = Math.min(1, cine.t / 2.4), R0 = s.rad + 9, a = cine.a0 + (REDUCED ? 0 : k * 1.1), r = R0 - k * 2.5;
  camera.position.set(s.x + Math.sin(a) * r, 1.8 + k * 2.4, s.z + Math.cos(a) * r); camera.lookAt(s.x, s.top * 0.6 + 0.8, s.z);
  if (Math.random() < 0.8) spark(s.x + (Math.random() - 0.5) * (s.rad * 2 + 3), 0.2, s.z + (Math.random() - 0.5) * (s.rad * 2 + 3), 0, 3 + Math.random() * 2, 0, 1, 1, 0.55, 0.2, 0);
  if (!cine.lit && cine.t > 1.1) { cine.lit = true; lightSite(s, true); sfx('impactBell_heavy_000', 0.7); flash(0.3); hero.play('Cheering', { once: true, dur: 1.4 }); }
  if (cine.t > 2.4) { app.classList.remove('cine'); showPanel(s, true); }
}
function showPanel(s, first) {
  state = 'panel'; keys.clear(); useHeld = false; joy.x = joy.y = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  sfx('bookOpen', 0.6);
  $('#panelSheet').innerHTML = `<header><img src="${GLYPH_URL[s.r.id]}" alt=""><div><span class="label">${first ? '새 기록을 깨웠다 · ' : ''}${esc(s.r.label)}</span><h2>${esc(s.r.title)}</h2></div></header>${blocksHTML(s.r.blocks)}<div class="foot"><small>${esc(s.r.place)}</small><button class="btn" id="pClose">계속하기</button></div>`;
  $('#panel').hidden = false; $('#panel').scrollTop = 0; $('#prompt').hidden = true;
  $('#pClose').onclick = closePanel; $('#pClose').focus({ preventScroll: true });
  refreshQuest();
}
function showEnding() {
  state = 'panel'; const c = PROFILE.realms.find(r => r.id === 'contact'), t = Math.round(save.time || 0);
  hero.play('Cheering');
  $('#panelSheet').innerHTML = `<header><div><span class="label">${esc(PROFILE.name)} · ${esc(PROFILE.role)}</span><h2>사가 완성</h2></div></header><p>네 개의 기록을 모두 깨웠습니다. 여기까지 와 주셔서 고맙습니다.</p>` +
    `<dl class="stats"><div><dt>걸린 시간</dt><dd>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</dd></div><div><dt>쓰러뜨린 수호자</dt><dd>${save.kills || 0}</dd></div><div><dt>기술 룬</dt><dd>${save.runes.length} / ${ALL_TAGS.length}</dd></div></dl>` +
    (c ? blocksHTML(c.blocks) : '') + `<div class="foot"><button class="btn ghost" id="eJournal">일지 전체 보기</button><button class="btn" id="pClose">계속 탐험하기</button></div>`;
  $('#panel').hidden = false; $('#panel').scrollTop = 0;
  $('#pClose').onclick = closePanel; $('#eJournal').onclick = () => { $('#panel').hidden = true; state = 'play'; openJournal(true); };
  $('#pClose').focus({ preventScroll: true });
}
function closePanel() {
  $('#panel').hidden = true; state = 'play'; startBlend(0.8);
  if (sites.every(s => s.opened) && !save.done) { save.done = true; persist(); burst(P.x, 1, P.z, 120, 8, 1.6, 1, 0.75, 0.35, 1); showEnding(); }
}

/* ---------- per-frame ---------- */
function collide(o, rad) {
  for (const b of obstacles) { const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz), m = b.r + rad; if (d < m && d > 0.0001) { o.x = b.x + dx / d * m; o.z = b.z + dz / d * m; } }
  const d = Math.hypot(o.x, o.z); if (d > 50) { o.x *= 50 / d; o.z *= 50 / d; }
}
function updatePlayer(dt) {
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  P.inv = Math.max(0, P.inv - dt); P.cd = Math.max(0, P.cd - dt); P.lock = Math.max(0, P.lock - dt); P.comboT = Math.max(0, P.comboT - dt); P.throwT = Math.max(0, P.throwT - dt);
  if (keys.has('ArrowLeft')) yaw += 1.8 * dt; if (keys.has('ArrowRight')) yaw -= 1.8 * dt;
  let moving = false, sprint = false;
  if (!P.dead) {
    if (P.dodge > 0) { P.dodge -= dt; const k = P.dodge > 0.1 ? 11.5 : 4; P.x += P.dx * k * dt; P.z += P.dz * k * dt; }
    else if (P.lock <= 0) {
      let mx = moveX(), mz = moveZ(); const l = Math.hypot(mx, mz);
      if (l > 0.15 && P.swing <= 0 && P.throwT <= 0.25) {
        if (l > 1) { mx /= l; mz /= l; }
        sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || (l > 0.95 && joy.id !== null);
        const sp = sprint ? 7.8 : 5.2, wx = right.x * mx + fwd.x * mz, wz = right.z * mx + fwd.z * mz;
        P.x += wx * sp * dt; P.z += wz * sp * dt; moving = true;
        P.face += wrapA(Math.atan2(-wx, -wz) - P.face) * Math.min(1, dt * 13);
        printD += sp * dt; if (printD > 0.9) { printD = 0; const m = prints[printI++ % prints.length], sd = printI % 2 ? 0.16 : -0.16; m.position.set(P.x + Math.cos(P.face) * sd, 0.02, P.z - Math.sin(P.face) * sd); }
        P.step -= dt; if (P.step <= 0) { P.step = sprint ? 0.25 : 0.33; sfx('footstep_grass_000', 0.22, sprint ? 1.1 : 0.95); }
        // without mouse-look, strafing gently swings the camera so keyboard or touch alone can steer
        if (document.pointerLockElement !== canvas && !mouseDown && look.id === null) yaw -= mx * 0.9 * dt;
      }
    }
    if (P.swing > 0) {
      P.swing -= dt;
      if (P.lunge > 0) { P.lunge -= dt; P.x += P.dx * 7 * dt; P.z += P.dz * 7 * dt; }
      if (!P.hitDone && P.swing < P.swingDur * 0.58) {
        P.hitDone = true; const heavy = P.combo === 2, R = heavy ? 3.6 : 2.9, fx = -Math.sin(P.face), fz = -Math.cos(P.face);
        for (const e of enemies) { if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; if (d < R + 0.5 * e.sc && (heavy || (dx * fx + dz * fz) / d > 0.15)) { hitEnemy(e, heavy ? 46 : (P.combo ? 26 : 22), dx / d, dz / d, heavy ? 2.2 : 0.7); gainRage(12); } }
        for (const b of bolts) if (b.live && Math.hypot(b.m.position.x - P.x, b.m.position.z - P.z) < R) killBolt(b);
        arc.position.set(P.x, heavy ? 0.25 : 1.15, P.z); arc.rotation.set(-Math.PI / 2, P.face + Math.PI / 2, 0); arc.scale.setScalar(heavy ? 1.35 : 1); arc.material.opacity = 0.7;
        if (heavy) { burst(P.x + fx * 1.6, 0.3, P.z + fz * 1.6, 30, 5, 0.6, 1, 0.6, 0.2, 8); sfx('chop', 0.8, 0.7); if (!REDUCED) shake = Math.max(shake, 0.4); }
      }
      if (P.swing <= 0 && P.queued) { P.queued = false; P.swing = 0; slash(); }
    }
    collide(P, 0.45);
  }
  arc.material.opacity = Math.max(0, arc.material.opacity - dt * 4);
  P.moving = moving; P.sprint = sprint;
  if (!P.dead && P.swing <= 0 && P.dodge <= 0 && P.lock <= 0 && P.throwT <= 0.1) {
    if (moving) hero.play(sprint ? 'Running_B' : 'Running_A', { scale: sprint ? 1.15 : 1 });
    else hero.play(using() && nearSite ? 'Interact' : 'Idle_A');
  }
  hero.root.position.set(P.x, 0, P.z);
  hero.root.rotation.y += wrapA(P.face + Math.PI - hero.root.rotation.y) * Math.min(1, dt * 18);
  hero.tint(cRed, P.inv > 0 && P.dodge <= 0 && P.hp < 100 ? Math.max(0, P.inv - 0.25) * 1.2 : 0);
  fill.position.set(P.x, 2.4, P.z);
  fovKick += ((sprint ? 5 : 0) - fovKick) * Math.min(1, dt * 5);
  if (Math.hypot(P.x, P.z) < 4.5 && P.hp < 100 && !P.dead) { P.hp = Math.min(100, P.hp + 30 * dt); if (!P.healed) { P.healed = true; toast('모닥불이 상처를 덮는다', '체력은 여기서 회복됩니다'); } }
  $('#hpBar').style.transform = `scaleX(${P.hp / 100})`;
  $('#rageBar').style.transform = `scaleX(${P.rage / 100})`; $('#rageWrap').classList.toggle('full', P.rage >= 100); $('#tNova').hidden = P.rage < 100;
}
function updateAxe(dt) {
  G.spin += dt * 24;
  if (G.pending !== null) {   // release point of the throw animation
    G.pending -= dt;
    if (G.pending <= 0) { G.pending = null; if (!P.dead) { handPos(G.pos); G.state = 'out'; G.dist = 0; G.hit.clear(); handAxe.visible = false; fly.visible = true; sfx('knifeSlice2', 0.5, 0.6); } }
  }
  if (G.state === 'held') return;
  if (G.state === 'out') {
    const step = 34 * dt; G.pos.addScaledVector(G.dir, step); G.dist += step;
    let turn = G.dist > 24 || G.pos.y < 0.2 || G.pos.y > 14;
    for (const b of obstacles) if (b.r > 0.75 && G.pos.y < 4 && Math.hypot(G.pos.x - b.x, G.pos.z - b.z) < b.r - 0.15) turn = true;
    if (turn) { G.state = 'back'; G.hit.clear(); burst(G.pos.x, G.pos.y, G.pos.z, 10, 3, 0.4, 1, 0.6, 0.2, 6); sfx('impactMetal_heavy_000', 0.35, 1.2); }
  } else {
    handPos(tmp); tmp.sub(G.pos); const d = tmp.length();
    if (d < 0.9) { G.state = 'held'; fly.visible = false; handAxe.visible = true; sfx('metalClick', 0.7); return; }
    G.dir.copy(tmp).divideScalar(d); G.pos.addScaledVector(G.dir, Math.min(d, 42 * dt));
  }
  for (const e of enemies) {
    if (e.dead || G.hit.has(e)) continue;
    if (Math.hypot(G.pos.x - e.x, G.pos.z - e.z) < 0.8 * e.sc + 0.35 && G.pos.y < 2.4 * e.sc) { G.hit.add(e); hitEnemy(e, G.state === 'out' ? 34 : 22, G.dir.x, G.dir.z); gainRage(8); }
  }
  fly.position.copy(G.pos); fly.rotation.y = Math.atan2(G.dir.x, G.dir.z); fly.userData.piv.rotation.x = G.spin;
  if (Math.random() < 0.8) spark(G.pos.x, G.pos.y, G.pos.z, (Math.random() - 0.5), Math.random(), (Math.random() - 0.5), 0.4, 1, 0.5, 0.15, 0);
}
let bossSeen = null;
function enemyAnim(e) {
  const key = e.dead ? 'death' : (e.stun > 0 && !e.boss && e.state !== 'awaken' ? 'hit' : e.state);
  if (key === e.key) { if (key === 'chase' || key === 'return') e.a.cur.timeScale = e.speed / 1.9; return; }
  e.key = key; const a = e.a;
  if (key === 'death') a.play('Skeletons_Death', { once: true, fade: 0.08 });
  else if (key === 'hit') a.play('Hit_A', { once: true, dur: 0.5, fade: 0.05 });
  else if (key === 'awaken') { a.play('Skeletons_Awaken_Floor', { once: true, scale: 1.35, fade: 0.05 }); e.awake = CLIPS.Skeletons_Awaken_Floor.duration / 1.35 * 0.92; }
  else if (key === 'idle') a.play('Skeletons_Idle');
  else if (key === 'chase' || key === 'return') a.play('Skeletons_Walking', { scale: e.speed / 1.9 });
  else if (key === 'windup') a.play(e.k.attack, { once: true, dur: e.k.wind / 0.42, fade: 0.08 });
  else if (key === 'slamup') a.play('Melee_2H_Attack_Chop', { once: true, dur: 1 / 0.45, fade: 0.1 });
  else if (key === 'taunt') a.play('Skeletons_Taunt', { once: true, fade: 0.1 });
}
function updateEnemies(dt) {
  bossSeen = null;
  for (const e of enemies) {
    const a = e.a;
    if (e.dead) {
      if (a.root.visible) { enemyAnim(e); a.mixer.update(dt); e.t += dt; a.tint(cWhite, Math.max(0, 0.6 - e.t * 2)); if (e.t > 2.6) a.root.position.y -= dt * 0.9; if (e.t > 4.4) a.root.visible = false; }
      continue;
    }
    const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1, hd = Math.hypot(e.x - e.hx, e.z - e.hz), mage = e.kind === 'mage';
    e.stun = Math.max(0, e.stun - dt); e.flash = Math.max(0, e.flash - dt * 5);
    let warn = 0;
    if (e.state === 'dormant') { if (d < (mage ? 16 : 12.5) && !P.dead) { e.state = 'awaken'; e.t = 0; } }
    else if (e.state === 'awaken') { e.t += dt; if (e.t >= (e.awake || 1.6)) e.state = 'chase'; }
    else if (e.state === 'taunt') { e.t += dt; if (e.t >= 1.4) e.state = 'chase'; }
    else if (e.state === 'idle') { if (d < 12.5 && !P.dead) e.state = 'chase'; }
    else if (e.state === 'chase') {
      if (hd > 22 || d > 32 || P.dead) e.state = 'return';
      else if (e.stun <= 0) {
        if (mage) {   // keeps its distance, circles, and throws bolts
          const want = d < 7 ? -1 : d > 12 ? 1 : 0;
          e.x += (dx / d * want * e.speed - dz / d * 0.9 * e.side) * dt; e.z += (dz / d * want * e.speed + dx / d * 0.9 * e.side) * dt;
          e.cool -= dt; if (e.cool <= 0) { e.state = 'windup'; e.t = 0; }
        }
        else if (e.boss && e.p2 && e.atk % 2 === 1 && d < 8) { e.state = 'slamup'; e.t = 0; e.atk++; }
        else if (d < 1.9 * e.k.reach) { e.state = 'windup'; e.t = 0; e.atk++; }
        else { e.x += dx / d * e.speed * dt; e.z += dz / d * e.speed * dt; }
      }
    } else if (e.state === 'windup') {
      e.t += dt; warn = e.t / e.k.wind;
      if (e.stun > 0 && !e.boss) { e.state = 'chase'; e.cool = 0.9; }
      else if (e.t >= e.k.wind) {
        if (mage) { fireBolt(e); e.cool = 2.4; }
        else { e.x += dx / d * 0.7; e.z += dz / d * 0.7; if (d < 2.7 * e.k.reach) hurtPlayer(e.k.dmg); else sfx('knifeSlice', 0.3, 0.7); }
        e.state = 'recover'; e.t = 0;
      }
    } else if (e.state === 'slamup') { e.t += dt; warn = e.t; if (e.t >= 1) { startWave(e); e.state = 'recover'; e.t = 0; } }
    else if (e.state === 'recover') { e.t += dt; if (e.t > (mage ? 0.6 : 0.9)) e.state = 'chase'; }
    else if (e.state === 'return') { const rx = e.hx - e.x, rz = e.hz - e.z, rd = Math.hypot(rx, rz); if (rd < 0.5) e.state = 'idle'; else { e.x += rx / rd * e.speed * dt; e.z += rz / rd * e.speed * dt; } if (d < 9 && hd < 14 && !P.dead) e.state = 'chase'; }
    for (const o of enemies) { if (o === e || o.dead || o.state === 'dormant') continue; const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz); if (od < 1.3 && od > 0.001 && e.state !== 'dormant') { e.x += ox / od * (1.3 - od) * 0.5; e.z += oz / od * (1.3 - od) * 0.5; } }
    if (e.state !== 'dormant') collide(e, 0.5 * e.sc);
    warn = clamp(warn, 0, 1);
    a.root.position.set(e.x, 0, e.z);
    if (e.state === 'return') e.rot += wrapA(Math.atan2(e.hx - e.x, e.hz - e.z) - e.rot) * Math.min(1, dt * 8);
    else if (e.state !== 'dormant' && e.state !== 'idle' && e.state !== 'awaken') e.rot += wrapA(Math.atan2(dx, dz) - e.rot) * Math.min(1, dt * 8);
    a.root.rotation.y = e.rot;
    enemyAnim(e); a.mixer.update(dt);
    if (e.flash > 0) a.tint(cWhite, e.flash * 0.9); else a.tint(cRed, warn * 0.55);
    e.eye.material.color.copy(SPECTRAL).lerp(cRed, warn); e.eye.scale.setScalar((0.9 + warn * 1.3) * e.sc); e.eye.visible = e.state !== 'dormant';
    if (e.boss && !['dormant', 'idle', 'return'].includes(e.state)) bossSeen = e;
  }
  $('#boss').hidden = !bossSeen; if (bossSeen) $('#bossBar').style.transform = `scaleX(${Math.max(0, bossSeen.hp / bossSeen.max)})`;
  if (musicA && musicB) { const t = AC.currentTime; musicA.gain.setTargetAtTime(bossSeen ? 0 : 0.22, t, 0.8); musicB.gain.setTargetAtTime(bossSeen ? 0.3 : 0, t, 0.8); }
}
function updateBolts(dt) {
  for (const b of bolts) {
    if (!b.live) continue; b.t -= dt; const p = b.m.position; p.x += b.vx * dt; p.z += b.vz * dt; b.m.rotation.x += dt * 6;
    if (b.t <= 0 || (G.state !== 'held' && G.pos.distanceTo(p) < 1.1)) { killBolt(b); continue; }
    if (Math.hypot(p.x - P.x, p.z - P.z) < 0.75 && P.dodge <= 0) { hurtPlayer(12); killBolt(b); }
  }
}
function updateWave(dt) {
  if (!wave.live) return; wave.r += 9 * dt; wave.m.scale.setScalar(wave.r); wave.m.material.opacity = Math.max(0, 0.9 * (1 - wave.r / 14));
  if (wave.r > 14) { wave.live = false; wave.m.material.opacity = 0; return; }
  const d = Math.hypot(P.x - wave.m.position.x, P.z - wave.m.position.z);
  if (!wave.hit && Math.abs(d - wave.r) < 0.7 && P.inv <= 0) { wave.hit = true; hurtPlayer(20); }
}
function updateRunes() {
  for (const r of runes) {
    if (r.got) continue; r.m.rotation.y = time * 1.6; r.m.position.y = 1.1 + Math.sin(time * 2 + r.x) * 0.15;
    if (Math.hypot(P.x - r.x, P.z - r.z) < 1.4) { r.got = true; r.m.visible = false; save.runes.push(r.tag); addXP(10); sfx('handleCoins', 0.7); burst(r.x, 1.2, r.z, 24, 4, 0.8, 1, 0.8, 0.4, 2); toast('기술 룬 · ' + r.tag, save.runes.length + ' / ' + ALL_TAGS.length, 2.2); }
  }
}
let nearSite = null;
const using = () => keys.has('KeyE') || useHeld;
function updateSites(dt) {
  let near = null, nd = 1e9;
  for (const s of sites) {
    if (s.sealed) { s.dome.rotation.y += dt * 0.12; s.dome.material.opacity = 0.11 + Math.sin(time * 1.5 + s.x) * 0.03; }
    s.glyph.position.y = s.top + 1.4 + Math.sin(time * 1.3 + s.z) * 0.12;
    const d = Math.hypot(P.x - s.x, P.z - s.z) - s.rad; if (d < 3.6 && d < nd) { nd = d; near = s; }
  }
  nearSite = near && !near.sealed && !near.opened ? near : null;
  const pr = $('#prompt'), use = using();
  for (const s of sites) if (s !== near || !use) s.hold = 0;
  $('#tUse').hidden = !(near && !near.sealed);
  if (!near || P.dead) { pr.hidden = true; return; }
  pr.hidden = false;
  if (near.sealed) { $('#ring').textContent = '✕'; $('#ring').style.setProperty('--p', 0); $('#promptText').textContent = '망자의 봉인 — 수호자를 먼저 쓰러뜨려야 한다'; return; }
  $('#ring').textContent = TOUCH ? '◆' : 'E';
  if (near.opened) { $('#ring').style.setProperty('--p', 1); $('#promptText').textContent = `${near.r.label} 다시 읽기`; if (use) openPanel(near); return; }
  $('#promptText').textContent = TOUCH ? '조사 버튼을 길게 눌러 기록 깨우기' : '길게 눌러 기록 깨우기';
  if (use) { near.hold += dt; if (Math.random() < 0.5) spark(near.x + (Math.random() - 0.5) * 2, 0.3, near.z + (Math.random() - 0.5) * 2, 0, 2.5, 0, 0.8, 1, 0.5, 0.15, 0); if (near.hold >= 0.8) { near.hold = 0; openPanel(near); return; } }
  $('#ring').style.setProperty('--p', (near.hold / 0.8).toFixed(2));
}
const blend = { t: 0, dur: 1, pos: new T.Vector3(), quat: new T.Quaternion() }, gq = new T.Quaternion();
function startBlend(dur) { blend.t = blend.dur = REDUCED ? 0.01 : dur; blend.pos.copy(camera.position); blend.quat.copy(camera.quaternion); }
function updateCamera(dt) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  tmp.set(fwd.x * cp, -sp, fwd.z * cp);
  const tall = camera.aspect < 0.9, cd = tall ? 6.4 : 4.6, cs = tall ? 0.4 : 0.85;
  camera.position.set(P.x + right.x * cs - tmp.x * cd, Math.max(0.5, 1.75 - tmp.y * cd), P.z + right.z * cs - tmp.z * cd);
  // keep the camera out of the big solid pieces (crypt, coffin, pillars)
  for (const b of obstacles) { if (b.r < 0.75) continue; const ox = camera.position.x - b.x, oz = camera.position.z - b.z, od = Math.hypot(ox, oz), m = b.r + 0.5; if (od < m && od > 0.001 && camera.position.y < 4.5) { camera.position.x = b.x + ox / od * m; camera.position.z = b.z + oz / od * m; } }
  if (shake > 0 && !REDUCED) { shake = Math.max(0, shake - dt * 1.6); camera.position.x += (Math.random() - 0.5) * shake * 0.35; camera.position.y += (Math.random() - 0.5) * shake * 0.35; }
  tmp2.copy(camera.position).add(tmp); camera.lookAt(tmp2);
  if (blend.t > 0) {   // ease from wherever the camera was (title orbit, cinematic) into the shoulder view
    blend.t = Math.max(0, blend.t - dt); const k = 1 - blend.t / blend.dur, e = k * k * (3 - 2 * k);
    gq.copy(camera.quaternion); camera.position.lerpVectors(blend.pos, camera.position, e); camera.quaternion.copy(blend.quat).slerp(gq, e);
  }
  const f = 55 + fovKick; if (Math.abs(camera.fov - f) > 0.05) { camera.fov = f; camera.updateProjectionMatrix(); }
}

function resize() {
  const w = app.clientWidth, h = app.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
}
addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(app); resize();

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.05, (now - last) / 1000); last = now; let dt = real; time += real;
  if (!ready) { camera.position.set(6, 3, 8); camera.lookAt(0, 1.5, 0); renderer.render(scene, camera); return; }
  if (state === 'play') {
    save.time = (save.time || 0) + real;
    if (hitstop > 0) { hitstop -= real; dt = real * 0.05; } else if (slowT > 0) { slowT -= real; dt = real * 0.3; }
    updatePlayer(dt); updateAxe(dt); updateEnemies(dt); updateBolts(dt); updateWave(dt); updateRunes(); updateSites(real);
    if (state === 'play') updateCamera(real);
    updateCompass();
    if (toastT > 0) { toastT -= real; if (toastT <= 0) $('#toast').classList.remove('on'); }
  } else if (state === 'cine') updateCine(real);
  else if (state === 'title' || (state === 'journal' && returnState === 'title')) {
    const a = REDUCED ? 0 : Math.sin(time * 0.12) * 0.35; camera.position.set(3.1 + a, 1.55, 7.2 - a * 0.6); camera.lookAt(-1.7, 1.15, 0.4);
  }
  hero.mixer.update(dt);
  if (state !== 'play') for (const e of enemies) if (!e.dead || e.a.root.visible) e.a.mixer.update(state === 'cine' ? dt : 0);
  // ambient: embers, leaves, breathing lights, drifting ribbon
  for (let i = 0; i < 2; i++) if (Math.random() < 0.7) spark((Math.random() - 0.5) * 0.9, 0.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 0.6, 1.5, 1, 0.4 + Math.random() * 0.3, 0.08, -0.4);
  fireLight.intensity = 46 + Math.sin(time * 9) * 5 + Math.sin(time * 23) * 3;
  flames.forEach((f, i) => { const k = 0.8 + Math.sin(time * (7 + i * 3.1) + i) * 0.2; f.scale.set(f.userData.s * k, f.userData.s * (1.5 + Math.sin(time * (9 + i * 2.3)) * 0.3), 1); });
  moon.position.set(P.x - 30, 50, P.z - 20); moon.target.position.set(P.x, 0, P.z);
  auroraTex.offset.x += real * 0.004;
  updateParticles(dt); updateLeaves(real);
  if (composer) composer.render(); else renderer.render(scene, camera);
}

function startGame() {
  if (!ready) return;
  $('#title').hidden = true; $('#journal').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !TOUCH;
  state = 'play'; refreshQuest(); initAudio(); startBlend(2);
  hero.play('Sit_Floor_StandUp', { once: true, fade: 0.1 }); P.lock = (CLIPS.Sit_Floor_StandUp ? CLIPS.Sit_Floor_StandUp.duration : 1) * 0.9;
  toast(save.opened.length ? '여정을 이어간다' : '푸른 빛기둥을 따라가라', TOUCH ? '왼쪽을 끌어 이동, 오른쪽을 끌어 둘러보기' : '클릭 베기 · 우클릭 던지기 · Space 구르기', 5.5);
}
$('#btnStart').onclick = startGame;

requestAnimationFrame(frame);
Promise.all([...MODELS.map(loadModel), ...SOUNDS.map(loadSound)]).then(() => {
  buildWorld(); buildActors(); buildHud(); refreshQuest();
  ready = true;
  const b = $('#btnStart'); b.disabled = false; b.textContent = save.opened.length ? '여정 이어가기' : '여정 시작';
  hashRoute();
}).catch(err => {
  console.error(err);
  $('#btnStart').textContent = '불러오지 못했습니다'; $('#tLead').textContent = '에셋을 불러오지 못했습니다. 새로고침하거나 "게임 없이 바로 보기"를 눌러 주세요.';
});
window.__saga = { get hero() { return hero; }, CLIPS, P, G, enemies, sites, runes, bolts, wave, save, get state() { return state; }, get ready() { return ready; }, throwAxe, slash, nova, openPanel, hitEnemy };
