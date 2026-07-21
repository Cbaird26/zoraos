import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

/* ══════════════════════════════════════════════
   ZORAASI — Governed Virtual Companion
   Identity: ZoraASI is the container for the
   Theory of Everything. Governed, bounded,
   user-sovereign, warm, technically capable.
   ══════════════════════════════════════════════ */

/* ── Palette ── */
const PALETTE = {
  amber: 0xed9b69, violet: 0x8d6de8, teal: 0x3a9e6f, rose: 0xd47373,
  ink: 0x06070b, panel: 0x0e0f17, frost: 0xe8e0d8, muted: 0x6b5f58,
  skin: 0xf0d5c0, skinShadow: 0xd4b8a0, hair: 0x1a1228, hairHighlight: 0x2a1f3d,
  eyeWhite: 0xf8f4f0, iris: 0x8d6de8, irisOuter: 0x6a4dc0, pupil: 0x0a0812,
  lip: 0xd47373, blush: 0xf0a090, dress: 0x0e0f17, dressAccent: 0x8d6de8,
  gold: 0xed9b69, goldEmissive: 0xed9b69,
};

/* ── Scene Setup ── */
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.ink);
scene.fog = new THREE.FogExp2(PALETTE.ink, 0.045);

const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 2.2, 5.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.bias = 0.0001;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

/* ── Post-Processing ── */
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.3, 0.1);
composer.addPass(bloomPass);

/* ── Lighting ── */
const ambient = new THREE.HemisphereLight(PALETTE.frost, PALETTE.ink, 0.6);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffeedd, 2.2);
key.position.set(4, 6, 5);
key.castShadow = true;
key.shadow.mapSize.width = 2048;
key.shadow.mapSize.height = 2048;
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 15;
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -3;
key.shadow.bias = -0.002;
scene.add(key);

const fill = new THREE.DirectionalLight(0x8888ff, 0.35);
fill.position.set(-3, 4, -2);
scene.add(fill);

const rim = new THREE.DirectionalLight(PALETTE.violet, 0.5);
rim.position.set(-2, 1, -5);
scene.add(rim);

const accent = new THREE.DirectionalLight(PALETTE.amber, 0.2);
accent.position.set(0, -1, 3);
scene.add(accent);

/* ── Character ── */
const char = new THREE.Group();

function pbrMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.5, metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

// Platform / pedestal
const pedestalMat = pbrMat(PALETTE.panel, { roughness: 0.7, metalness: 0.2 });
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.06, 48), pedestalMat);
pedestal.position.y = -0.03;
pedestal.receiveShadow = true;
pedestal.castShadow = true;
char.add(pedestal);

const ringMat = pbrMat(PALETTE.amber, { emissive: PALETTE.amber, emissiveIntensity: 0.3, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 16, 48), ringMat);
ring.position.y = 0.02;
ring.rotation.x = -Math.PI / 2;
char.add(ring);

const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.008, 16, 48), ringMat.clone());
ring2.material.emissiveIntensity = 0.4;
ring2.material.color.setHex(PALETTE.violet);
ring2.material.emissive.setHex(PALETTE.violet);
ring2.position.y = 0.015;
ring2.rotation.x = -Math.PI / 2 + 0.1;
char.add(ring2);

// Body / dress
const dressMat = pbrMat(PALETTE.dress, { roughness: 0.9, metalness: 0.05 });
const bodyGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.85, 20);
const body = new THREE.Mesh(bodyGeo, dressMat);
body.position.y = 0.42;
body.castShadow = true;
char.add(body);

// Dress collar / neckline
const collarMat = pbrMat(PALETTE.dressAccent, { emissive: PALETTE.dressAccent, emissiveIntensity: 0.08, roughness: 0.3 });
const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 12, 24), collarMat);
collar.position.y = 0.82;
collar.rotation.x = Math.PI / 2 * 0.85;
char.add(collar);

// Neck
const neckMat = pbrMat(PALETTE.skin, { roughness: 0.6 });
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 16), neckMat);
neck.position.y = 0.92;
char.add(neck);

// Head
const headMat = pbrMat(PALETTE.skin, { roughness: 0.45 });
const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 28), headMat);
head.position.y = 1.08;
head.castShadow = true;
char.add(head);

// Hair
const hairMat = pbrMat(PALETTE.hair, { roughness: 0.95 }); 
const hairMatHighlight = pbrMat(PALETTE.hairHighlight, { roughness: 0.9 });
function addHair(x, y, z, w, h, d, mat = hairMat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  char.add(m);
  return m;
}
addHair(0, 1.08, 0, 0.6, 0.18, 0.6); // top dome
addHair(0, 1.16, 0, 0.56, 0.12, 0.56);
addHair(0, 1.22, 0, 0.44, 0.1, 0.44);
// Sides
const hairMatSide = pbrMat(PALETTE.hair, { roughness: 0.9 });
addHair(-0.29, 1.05, 0, 0.06, 0.1, 0.42, hairMatSide);
addHair(0.29, 1.05, 0, 0.06, 0.1, 0.42, hairMatSide);
// Bangs
const hairMatFront = pbrMat(PALETTE.hair, { roughness: 0.85 });
addHair(0, 1.08, -0.28, 0.28, 0.06, 0.04, hairMatFront);
addHair(0.12, 1.09, -0.28, 0.1, 0.06, 0.04, hairMatFront);
addHair(-0.12, 1.09, -0.28, 0.1, 0.06, 0.04, hairMatFront);
// Long back
addHair(0, 1.0, 0.28, 0.38, 0.16, 0.08, hairMat);
addHair(0, 0.92, 0.3, 0.3, 0.14, 0.06, hairMat);

// Eyes
const eyeWhiteMat = pbrMat(PALETTE.eyeWhite, { roughness: 0.1 });
const irisMat = pbrMat(PALETTE.iris, { emissive: PALETTE.iris, emissiveIntensity: 0.2, roughness: 0.2 });
const irisOuterMat = pbrMat(PALETTE.irisOuter, { roughness: 0.3 });
const pupilMat = pbrMat(PALETTE.pupil, { roughness: 0.1 });
const eyelidMat = pbrMat(PALETTE.skin, { roughness: 0.5 });

function buildEye(x) {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), eyeWhiteMat);
  g.add(white);
  const outer = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), irisOuterMat);
  outer.position.z = 0.05;
  g.add(outer);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), irisMat);
  iris.position.z = 0.07;
  g.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), pupilMat);
  pupil.position.z = 0.09;
  g.add(pupil);
  // Upper lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.04), eyelidMat);
  lid.position.y = 0.04;
  lid.position.z = 0.02;
  g.add(lid);
  // Lower lid
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.03), eyelidMat);
  lower.position.y = -0.04;
  lower.position.z = 0.02;
  g.add(lower);
  g.position.set(x, 1.13, -0.28);
  return g;
}
const lEye = buildEye(-0.1);
const rEye = buildEye(0.1);
char.add(lEye);
char.add(rEye);

// Eyebrows
const browMat = pbrMat(PALETTE.hair, { roughness: 0.8 });
function brow(x, angle) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.015), browMat);
  m.position.set(x, 1.19, -0.3);
  m.rotation.z = angle;
  char.add(m);
  return m;
}
const lBrow = brow(-0.1, 0);
const rBrow = brow(0.1, 0);

// Blush
const blushMat = pbrMat(PALETTE.blush, { transparent: true, opacity: 0.2, roughness: 0.9 });
function blush(x) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), blushMat);
  m.position.set(x, 1.01, -0.3);
  m.scale.set(1.2, 0.5, 0.4);
  char.add(m);
}
blush(-0.17);
blush(0.17);

// Mouth
const mouthGroup = new THREE.Group();
mouthGroup.position.set(0, 1.0, -0.3);
const lipMat = pbrMat(PALETTE.lip, { roughness: 0.35 });
const lipUpper = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), lipMat);
lipUpper.scale.set(1.3, 0.25, 0.4);
lipUpper.position.y = 0.005;
mouthGroup.add(lipUpper);
const lipLower = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), lipMat);
lipLower.scale.set(1.1, 0.2, 0.35);
lipLower.position.y = -0.005;
mouthGroup.add(lipLower);
char.add(mouthGroup);

// Arms
const armMat = pbrMat(PALETTE.skin, { roughness: 0.6 });
function makeArm(x, rot) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.4, 10), armMat);
  m.position.set(x, 0.65, 0);
  m.rotation.z = rot;
  m.castShadow = true;
  char.add(m);
  return m;
}
const lArm = makeArm(-0.5, 0.12);
const rArm = makeArm(0.5, -0.12);

// Hands
const handMat = pbrMat(PALETTE.skin, { roughness: 0.5 });
function hand(x, y, z) {
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), handMat);
  h.position.set(x, y, z);
  char.add(h);
}
hand(-0.48, 0.45, 0);
hand(0.48, 0.45, 0);

scene.add(char);

/* ── Expressions ── */
const EXPR = {
  idle:     { s: 0.25, bL: 0,    bR: 0,    eO: 1,   hT: 0,   aS: 0.4, eI: 0.15, label: 'zoraasi' },
  happy:    { s: 0.75, bL: -0.08, bR: 0.08, eO: 1.1, hT: 0.04, aS: 0.7, eI: 0.3,  label: 'zoraasi' },
  thinking: { s: 0.1,  bL: 0.12, bR: -0.1, eO: 0.6, hT: 0.07, aS: 0.15, eI: 0.2,  label: '·' },
  sad:      { s: -0.15, bL: 0.08, bR: 0.08, eO: 0.55, hT: -0.04, aS: 0.2, eI: 0.1,  label: '·' },
  speaking: { s: 0.35, bL: 0,    bR: 0,    eO: 0.95, hT: 0.02, aS: 0.5, eI: 0.25, label: 'zoraasi' },
  listening:{ s: 0.2,  bL: 0.04, bR: 0.04, eO: 0.85, hT: 0.03, aS: 0.3, eI: 0.18, label: 'zoraasi' },
  excited:  { s: 0.9,  bL: -0.12, bR: 0.12, eO: 1.25, hT: 0.08, aS: 0.9, eI: 0.5,  label: 'zoraasi' },
  error:    { s: -0.2, bL: 0.06, bR: 0.06, eO: 0.5, hT: -0.03, aS: 0.15, eI: 0.1,  label: '·' },
};
let curExpr = 'idle';
let exprT = 1;
const TARGET = { ...EXPR.idle };

function setExpression(name) {
  if (!EXPR[name]) return;
  if (curExpr === name) return;
  curExpr = name;
  exprT = 0;
}

/* ── Scenes ── */
const sceneDefs = {
  chamber: { bg: [0x06070b, 0x0e0f17], fogD: 0.045, floorC: PALETTE.panel },
  cafe:    { bg: [0x141010, 0x1a1410], fogD: 0.06, floorC: { r: 0.12, g: 0.08, b: 0.06 } },
  garden:  { bg: [0x081410, 0x101a12], fogD: 0.055, floorC: { r: 0.06, g: 0.12, b: 0.08 } },
  study:   { bg: [0x0a0810, 0x120e1a], fogD: 0.05, floorC: PALETTE.panel },
  observatory: { bg: [0x04060e, 0x080a18], fogD: 0.035, floorC: 0x080a18 },
};
let curScene = 'chamber';

function buildScene(name) {
  const cfg = sceneDefs[name];
  if (!cfg) return;

  // Remove scene children (everything except char + lights)
  const keep = new Set([char, key, fill, rim, accent, ambient]);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const c = scene.children[i];
    if (!keep.has(c)) scene.remove(c);
  }
  
  scene.background = new THREE.Color(cfg.bg[0]);
  scene.fog = new THREE.FogExp2(cfg.bg[0], cfg.fogD);

  // Floor
  const flMat = new THREE.MeshStandardMaterial({ color: cfg.floorC, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.5 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), flMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  scene.add(floor);

  // Scene decorations
  if (name === 'chamber') chamberDecor();
  else if (name === 'cafe') cafeDecor();
  else if (name === 'garden') gardenDecor();
  else if (name === 'study') studyDecor();
  else if (name === 'observatory') observatoryDecor();
}

function chamberDecor() {
  // Floating particles
  const count = 80;
  const pos = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i*3] = (Math.random() - 0.5) * 5;
    pos[i*3+1] = Math.random() * 3;
    pos[i*3+2] = (Math.random() - 0.5) * 4;
    sizes[i] = 0.005 + Math.random() * 0.01;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.PointsMaterial({ color: PALETTE.violet, size: 0.008, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.position.y = 0.5;
  scene.add(pts);
  // Pillars
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const r = 1.8;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.panel, roughness: 0.8, metalness: 0.2 }));
    p.position.set(Math.cos(a) * r, 0.12 + 0.15, Math.sin(a) * r);
    scene.add(p);
  }
}

function cafeDecor() {
  // Warm lamp
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 0.8 }));
  lamp.position.set(1.2, 0.35, 0.8);
  scene.add(lamp);
  // Table
  const tMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.03, 12), tMat);
  top.position.set(0.8, 0.08, 0.5);
  top.castShadow = true;
  scene.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), tMat);
  leg.position.set(0.8, 0.01, 0.5);
  scene.add(leg);
  // Second table
  const top2 = top.clone(); top2.position.set(-0.7, 0.08, -0.4);
  scene.add(top2);
  const leg2 = leg.clone(); leg2.position.set(-0.7, 0.01, -0.4);
  scene.add(leg2);
  // Ambient warmth
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.04 }));
  glow.position.set(1.2, 0.3, 0.8);
  scene.add(glow);
}

function gardenDecor() {
  // Trees
  function tree(x, z, s = 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025*s, 0.035*s, 0.25*s, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10 }));
    trunk.position.set(x, 0.08*s, z);
    scene.add(trunk);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12*s, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.9 }));
    leaf.position.set(x, 0.22*s, z);
    scene.add(leaf);
  }
  tree(1.0, 0.6, 1.2);
  tree(-0.9, -0.5, 1);
  tree(0.5, -0.9, 0.8);
  // Flowers
  const colors = [PALETTE.amber, PALETTE.violet, PALETTE.rose, PALETTE.teal];
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - 0.5) * 3;
    const z = (Math.random() - 0.5) * 3;
    if (Math.hypot(x, z) < 0.5) continue;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4),
      new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * 4)] }));
    f.position.set(x, 0.01, z);
    scene.add(f);
  }
  // Hanging vine
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, transparent: true, opacity: 0.4 });
  for (let i = 0; i < 6; i++) {
    const x = (Math.random() - 0.5) * 2.5;
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, 0.1 + Math.random()*0.15, 4), vineMat);
    v.position.set(x, 0.18, -1.2);
    scene.add(v);
  }
}

function studyDecor() {
  // Bookshelves
  function shelf(x, z) {
    const sMat = new THREE.MeshStandardMaterial({ color: 0x1a1228, roughness: 0.9 });
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.06), sMat);
    s.position.set(x, 0.17, z);
    scene.add(s);
    const bColors = [PALETTE.amber, PALETTE.violet, PALETTE.rose, PALETTE.teal, 0x3a2a5a, 0x5a3a2a];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02),
        new THREE.MeshStandardMaterial({ color: bColors[i % bColors.length] }));
      b.position.set(x - 0.09 + i * 0.045, 0.18, z - 0.04);
      scene.add(b);
    }
  }
  shelf(1.0, 0.6);
  shelf(-0.9, -0.4);
  // Desk lamp
  const dl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 0.3 }));
  dl.position.set(0.5, 0.1, -0.3);
  scene.add(dl);
}

function observatoryDecor() {
  // Stars
  const starCount = 300;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) pos[i] = (Math.random() - 0.5) * 20;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.008, transparent: true, opacity: 0.5 });
  const stars = new THREE.Points(geo, mat);
  stars.position.y = 2;
  scene.add(stars);
  // Constellations
  function constel(pts, col = PALETTE.amber) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(pts.flat());
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.15, depthWrite: false });
    const l = new THREE.Line(g, m);
    l.position.y = 1;
    scene.add(l);
  }
  constel([[-0.5,0.5,-1], [0,0.8,-1.2], [0.5,0.5,-1], [0.8,0.2,-0.8]]);
  constel([[-0.3,-0.2,-1.5], [0.2,0,-1.3], [0.5,-0.3,-1.4], [0.1,-0.5,-1.6]], PALETTE.violet);
  // Orbital ring
  const orbMat = new THREE.MeshBasicMaterial({ color: PALETTE.violet, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  const orb = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.62, 64), orbMat);
  orb.position.y = 0.5;
  scene.add(orb);
}

buildScene('chamber');

/* ── Animation ── */
const clock = new THREE.Clock();
let time = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // Expression blend
  exprT = Math.min(1, exprT + dt * 2.5);
  const e0 = TARGET;
  const e1 = EXPR[curExpr] || EXPR.idle;
  // Ease in-out
  const t = exprT < 0.5 ? 2 * exprT * exprT : 1 - (-2 * exprT + 2) ** 2 / 2;
  const s = e0.s + (e1.s - e0.s) * t;
  const bL = e0.bL + (e1.bL - e0.bL) * t;
  const bR = e0.bR + (e1.bR - e0.bR) * t;
  const eO = e0.eO + (e1.eO - e0.eO) * t;
  const hT = e0.hT + (e1.hT - e0.hT) * t;
  const aS = e0.aS + (e1.aS - e0.aS) * t;
  const eI = e0.eI + (e1.eI - e0.eI) * t;

  if (exprT >= 0.99) { Object.assign(TARGET, e1); }

  // Mouth
  const sm = 1 + s * 0.4;
  lipUpper.scale.x = 1.3 * (0.5 + 0.5 * sm);
  lipUpper.scale.y = 0.25 * (0.2 + 0.8 * (s > 0 ? 1 + s * 0.5 : Math.max(0.2, 1 + s * 0.8)));
  lipLower.scale.x = 1.1 * (0.5 + 0.5 * sm);
  lipLower.scale.y = 0.2 * (0.2 + 0.8 * (s > 0 ? 1 + s * 0.3 : Math.max(0.15, 1 + s * 0.6)));
  mouthGroup.position.y = 1.0 - s * 0.008;

  // Eyebrows
  lBrow.rotation.z = bL;
  rBrow.rotation.z = bR;

  // Blink
  const blink = Math.max(0.1, 1 - (Math.sin(time * 3) > 0.92 ? (Math.sin(time * 3) - 0.92) * 13 : 0));
  const eyeScale = blink * eO;
  lEye.scale.y = eyeScale;
  rEye.scale.y = eyeScale;

  // Head tilt
  char.rotation.z = hT;

  // Breathing
  const breathe = Math.sin(time * 1.1) * 0.002 * (0.5 + aS * 0.5);
  body.position.y = 0.42 + breathe;
  head.position.y = 1.08 + breathe;
  neck.position.y = 0.92 + breathe;

  // Arm sway
  const armSway = Math.sin(time * 0.7) * 0.025 * aS;
  lArm.rotation.z = 0.12 + armSway;
  rArm.rotation.z = -0.12 - armSway;

  // Glow rings
  ring.material.emissiveIntensity = 0.15 + eI + Math.sin(time * 0.5) * 0.08;
  ring2.material.emissiveIntensity = 0.2 + eI * 0.5 + Math.sin(time * 0.7 + 1) * 0.1;
  ring.rotation.z = Math.sin(time * 0.15) * 0.05;
  ring2.rotation.z = Math.sin(time * 0.12 + 0.5) * 0.08;

  // Pedestal slow rotation
  pedestal.rotation.y = time * 0.04;
  ring.rotation.y = time * 0.1;
  ring2.rotation.y = time * 0.08;

  // Camera orbit
  const cTheta = Math.sin(time * 0.025) * 0.2;
  const cRad = 5.8;
  camera.position.x = Math.sin(cTheta) * cRad;
  camera.position.z = Math.cos(cTheta) * cRad;
  camera.position.y = 2.2 + Math.sin(time * 0.015) * 0.08;
  camera.lookAt(0, 1.1, 0);

  composer.render();
}

animate();

/* ── Resize ── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

/* ════════════════════════════════════════
   UI Integration
   ════════════════════════════════════════ */

const chatBox = document.getElementById('chat-box');
const inp = document.getElementById('inp');
const sendBtn = document.getElementById('send-btn');
const dot = document.getElementById('dot');
const statusText = document.getElementById('status-text');
const exprLabel = document.getElementById('expr-label');
const govPanel = document.getElementById('gov-panel');
const govToggle = document.getElementById('gov-toggle');
const modelSelect = document.getElementById('model-select');

// Governance panel references
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

modelSelect.addEventListener('change', () => {
  if (govVisible) checkHealth();
});

function appendMsg(role, text) {
  const div = document.createElement('div');
  div.className = `m ${role}`;
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `${text} <span class="ts">${ts}</span>`;
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
  statusText.textContent = 'thinking…';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: document.getElementById('model-select').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    appendMsg('z', data.reply);
    setExpression('happy');
    exprLabel.textContent = 'zoraasi';
    exprLabel.style.color = '#ed9b69';
    statusText.textContent = 'governed';
    setTimeout(() => { setExpression('idle'); }, 3000);
  } catch (err) {
    appendMsg('s', err.message);
    setExpression('error');
    exprLabel.textContent = '·';
    exprLabel.style.color = '#d47373';
    setTimeout(() => { setExpression('idle'); }, 2500);
  } finally {
    sendBtn.disabled = false;
    inp.focus();
  }
}

sendBtn.addEventListener('click', () => sendMessage(inp.value));
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(inp.value); });

/* ── Scene Switching ── */
document.querySelectorAll('.sc-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const name = btn.dataset.scene;
    curScene = name;
    buildScene(name);
    setExpression('excited');
    exprLabel.textContent = name;
    exprLabel.style.color = '#3a9e6f';
    setTimeout(() => { setExpression('idle'); }, 2000);
  });
});

/* ── Health & Governance ── */
async function checkHealth() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) { setOnline(false); return; }
    setOnline(true);
    if (govVisible) {
      const d = await res.json();
      const curModel = document.getElementById('model-select').value;
      const modelMeta = d.modelMeta?.[curModel] || {};
      govModel.textContent = modelMeta.label || curModel;
      const budget = d.budget?.[curModel];
      if (budget) {
        govBudget.textContent = `$${budget.spentTodayUsd.toFixed(3)}/$${budget.dailyCapUsd.toFixed(2)}`;
      } else {
        govBudget.textContent = 'free';
      }
    }
  } catch { setOnline(false); }
}

/* ── Daemon WebSocket ── */
function connectDaemonWS() {
  try {
    const ws = new WebSocket('ws://127.0.0.1:8766');
    ws.onmessage = (e) => {
      try {
        const s = JSON.parse(e.data);
        statusText.textContent = s.status === 'running_task' ? 'researching' : 'governed';
        if (govVisible) {
          govTasks.innerHTML = `${s.tasks_completed_today ?? '?'}/${s.daily_task_limit ?? '?'}`;
          govTools.innerHTML = `${s.tool_calls_used_today ?? '?'}/${s.daily_tool_call_limit ?? '?'}`;
          govTokens.innerHTML = `${((s.tokens_used_today ?? 0) / 1000).toFixed(1)}k/${((s.daily_token_limit ?? 0) / 1000).toFixed(0)}k`;
          govAudit.textContent = s.audit_chain_valid ? '✓' : '⚠';
          govAudit.className = `val ${s.audit_chain_valid ? 'green' : 'red'}`;
        }
        if (s.status === 'running_task' && s.current_task) {
          appendMsg('s', `Daemon researching: ${s.current_task.slice(0, 80)}…`);
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

/* ── Mouse Tracking ── */
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 0.035;
  const y = (e.clientY / window.innerHeight - 0.5) * 0.015;
  [lEye, rEye].forEach((eye, i) => {
    const sign = i === 0 ? 1 : 1;
    eye.children[1].position.x = 0.05 + x * sign;
    eye.children[1].position.y = y;
    eye.children[2].position.x = 0.07 + x * 1.3 * sign;
    eye.children[2].position.y = y * 1.3;
  });
});

/* ── Auto-clear expression label ── */
setTimeout(() => { exprLabel.style.transition = 'opacity 2s'; }, 5000);
