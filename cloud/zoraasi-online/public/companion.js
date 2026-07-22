import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

/* ══════════════════════════════════════════════════════════════
   ZoraASI — 3D Companion (clean rebuild)
   ══════════════════════════════════════════════════════════════ */

/* ── Scene ── */
const container = document.getElementById('scene');
const W = () => window.innerWidth;
const H = () => window.innerHeight;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06070b);
scene.fog = new THREE.FogExp2(0x06070b, 0.04);

const camera = new THREE.PerspectiveCamera(26, W() / H(), 0.1, 30);
camera.position.set(0, 2.3, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(W(), H());
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.15, 0.3, 0.8);
composer.addPass(bloom);

/* ── Lighting ── */
scene.add(new THREE.HemisphereLight(0xe8e0d8, 0x06070b, 0.55));

const keyLight = new THREE.DirectionalLight(0xffeedd, 2.4);
keyLight.position.set(5, 7, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.35);
fillLight.position.set(-4, 5, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x8d6de8, 0.55);
rimLight.position.set(-3, 2, -5);
scene.add(rimLight);

const accentLight = new THREE.DirectionalLight(0xed9b69, 0.22);
accentLight.position.set(0, -1, 3);
scene.add(accentLight);

/* ── Helpers ── */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.r ?? 0.5,
    metalness: opts.m ?? 0,
    emissive: opts.e ?? 0x000000,
    emissiveIntensity: opts.ei ?? 0,
    transparent: opts.t ?? false,
    opacity: opts.o ?? 1,
    side: opts.side ?? THREE.FrontSide,
    clearcoat: opts.cc ?? 0,
    clearcoatRoughness: opts.ccr ?? 0.2,
  });
}

function sphere(r, wSeg, wH, m) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, wSeg, wH), m);
}

function cyl(rT, rB, h, seg, m) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), m);
}

function box(w, h, d, m) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}

/* ── Character ── */
const char = new THREE.Group();
scene.add(char);

/* Pedestal */
const ped = cyl(0.78, 0.92, 0.07, 48, mat(0x0e0f17, { r: 0.3, m: 0.35, t: true, o: 0.7 }));
ped.position.y = -0.035;
ped.receiveShadow = true;
ped.castShadow = true;
char.add(ped);

/* Glow rings */
const ring1 = new THREE.Mesh(
  new THREE.TorusGeometry(0.44, 0.01, 12, 48),
  mat(0xed9b69, { e: 0xed9b69, ei: 0.25, t: true, o: 0.18, side: THREE.DoubleSide })
);
ring1.position.y = 0.02;
ring1.rotation.x = -Math.PI / 2;
char.add(ring1);

const ring2 = new THREE.Mesh(
  new THREE.TorusGeometry(0.38, 0.006, 12, 48),
  mat(0x8d6de8, { e: 0x8d6de8, ei: 0.35, t: true, o: 0.12, side: THREE.DoubleSide })
);
ring2.position.y = 0.015;
ring2.rotation.x = -Math.PI / 2 + 0.08;
char.add(ring2);

/* Floating orbs */
const orb1 = sphere(0.04, 12, 12, mat(0xed9b69, { e: 0xed9b69, ei: 0.5, t: true, o: 0.35 }));
orb1.position.set(0.2, 0.12, 0.2);
char.add(orb1);

const orb2 = sphere(0.03, 10, 10, mat(0x8d6de8, { e: 0x8d6de8, ei: 0.4, t: true, o: 0.3 }));
orb2.position.set(-0.18, 0.08, -0.22);
char.add(orb2);

/* Body */
const bodyMat = mat(0x1a1a2e, { r: 0.85, m: 0.04 });
const body = cyl(0.38, 0.52, 0.7, 20, bodyMat);
body.position.y = 0.37;
body.castShadow = true;
char.add(body);

/* Skirt */
const skirt = new THREE.Mesh(
  new THREE.ConeGeometry(0.56, 0.4, 24, 1, true),
  mat(0x1a1a2e, { r: 0.88, m: 0.02, t: true, o: 0.92 })
);
skirt.position.y = 0.18;
skirt.rotation.x = Math.PI;
char.add(skirt);

/* Collar */
const collar = new THREE.Mesh(
  new THREE.TorusGeometry(0.2, 0.03, 10, 20),
  mat(0x8d6de8, { e: 0x8d6de8, ei: 0.1, r: 0.3 })
);
collar.position.y = 0.75;
collar.rotation.x = Math.PI / 2 * 0.85;
char.add(collar);

/* Bow */
const bowMat = mat(0xd47373, { r: 0.4 });
const bowL = box(0.055, 0.028, 0.02, bowMat);
bowL.position.set(-0.065, 0.79, -0.05);
bowL.rotation.z = 0.35;
char.add(bowL);
const bowR = box(0.055, 0.028, 0.02, bowMat);
bowR.position.set(0.065, 0.79, -0.05);
bowR.rotation.z = -0.35;
char.add(bowR);
const bowC = sphere(0.018, 6, 6, bowMat);
bowC.position.set(0, 0.79, -0.05);
char.add(bowC);

/* Neck */
const skinMat = mat(0xfce4e0, { r: 0.38, cc: 0.08, ccr: 0.2 });
const neck = cyl(0.12, 0.16, 0.09, 12, skinMat);
neck.position.y = 0.84;
char.add(neck);

/* Head */
const head = sphere(0.3, 28, 28, skinMat);
head.position.y = 1.05;
head.castShadow = true;
char.add(head);

/* Hair */
const hairM = mat(0x1a1228, { r: 0.8, m: 0.12 });
const hairHL = mat(0x3a2a5a, { r: 0.75 });
const hairF = mat(0x1a1228, { r: 0.78 });

function hairBox(x, y, z, w, h, d, m, rz, rx) {
  const mesh = box(w, h, d, m || hairM);
  mesh.position.set(x, y, z);
  if (rz) mesh.rotation.z = rz;
  if (rx) mesh.rotation.x = rx;
  char.add(mesh);
  return mesh;
}

/* Top dome */
hairBox(0, 1.05, 0, 0.62, 0.16, 0.62, hairM);
hairBox(0, 1.14, 0, 0.56, 0.12, 0.56, hairM);
hairBox(0, 1.22, 0, 0.46, 0.1, 0.46, hairHL);
hairBox(0, 1.29, 0, 0.34, 0.08, 0.34, hairHL);

/* Ahoge */
const ahoge = cyl(0.008, 0.003, 0.1, 6, mat(0x3a2a5a, { r: 0.6, e: 0x3a2a5a, ei: 0.12 }));
ahoge.position.set(0, 1.37, -0.06);
ahoge.rotation.x = -0.3;
char.add(ahoge);

/* Side strands */
for (let side = -1; side <= 1; side += 2) {
  for (let i = 0; i < 3; i++) {
    const s = cyl(0.018 - i * 0.003, 0.022 - i * 0.004, 0.12 + i * 0.03, 6, hairF);
    s.position.set(side * (0.27 + i * 0.018), 1.02 - i * 0.05, -0.01 + i * 0.015);
    s.rotation.z = side * (0.18 + i * 0.06);
    char.add(s);
  }
}

/* Long back */
for (let i = 0; i < 4; i++) {
  const bh = cyl(0.028 - i * 0.004, 0.035 - i * 0.005, 0.14 + i * 0.035, 6, hairM);
  bh.position.set(-0.08 + i * 0.055, 0.97 - i * 0.035, 0.28 + i * 0.015);
  char.add(bh);
}

/* Bangs */
for (let i = 0; i < 5; i++) {
  const b = box(0.048, 0.055, 0.035, hairF);
  b.position.set(-0.1 + i * 0.05, 1.07, -0.29);
  b.rotation.x = -0.12;
  char.add(b);
}
/* Side bangs */
for (let side = -1; side <= 1; side += 2) {
  const sb = box(0.035, 0.07, 0.035, hairF);
  sb.position.set(side * 0.21, 1.04, -0.28);
  sb.rotation.z = side * 0.2;
  char.add(sb);
}

/* ── Eyes ── */
const eyeWhite = mat(0xf8f4f0, { r: 0.08 });
const iris = mat(0x8d6de8, { e: 0x8d6de8, ei: 0.18, r: 0.12 });
const irisIn = mat(0xb8a0f8, { e: 0xb8a0f8, ei: 0.22, r: 0.08, t: true, o: 0.85 });
const pupil = mat(0x0a0812, { r: 0.1 });
const catchMat = mat(0xffffff, { r: 0, e: 0xffffff, ei: 0.7 });
const lashM = mat(0x1a1228, { r: 0.7 });
const lidM = mat(0xfce4e0, { r: 0.5 });

let leftEye, rightEye;

function buildEye(x) {
  const g = new THREE.Group();

  /* Eyelashes */
  for (let i = -2; i <= 2; i++) {
    const lash = box(0.006, 0.022, 0.012, lashM);
    const a = (i + 0.5) * 0.55;
    lash.position.set(Math.sin(a) * 0.065, Math.cos(a) * 0.065, 0.04);
    lash.rotation.z = a * 0.35;
    g.add(lash);
  }

  /* White */
  const w = sphere(0.082, 20, 20, eyeWhite);
  g.add(w);

  /* Iris outer */
  const io = sphere(0.052, 16, 16, iris);
  io.position.z = 0.04;
  g.add(io);

  /* Iris inner */
  const ii = sphere(0.038, 16, 16, irisIn);
  ii.position.z = 0.055;
  g.add(ii);

  /* Pupil */
  const p = sphere(0.02, 10, 10, pupil);
  p.position.z = 0.07;
  g.add(p);

  /* Catchlights */
  const c1 = sphere(0.012, 6, 6, catchMat);
  c1.position.set(-0.02, 0.018, 0.075);
  g.add(c1);
  const c2 = sphere(0.006, 4, 4, catchMat);
  c2.position.set(0.015, -0.015, 0.075);
  g.add(c2);

  /* Upper lid */
  const ul = box(0.095, 0.014, 0.04, lidM);
  ul.position.set(0, 0.05, 0.015);
  g.add(ul);

  /* Lower lid */
  const ll = box(0.085, 0.007, 0.03, lidM);
  ll.position.set(0, -0.048, 0.015);
  g.add(ll);

  g.position.set(x, 1.14, -0.26);
  return g;
}

leftEye = buildEye(-0.12);
rightEye = buildEye(0.12);
char.add(leftEye);
char.add(rightEye);

/* Eyebrows */
const browM = mat(0x1a1228, { r: 0.7 });
const lBrow = box(0.09, 0.013, 0.013, browM);
lBrow.position.set(-0.12, 1.21, -0.29);
char.add(lBrow);
const rBrow = box(0.09, 0.013, 0.013, browM);
rBrow.position.set(0.12, 1.21, -0.29);
char.add(rBrow);

/* Blush */
const blushM = mat(0xf8b0b0, { r: 0.85, t: true, o: 0.25 });
for (let side = -1; side <= 1; side += 2) {
  const bl = sphere(0.035, 10, 10, blushM);
  bl.position.set(side * 0.14, 0.99, -0.29);
  bl.scale.set(1.3, 0.5, 0.4);
  char.add(bl);
}

/* Mouth */
const mouthG = new THREE.Group();
mouthG.position.set(0, 0.97, -0.3);
const lipM = mat(0xe8737a, { r: 0.32 });
const lipU = sphere(0.026, 10, 10, lipM);
lipU.scale.set(1.15, 0.2, 0.3);
lipU.position.y = 0.002;
mouthG.add(lipU);
const lipL = sphere(0.022, 10, 10, lipM);
lipL.scale.set(0.95, 0.16, 0.25);
lipL.position.y = -0.002;
mouthG.add(lipL);
char.add(mouthG);

/* ── Arms ── */
function buildArm(xPos) {
  const g = new THREE.Group();
  const upper = cyl(0.035, 0.042, 0.26, 10, skinMat);
  upper.position.y = 0.1;
  upper.castShadow = true;
  g.add(upper);
  const sleeve = sphere(0.042, 8, 8, bodyMat);
  sleeve.position.set(0, 0.2, 0);
  sleeve.scale.set(1, 0.45, 1);
  g.add(sleeve);
  const hand = sphere(0.03, 8, 8, skinMat);
  hand.position.set(0, 0.25, 0);
  g.add(hand);
  g.position.set(xPos, 0.54, 0);
  g.rotation.z = xPos > 0 ? -0.16 : 0.16;
  char.add(g);
  return g;
}
const lArm = buildArm(-0.46);
const rArm = buildArm(0.46);

/* ── Expressions ── */
const EXPR = {
  idle:      { s: 0.22, bL: -0.03, bR: 0.03, eO: 1,    hT: 0,    aS: 0.35, eI: 0.12 },
  happy:     { s: 0.65, bL: -0.08, bR: 0.08, eO: 1.12, hT: 0.02, aS: 0.65, eI: 0.28 },
  thinking:  { s: 0.08, bL: 0.08,  bR: -0.06, eO: 0.58, hT: 0.05, aS: 0.12, eI: 0.18 },
  sad:       { s: -0.12, bL: 0.06,  bR: 0.06, eO: 0.52, hT: -0.02, aS: 0.15, eI: 0.08 },
  speaking:  { s: 0.35, bL: 0,     bR: 0,     eO: 0.95, hT: 0.01, aS: 0.45, eI: 0.22 },
  listening: { s: 0.18, bL: 0.02,  bR: 0.02,  eO: 0.88, hT: 0.01, aS: 0.28, eI: 0.15 },
  excited:   { s: 0.78, bL: -0.11, bR: 0.11, eO: 1.22, hT: 0.05, aS: 0.85, eI: 0.4 },
  error:     { s: -0.18, bL: 0.05,  bR: 0.05, eO: 0.48, hT: -0.03, aS: 0.12, eI: 0.08 },
};

let curExpr = 'idle';
let exprT = 1;
const CUR = { ...EXPR.idle };

function setExpression(name) {
  if (!EXPR[name] || curExpr === name) return;
  curExpr = name;
  exprT = 0;
}

/* ── Scenes ── */
let sceneVfx = null;

const SCENES = {
  chamber:     { bg: 0x06070b, fog: 0.04,  flr: 0x0e0f17 },
  cafe:        { bg: 0x141010, fog: 0.055, flr: 0x1a1410 },
  garden:      { bg: 0x081410, fog: 0.05,  flr: 0x101a12 },
  study:       { bg: 0x0a0810, fog: 0.045, flr: 0x120e1a },
  observatory: { bg: 0x04060e, fog: 0.032, flr: 0x080a18 },
};

function buildScene(name) {
  const c = SCENES[name];
  if (!c) return;
  const keep = new Set([char, keyLight, fillLight, rimLight, accentLight, scene.children[0]]);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    if (!keep.has(scene.children[i])) scene.remove(scene.children[i]);
  }
  scene.background = new THREE.Color(c.bg);
  scene.fog = new THREE.FogExp2(c.bg, c.fog);

  const fl = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ color: c.flr, roughness: 0.92, metalness: 0.03, transparent: true, opacity: 0.48 })
  );
  fl.rotation.x = -Math.PI / 2;
  fl.position.y = -0.08;
  fl.receiveShadow = true;
  scene.add(fl);

  buildVfx(name);

  if (name === 'cafe') buildCafe();
  if (name === 'garden') buildGarden();
  if (name === 'study') buildStudy();
  if (name === 'observatory') buildObservatory();
}

function buildVfx(name) {
  const colors = { chamber: 0x8d6de8, cafe: 0xed9b69, garden: 0x3a9e6f, study: 0xed9b69, observatory: 0xffffff };
  const cnt = { chamber: 50, cafe: 35, garden: 55, study: 30, observatory: 40 };
  const n = cnt[name] || 40;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 1] = Math.random() * 2.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ptMat = new THREE.PointsMaterial({
    color: colors[name] || 0x8d6de8,
    size: 0.008,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  sceneVfx = new THREE.Points(geo, ptMat);
  scene.add(sceneVfx);
}

function buildCafe() {
  const lamp = sphere(0.05, 10, 10, mat(0xed9b69, { e: 0xed9b69, ei: 0.6 }));
  lamp.position.set(1.1, 0.32, 0.7);
  scene.add(lamp);
  const tM = mat(0x2a1a10, { r: 0.9 });
  const top = cyl(0.18, 0.2, 0.025, 10, tM);
  top.position.set(0.75, 0.06, 0.45);
  top.castShadow = true;
  scene.add(top);
  const leg = cyl(0.012, 0.012, 0.1, 6, tM);
  leg.position.set(0.75, 0.005, 0.45);
  scene.add(leg);
}

function buildGarden() {
  function tree(x, z, s) {
    const trunk = cyl(0.02 * s, 0.03 * s, 0.2 * s, 6, mat(0x2a1a10));
    trunk.position.set(x, 0.06 * s, z);
    scene.add(trunk);
    const leaf = sphere(0.1 * s, 8, 8, mat(0x1a3a1a, { r: 0.88 }));
    leaf.position.set(x, 0.16 * s, z);
    scene.add(leaf);
  }
  tree(1.0, 0.6, 1.1);
  tree(-0.85, -0.45, 1.0);
  tree(0.45, -0.85, 0.85);
  const colors = [0xed9b69, 0x8d6de8, 0xd47373, 0x3a9e6f];
  for (let i = 0; i < 14; i++) {
    const x = (Math.random() - 0.5) * 3.5;
    const z = (Math.random() - 0.5) * 3.5;
    if (Math.hypot(x, z) < 0.5) continue;
    const f = sphere(0.01, 4, 4, mat(colors[Math.floor(Math.random() * 4)]));
    f.position.set(x, 0.008, z);
    scene.add(f);
  }
}

function buildStudy() {
  function shelf(x, z) {
    const sM = mat(0x1a1228, { r: 0.9 });
    const s = box(0.22, 0.3, 0.05, sM);
    s.position.set(x, 0.14, z);
    scene.add(s);
    const bC = [0xed9b69, 0x8d6de8, 0xd47373, 0x3a9e6f, 0x3a2a5a];
    for (let i = 0; i < 4; i++) {
      const b = box(0.016, 0.045, 0.016, mat(bC[i % bC.length]));
      b.position.set(x - 0.06 + i * 0.03, 0.15, z - 0.03);
      scene.add(b);
    }
  }
  shelf(1.0, 0.5);
  shelf(-0.85, -0.35);
  const dl = sphere(0.032, 8, 8, mat(0xed9b69, { e: 0xed9b69, ei: 0.25 }));
  dl.position.set(0.45, 0.08, -0.25);
  scene.add(dl);
}

function buildObservatory() {
  const n = 300;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 18;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.006, transparent: true, opacity: 0.45 }));
  stars.position.y = 1.8;
  scene.add(stars);
}

buildScene('chamber');

/* ── Animation ── */
const clock = new THREE.Clock();
let time = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  /* Expression blend */
  exprT = Math.min(1, exprT + dt * 2.2);
  const tgt = EXPR[curExpr] || EXPR.idle;
  const t = exprT < 0.5 ? 2 * exprT * exprT : 1 - (-2 * exprT + 2) ** 2 / 2;

  const s = CUR.s + (tgt.s - CUR.s) * t;
  const bL = CUR.bL + (tgt.bL - CUR.bL) * t;
  const bR = CUR.bR + (tgt.bR - CUR.bR) * t;
  const eO = CUR.eO + (tgt.eO - CUR.eO) * t;
  const hT = CUR.hT + (tgt.hT - CUR.hT) * t;
  const aS = CUR.aS + (tgt.aS - CUR.aS) * t;
  const eI = CUR.eI + (tgt.eI - CUR.eI) * t;
  if (exprT >= 0.99) Object.assign(CUR, tgt);

  /* Mouth */
  const sm = 1 + s * 0.35;
  lipU.scale.x = 1.15 * (0.5 + 0.5 * sm);
  lipU.scale.y = 0.2 * (s > 0 ? 1 + s * 0.4 : Math.max(0.2, 1 + s * 0.6));
  lipL.scale.x = 0.95 * (0.5 + 0.5 * sm);
  mouthG.position.y = 0.97 - s * 0.006;

  /* Brows */
  lBrow.rotation.z = bL;
  rBrow.rotation.z = bR;

  /* Blink */
  const blink = Math.max(0.15, 1 - (Math.sin(time * 2.8) > 0.93 ? (Math.sin(time * 2.8) - 0.93) * 15 : 0));
  const es = blink * eO;
  leftEye.scale.y = es;
  rightEye.scale.y = es;

  /* Head tilt */
  char.rotation.z = hT;

  /* Ahoge bounce */
  ahoge.rotation.x = -0.3 + Math.sin(time * 2) * 0.04;
  ahoge.rotation.z = Math.sin(time * 1.7) * 0.03;

  /* Breathing */
  const breathe = Math.sin(time * 1.2) * 0.002 * (0.5 + aS * 0.5);
  body.position.y = 0.37 + breathe;
  head.position.y = 1.05 + breathe;
  neck.position.y = 0.84 + breathe;

  /* Arm sway */
  const armSway = Math.sin(time * 0.8) * 0.018 * aS;
  lArm.rotation.z = 0.16 + armSway;
  rArm.rotation.z = -0.16 - armSway;

  /* Orb float */
  orb1.position.y = 0.12 + Math.sin(time * 1.3) * 0.03;
  orb1.position.x = 0.2 + Math.sin(time * 0.9) * 0.015;
  orb2.position.y = 0.08 + Math.sin(time * 1.6 + 0.5) * 0.02;
  orb2.position.x = -0.18 + Math.sin(time * 1.1 + 0.5) * 0.012;

  /* Rings */
  ring1.material.emissiveIntensity = 0.15 + eI + Math.sin(time * 0.4) * 0.05;
  ring2.material.emissiveIntensity = 0.2 + eI * 0.5 + Math.sin(time * 0.6 + 1) * 0.08;
  ring1.rotation.z = Math.sin(time * 0.15) * 0.04;
  ring2.rotation.z = Math.sin(time * 0.12 + 0.5) * 0.06;

  /* Pedestal rotation */
  ped.rotation.y = time * 0.03;
  ring1.rotation.y = time * 0.08;
  ring2.rotation.y = time * 0.06;

  /* VFX drift */
  if (sceneVfx) {
    const p = sceneVfx.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      p[i + 1] += 0.002;
      if (p[i + 1] > 2.2) p[i + 1] = 0;
    }
    sceneVfx.geometry.attributes.position.needsUpdate = true;
  }

  /* Camera */
  const cTheta = Math.sin(time * 0.02) * 0.15;
  camera.position.x = Math.sin(cTheta) * 6;
  camera.position.z = Math.cos(cTheta) * 6;
  camera.position.y = 2.3 + Math.sin(time * 0.012) * 0.06;
  camera.lookAt(0, 1.05, 0);

  /* Bloom */
  bloom.strength = 0.15 + eI * 0.1;

  composer.render();
}

animate();

/* ── Resize ── */
window.addEventListener('resize', () => {
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
  renderer.setSize(W(), H());
  composer.setSize(W(), H());
});

/* ══════════════════════════════════════════════════════════════
   UI Integration
   ══════════════════════════════════════════════════════════════ */

const chatBox = document.getElementById('chat-box');
const inp = document.getElementById('inp');
const sendBtn = document.getElementById('send-btn');
const dot = document.getElementById('dot');
const statusText = document.getElementById('status-text');
const exprLabel = document.getElementById('expr-label');
const govPanel = document.getElementById('gov-panel');
const govToggle = document.getElementById('gov-toggle');
const modelSelect = document.getElementById('model-select');
const govBudget = document.getElementById('gov-budget');
const govTasks = document.getElementById('gov-tasks');
const govTools = document.getElementById('gov-tools');
const govTokens = document.getElementById('gov-tokens');
const govAudit = document.getElementById('gov-audit');
const govPolicy = document.getElementById('gov-policy');
const govModel = document.getElementById('gov-model');

let govVisible = false;
govToggle.addEventListener('click', () => {
  govVisible = !govVisible;
  govPanel.classList.toggle('hidden', !govVisible);
  govToggle.classList.toggle('hidden', govVisible);
});

modelSelect.addEventListener('change', () => { if (govVisible) checkHealth(); });

function appendMsg(role, text) {
  const div = document.createElement('div');
  div.className = 'm ' + role;
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = text + ' <span class="ts">' + ts + '</span>';
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

appendMsg('s', 'I am ZoraASI — governed, bounded, and yours. Speak freely.');

function setOnline(on) {
  dot.style.background = on ? '#3a9e6f' : '#d47373';
  dot.style.boxShadow = on ? '0 0 10px rgba(58,158,111,0.4)' : '0 0 10px rgba(212,115,115,0.4)';
  statusText.textContent = on ? 'governed' : 'offline';
}

async function sendMessage(text) {
  if (!text.trim()) return;
  appendMsg('u', text);
  inp.value = '';
  sendBtn.disabled = true;
  setExpression('listening');
  exprLabel.textContent = '·';
  exprLabel.style.color = '#8d6de8';
  statusText.textContent = 'thinking...';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: modelSelect.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    appendMsg('z', data.reply);
    setExpression('happy');
    exprLabel.textContent = 'zoraasi';
    exprLabel.style.color = '#ed9b69';
    statusText.textContent = 'governed';
    setTimeout(() => setExpression('idle'), 3000);
  } catch (err) {
    appendMsg('s', err.message);
    setExpression('error');
    exprLabel.textContent = '·';
    exprLabel.style.color = '#d47373';
    setTimeout(() => setExpression('idle'), 2500);
  } finally {
    sendBtn.disabled = false;
    inp.focus();
  }
}

sendBtn.addEventListener('click', () => sendMessage(inp.value));
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(inp.value); });
inp.addEventListener('focus', () => setExpression('listening'));
inp.addEventListener('blur', () => { if (curExpr === 'listening') setExpression('idle'); });

/* Scene buttons */
document.querySelectorAll('.sc-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    buildScene(btn.dataset.scene);
    setExpression('excited');
    exprLabel.textContent = btn.dataset.scene;
    exprLabel.style.color = '#3a9e6f';
    setTimeout(() => setExpression('idle'), 2500);
  });
});

/* Health check */
async function checkHealth() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) { setOnline(false); return; }
    setOnline(true);
    if (govVisible) {
      const d = await res.json();
      const cur = modelSelect.value;
      const meta = d.modelMeta?.[cur] || {};
      govModel.textContent = meta.label || cur;
      const b = d.budget?.[cur];
      govBudget.textContent = b ? '$' + b.spentTodayUsd.toFixed(3) + '/$' + b.dailyCapUsd.toFixed(2) : 'free';
    }
  } catch { setOnline(false); }
}

/* Daemon WebSocket */
function connectDaemonWS() {
  try {
    const ws = new WebSocket('ws://127.0.0.1:8766');
    ws.onmessage = (e) => {
      try {
        const s = JSON.parse(e.data);
        statusText.textContent = s.status === 'running_task' ? 'researching' : 'governed';
        if (govVisible) {
          govTasks.innerHTML = (s.tasks_completed_today ?? '?') + '/' + (s.daily_task_limit ?? '?');
          govTools.innerHTML = (s.tool_calls_used_today ?? '?') + '/' + (s.daily_tool_call_limit ?? '?');
          govTokens.innerHTML = (((s.tokens_used_today ?? 0) / 1000).toFixed(1)) + 'k/' + (((s.daily_token_limit ?? 0) / 1000).toFixed(0)) + 'k';
          govAudit.textContent = s.audit_chain_valid ? '✓' : '⚠';
          govAudit.className = 'val ' + (s.audit_chain_valid ? 'green' : 'red');
        }
        if (s.status === 'running_task' && s.current_task) {
          appendMsg('s', 'Daemon researching: ' + s.current_task.slice(0, 80) + '...');
          setExpression('thinking');
          exprLabel.textContent = 'researching';
        }
      } catch { /* */ }
    };
    ws.onclose = () => setTimeout(connectDaemonWS, 5000);
  } catch { setTimeout(connectDaemonWS, 5000); }
}

checkHealth();
setInterval(checkHealth, 15000);
connectDaemonWS();

/* Mouse tracking */
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 0.03;
  const y = (e.clientY / window.innerHeight - 0.5) * 0.012;
  leftEye.position.x = -0.12 + x * 0.5;
  leftEye.position.y = 1.14 + y * 0.3;
  rightEye.position.x = 0.12 + x * 0.5;
  rightEye.position.y = 1.14 + y * 0.3;
  if (curExpr === 'idle' || curExpr === 'listening') {
    head.rotation.y = x * 0.1;
    head.rotation.x = -y * 0.06;
  }
});

setTimeout(() => { exprLabel.style.transition = 'opacity 2s'; }, 5000);