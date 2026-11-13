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
    if (b.loot) return `<ol class="loot">${b.loot.map(i => `<li><div class="loot-head"><h3>${i.href ? `<a href="${esc(i.href)}" target="_blank" rel="noopener">${esc(i.t)}</a>` : esc(i.t)}</h3>${i.k ? `<span class="kind">${esc(i.k)}</span>` : ''}</div><p>${esc(i.d)}</p>${i.tags ? `<ul class="tags">${i.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>`;
    return '';
  }).join('');
}

/* ---------- state ---------- */
const save = { opened: [], xp: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem('emberfall-v2') || '{}')); } catch (e) {}
if (!Array.isArray(save.opened)) save.opened = [];
if (!Array.isArray(save.runes)) save.runes = [];
// runes follow PROFILE.journey (the order the skills were learned); without it, the order the tags appear
const ALL_TAGS = Array.isArray(PROFILE.journey) && PROFILE.journey.length ? PROFILE.journey.map(j => j.tag) : [];
if (!ALL_TAGS.length) PROFILE.realms.forEach(r => r.blocks.forEach(b => { if (b.tags) b.tags.forEach(t => { if (!ALL_TAGS.includes(t)) ALL_TAGS.push(t); }); }));
const ORDER = PROFILE.realms.map(r => r.id);   // the records open in this order, one path at a time
const can = { get hammer() { return save.opened.includes(ORDER[0]); }, get ship() { return save.opened.includes(ORDER[1]); } };
const persist = () => { try { localStorage.setItem('emberfall-v2', JSON.stringify(save)); } catch (e) {} };
let state = 'title';           // title | play | cine | panel | journal
let revealAll = false, returnState = 'title', ready = false, noGL = false;
let creditsHTML = '';
fetch(ASSETS + 'CREDITS.md').then(r => r.ok ? r.text() : '').then(t => {
  const lines = t.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
  const short = lines.map(l => { const m = l.match(/^"(.+?)" by (.+?) \((.+?), (https?:[^)]+)\), licensed (.+?) \(/); return m ? `<li>${esc(m[1])} · ${esc(m[2])} (${esc(m[3])}) · ${esc(m[5])}</li>` : `<li>${esc(l)}</li>`; });
  creditsHTML = `<details class="credits"><summary>사용한 에셋과 출처 (${lines.length})</summary><p>모델·효과음·음악은 Patch 에셋 라이브러리에서 가져온 CC0 / CC BY 4.0 작품입니다. 전체 문구는 assets/CREDITS.md에 있습니다.</p><ul>${short.join('')}</ul></details>`;
}).catch(() => {});

$('#tName').textContent = PROFILE.name; $('#tRole').textContent = PROFILE.role;
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
    `<nav class="jnav" aria-label="기록 바로가기">${PROFILE.realms.map(r => `<button data-go="${r.id}">${esc(r.label)}</button>`).join('')}</nav>` +
    PROFILE.realms.map(r => {
      const open = revealAll || save.opened.includes(r.id);
      return `<section id="sec-${r.id}" class="realm-block${open ? '' : ' locked'}"><span class="label">${esc(r.label)} · ${esc(r.place)}</span>` +
        (open ? `<h3 style="font-size:20px">${esc(r.title)}</h3>${blocksHTML(r.blocks)}` : `<p>아직 깨우지 못한 기록입니다. 나침반의 푸른 표식을 따라가세요.</p>`) + `</section>`;
    }).join('') +
    (PROFILE.journey ? `<section id="sec-journey" class="realm-block"><span class="label">배움의 순서 · 기술 룬</span><ol class="journey">${PROFILE.journey.map(j => `<li class="${revealAll || save.runes.includes(j.tag) ? 'got' : ''}"><b>${esc(j.tag)}</b>${j.when ? `<span>${esc(j.when)}</span>` : ''}</li>`).join('')}</ol></section>` : '') +
    `<section class="realm-block"><span class="label">성장 · 레벨 ${ready ? lvl() : 1}</span><ol class="journey evo">${EVO.map(v => `<li class="${ready && has(v.lv) ? 'got' : ''}"><b>${esc(v.name)}</b><span>Lv ${v.lv} · ${esc(v.d)}</span></li>`).join('')}</ol></section>` +
    `<p class="inspired">이 페이지의 아이디어와 연출은 God of War(2018)와 God of War Ragnarök에서 영감을 받았습니다. 캐릭터, 세계, 에셋은 그와 별개로 만든 것입니다.</p>` + creditsHTML +
    `<div class="foot"><small>깨운 기록 ${n} / ${total} · 기술 룬 ${save.runes.length} / ${ALL_TAGS.length}</small><span style="display:flex;gap:10px;flex-wrap:wrap">` +
    (revealAll || n === total ? '' : `<button class="btn ghost" id="jAll">전부 펼쳐 보기</button>`) +
    `<button class="btn" id="jClose">${returnState === 'play' ? '여정으로 돌아가기' : (noGL || !ready ? '닫기' : '여정 시작')}</button></span></div>`;
  $('#journal').hidden = false; $('#title').hidden = true;
  $('#journal').scrollTop = 0;
  const a = $('#jAll'); if (a) a.onclick = () => openJournal(true);
  document.querySelectorAll('.jnav button').forEach(b => { b.onclick = () => { const el = document.getElementById('sec-' + b.dataset.go); if (el) el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }; });
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
const MODELS = ['Ranger', 'pencil_B_long', 'hammer', 'building_church_blue', 'building_blacksmith_blue', 'building_market_blue', 'building_castle_blue', 'anvil', 'blueprint', 'Skeleton_Warrior', 'Skeleton_Minion', 'Skeleton_Mage', 'Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff', 'Skeleton_Shield_Large_A',
  'arch', 'fence', 'fence_broken', 'fence_pillar', 'grave_A', 'grave_A_destroyed', 'grave_B', 'gravemarker_A', 'gravemarker_B', 'gravestone', 'lantern_standing', 'post_lantern', 'post_skull', 'pillar', 'plaque_candles', 'shrine', 'shrine_candles', 'skull', 'skull_candle', 'ribcage', 'bone_A', 'bone_C', 'coffin_decorated', 'pumpkin_orange_jackolantern', 'pumpkin_orange', 'tree_dead_large', 'tree_dead_medium', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium', 'path_A', 'path_B', 'path_C', 'candle_triple', 'floor_dirt_grave',
  'Rock_1_A_Color1', 'Rock_1_D_Color1', 'Rock_2_A_Color1', 'Rock_3_A_Color1', 'Rock_3_F_Color1', 'Bush_1_A_Color1', 'Bush_2_A_Color1', 'Bush_4_A_Color1', 'Grass_1_A_Color1', 'Grass_1_C_Color1', 'Grass_2_B_Color1', 'campfire_logs', 'campfire_bricks'];
const SOUNDS = ['metalClick', 'metalLatch', 'cloth1', 'bookOpen', 'footstep_grass_000', 'impactMetal_heavy_000', 'impactPlate_heavy_000', 'impactPunch_heavy_000', 'impactPunch_medium_000', 'impactSoft_heavy_000', 'impactWood_heavy_000', 'impactBell_heavy_000', 'impactMining_000', 'dark_hallway', 'epic_boss_battle'];
const M = {}, CLIPS = {}, AUDIO_RAW = {}, BUF = {};
const loader = new GLTFLoader();
let loaded = 0;
const total = MODELS.length + SOUNDS.length;
let failed = false;
const tick = () => { loaded++; if (!ready && !failed) $('#btnStart').textContent = `불러오는 중 ${Math.round(loaded / total * 100)}%`; };
const MODEL_EXT = import.meta.env.VITE_MODEL_EXT || '.glb';
const onModel = (name, g) => { M[name] = g.scene; g.animations.forEach(c => { CLIPS[c.name] = c; }); tick(); };
// The hosted preview can't serve .glb, so there each model ships as base64 inside a .json file and is parsed
// from memory. Textures then go through <img> rather than fetch(), which that host's policy blocks for blob: URLs.
function parseB64(b64) {
  const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const cib = self.createImageBitmap; try { self.createImageBitmap = undefined; } catch (e) {}
  const pr = loader.parseAsync(buf.buffer, ''); try { self.createImageBitmap = cib; } catch (e) {}
  return pr;
}
const loadModel = name => (MODEL_EXT === '.json'
  ? fetch(ASSETS + 'models/' + name + '.json').then(r => { if (!r.ok) throw new Error(name + ' ' + r.status); return r.json(); }).then(j => parseB64(j.glb))
  : loader.loadAsync(ASSETS + 'models/' + name + '.glb')).then(g => onModel(name, g));
// audio is fetched up front but decoded only after the first click, when an AudioContext is allowed
const loadSound = name => fetch(ASSETS + 'audio/' + name + '.mp3').then(r => r.arrayBuffer()).then(b => { AUDIO_RAW[name] = b; tick(); }).catch(() => tick());

/* =====================================================================
   WORLD (built once the models are in)
   ===================================================================== */
const obstacles = [{ x: 0, z: 0, r: 1.5 }];
const SHR = 26, VEIL = 11.5, RING = 20;
// each site: a record pedestal on the path, with its hall standing behind it
const SITE = {
  about: { pos: [0, -SHR], hall: 'building_church_blue', hr: 3.6, prop: 'blueprint' },
  skills: { pos: [SHR, 0], hall: 'building_blacksmith_blue', hr: 4.3, prop: 'anvil' },
  projects: { pos: [0, SHR], hall: 'building_market_blue', hr: 5.4, prop: 'coffin_decorated' },
  contact: { pos: [-SHR, 0], hall: 'building_castle_blue', hr: 6.9, prop: 'pillar' }
};
// anything that gets between the camera and the hero is dithered away around the line of sight
const occU = { uOccP: { value: new T.Vector3() }, uOccR: { value: 0 } }, occDone = new WeakSet();
function seeThrough(mat) {
  if (!mat || occDone.has(mat)) return; occDone.add(mat);
  mat.onBeforeCompile = sh => {
    sh.uniforms.uOccP = occU.uOccP; sh.uniforms.uOccR = occU.uOccR;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOccW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vec4 occW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n occW = instanceMatrix * occW;\n#endif\n vOccW = (modelMatrix * occW).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uOccP; uniform float uOccR; varying vec3 vOccW;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uOccR > 0.0) {
    vec3 occA = vOccW - cameraPosition, occB = uOccP - cameraPosition; float occH = dot(occA, occB) / dot(occB, occB);
    if (occH > 0.0 && occH < 0.94) {
      float occD = length(occA - occB * occH);
      if (occD < uOccR) { float occK = smoothstep(uOccR * 0.45, uOccR, occD), occN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (occN > occK * 0.94 + 0.05) discard; }
    }
  }`);
  };
  mat.customProgramCacheKey = () => 'see-through';
  mat.needsUpdate = true;
}
const dummy = new T.Object3D(), mtx = new T.Matrix4();
function scatter(name, list) {
  if (!list.length) return;
  const src = M[name], ims = []; src.updateMatrixWorld(true);
  src.traverse(o => {
    if (!o.isMesh) return;
    seeThrough(o.material);
    const im = new T.InstancedMesh(o.geometry, o.material, list.length); im.castShadow = SHADOWS; im.receiveShadow = true;
    list.forEach((t, i) => { dummy.position.set(t.x, t.y || 0, t.z); dummy.rotation.set(0, t.ry || 0, 0); dummy.scale.setScalar(t.s || 1); dummy.updateMatrix(); mtx.multiplyMatrices(dummy.matrix, o.matrixWorld); im.setMatrixAt(i, mtx); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); scene.add(im); ims.push(im);
  });
  list.forEach((t, i) => { if (t.ob) { t.ob.ims = ims; t.ob.i = i; } });   // breakable pieces remember where they were drawn
}
// trees, fences and graves give way to the pencil and the hammer
const ZERO = new T.Matrix4().makeScale(0, 0, 0);
function strikeOb(b, n) {
  if (b.dead || !b.hp) return false;
  b.hp -= n; const wood = b.kind === 'tree';
  for (let i = 0; i < 8; i++) spark(b.x + (Math.random() - 0.5), 0.6 + Math.random() * 1.6, b.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.5, wood ? 0.9 : 0.6, wood ? 0.5 : 0.6, wood ? 0.2 : 0.6, 6);
  sfx(wood ? 'impactWood_heavy_000' : 'impactMining_000', 0.5, wood ? 0.9 : 1.3, b);
  if (b.hp > 0) return true;
  b.dead = true; b.r = -1; b.ims.forEach(im => { im.setMatrixAt(b.i, ZERO); im.instanceMatrix.needsUpdate = true; });
  for (let i = 0; i < (wood ? 46 : 20); i++) spark(b.x + (Math.random() - 0.5) * 1.6, Math.random() * (wood ? 5 : 1.5), b.z + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 4, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.7 + Math.random() * 0.7, wood ? 0.9 : 0.5, wood ? 0.45 : 0.5, wood ? 0.15 : 0.55, 5);
  dust(b.x, b.z, 16, 4); sfx('impactWood_heavy_000', 0.7, wood ? 0.55 : 0.8, b); thump(wood ? 60 : 90, 0.3, 0.4, b); if (wood && !REDUCED) shake = Math.max(shake, 0.25);
  return true;
}
function put(name, x, z, ry, s, parent) { const o = M[name].clone(); o.position.set(x, 0, z); o.rotation.y = ry || 0; o.scale.setScalar(s || 1); o.traverse(c => { if (c.isMesh) { c.castShadow = SHADOWS; c.receiveShadow = true; seeThrough(c.material); } }); (parent || scene).add(o); return o; }
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
  // paths: a spoke out to each hall, and a ring road that carries the journey round from one to the next
  const inst = {};
  const add = (name, t, ob) => { if (ob) { t.ob = ob; obstacles.push(ob); } (inst[name] || (inst[name] = [])).push(t); };
  const tile = (x, z) => add(pick(['path_A', 'path_B', 'path_C']), { x, z, ry: rnd() * 6.28, s: 0.9 + rnd() * 0.4 });
  for (let k = 0; k < 4; k++) {
    const ax = Math.sin(k * Math.PI / 2), az = Math.cos(k * Math.PI / 2);
    for (let d = 3.4; d < SHR - 4; d += 1.3) { const j = (rnd() - 0.5) * 0.7; tile(ax * d + az * j, az * d - ax * j); }
  }
  for (let a = 0.07; a < Math.PI * 1.5 - 0.07; a += 1.25 / RING) { const r = RING + (rnd() - 0.5) * 0.9; tile(Math.sin(a) * r, -Math.cos(a) * r); }
  // the four graveyards
  PROFILE.realms.forEach(r => {
    const cfg = SITE[r.id], [x, z] = cfg.pos, toC = Math.atan2(-x, -z), out = toC + Math.PI;
    const fx = Math.sin(toC), fz = Math.cos(toC), px = Math.cos(toC), pz = -Math.sin(toC);   // forward (to the fire) and sideways
    const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
    cfg.rad = 0.9;
    const center = put('shrine', 0, 0, toC, 1.6, g);
    const top = new T.Box3().setFromObject(center).max.y;
    obstacles.push({ x, z, r: cfg.rad });
    const hx = x - fx * (cfg.hr + 3.4), hz = z - fz * (cfg.hr + 3.4);   // the hall, behind the pedestal, facing the fire
    put(cfg.hall, hx, hz, toC, 1); obstacles.push({ x: hx, z: hz, r: cfg.hr });
    if (cfg.prop) { const pr = put(cfg.prop, x + px * 2.6 - fx * 0.6, z + pz * 2.6 - fz * 0.6, toC + 0.5, 1.2); obstacles.push({ x: pr.position.x, z: pr.position.z, r: 0.75 }); }
    const inHall = (ax, az, m) => Math.hypot(ax - hx, az - hz) < cfg.hr + m;
    // fence arc around the back, open towards the fire
    const R = cfg.rad + 7.5, segs = Math.round(R * 3.3 / 3);
    for (let i = 0; i < segs; i++) {
      const a = out - 1.65 + (i + 0.5) / segs * 3.3, wx = x + Math.sin(a) * R, wz = z + Math.cos(a) * R;
      if (inHall(wx, wz, 1.8)) continue;
      if (Math.abs(Math.hypot(wx, wz) - RING) < 3) continue;   // never across the ring road
      add(rnd() < 0.25 ? 'fence_broken' : 'fence', { x: wx, z: wz, ry: a + Math.PI / 2 }, { x: wx, z: wz, r: 1.3, hp: 1, kind: 'fence' });
      const b = a - 1.65 / segs; add('fence_pillar', { x: x + Math.sin(b) * R, z: z + Math.cos(b) * R, ry: b });
    }
    // gate and lantern posts on the approach
    const gd = cfg.rad + 8.5;
    add('arch', { x: x + fx * gd, z: z + fz * gd, ry: toC });
    [-1, 1].forEach(sd => obstacles.push({ x: x + fx * gd + px * sd * 1.45, z: z + fz * gd + pz * sd * 1.45, r: 0.4 }));
    const lamps = [];
    [-1, 1].forEach(sd => { const lx = x + fx * (cfg.rad + 4.2) + px * sd * 2.6, lz = z + fz * (cfg.rad + 4.2) + pz * sd * 2.6; add('post_lantern', { x: lx, z: lz, ry: toC + (sd > 0 ? Math.PI : 0) }); const sp = glow(0x5fe8c8, 1.6, 0.8); sp.position.set(lx, 1.75, lz); scene.add(sp); lamps.push(sp); obstacles.push({ x: lx, z: lz, r: 0.3 }); });
    // graves and clutter, keeping the approach lane clear
    for (let i = 0, n = 0; i < 80 && n < 7; i++) {
      const a = rnd() * 6.283, d = cfg.rad + 1.8 + rnd() * 5, lx = Math.sin(a) * d, lz = Math.cos(a) * d;
      const fwd = lx * fx + lz * fz, side = lx * px + lz * pz;
      if ((fwd > 0 && Math.abs(side) < 3.2) || Math.abs(Math.hypot(x + lx, z + lz) - RING) < 2.4 || inHall(x + lx, z + lz, 1) || Math.hypot(lx - px * 2.6, lz - pz * 2.6) < 1.6) continue;
      const kind = pick(['grave_A', 'grave_B', 'grave_A_destroyed', 'gravestone', 'gravestone', 'gravemarker_A', 'gravemarker_B']);
      add(kind, { x: x + lx, z: z + lz, ry: toC + (rnd() - 0.5) * 0.5 }, kind.startsWith('grave_') ? { x: x + lx, z: z + lz, r: 0.65, hp: 1, kind: 'grave' } : null); n++;
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
    // while the path is closed, a veil of mist holds the whole graveyard
    const veil = new T.Mesh(new T.IcosahedronGeometry(VEIL, 2), new T.MeshBasicMaterial({ color: 0x9fb6d8, transparent: true, opacity: 0.1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    veil.position.set(fx * 3, 0, fz * 3); veil.add(new T.Mesh(veil.geometry, new T.MeshBasicMaterial({ color: 0xb8c8e6, transparent: true, opacity: 0.16, wireframe: true, depthWrite: false, fog: false }))); g.add(veil);
    sites.push({ r, x, z, rad: cfg.rad, top, toC, fx, fz, px, pz, g, glyph, halo, dome, beam, beamMat, light, lamps, veil, vx: x + fx * 3, vz: z + fz * 3, locked: false, guards: [], sealed: true, opened: false, hold: 0 });
  });
  // forest
  {
    // palette lock: autumn pines and dead trees only, so the forest stays in the ember / spectral range
    const kinds = ['tree_pine_orange_large', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium', 'tree_pine_yellow_medium', 'tree_dead_large', 'tree_dead_medium'];
    const spots = [];
    for (let i = 0; i < 1600 && spots.length < 210; i++) {
      const a = rnd() * 6.283, d = 11 + rnd() * 78, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if ((Math.abs(x) < 4.6 || Math.abs(z) < 4.6) && d < SHR + 6) continue;   // spokes stay wide
      if (Math.abs(d - RING) < 3.6) continue;                                   // so does the ring road
      if (d < 50 && rnd() < 0.45) continue;                                     // the clearing itself is thinly wooded
      if (sites.some(s => Math.hypot(x - s.x, z - s.z) < 11) || Object.values(SITE).some(c => Math.hypot(x - (c.pos[0] * (1 + (c.hr + 3.4) / SHR)), z - (c.pos[1] * (1 + (c.hr + 3.4) / SHR))) < c.hr + 3.5)) continue;
      if (spots.some(s => Math.hypot(s.x - x, s.z - z) < 3.4)) continue;
      spots.push({ x, z }); const y = d > 53 ? Math.pow((d - 53) / 14, 1.7) * 2.2 : 0;
      add(pick(kinds), { x, z, y, ry: rnd() * 6.28, s: (d > 50 ? 1.5 : 1.05) + rnd() * 0.55 }, d < 53 ? { x, z, r: 0.5, hp: 2, kind: 'tree' } : null);
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

/* ---------- brush-stroke trail: the path the axe head draws, as a dry-brush mark ---------- */
const brushTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 150; i++) {   // one bristle each: runs the length, thins and breaks up towards the tail
    const y = 3 + Math.random() * 58, w = 0.6 + Math.random() * 2.4, edge = Math.sin(Math.PI * y / 64), dry = 0.25 + Math.random() * 0.75;
    let x = Math.random() * 14;
    while (x < 512) {
      const u = x / 512, len = 8 + Math.random() * 60 * (1 - u * 0.6), gap = Math.random() < u * dry * 1.5 ? 6 + Math.random() * 46 * u : 0;
      g.globalAlpha = Math.max(0, (0.25 + Math.random() * 0.55) * Math.pow(edge, 0.5) * (1 - u * 0.5));
      g.fillStyle = '#fff'; g.fillRect(x, y, len, w); x += len + gap;
    }
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
})();
class Trail {
  constructor(n, color) {
    this.n = n; this.sub = 3; this.m = (n - 1) * this.sub + 1; this.tip = []; this.base = []; this.k = 0; this.on = false; this.drawing = false;
    for (let i = 0; i < n; i++) { this.tip.push(new T.Vector3()); this.base.push(new T.Vector3()); }
    const m = this.m; this.pos = new Float32Array(m * 6); const uv = new Float32Array(m * 4), idx = [];
    for (let i = 0; i < m; i++) { uv[i * 4] = uv[i * 4 + 2] = i / (m - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 3] = 1; if (i < m - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(this.pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx);
    this.mat = new T.MeshBasicMaterial({ map: brushTex, color: new T.Color(color).multiplyScalar(1.8), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    this.mesh = new T.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
    this.a = new T.Vector3(); this.b = new T.Vector3();
  }
  // Catmull-Rom through the recorded points, so a low frame rate still draws a curve instead of corners
  static cr(out, p, i, t, n) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[Math.min(n - 1, i + 1)], p3 = p[Math.min(n - 1, i + 2)], t2 = t * t, t3 = t2 * t;
    for (const ax of ['x', 'y', 'z']) out[ax] = 0.5 * (2 * p1[ax] + (p2[ax] - p0[ax]) * t + (2 * p0[ax] - 5 * p1[ax] + 4 * p2[ax] - p3[ax]) * t2 + (3 * p1[ax] - p0[ax] - 3 * p2[ax] + p3[ax]) * t3);
    return out;
  }
  update(active, tip, base, dt) {
    if (active) {
      if (!this.drawing) { for (let i = 0; i < this.n; i++) { this.tip[i].copy(tip); this.base[i].copy(base); } }   // a new stroke never joins the last one
      else { const t = this.tip.pop(), b = this.base.pop(); t.copy(tip); b.copy(base); this.tip.unshift(t); this.base.unshift(b); }
      this.drawing = true; this.on = true; this.k = Math.min(1, this.k + dt * 16);
    } else {
      this.drawing = false; if (!this.on) return;
      this.k -= dt * 3; if (this.k <= 0) { this.k = 0; this.on = false; this.mesh.visible = false; return; }   // the mark stays where it was drawn and dries out
    }
    this.mesh.visible = true; this.mat.opacity = this.k;
    for (let v = 0; v < this.m; v++) {
      const i = Math.min(this.n - 2, Math.floor(v / this.sub)), t = v / this.sub - i, u = v / (this.m - 1);
      const a = Trail.cr(this.a, this.tip, i, t, this.n), b = Trail.cr(this.b, this.base, i, t, this.n);
      const w = Math.pow(1 - u, 0.6) * (0.75 + 0.25 * Math.sin(u * 9)), j = v * 6;   // pressed down at the head, lifting and wavering towards the tail
      this.pos[j] = a.x; this.pos[j + 1] = a.y; this.pos[j + 2] = a.z;
      this.pos[j + 3] = a.x + (b.x - a.x) * w; this.pos[j + 4] = a.y + (b.y - a.y) * w; this.pos[j + 5] = a.z + (b.z - a.z) * w;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
function dust(x, z, n, sp) { for (let i = 0; i < n; i++) spark(x + (Math.random() - 0.5) * 0.6, 0.08, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * sp, 0.3 + Math.random() * 0.9, (Math.random() - 0.5) * sp, 0.45 + Math.random() * 0.5, 0.17, 0.16, 0.14, 1.4); }

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
      if (o.name === 'chest') this.chest = o;
    });
    scene.add(this.root);
  }
  hold(model, left) {
    const w = M[model].clone(); w.traverse(c => { if (c.isMesh) c.castShadow = SHADOWS; });
    // The library re-centres each weapon on its base and turns it half a turn: the hand ends up on the butt of the
    // handle and the edge faces backwards. Put the grip back in the fist and turn the edge to lead the swing
    // (measured: the slot's +Y is the weapon axis, +X is the cutting direction at impact).
    if (!left && w.children[0]) { w.children[0].position.set(0, 0, 0); w.rotation.y = Math.PI; }
    (left ? this.handL : this.handR).add(w); return w;
  }
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

const P = { x: 0, z: 2.9, face: 0, hp: 100, inv: 0, dodge: 0, dx: 0, dz: 0, cd: 0, lock: 0, dead: false, healed: false, rage: 0, raged: false, combo: 0, comboT: 0, swing: 0, swingDur: 1, hitDone: true, queued: false, yawB: Math.PI, tw: 0, pitchB: 0, chestTw: 0, lunge: 0, lungeSp: 7, throwT: 0, step: 0, moving: false, sprint: false, atk: null, whooshed: true, idleT: 0, beat: 0 };
let hero = null, pencil = null, handHammer = null, fly = null, flyIn = null, trail = null;
const qTw = new T.Quaternion(), UP = new T.Vector3(0, 1, 0);
const camF = new T.Vector3(0, 0, 2.9), tipV = new T.Vector3(), baseV = new T.Vector3();
let lean = 0, flyWhoosh = 0;
const G = { state: 'held', pos: new T.Vector3(), dir: new T.Vector3(), dist: 0, hit: new Set(), spin: 0, pending: null };
const enemies = [], bolts = [], runes = [];
const prints = []; let printI = 0, printD = 0;
const wave = { m: null, r: 0, live: false, hit: false };
const cRed = new T.Color(0xff3b2e), cWhite = new T.Color(0xffffff), cBlack = new T.Color(0);

// fraction of each clip at which the blow lands, measured from the rig
const IMPACT = { Melee_1H_Attack_Chop: 0.57, Melee_1H_Attack_Slice_Diagonal: 0.42, Melee_2H_Attack_Slice: 0.39, Melee_2H_Attack_Chop: 0.52 };
const KIND = {
  minion: { model: 'Skeleton_Minion', scale: 1, hp: 100, dmg: 10, speed: 3.0, wind: 0.6, reach: 1, weapon: 'Skeleton_Blade', attacks: ['Melee_1H_Attack_Chop', 'Melee_1H_Attack_Slice_Diagonal'] },
  mage: { model: 'Skeleton_Mage', scale: 1, hp: 70, dmg: 12, speed: 2.4, wind: 0.75, reach: 1, weapon: 'Skeleton_Staff', attacks: [] },
  boss: { model: 'Skeleton_Warrior', scale: 1.65, hp: 380, dmg: 18, speed: 2.5, wind: 0.85, reach: 1.55, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Large_A', attacks: ['Melee_1H_Attack_Chop', 'Melee_2H_Attack_Slice'] }
};
function makeEnemy(site, ox, oz, kind, risen) {
  const k = KIND[kind], a = new Actor(k.model, k.scale, true);
  a.hold(k.weapon); if (k.shield) a.hold(k.shield, true);
  const eye = glow(0x5fe8c8, 0.9 * k.scale, 0.9); if (a.head) { eye.position.set(0, 0.45, 0.25); a.head.add(eye); }
  const e = { a, kind, k, site, boss: kind === 'boss', sc: k.scale, eye, hx: site.x + ox, hz: site.z + oz, x: site.x + ox, z: site.z + oz, hp: k.hp, max: k.hp, speed: k.speed, state: risen ? 'awaken' : 'dormant', key: '', t: 0, stun: 0, flash: 0, dead: false, cool: 1.2, side: Math.random() < 0.5 ? -1 : 1, atk: 0, p2: false, vx: 0, vz: 0, hitN: 0, clip: '', rot: site.toC + (Math.random() - 0.5) };
  a.root.position.set(e.x, 0, e.z); a.root.rotation.y = e.rot;
  if (risen) { a.play('Skeletons_Spawn_Ground', { once: true, fade: 0, scale: 2 }); e.key = 'awaken'; e.awake = CLIPS.Skeletons_Spawn_Ground.duration / 2 * 0.92; }
  else { a.play('Skeletons_Inactive_Floor_Pose', { fade: 0 }); e.key = 'dormant'; }
  a.mixer.update(0.01);
  enemies.push(e); site.guards.push(e); return e;
}

function buildActors() {
  hero = new Actor('Ranger', 1, true);
  // the pencil: drawn with, and fought with. Point outwards, held near the eraser.
  pencil = M.pencil_B_long.clone(); pencil.traverse(c => { if (c.isMesh) c.castShadow = SHADOWS; });
  if (pencil.children[0]) pencil.children[0].position.set(0, 0, 0);
  pencil.scale.setScalar(3.1); pencil.rotation.x = Math.PI; pencil.position.y = 0.52; hero.handR.add(pencil);
  // the hammer: carried in the off hand once earned, thrown to build
  handHammer = M.hammer.clone(); handHammer.traverse(c => { if (c.isMesh) c.castShadow = SHADOWS; });
  if (handHammer.children[0]) handHammer.children[0].position.set(0, 0, 0);
  handHammer.scale.setScalar(1.25); handHammer.rotation.y = Math.PI; if (hero.handL) hero.handL.add(handHammer); handHammer.visible = can.hammer;
  hero.root.position.set(P.x, 0, P.z); hero.root.rotation.y = P.face + Math.PI;
  hero.play('Sit_Floor_Idle', { fade: 0 });
  // the thrown hammer: tumbles head over handle along its flight, comes back to the hand
  fly = new T.Group(); flyIn = M.hammer.clone(); flyIn.scale.setScalar(1.9);
  if (flyIn.children[0]) flyIn.children[0].position.set(0, 0, 0);
  flyIn.rotation.y = Math.PI / 2; flyIn.position.set(0, -0.55, 0);
  const piv = new T.Group(); piv.add(flyIn); fly.add(piv); fly.userData.piv = piv;
  fly.add(glow(0xff8a3c, 2.2, 0.5)); const fl = new T.PointLight(0xff8a3c, 10, 9, 1.8); fly.add(fl); fly.visible = false; scene.add(fly);
  trail = new Trail(16, 0xffc890);
  hero.root.rotation.order = 'YXZ';
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
  refreshLocks(false); applyEvo();

  { const geo = new T.IcosahedronGeometry(0.26, 0), mat = new T.MeshBasicMaterial({ color: new T.Color(0x9fffe0).multiplyScalar(2), fog: false });
    for (let i = 0; i < 8; i++) { const m = new T.Mesh(geo, mat); m.add(glow(0x5fe8c8, 2, 0.6)); m.visible = false; scene.add(m); bolts.push({ m, live: false, vx: 0, vz: 0, t: 0 }); } }
  wave.m = new T.Mesh(new T.RingGeometry(0.88, 1, 64), new T.MeshBasicMaterial({ color: new T.Color(0x8ff5dd).multiplyScalar(1.6), transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false }));
  wave.m.rotation.x = -Math.PI / 2; wave.m.position.y = 0.14; scene.add(wave.m);
  { const geo = new T.OctahedronGeometry(0.2, 0), mat = new T.MeshBasicMaterial({ color: new T.Color(0xffd27a), fog: false });
    // laid out along the journey in the order they were learned: out the first spoke, then round the ring road
    const n = ALL_TAGS.length, per = Math.ceil(n / sites.length);
    ALL_TAGS.forEach((tag, i) => {
      if (save.runes.includes(tag)) return;
      const st = Math.min(sites.length - 1, Math.floor(i / per)), j = i - st * per, lat = (j % 2 ? 1 : -1) * 2.2, o = { x: 0, z: 0 };
      if (st === 0) { const d = 6 + j * (10 / Math.max(1, per - 1)); o.x = lat; o.z = -d; }
      else { const a = (st - 1) * Math.PI / 2 + 0.3 + j * (0.95 / Math.max(1, per - 1)), r = RING + lat; o.x = Math.sin(a) * r; o.z = -Math.cos(a) * r; }
      collide(o, 1.2);
      const m = new T.Mesh(geo, mat); m.add(glow(0xffd27a, 1.5, 0.3)); m.position.set(o.x, 1.1, o.z); scene.add(m); runes.push({ tag, m, x: o.x, z: o.z, got: false }); }); }
}
const DIRS = { '0,-1': '북쪽', '1,0': '동쪽', '-1,0': '서쪽', '0,1': '남쪽' };
function refreshLocks(announce) {
  sites.forEach((s, i) => {
    const was = s.locked; s.locked = i > 0 && !save.opened.includes(ORDER[i - 1]);
    s.veil.visible = s.locked; s.beam.visible = !s.locked; s.glyph.visible = s.halo.visible = !s.locked; s.light.visible = !s.locked; if (s.sealed) s.dome.visible = !s.locked;
    s.lamps.forEach(l => { l.visible = !s.locked; });
    if (announce && was && !s.locked) { burst(s.vx, 3, s.vz, 120, 9, 1.6, 0.6, 0.75, 1, 1); s.opening = true; }
  });
  if (handHammer) handHammer.visible = can.hammer && G.state === 'held';
  $('#rageWrap').hidden = !can.ship;
  const k = $('#keys'); if (k) k.innerHTML = keysHTML();
}
function keysHTML() {
  return `<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동 · <kbd>Shift</kbd> 질주 · <kbd>Space</kbd> 대시</span>` +
    `<span><kbd>클릭</kbd> 연필 긋기(4연타)` + (can.hammer ? ` · <kbd>우클릭</kbd>/<kbd>Q</kbd> 망치 던지기·회수` : '') + `</span>` +
    `<span>` + (can.ship ? `<kbd>R</kbd> 출시 · ` : '') + `<kbd>E</kbd> 조사 · <kbd>J</kbd> 일지</span>`;
}
// what each record gives: the next path, and the next tool
function announceUnlock(id) {
  const i = ORDER.indexOf(id), next = sites[i + 1], dir = next ? DIRS[Math.sign(Math.round(next.x)) + ',' + Math.sign(Math.round(next.z))] : '';
  chime([659.3, 784, 987.8, 1318.5], 0.07, 0.1);
  if (i === 0) toast('망치를 얻었다', (TOUCH ? '던지기 버튼으로 던지고 다시 눌러 불러들입니다' : '우클릭으로 던지고, 다시 눌러 불러들입니다') + ` · ${dir} 길이 열렸다`, 6.5);
  else if (i === 1) toast('출시를 익혔다', (TOUCH ? '몰입이 가득 차면 출시 버튼' : '몰입이 가득 차면 R') + `으로 주변을 휩씁니다 · ${dir} 길이 열렸다`, 6.5);
  else if (next) toast('마지막 길이 열렸다', `${dir} 성에서 해골왕이 기다린다`, 6);
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

/* ---------- sound: samples for impacts, synthesis for air, fire and tone ---------- */
let AC = null, master = null, muted = false, musicA = null, musicB = null, noiseBuf = null;
const distVol = at => (at ? clamp(1 - Math.hypot(at.x - P.x, at.z - P.z) / 24, 0, 1) : 1);
function sfx(name, vol, rate, at) {
  if (!AC || muted || !BUF[name]) return;
  try { const s = AC.createBufferSource(); s.buffer = BUF[name]; s.playbackRate.value = (rate || 1) * (0.93 + Math.random() * 0.14); const g = AC.createGain(); g.gain.value = (vol === undefined ? 0.5 : vol) * distVol(at); s.connect(g); g.connect(master); s.start(); } catch (e) {}
}
function tone(type, f0, f1, dur, vol, delay) {
  if (!AC || muted) return;
  try { const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03); } catch (e) {}
}
// the air a blade moves: band-passed noise swept up and back
function whoosh(dur, f0, f1, vol, q, at) {
  if (!AC || muted || !noiseBuf) return;
  try {
    const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), v = vol * distVol(at); if (v < 0.004) return;
    s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = q || 1.1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.55); f.frequency.exponentialRampToValueAtTime(Math.max(60, f0 * 0.7), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  } catch (e) {}
}
const thump = (f, dur, vol, at) => tone('sine', f, f * 0.4, dur, vol * distVol(at));
function chime(notes, vol, step) { notes.forEach((n, i) => { tone('sine', n, n, 0.55, vol, i * step); tone('triangle', n * 2, n * 2, 0.22, vol * 0.3, i * step); }); }
function rattle(at, n) { for (let i = 0; i < (n || 5); i++) setTimeout(() => sfx('impactWood_heavy_000', 0.16, 2 + Math.random() * 1.2, at), i * 75 + Math.random() * 40); }
function growl(at) { const v = distVol(at); tone('sawtooth', 78, 42, 1.0, 0.16 * v); tone('sawtooth', 117, 60, 0.9, 0.07 * v); whoosh(1.0, 140, 420, 0.3, 0.7, at); }
function loopTrack(name, vol) { if (!BUF[name]) return null; const s = AC.createBufferSource(); s.buffer = BUF[name]; s.loop = true; const g = AC.createGain(); g.gain.value = vol; s.connect(g); g.connect(master); s.start(); return g; }
function initAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = muted ? 0 : 1;
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; master.connect(comp); comp.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const jobs = Object.keys(AUDIO_RAW).map(n => new Promise(res => { try { AC.decodeAudioData(AUDIO_RAW[n].slice(0), b => { BUF[n] = b; res(); }, () => res()); } catch (e) { res(); } }));
      Promise.all(jobs).then(() => { musicA = loopTrack('dark_hallway', 0.2); musicB = loopTrack('epic_boss_battle', 0); });
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) {}
}
// things that sound on their own: the fire, a failing heart
function ambientSound(real) {
  if (!AC || muted) return;
  const d = Math.hypot(P.x, P.z);
  if (d < 16 && Math.random() < real * 11) whoosh(0.02 + Math.random() * 0.05, 1800 + Math.random() * 3500, 900, (1 - d / 16) * (0.05 + Math.random() * 0.13), 2.5);
  if (state === 'play' && !P.dead && P.hp < 30) { P.beat -= real; if (P.beat <= 0) { P.beat = 0.85; thump(58, 0.14, 0.4); tone('sine', 50, 22, 0.16, 0.3, 0.2); } }
}
$('#btnSound').onclick = () => { muted = !muted; if (master) master.gain.value = muted ? 0 : 1; $('#btnSound').textContent = muted ? '소리 끔' : '소리 켬'; $('#btnSound').setAttribute('aria-pressed', String(!muted)); };

/* ---------- HUD ---------- */
const compassItems = [];
function buildHud() {
  const c = $('#compass');
  const add = (txt, cls, getA, ref) => { const d = document.createElement('span'); d.className = 'cm ' + cls; d.textContent = txt; c.appendChild(d); compassItems.push({ d, getA, ref }); };
  [['북', 0], ['서', Math.PI / 2], ['남', Math.PI], ['동', -Math.PI / 2]].forEach(([t, a]) => add(t, '', () => a));
  sites.forEach(s => add('◆' + s.r.label, 'realm', () => (s.locked ? null : Math.atan2(-(s.x - P.x), -(s.z - P.z))), s));
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
  sites.forEach(s => { const li = $(`#questList li[data-id="${s.r.id}"]`); li.classList.toggle('done', s.opened); li.classList.toggle('locked', s.locked); });
  $('#questRunes').textContent = `기술 룬 ${save.runes.length} / ${ALL_TAGS.length}`;
  $('#lvl').textContent = 'Lv ' + lvl(); $('#xpBar').style.transform = `scaleX(${(save.xp % XP_PER) / XP_PER})`;
}
let toastT = 0;
function toast(msg, sub, dur) { const t = $('#toast'); t.innerHTML = esc(msg) + (sub ? `<small>${esc(sub)}</small>` : ''); t.classList.add('on'); toastT = dur || 3.2; }
function dmgNum(x, y, z, n, big) { v3.set(x, y, z).project(camera); if (v3.z > 1) return; const d = document.createElement('span'); d.className = 'dmg' + (big ? ' big' : ''); d.textContent = n; d.style.transform = `translate(${((v3.x + 1) / 2 * app.clientWidth).toFixed(0)}px,${((1 - v3.y) / 2 * app.clientHeight).toFixed(0)}px)`; $('#hud').appendChild(d); d.addEventListener('animationend', () => d.remove()); }
const STEPS = ['스케치', '와이어프레임', '프로토타입', '빌드'];
function stepLabel(t) { v3.set(P.x, 2.5, P.z).project(camera); if (v3.z > 1) return; const d = document.createElement('span'); d.className = 'dmg step'; d.textContent = t; d.style.transform = `translate(${((v3.x + 1) / 2 * app.clientWidth).toFixed(0)}px,${((1 - v3.y) / 2 * app.clientHeight).toFixed(0)}px) translateX(-50%)`; $('#hud').appendChild(d); d.addEventListener('animationend', () => d.remove()); }
function flash(o) { if (REDUCED) return; const el = $('#flash'); el.style.transition = 'none'; el.style.opacity = o; requestAnimationFrame(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 0; }); }
function gainRage(n) { if (!can.ship) return; P.rage = Math.min(100, P.rage + n); if (P.rage >= 100 && !P.raged) { P.raged = true; toast('몰입이 가득 찼다', TOUCH ? '출시 버튼으로 주변을 휩쓸 수 있습니다' : 'R을 눌러 출시하세요. 주변을 휩씁니다'); } }
const XP_PER = 120;
const lvl = () => 1 + Math.floor(save.xp / XP_PER), has = n => lvl() >= n;
const EVO = [
  { lv: 2, name: '세 번째 획 · 프로토타입', d: '연속 긋기가 한 바퀴 도는 회전 긋기까지 이어집니다' },
  { lv: 3, name: '네 번째 획 · 빌드', d: '뛰어올라 내려찍는 마무리가 열립니다' },
  { lv: 4, name: '굵은 획', d: '연필이 커지고 획이 더 멀리, 더 세게 닿습니다' },
  { lv: 5, name: '연쇄 망치', d: '던진 망치가 가까운 다른 적에게 한 번 더 튑니다' },
  { lv: 6, name: '단축키', d: '대시가 적을 긋고 지나가며, 더 빨리 다시 쓸 수 있습니다' },
  { lv: 7, name: '빌드 충격', d: '마무리 착지에서 먹물 고리가 퍼져 주변을 칩니다' },
  { lv: 8, name: '큰 출시', d: '출시가 더 넓은 범위를 휩씁니다' }
];
const comboLen = () => (has(3) ? 4 : has(2) ? 3 : 2);
function applyEvo() { if (pencil) pencil.scale.setScalar(has(4) ? 3.8 : 3.1); if (pencil) pencil.position.y = has(4) ? 0.66 : 0.52; }
function addXP(n) {
  const before = lvl(); save.xp += n; persist(); refreshQuest();
  if (lvl() > before) { chime([784, 987.8, 1174.7, 1568], 0.07, 0.09); applyEvo(); const e = EVO.find(v => v.lv === lvl()); toast('레벨 ' + lvl() + (e ? ' · ' + e.name : ''), e ? e.d : '여정이 깊어졌다', 5); if (e && !REDUCED) burst(P.x, 1.2, P.z, 60, 6, 1.2, 1, 0.8, 0.4, 1); }
}

/* ---------- actions ---------- */
const moveX = () => (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + joy.x;
const moveZ = () => (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
const busy = () => P.dead || P.lock > 0 || P.dodge > 0;
function handPos(out) { return out.set(P.x + Math.cos(P.face) * 0.4, 1.25, P.z - Math.sin(P.face) * 0.4); }
// dur: seconds of control lost · imp: clip fraction where the blow lands · end: clip fraction played before control returns
// tw / pitch / hop: what the whole body does over the swing (progress 0..1) — wind up against the blow, then unwind
// through it, so the arc travels around the side of the body where a camera behind the hero can see it.
const ATTACKS = [
  { clip: 'Melee_1H_Attack_Slice_Diagonal', dur: 0.5, imp: 0.42, end: 0.72, dmg: 22, R: 3.0, kb: 0.8, arc: 0.1, chest: 0.5,
    tw: [[0, 0], [0.3, -0.9], [0.58, 0.35], [1, 1.0]], pitch: [[0, 0], [0.3, -0.14], [0.6, 0.22], [1, 0.05]] },
  { clip: 'Melee_1H_Attack_Slice_Horizontal', dur: 0.48, imp: 0.2, end: 0.5, dmg: 26, R: 3.1, kb: 0.9, arc: 0, chest: 0.5,
    tw: [[0, 0], [0.22, 0.85], [0.42, -0.3], [1, -1.05]], pitch: [[0, 0], [0.22, -0.08], [0.45, 0.14], [1, 0]] },
  { clip: 'Melee_1H_Attack_Slice_Horizontal', dur: 0.62, imp: 0.25, end: 0.62, dmg: 30, R: 3.3, kb: 1.7, all: true, spin: true, chest: 0,
    tw: [[0, 0], [0.16, 0.75], [0.82, -6.0], [1, -6.2832]], pitch: [[0, 0], [0.16, -0.1], [0.5, 0.16], [1, 0]], hop: [[0, 0], [0.4, 0.18], [0.8, 0], [1, 0]] },
  { clip: 'Melee_1H_Attack_Jump_Chop', dur: 0.84, imp: 0.58, end: 0.88, dmg: 50, R: 3.6, kb: 2.2, heavy: true, chest: 0.4,
    tw: [[0, 0], [0.36, -0.6], [0.66, 0.2], [1, 0.1]], pitch: [[0, 0], [0.36, -0.34], [0.66, 0.5], [1, 0.08]], hop: [[0, 0], [0.42, 0.75], [0.6, 0.3], [0.67, 0], [1, 0]] }
];
function kf(keys, p) {   // eased keyframes
  if (!keys) return 0;
  for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) { const a = keys[i - 1], b = keys[i], t = clamp((p - a[0]) / (b[0] - a[0] || 1), 0, 1), e = t * t * (3 - 2 * t); return a[1] + (b[1] - a[1]) * e; }
  return keys[keys.length - 1][1];
}
const DASH = { clip: 'Melee_1H_Attack_Stab', dur: 0.48, imp: 0.27, end: 0.57, dmg: 32, R: 3.3, kb: 1.8, arc: 0.5, dash: true, chest: 0.4,
  tw: [[0, 0], [0.2, -0.5], [0.5, 0.3], [1, 0.1]], pitch: [[0, 0], [0.2, -0.1], [0.5, 0.3], [1, 0.05]] };
function slash() {
  if (state !== 'play' || busy()) return;
  if (G.state !== 'held') { if (G.state === 'out') { G.state = 'back'; G.hit.clear(); } return; }
  if (P.swing > 0) { if (P.swing < P.swingDur * 0.6) P.queued = true; return; }
  if (P.throwT > 0) return;
  let atk;
  if (P.sprint && P.moving && P.comboT <= 0) atk = DASH;   // running in: a lunging stab
  else { P.combo = P.comboT > 0 ? (P.combo + 1) % comboLen() : 0; atk = ATTACKS[P.combo]; }
  P.atk = atk; P.swingDur = P.swing = atk.dur; P.comboT = atk.dur + 0.5; P.hitDone = false; P.whooshed = false; P.queued = false;
  // aim help: turn to the nearest enemy roughly ahead, and close the gap
  let tx = fwd.x, tz = fwd.z, best = 6.5;
  for (const e of enemies) { if (e.dead || e.site.locked) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; if (d < best && (dx * fwd.x + dz * fwd.z) / d > -0.3) { best = d; tx = dx / d; tz = dz / d; } }
  P.face = Math.atan2(-tx, -tz); P.dx = tx; P.dz = tz;
  P.lunge = atk.dash ? 0.2 : (best > 2 && best < 6.5 ? Math.min(0.3, (best - 1.8) / 9) : 0.05); P.lungeSp = atk.dash ? 13 : 9;
  hero.play(atk.clip, { once: true, dur: atk.dur / atk.end, fade: 0.07 });
  stepLabel(atk.dash ? '단축키' : STEPS[P.combo]);
  if (atk.heavy) whoosh(0.3, 220, 700, 0.3, 0.8);
  if (atk.spin) whoosh(0.5, 300, 1500, 0.4, 0.9);
  if (atk.dash) dust(P.x, P.z, 8, 2.5);
}
function throwAxe(auto) {
  if (state !== 'play' || busy()) return;
  if (!can.hammer) { if (!P.hintT || time - P.hintT > 5) { P.hintT = time; toast('아직 던질 것이 없다', '첫 기록을 깨우면 망치를 얻습니다', 2.6); } return; }
  if (G.state === 'out') { G.state = 'back'; G.hit.clear(); return; }
  if (G.state !== 'held' || P.cd > 0 || P.swing > 0 || P.throwT > 0) return;
  let target = null, best = auto ? 0.5 : 0.955;   // about 17 degrees of help around the crosshair
  ray.setFromCamera(auto ? tmp2.set(0, 0, 0) : aim, camera);
  for (const e of enemies) {
    if (e.dead || e.site.locked) continue;
    tmp.set(e.x, 1.2 * e.sc, e.z).sub(ray.ray.origin); const d = tmp.length(); if (d > 40) continue;
    const dot = tmp.normalize().dot(ray.ray.direction) - (auto ? d * 0.004 : 0);
    if (dot > best) { best = dot; target = e; }
  }
  if (target) tmp.set(target.x, 1.2 * target.sc, target.z);
  else { tmp.copy(ray.ray.direction).multiplyScalar(30).add(ray.ray.origin); if (tmp.y < 0.6) tmp.y = 0.6; }
  handPos(G.pos); G.dir.copy(tmp).sub(G.pos).normalize(); G.target = target; G.chained = false;
  P.face = Math.atan2(-G.dir.x, -G.dir.z); P.throwT = 0.46; P.cd = 0.55; G.pending = 0.27;
  hero.play('Throw', { once: true, dur: 0.55, fade: 0.06 });   // the hand lets go about halfway through the clip
}
function dodge() {
  if (state !== 'play' || P.dead || P.lock > 0 || P.dodge > 0 || P.cd > 0.4) return;
  let mx = moveX(), mz = moveZ(), back = false;
  if (!mx && !mz) { P.dx = Math.sin(P.face); P.dz = Math.cos(P.face); back = true; }
  else { const l = Math.hypot(mx, mz); mx /= l; mz /= l; P.dx = right.x * mx + fwd.x * mz; P.dz = right.z * mx + fwd.z * mz; P.face = Math.atan2(-P.dx, -P.dz); }
  P.dodge = 0.42; P.inv = 0.46; P.cd = has(6) ? 0.45 : 0.65; P.swing = 0; P.queued = false; P.dashHit = new Set();
  hero.play(back ? 'Dodge_Backward' : 'Dodge_Forward', { once: true, dur: 0.48, fade: 0.05 });
  whoosh(0.24, 260, 900, 0.3, 0.7); sfx('cloth1', 0.3); dust(P.x, P.z, 10, 3);
}
function nova() {
  if (state !== 'play' || busy() || P.rage < 100 || !can.ship) return;
  P.rage = 0; P.raged = false; P.inv = Math.max(P.inv, 0.9); P.lock = 0.7; P.swing = 0;
  hero.play('Melee_2H_Attack_Spin', { once: true, dur: 0.8, fade: 0.06 });
  for (const e of enemies) { if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; if (d < (has(8) ? 10.5 : 8)) hitEnemy(e, 70, dx / d, dz / d, 2.6); }
  for (const b of obstacles) if (b.hp && !b.dead && Math.hypot(b.x - P.x, b.z - P.z) < 6) strikeOb(b, 3);
  bolts.forEach(b => { if (b.live) killBolt(b); });
  burst(P.x, 1, P.z, has(8) ? 220 : 160, has(8) ? 13 : 10, 1, 1, 0.6, 0.2, 2); if (!REDUCED) { shake = 0.9; slowT = 0.5; } flash(0.4);
  whoosh(0.8, 180, 3200, 0.6, 0.6); thump(62, 0.6, 0.6); sfx('impactBell_heavy_000', 0.4, 0.45); dust(P.x, P.z, 26, 7);
}
function hurtPlayer(n) {
  if (P.inv > 0 || P.dead) return;
  P.hp -= n; P.inv = 0.55; shake = 0.5; gainRage(5);
  sfx('impactPunch_medium_000', 0.7); sfx('impactSoft_heavy_000', 0.5); thump(72, 0.2, 0.45);
  const h = $('#hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = ''; h.style.opacity = 0; });
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; P.swing = 0; hero.play('Death_A', { once: true });
    setTimeout(() => { $('#fade').style.opacity = 1; }, 900);
    setTimeout(() => {
      P.x = 0; P.z = 3; camF.set(0, 0, 3); P.tw = 0; P.pitchB = 0; hero.root.position.y = 0; P.hp = 100; P.dead = false; P.inv = 2; yaw = 0; P.face = 0; G.state = 'held'; fly.visible = false; handHammer.visible = can.hammer;
      bolts.forEach(b => { if (b.live) killBolt(b); }); wave.live = false; wave.m.material.opacity = 0;
      enemies.forEach(e => { if (!e.dead && e.state !== 'dormant') { e.x = e.hx; e.z = e.hz; e.state = 'idle'; } });
      hero.play('Idle_A', { fade: 0 }); $('#fade').style.opacity = 0; toast('모닥불 곁에서 다시 일어섰다', '해골의 눈이 붉게 빛나면 Space로 대시해 피하세요');
    }, 1900);
  } else if (P.swing <= 0 && P.dodge <= 0 && P.lock <= 0) { hero.play('Hit_A', { once: true, dur: 0.45, fade: 0.05 }); P.lock = 0.28; }
}
function hitEnemy(e, n, dx, dz, kb, stun) {
  const k = (kb || 0.5) * (e.boss ? 0.3 : 1), big = n >= 40;
  e.hp -= n; e.flash = 1; e.stun = e.boss ? 0.12 : (stun || 0.38); e.vx += dx * k * 9; e.vz += dz * k * 9; e.key = '';
  if (e.state === 'dormant') { e.state = 'awaken'; e.t = 0; }
  else if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
  for (let i = 0; i < (big ? 22 : 12); i++) spark(e.x, 1.3 * e.sc, e.z, dx * (3 + Math.random() * 5) + (Math.random() - 0.5) * 3, 1 + Math.random() * 4, dz * (3 + Math.random() * 5) + (Math.random() - 0.5) * 3, 0.3 + Math.random() * 0.4, 1, 0.85, 0.6, 9);
  dmgNum(e.x, 2.3 * e.sc, e.z, n, big);
  if (!REDUCED) { hitstop = big ? 0.12 : 0.07; shake = Math.max(shake, big ? 0.5 : 0.25); if (big) fovKick += 5; }
  sfx('impactPunch_heavy_000', 0.6, big ? 0.85 : 1, e); sfx('impactWood_heavy_000', 0.4, 1.2 + Math.random() * 0.5, e); thump(big ? 80 : 105, 0.13, 0.4, e);
  if (big) sfx('impactPlate_heavy_000', 0.45, 0.8, e);
  if (e.boss && !e.p2 && e.hp > 0 && e.hp <= e.max / 2) {
    e.p2 = true; e.speed = 3.1; e.state = 'taunt'; e.t = 0; toast('해골왕이 격노한다', '땅을 내리치면 고리가 퍼집니다. 대시로 뚫으세요', 4.5);
    [-1, 1].forEach(s => { const w = makeEnemy(e.site, e.x - e.site.x + s * 3.5, e.z - e.site.z, 'minion', true); dust(w.x, w.z, 18, 4); rattle(w, 6); });
    growl(e);
  }
  if (e.hp <= 0) {
    e.dead = true; e.t = 0; e.eye.visible = false; rattle(e, e.boss ? 9 : 5); sfx('impactWood_heavy_000', 0.6, 0.6, e); thump(60, 0.3, 0.4, e);
    burst(e.x, 1.2 * e.sc, e.z, e.boss ? 90 : 36, 5, 1.1, 0.4, 0.9, 0.8, 3); save.kills = (save.kills || 0) + 1; addXP(e.boss ? 60 : 15);
    const s = e.site;
    if (s.sealed && s.guards.every(g => g.dead)) { s.sealed = false; s.dome.visible = false; burst(s.x, 2, s.z, 80, 7, 1, 0.4, 0.9, 0.8, 5); sfx('metalLatch', 0.7, 0.6); sfx('impactBell_heavy_000', 0.45, 0.7); whoosh(1.3, 2400, 300, 0.22, 1.5); if (!REDUCED) slowT = 0.9; toast('봉인이 깨졌다', `${s.r.place}에 다가가 기록을 깨우세요`); }
  }
}
function fireBolt(e) { const b = bolts.find(b => !b.live); if (!b) return; const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1; b.live = true; b.t = 3.2; b.vx = dx / d * 11; b.vz = dz / d * 11; b.m.position.set(e.x + dx / d, 1.3, e.z + dz / d); b.m.visible = true; whoosh(0.35, 700, 3000, 0.22, 2, e); tone('sine', 880, 330, 0.25, 0.05 * distVol(e)); }
function killBolt(b) { b.live = false; b.m.visible = false; burst(b.m.position.x, 1.3, b.m.position.z, 10, 3, 0.4, 0.4, 0.9, 0.8, 4); }
function startWave(e) { wave.live = true; wave.r = 1.5; wave.hit = false; wave.m.position.x = e.x; wave.m.position.z = e.z; burst(e.x, 0.4, e.z, 50, 7, 0.7, 0.4, 0.9, 0.8, 6); if (!REDUCED) shake = Math.max(shake, 0.7); sfx('impactMining_000', 0.8, 0.5, e); thump(55, 0.7, 0.7, e); whoosh(0.9, 140, 600, 0.45, 0.6, e); dust(e.x, e.z, 30, 8); }

/* ---------- records: cinematic, panel, ending ---------- */
const cine = { s: null, t: 0, a0: 0, lit: false, fresh: null };
function openPanel(s) {
  if (s.opened) { showPanel(s, false); return; }
  save.opened.push(s.r.id); addXP(100); cine.fresh = s.r.id;
  state = 'cine'; cine.s = s; cine.t = 0; cine.lit = false; cine.a0 = Math.atan2(P.x - s.x, P.z - s.z) + 0.5;
  app.classList.add('cine'); $('#toast').classList.remove('on'); toastT = 0; keys.clear(); useHeld = false; joy.x = joy.y = 0; $('#prompt').hidden = true;
  if (document.pointerLockElement) document.exitPointerLock();
  P.face = Math.atan2(-(s.x - P.x), -(s.z - P.z)); P.yawB = P.face + Math.PI; P.tw = 0; hero.root.rotation.set(0, P.yawB, 0); hero.root.position.y = 0; hero.play('Interact', { once: true, dur: 1.6 });
  sfx('metalLatch', 0.6, 0.5); tone('sine', 196, 392, 1.1, 0.07); whoosh(1.1, 300, 1800, 0.15, 1.5);
}
function updateCine(dt) {
  const s = cine.s; cine.t += dt; const k = Math.min(1, cine.t / 2.4), R0 = s.rad + 9, a = cine.a0 + (REDUCED ? 0 : k * 1.1), r = R0 - k * 2.5;
  camera.position.set(s.x + Math.sin(a) * r, 1.8 + k * 2.4, s.z + Math.cos(a) * r); camera.lookAt(s.x, s.top * 0.6 + 0.8, s.z);
  if (Math.random() < 0.8) spark(s.x + (Math.random() - 0.5) * (s.rad * 2 + 3), 0.2, s.z + (Math.random() - 0.5) * (s.rad * 2 + 3), 0, 3 + Math.random() * 2, 0, 1, 1, 0.55, 0.2, 0);
  if (!cine.lit && cine.t > 1.1) { cine.lit = true; lightSite(s, true); sfx('impactBell_heavy_000', 0.6); chime([523.3, 659.3, 784, 1046.5], 0.06, 0.11); flash(0.3); hero.play('Cheering', { once: true, dur: 1.4 }); }
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
  if (cine.fresh) { const id = cine.fresh; cine.fresh = null; refreshLocks(true); refreshQuest(); announceUnlock(id); }
  if (sites.every(s => s.opened) && !save.done) { save.done = true; persist(); burst(P.x, 1, P.z, 120, 8, 1.6, 1, 0.75, 0.35, 1); showEnding(); }
}

/* ---------- per-frame ---------- */
function collide(o, rad) {
  for (const b of obstacles) { if (b.dead) continue; const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz), m = b.r + rad; if (d < m && d > 0.0001) { o.x = b.x + dx / d * m; o.z = b.z + dz / d * m; } }
  const d = Math.hypot(o.x, o.z); if (d > 50) { o.x *= 50 / d; o.z *= 50 / d; }
}
function updatePlayer(dt) {
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  P.inv = Math.max(0, P.inv - dt); P.cd = Math.max(0, P.cd - dt); P.lock = Math.max(0, P.lock - dt); P.comboT = Math.max(0, P.comboT - dt); P.throwT = Math.max(0, P.throwT - dt);
  if (keys.has('ArrowLeft')) yaw += 1.8 * dt; if (keys.has('ArrowRight')) yaw -= 1.8 * dt;
  let moving = false, sprint = false, turn = 0;
  if (!P.dead) {
    if (P.dodge > 0) { P.dodge -= dt; const k = P.dodge > 0.1 ? 11.5 : 4; P.x += P.dx * k * dt; P.z += P.dz * k * dt;
      if (has(6) && P.dashHit) for (const e of enemies) { if (e.dead || P.dashHit.has(e)) continue; if (Math.hypot(e.x - P.x, e.z - P.z) < 1.4 * e.sc) { P.dashHit.add(e); hitEnemy(e, 14, P.dx, P.dz, 0.4); } } if (P.dodge <= 0) dust(P.x, P.z, 6, 2); }
    else if (P.lock <= 0) {
      let mx = moveX(), mz = moveZ(); const l = Math.hypot(mx, mz);
      if (l > 0.15 && P.swing <= 0 && P.throwT <= 0.2) {
        if (l > 1) { mx /= l; mz /= l; }
        sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || (l > 0.95 && joy.id !== null);
        const sp = sprint ? 7.8 : 5.2, wx = right.x * mx + fwd.x * mz, wz = right.z * mx + fwd.z * mz;
        P.x += wx * sp * dt; P.z += wz * sp * dt; moving = true;
        turn = wrapA(Math.atan2(-wx, -wz) - P.face); P.face += turn * Math.min(1, dt * 13);
        printD += sp * dt; if (printD > 0.9) { printD = 0; const m = prints[printI++ % prints.length], sd = printI % 2 ? 0.16 : -0.16; m.position.set(P.x + Math.cos(P.face) * sd, 0.02, P.z - Math.sin(P.face) * sd); }
        P.step -= dt; if (P.step <= 0) { P.step = sprint ? 0.25 : 0.33; sfx('footstep_grass_000', sprint ? 0.26 : 0.18, sprint ? 1.12 : 0.92); if (sprint) dust(P.x, P.z, 2, 1.2); }
        // without mouse-look, strafing gently swings the camera so keyboard or touch alone can steer
        if (document.pointerLockElement !== canvas && !mouseDown && look.id === null) yaw -= mx * 0.9 * dt;
      }
    }
    if (P.swing > 0) {
      const atk = P.atk, el = P.swingDur - P.swing, hitT = atk.dur * atk.imp / atk.end;
      P.swing -= dt;
      if (P.lunge > 0) { P.lunge -= dt; P.x += P.dx * P.lungeSp * dt; P.z += P.dz * P.lungeSp * dt; }
      if (!P.whooshed && el >= hitT - 0.13) {
        P.whooshed = true;
        if (atk.kick) whoosh(0.16, 170, 520, 0.4, 0.8); else if (atk.heavy) whoosh(0.34, 320, 1700, 0.55, 0.9); else if (atk.dash) whoosh(0.26, 700, 2800, 0.42, 1.4); else whoosh(0.2, 520 + P.combo * 120, 2100 + P.combo * 300, 0.36, 1.2);
      }
      if (!P.hitDone && el >= hitT) {
        P.hitDone = true; const bold = has(4), R = atk.R * (bold ? 1.15 : 1), dmg = Math.round(atk.dmg * (bold ? 1.2 : 1)), fx = -Math.sin(P.face), fz = -Math.cos(P.face);
        for (const b of obstacles) { if (!b.hp || b.dead) continue; const dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz) || 1; if (d < R * 0.8 + b.r && (atk.heavy || atk.all || (dx * fx + dz * fz) / d > 0.2)) strikeOb(b, atk.heavy ? 2 : 1); }
        for (const e of enemies) { if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; if (d < R + 0.5 * e.sc && (atk.heavy || atk.all || (dx * fx + dz * fz) / d > atk.arc)) { hitEnemy(e, dmg, atk.kick ? fx : dx / d, atk.kick ? fz : dz / d, atk.kb, atk.stun); gainRage(atk.kick ? 6 : 12); } }
        if (!atk.kick) for (const b of bolts) if (b.live && Math.hypot(b.m.position.x - P.x, b.m.position.z - P.z) < R) killBolt(b);
        if (atk.heavy) { const gx = P.x + fx * 1.5, gz = P.z + fz * 1.5; burst(gx, 0.3, gz, 34, 5, 0.6, 1, 0.6, 0.2, 8); dust(gx, gz, 22, 6); sfx('impactMining_000', 0.55, 0.8); thump(70, 0.3, 0.55); if (!REDUCED) shake = Math.max(shake, 0.45);
          if (has(7)) {   // ink ring from the landing
            for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283; spark(gx + Math.cos(a) * 0.6, 0.25, gz + Math.sin(a) * 0.6, Math.cos(a) * 9, 0.4, Math.sin(a) * 9, 0.5, 1, 0.75, 0.4, 0); }
            for (const e of enemies) { if (e.dead) continue; const dx = e.x - gx, dz = e.z - gz, d = Math.hypot(dx, dz) || 1; if (d > R && d < 5.6) hitEnemy(e, 25, dx / d, dz / d, 1.8); }
          } }
      }
      if (P.swing <= 0 && P.queued) { P.queued = false; P.swing = 0; slash(); }
    }
    collide(P, 0.45);
    for (const s of sites) if (s.locked) { const ox = P.x - s.vx, oz = P.z - s.vz, od = Math.hypot(ox, oz); if (od < VEIL + 0.4 && od > 0.001) { P.x = s.vx + ox / od * (VEIL + 0.4); P.z = s.vz + oz / od * (VEIL + 0.4); if (!P.veilT || time - P.veilT > 6) { P.veilT = time; toast('안개가 길을 막고 있다', '앞선 기록을 먼저 깨워야 이 길이 열립니다'); } } }
  }
  P.moving = moving; P.sprint = sprint;
  if (!P.dead && P.swing <= 0 && P.dodge <= 0 && P.lock <= 0 && P.throwT <= 0.1) {
    if (moving) { P.idleT = 0; hero.play(sprint ? 'Running_B' : 'Running_A', { scale: sprint ? 1.15 : 1, fade: 0.16 }); }
    else { P.idleT += dt; hero.play(using() && nearSite ? 'Interact' : (P.idleT % 13 > 8.5 ? 'Idle_B' : 'Idle_A'), { fade: 0.25 }); }
  }
  // body follows the motion: bank into turns, lean into a sprint
  lean += ((moving ? clamp(turn * 0.45, -0.28, 0.28) : 0) - lean) * Math.min(1, dt * 7);
  const r = hero.root.rotation; let hop = 0, pitchT = moving && sprint ? 0.11 : 0;
  if (P.swing > 0 && !P.dead && P.atk) {   // the body winds up against the blow and unwinds through it
    const pr = clamp(1 - P.swing / P.swingDur, 0, 1);
    P.tw = REDUCED && P.atk.spin ? 0 : kf(P.atk.tw, pr); pitchT = kf(P.atk.pitch, pr); hop = kf(P.atk.hop, pr); P.chestTw = P.tw * (P.atk.chest || 0); P.pitchB = pitchT;
  } else {
    if (Math.abs(P.tw) > Math.PI) P.tw = wrapA(P.tw);
    const k = Math.min(1, dt * 9); P.tw += -P.tw * k; P.chestTw += -P.chestTw * k; P.pitchB += (pitchT - P.pitchB) * Math.min(1, dt * 8);
  }
  hero.root.position.set(P.x, hop, P.z);
  P.yawB += wrapA(P.face + Math.PI - P.yawB) * Math.min(1, dt * 18); r.y = P.yawB + P.tw; r.z = -lean; r.x = P.pitchB;
  hero.tint(cRed, P.inv > 0 && P.dodge <= 0 && P.hp < 100 ? Math.max(0, P.inv - 0.25) * 1.2 : 0);
  fill.position.set(P.x, 2.4, P.z);
  fovKick += ((sprint ? 5 : 0) + (P.swing > 0 ? 3.5 : 0) - fovKick) * Math.min(1, dt * 5);
  if (Math.hypot(P.x, P.z) < 4.5 && P.hp < 100 && !P.dead) { P.hp = Math.min(100, P.hp + 30 * dt); if (!P.healed) { P.healed = true; toast('모닥불이 상처를 덮는다', '체력은 여기서 회복됩니다'); } }
  $('#hpBar').style.transform = `scaleX(${P.hp / 100})`;
  $('#rageBar').style.transform = `scaleX(${P.rage / 100})`; $('#rageWrap').classList.toggle('full', P.rage >= 100); $('#tNova').hidden = P.rage < 100 || !can.ship; $('#tThrow').hidden = !can.hammer;
}
function updateAxe(dt) {
  G.spin += dt * 24;
  if (G.pending !== null) {   // release point of the throw animation
    G.pending -= dt;
    if (G.pending <= 0) { G.pending = null; if (!P.dead) { handPos(G.pos); G.state = 'out'; G.dist = 0; G.hit.clear(); handHammer.visible = false; fly.visible = true; whoosh(0.28, 380, 1700, 0.42, 1.1); flyWhoosh = 0.1; } }
  }
  if (G.state !== 'held') {
    if (G.state === 'out') {
      const step = 34 * dt; G.pos.addScaledVector(G.dir, step); G.dist += step;
      if (G.target && !G.target.dead) { tmp.set(G.target.x, 1.2 * G.target.sc, G.target.z).sub(G.pos).normalize(); G.dir.lerp(tmp, Math.min(1, dt * 5)).normalize(); }   // bends a little towards its mark
      let turn = G.dist > 24 || G.pos.y < 0.2 || G.pos.y > 14;
      for (const b of obstacles) {
        if (b.dead || G.pos.y > 4.5 || Math.hypot(G.pos.x - b.x, G.pos.z - b.z) > Math.max(0.6, b.r - 0.1)) continue;
        if (b.hp) { if (!G.hit.has(b)) { G.hit.add(b); strikeOb(b, 2); } } else if (b.r > 0.75) turn = true;
      }
      if (turn) { G.state = 'back'; G.hit.clear(); burst(G.pos.x, G.pos.y, G.pos.z, 10, 3, 0.4, 1, 0.6, 0.2, 6); sfx('impactMetal_heavy_000', 0.3, 1.2, G.pos); }
    } else {
      handPos(tmp); tmp.sub(G.pos); const d = tmp.length();
      if (d < 0.9) { G.state = 'held'; fly.visible = false; handHammer.visible = true; sfx('metalClick', 0.5); thump(150, 0.08, 0.3); hero.play('Hit_B', { once: true, dur: 0.3, fade: 0.04 }); P.lock = Math.max(P.lock, 0.12); }
      else { G.dir.copy(tmp).divideScalar(d); G.pos.addScaledVector(G.dir, Math.min(d, 42 * dt)); }
    }
    if (G.state !== 'held') {
      for (const e of enemies) {
        if (e.dead || G.hit.has(e)) continue;
        if (Math.hypot(G.pos.x - e.x, G.pos.z - e.z) < 0.8 * e.sc + 0.35 && G.pos.y < 2.4 * e.sc) { G.hit.add(e); hitEnemy(e, G.state === 'out' ? 34 : 22, G.dir.x, G.dir.z); gainRage(8);
          if (G.state === 'out' && has(5) && !G.chained) {   // chain: carry on to the next nearest
            let nx = null, nd = 10; for (const o of enemies) { if (o.dead || o === e || G.hit.has(o) || o.site.locked) continue; const od = Math.hypot(o.x - e.x, o.z - e.z); if (od < nd) { nd = od; nx = o; } }
            if (nx) { G.chained = true; G.target = nx; G.dist = Math.max(0, G.dist - nd); whoosh(0.2, 600, 2000, 0.3, 1.4, G.pos); }
          } }
      }
      fly.position.copy(G.pos); fly.rotation.y = Math.atan2(G.dir.x, G.dir.z); fly.userData.piv.rotation.x = G.spin; fly.updateMatrixWorld(true);
      flyWhoosh -= dt; if (flyWhoosh <= 0) { flyWhoosh = 0.14; whoosh(0.13, 420, 1150, 0.2, 1.6, G.pos); }   // one beat per turn of the blade
    }
  }
  // the brush mark follows the edge of whichever axe is moving
  const flying = G.state !== 'held', atk = P.atk, el = P.swingDur - P.swing;
  const hitT = atk ? atk.dur * atk.imp / atk.end : 0;
  const swinging = !flying && P.swing > 0 && atk && !atk.kick && (atk.spin ? el > atk.dur * 0.14 && el < atk.dur * 0.86 : el > hitT - 0.2 && el < hitT + 0.15);
  const node = flying ? flyIn.children[0] : pencil.children[0];
  if ((flying || swinging) && node) { if (flying) { node.localToWorld(tipV.set(0, 0.6, 0)); node.localToWorld(baseV.set(0, 0.36, 0)); } else { node.localToWorld(tipV.set(0, -0.33, 0)); node.localToWorld(baseV.set(0, -0.13, 0)); } }   // the pencil's lead draws the line
  trail.update(flying || swinging, tipV, baseV, dt);
}
let bossSeen = null;
function enemyAnim(e) {
  const key = e.dead ? 'death' : (e.stun > 0 && !e.boss && e.state !== 'awaken' ? 'hit' : e.state);
  if (key === e.key) { if (key === 'chase' || key === 'return') e.a.cur.timeScale = e.speed / 1.9; return; }
  const was = e.key; e.key = key; const a = e.a, mage = e.kind === 'mage';
  if (key === 'death') a.play(e.kind === 'minion' && e.hitN % 2 ? 'Death_B' : 'Skeletons_Death', { once: true, fade: 0.08 });
  else if (key === 'hit') a.play(e.hitN++ % 2 ? 'Hit_B' : 'Hit_A', { once: true, dur: 0.5, fade: 0.04 });
  else if (key === 'awaken') { if (was !== 'awaken') { a.play('Skeletons_Awaken_Floor', { once: true, scale: 1.35, fade: 0.05 }); e.awake = CLIPS.Skeletons_Awaken_Floor.duration / 1.35 * 0.92; rattle(e, 6); dust(e.x, e.z, 10, 2.5); } }
  else if (key === 'idle') a.play('Skeletons_Idle', { fade: 0.25 });
  else if (key === 'chase' || key === 'return') a.play('Skeletons_Walking', { scale: e.speed / 1.9, fade: 0.2 });
  else if (key === 'windup') { if (mage) a.play('Ranged_Magic_Spellcasting', { scale: 1.3, fade: 0.1 }); else a.play(e.clip, { once: true, dur: e.k.wind / (IMPACT[e.clip] || 0.5), fade: 0.1 }); }
  else if (key === 'recover') { if (mage) a.play('Ranged_Magic_Shoot', { once: true, fade: 0.05 }); }
  else if (key === 'slamup') a.play('Melee_2H_Attack_Chop', { once: true, dur: 1 / IMPACT.Melee_2H_Attack_Chop, fade: 0.1 });
  else if (key === 'taunt') { a.play(CLIPS.Skeletons_Taunt_Longer ? 'Skeletons_Taunt_Longer' : 'Skeletons_Taunt', { once: true, fade: 0.1 }); }
}
function updateEnemies(dt) {
  bossSeen = null;
  for (const e of enemies) {
    const a = e.a;
    if (e.dead) {
      if (a.root.visible) { enemyAnim(e); a.mixer.update(dt); e.t += dt; e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= Math.exp(-6 * dt); e.vz *= Math.exp(-6 * dt); a.root.position.x = e.x; a.root.position.z = e.z; a.tint(cWhite, Math.max(0, 0.6 - e.t * 2)); if (e.t > 2.6) a.root.position.y -= dt * 0.9; if (e.t > 4.4) a.root.visible = false; }
      continue;
    }
    const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1, hd = Math.hypot(e.x - e.hx, e.z - e.hz), mage = e.kind === 'mage';
    e.stun = Math.max(0, e.stun - dt); e.flash = Math.max(0, e.flash - dt * 5);
    let warn = 0;
    if (e.state === 'dormant') { if (d < (mage ? 16 : 12.5) && !P.dead && !e.site.locked) { e.state = 'awaken'; e.t = 0; } }
    else if (e.state === 'awaken') { e.t += dt; if (e.t >= (e.awake || 1.6)) e.state = 'chase'; }
    else if (e.state === 'taunt') { e.t += dt; if (e.t >= 1.7) e.state = 'chase'; }
    else if (e.state === 'idle') { if (d < 12.5 && !P.dead) e.state = 'chase'; }
    else if (e.state === 'chase') {
      if (hd > 22 || d > 32 || P.dead) e.state = 'return';
      else if (e.stun <= 0) {
        if (mage) {   // keeps its distance, circles, and throws bolts
          const want = d < 7 ? -1 : d > 12 ? 1 : 0;
          e.x += (dx / d * want * e.speed - dz / d * 0.9 * e.side) * dt; e.z += (dz / d * want * e.speed + dx / d * 0.9 * e.side) * dt;
          e.cool -= dt; if (e.cool <= 0) { e.state = 'windup'; e.t = 0; whoosh(0.7, 300, 1600, 0.12, 2.5, e); }
        }
        else if (e.boss && e.p2 && e.atk % 2 === 1 && d < 8) { e.state = 'slamup'; e.t = 0; e.atk++; growl(e); }
        else if (d < 1.9 * e.k.reach) { e.state = 'windup'; e.t = 0; e.clip = e.k.attacks[e.atk % e.k.attacks.length]; e.atk++; }
        else { e.x += dx / d * e.speed * dt; e.z += dz / d * e.speed * dt; }
      }
    } else if (e.state === 'windup') {
      e.t += dt; warn = e.t / e.k.wind;
      if (e.stun > 0 && !e.boss) { e.state = 'chase'; e.cool = 0.9; }
      else if (e.t >= e.k.wind) {
        if (mage) { fireBolt(e); e.cool = 2.4; }
        else { e.vx += dx / d * 6; e.vz += dz / d * 6; whoosh(0.2, 380, 1500, e.boss ? 0.45 : 0.3, 1.1, e); if (d < 2.7 * e.k.reach) hurtPlayer(e.k.dmg); }
        e.state = 'recover'; e.t = 0;
      }
    } else if (e.state === 'slamup') { e.t += dt; warn = e.t; if (e.t >= 1) { startWave(e); e.state = 'recover'; e.t = 0; } }
    else if (e.state === 'recover') { e.t += dt; if (e.t > (mage ? 0.7 : 0.9)) e.state = 'chase'; }
    else if (e.state === 'return') { const rx = e.hx - e.x, rz = e.hz - e.z, rd = Math.hypot(rx, rz); if (rd < 0.5) e.state = 'idle'; else { e.x += rx / rd * e.speed * dt; e.z += rz / rd * e.speed * dt; } if (d < 9 && hd < 14 && !P.dead) e.state = 'chase'; }
    e.x += e.vx * dt; e.z += e.vz * dt; const dec = Math.exp(-9 * dt); e.vx *= dec; e.vz *= dec;   // knockback carries, then scrubs off
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
  if (musicA && musicB) { const t = AC.currentTime; musicA.gain.setTargetAtTime(bossSeen ? 0 : 0.2, t, 0.8); musicB.gain.setTargetAtTime(bossSeen ? 0.28 : 0, t, 0.8); }
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
    if (Math.hypot(P.x - r.x, P.z - r.z) < 1.4) { r.got = true; r.m.visible = false; save.runes.push(r.tag); addXP(25); chime([1318.5, 1661.2, 1975.5], 0.06, 0.07); burst(r.x, 1.2, r.z, 24, 4, 0.8, 1, 0.8, 0.4, 2); const jn = PROFILE.journey && PROFILE.journey.find(j => j.tag === r.tag); toast('기술 룬 · ' + r.tag, (jn && jn.when ? jn.when + ' · ' : '') + save.runes.length + ' / ' + ALL_TAGS.length, 2.6); }
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
  const tall = camera.aspect < 0.9, cd = tall ? 6.4 : 4.6, cs = tall ? 0.4 : 0.85, fk = REDUCED ? 1 : 1 - Math.exp(-13 * dt);
  camF.x += (P.x - camF.x) * fk; camF.z += (P.z - camF.z) * fk;
  camera.position.set(camF.x + right.x * cs - tmp.x * cd, Math.max(0.5, 1.75 - tmp.y * cd), camF.z + right.z * cs - tmp.z * cd);
  // keep the camera out of the big solid pieces (halls, pedestals)
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
  const real = Math.min(0.05, (now - last) / 1000) * (window.__slow || 1); last = now; let dt = real; time += real;   // __slow: frame-by-frame inspection while testing
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
  if (hero.chest && Math.abs(P.chestTw) > 0.001) hero.chest.quaternion.premultiply(qTw.setFromAxisAngle(UP, P.chestTw));   // shoulders lead the hips
  if (state !== 'play') for (const e of enemies) if (!e.dead || e.a.root.visible) e.a.mixer.update(state === 'cine' ? dt : 0);
  // ambient: embers, leaves, breathing lights, drifting ribbon
  for (let i = 0; i < 2; i++) if (Math.random() < 0.7) spark((Math.random() - 0.5) * 0.9, 0.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 0.6, 1.5, 1, 0.4 + Math.random() * 0.3, 0.08, -0.4);
  fireLight.intensity = 46 + Math.sin(time * 9) * 5 + Math.sin(time * 23) * 3;
  flames.forEach((f, i) => { const k = 0.8 + Math.sin(time * (7 + i * 3.1) + i) * 0.2; f.scale.set(f.userData.s * k, f.userData.s * (1.5 + Math.sin(time * (9 + i * 2.3)) * 0.3), 1); });
  moon.position.set(P.x - 30, 50, P.z - 20); moon.target.position.set(P.x, 0, P.z);
  auroraTex.offset.x += real * 0.004;
  occU.uOccR.value = state === 'play' ? 1.7 : 0; occU.uOccP.value.set(P.x, 1.1, P.z);
  ambientSound(real);
  updateParticles(dt); updateLeaves(real);
  if (composer) composer.render(); else renderer.render(scene, camera);
}

function startGame() {
  if (!ready) return;
  $('#title').hidden = true; $('#journal').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !TOUCH;
  state = 'play'; refreshQuest(); initAudio(); startBlend(2); camF.set(P.x, 0, P.z);
  hero.play('Sit_Floor_StandUp', { once: true, fade: 0.1 }); P.lock = (CLIPS.Sit_Floor_StandUp ? CLIPS.Sit_Floor_StandUp.duration : 1) * 0.9;
  setTimeout(() => $('#keys').classList.add('dim'), 20000);
  toast(save.opened.length ? '여정을 이어간다' : '푸른 빛기둥을 따라가라', TOUCH ? '왼쪽을 끌어 이동, 오른쪽을 끌어 둘러보기' : '클릭으로 연필을 긋고, Space로 대시합니다', 5.5);
}
$('#btnStart').onclick = startGame;

requestAnimationFrame(frame);
Promise.all([...MODELS.map(loadModel), ...SOUNDS.map(loadSound)]).then(() => {
  buildWorld(); buildActors(); buildHud(); refreshQuest();
  ready = true;
  const b = $('#btnStart'); b.disabled = false; b.textContent = save.opened.length ? '여정 이어가기' : '여정 시작';
  hashRoute();
}).catch(err => {
  console.error(err); failed = true;
  $('#btnStart').textContent = '불러오지 못했습니다'; $('#tLead').textContent = '에셋을 불러오지 못했습니다. 새로고침하거나 "게임 없이 바로 보기"를 눌러 주세요. (' + String(err && err.message || err).slice(0, 120) + ')';
});
window.__saga = { T, obstacles, get hero() { return hero; }, get handAxe() { return pencil; }, set yaw(v) { yaw = v; }, set pitch(v) { pitch = v; }, CLIPS, P, G, enemies, sites, runes, bolts, wave, save, get state() { return state; }, get ready() { return ready; }, throwAxe, slash, nova, openPanel, hitEnemy };
