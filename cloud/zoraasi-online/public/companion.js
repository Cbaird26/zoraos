import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const PALETTE = {
  amber: 0xed9b69, violet: 0x8d6de8, teal: 0x3a9e6f, rose: 0xd47373,
  ink: 0x06070b, panel: 0x0e0f17, frost: 0xe8e0d8, muted: 0x6b5f58,
  skin: 0xfce4e0, skinShadow: 0xf5c8c0, hair: 0x1a1228, hairHighlight: 0x3a2a5a,
  eyeWhite: 0xf8f4f0, iris: 0x8d6de8, irisInner: 0xb8a0f8, pupil: 0x0a0812,
  lip: 0xe8737a, blush: 0xf8b0b0, dress: 0x0e0f17, dressAccent: 0x8d6de8,
  gold: 0xed9b69, goldEmissive: 0xed9b69,
};

const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.ink);
scene.fog = new THREE.FogExp2(PALETTE.ink, 0.04);

const camera = new THREE.PerspectiveCamera(24, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 2.5, 6.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.25, 0.08);
composer.addPass(bloom);

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

const char = new THREE.Group();
const hairPivot = new THREE.Group();

function pbrMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.5, metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

// Pedestal — crystalline platform
const pedMat = pbrMat(PALETTE.panel, { roughness: 0.3, metalness: 0.4 });
const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.06, 48), pedMat);
ped.position.y = -0.03;
ped.receiveShadow = true;
ped.castShadow = true;
char.add(ped);

// Glow ring
const gMat = pbrMat(PALETTE.gold, { emissive: PALETTE.gold, emissiveIntensity: 0.3, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
const gRing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.012, 16, 48), gMat);
gRing.position.y = 0.02;
gRing.rotation.x = -Math.PI / 2;
char.add(gRing);
const gRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.006, 16, 48), gMat.clone());
gRing2.material.emissiveIntensity = 0.4;
gRing2.material.color.setHex(PALETTE.violet);
gRing2.material.emissive.setHex(PALETTE.violet);
gRing2.position.y = 0.015;
gRing2.rotation.x = -Math.PI / 2 + 0.1;
char.add(gRing2);

// ── Body ──
const dressMat = pbrMat(0x1a1a2e, { roughness: 0.85, metalness: 0.05 });
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 0.75, 20), dressMat);
body.position.y = 0.38;
body.castShadow = true;
char.add(body);

// Skirt flare
const skirtMat = pbrMat(0x1a1a2e, { roughness: 0.85, metalness: 0.02, transparent: true, opacity: 0.9 });
const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 24, 1, true), skirtMat);
skirt.position.y = 0.2;
skirt.rotation.x = Math.PI;
char.add(skirt);

// Collar
const collarMat = pbrMat(PALETTE.dressAccent, { emissive: PALETTE.dressAccent, emissiveIntensity: 0.1, roughness: 0.3 });
const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 12, 24), collarMat);
collar.position.y = 0.74;
collar.rotation.x = Math.PI / 2 * 0.85;
char.add(collar);

// Bow at neck
const bowMat = pbrMat(PALETTE.rose, { roughness: 0.4 });
for (let i = -1; i <= 1; i += 2) {
  const bw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), bowMat);
  bw.position.set(i * 0.07, 0.78, -0.06);
  bw.rotation.z = i * 0.35;
  char.add(bw);
}
const bowC = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), bowMat);
bowC.position.set(0, 0.78, -0.06);
char.add(bowC);

// Neck
const neckMat = pbrMat(PALETTE.skin, { roughness: 0.5 });
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.1, 16), neckMat);
neck.position.y = 0.84;
char.add(neck);

// ── Head (slightly larger — anime proportion) ──
const headMat = pbrMat(PALETTE.skin, { roughness: 0.35 });
const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 28), headMat);
head.position.y = 1.04;
head.castShadow = true;
char.add(head);

// ── Anime Hair ──
function makeHairStrand(xOff, yOff, zOff, w, h, d, color, roughness = 0.9, matFrom) {
  const m = matFrom || pbrMat(color, { roughness });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(xOff, yOff, zOff);
  char.add(mesh);
  return mesh;
}
const hairMat = pbrMat(PALETTE.hair, { roughness: 0.9 });
const hairHLMat = pbrMat(PALETTE.hairHighlight, { roughness: 0.85 });
// Main dome
makeHairStrand(0, 1.04, 0, 0.64, 0.18, 0.64, 0, 0, hairMat);
makeHairStrand(0, 1.12, 0, 0.58, 0.14, 0.58, 0, 0, hairMat);
makeHairStrand(0, 1.2, 0, 0.48, 0.12, 0.48, 0, 0, hairHLMat);
makeHairStrand(0, 1.27, 0, 0.36, 0.1, 0.36, 0, 0, hairHLMat);
// Ahoge (cowlick)
const ahogeMat = pbrMat(PALETTE.hairHighlight, { roughness: 0.6, emissive: PALETTE.hairHighlight, emissiveIntensity: 0.15 });
const ahoge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.005, 0.1, 6), ahogeMat);
ahoge.position.set(0, 1.35, -0.08);
ahoge.rotation.x = -0.3;
ahoge.rotation.z = 0.08;
char.add(ahoge);
// Side strands
const sideMat = pbrMat(PALETTE.hair, { roughness: 0.85 });
for (let side = -1; side <= 1; side += 2) {
  for (let i = 0; i < 3; i++) {
    const ss = new THREE.Mesh(new THREE.CylinderGeometry(0.02 - i * 0.003, 0.025 - i * 0.004, 0.12 + i * 0.04, 6), sideMat);
    ss.position.set(side * (0.28 + i * 0.02), 1.0 - i * 0.06, -0.02 + i * 0.02);
    ss.rotation.z = side * (0.15 + i * 0.05);
    ss.rotation.x = 0.1;
    char.add(ss);
  }
}
// Long back hair
for (let i = 0; i < 4; i++) {
  const bh = new THREE.Mesh(new THREE.CylinderGeometry(0.03 - i * 0.004, 0.04 - i * 0.005, 0.15 + i * 0.04, 6), hairMat);
  bh.position.set(-0.1 + i * 0.065, 0.98 - i * 0.04, 0.3 + i * 0.02);
  bh.rotation.x = -0.1;
  char.add(bh);
}
// Bangs
const bangMat = pbrMat(PALETTE.hair, { roughness: 0.8 });
for (let i = 0; i < 5; i++) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.04), bangMat);
  b.position.set(-0.12 + i * 0.06, 1.06, -0.31);
  b.rotation.x = -0.15;
  char.add(b);
}
// Side bangs
for (let side = -1; side <= 1; side += 2) {
  const sb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), bangMat);
  sb.position.set(side * 0.22, 1.04, -0.29);
  sb.rotation.z = side * 0.2;
  char.add(sb);
}

// ── Anime Eyes (large, expressive) ──
const eyeWhiteMat = pbrMat(PALETTE.eyeWhite, { roughness: 0.1 });
const irisMat = pbrMat(PALETTE.iris, { emissive: PALETTE.iris, emissiveIntensity: 0.25, roughness: 0.15 });
const irisInnerMat = pbrMat(PALETTE.irisInner, { emissive: PALETTE.irisInner, emissiveIntensity: 0.15, roughness: 0.1 });
const pupilMat = pbrMat(PALETTE.pupil, { roughness: 0.1 });
const highlightMat = pbrMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0 });
const lashMat = pbrMat(PALETTE.hair, { roughness: 0.7 });

function buildAnimeEye(x) {
  const g = new THREE.Group();
  // Sclera (white)
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 24), eyeWhiteMat);
  g.add(white);
  // Iris (large)
  const irisOuter = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 20), irisMat);
  irisOuter.position.z = 0.04;
  g.add(irisOuter);
  // Inner iris gradient
  const irisInner = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 20), irisInnerMat);
  irisInner.position.z = 0.06;
  g.add(irisInner);
  // Pupil
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), pupilMat);
  pupil.position.z = 0.08;
  g.add(pupil);
  // Catchlight / highlight (top-left)
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), highlightMat);
  hl.position.set(-0.025, 0.025, 0.09);
  g.add(hl);
  const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), highlightMat);
  hl2.position.set(0.02, -0.02, 0.09);
  g.add(hl2);
  // Eyelashes (upper)
  for (let i = -3; i <= 3; i++) {
    const lash = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.004, 0.025), lashMat);
    const angle = i * 0.2;
    lash.position.set(Math.sin(angle) * 0.08, Math.cos(angle) * 0.08, 0.04);
    lash.rotation.z = angle * 0.3;
    g.add(lash);
  }
  // Upper lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.04), pbrMat(PALETTE.skin, { roughness: 0.5 }));
  lid.position.y = 0.05;
  lid.position.z = 0.02;
  g.add(lid);
  // Lower lid
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.03), pbrMat(PALETTE.skin, { roughness: 0.5 }));
  lower.position.y = -0.045;
  lower.position.z = 0.02;
  g.add(lower);
  g.position.set(x, 1.12, -0.28);
  return g;
}
const lEye = buildAnimeEye(-0.12);
const rEye = buildAnimeEye(0.12);
char.add(lEye);
char.add(rEye);

// Eyebrows
const browMat = pbrMat(PALETTE.hair, { roughness: 0.7 });
const lBrow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.015), browMat);
lBrow.position.set(-0.13, 1.2, -0.3);
lBrow.rotation.z = -0.05;
char.add(lBrow);
const rBrow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.015), browMat);
rBrow.position.set(0.13, 1.2, -0.3);
rBrow.rotation.z = 0.05;
char.add(rBrow);

// Blush
const blushMat = pbrMat(PALETTE.blush, { transparent: true, opacity: 0.25, roughness: 0.9 });
for (let side = -1; side <= 1; side += 2) {
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), blushMat);
  bl.position.set(side * 0.15, 0.99, -0.3);
  bl.scale.set(1.3, 0.5, 0.4);
  char.add(bl);
}

// ── Mouth (anime style — small, cute) ──
const mouthGroup = new THREE.Group();
mouthGroup.position.set(0, 0.98, -0.3);
const lipMat = pbrMat(PALETTE.lip, { roughness: 0.3 });
const lipUpper = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), lipMat);
lipUpper.scale.set(1.1, 0.2, 0.3);
lipUpper.position.y = 0.003;
mouthGroup.add(lipUpper);
const lipLower = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), lipMat);
lipLower.scale.set(0.9, 0.15, 0.25);
lipLower.position.y = -0.003;
mouthGroup.add(lipLower);
char.add(mouthGroup);

// ── Arms with puff sleeves ──
const armMat = pbrMat(PALETTE.skin, { roughness: 0.5 });
const sleeveMat = pbrMat(0x1a1a2e, { roughness: 0.85 });
function makeArm(x, rot) {
  const g = new THREE.Group();
  // Upper arm
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 10), armMat);
  upper.position.y = 0.15;
  upper.castShadow = true;
  g.add(upper);
  // Puff sleeve (shoulder)
  const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), sleeveMat);
  sleeve.position.y = 0.28;
  sleeve.scale.set(1, 0.5, 1);
  g.add(sleeve);
  // Hand
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), armMat);
  hand.position.y = 0.3;
  g.add(hand);
  g.position.set(x, 0.58, 0);
  g.rotation.z = rot;
  char.add(g);
  return { group: g, hand };
}
const lArmG = makeArm(-0.46, 0.18);
const rArmG = makeArm(0.46, -0.18);

// ── Floating accessories ──
const orbMat = pbrMat(PALETTE.violet, { emissive: PALETTE.violet, emissiveIntensity: 0.5, transparent: true, opacity: 0.3 });
const orb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), orbMat);
orb.position.set(0.15, 0.15, 0.25);
char.add(orb);
const orb2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), orbMat.clone());
orb2.material.color.setHex(PALETTE.gold);
orb2.material.emissive.setHex(PALETTE.gold);
orb2.position.set(-0.12, 0.1, 0.28);
char.add(orb2);

scene.add(char);

// ── Expressions ──
const EXPR = {
  idle:     { s: 0.25, bL: -0.05, bR: 0.05, eO: 1,   hT: 0,   aS: 0.4, eI: 0.15 },
  happy:    { s: 0.7,  bL: -0.1,  bR: 0.1,  eO: 1.15, hT: 0.03, aS: 0.7, eI: 0.35 },
  thinking: { s: 0.1,  bL: 0.1,   bR: -0.08, eO: 0.65, hT: 0.06, aS: 0.15, eI: 0.2 },
  sad:      { s: -0.15, bL: 0.06, bR: 0.06, eO: 0.55, hT: -0.04, aS: 0.2, eI: 0.1 },
  speaking: { s: 0.4,  bL: -0.02, bR: 0.02, eO: 1,   hT: 0.02, aS: 0.55, eI: 0.25 },
  listening:{ s: 0.2,  bL: 0.02,  bR: 0.02, eO: 0.9, hT: 0.02, aS: 0.35, eI: 0.2 },
  excited:  { s: 0.85, bL: -0.14, bR: 0.14, eO: 1.3, hT: 0.07, aS: 0.95, eI: 0.55 },
  error:    { s: -0.2, bL: 0.05,  bR: 0.05, eO: 0.5, hT: -0.03, aS: 0.15, eI: 0.1 },
};
let curExpr = 'idle';
let exprT = 1;
const TARGET = { ...EXPR.idle };

function setExpression(name) {
  if (!EXPR[name] || curExpr === name) return;
  curExpr = name;
  exprT = 0;
}

// ── Scenes ──
const sceneDefs = {
  chamber: { bg: [0x06070b, 0x0e0f17], fogD: 0.04, floorC: PALETTE.panel },
  cafe:    { bg: [0x141010, 0x1a1410], fogD: 0.055, floorC: { r: 0.12, g: 0.08, b: 0.06 } },
  garden:  { bg: [0x081410, 0x101a12], fogD: 0.05, floorC: { r: 0.06, g: 0.12, b: 0.08 } },
  study:   { bg: [0x0a0810, 0x120e1a], fogD: 0.045, floorC: PALETTE.panel },
  observatory: { bg: [0x04060e, 0x080a18], fogD: 0.03, floorC: 0x080a18 },
};
let curScene = 'chamber';

// Scene VFX
let sceneParticles = null;

function buildScene(name) {
  const cfg = sceneDefs[name];
  if (!cfg) return;
  const keep = new Set([char, key, fill, rim, accent, ambient]);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const c = scene.children[i];
    if (!keep.has(c)) scene.remove(c);
  }
  sceneParticles = null;
  scene.background = new THREE.Color(cfg.bg[0]);
  scene.fog = new THREE.FogExp2(cfg.bg[0], cfg.fogD);
  const flMat = new THREE.MeshStandardMaterial({ color: cfg.floorC, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.5 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), flMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  scene.add(floor);
  const fns = { chamber: chamberDecor, cafe: cafeDecor, garden: gardenDecor, study: studyDecor, observatory: observatoryDecor };
  (fns[name] || chamberDecor)();
}

function sparkleParticles(count, color, size, spread) {
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i*3] = (Math.random() - 0.5) * spread;
    pos[i*3+1] = Math.random() * 2.5;
    pos[i*3+2] = (Math.random() - 0.5) * spread;
    vel.push({ x: (Math.random() - 0.5) * 0.002, y: 0.002 + Math.random() * 0.005, z: (Math.random() - 0.5) * 0.002 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return { pts, vel, spread };
}

function chamberDecor() {
  const p = sparkleParticles(60, PALETTE.violet, 0.01, 4);
  sceneParticles = () => {
    const pos = p.pts.geometry.attributes.position.array;
    for (let i = 0; i < p.vel.length; i++) {
      pos[i*3] += p.vel[i].x;
      pos[i*3+1] += p.vel[i].y;
      pos[i*3+2] += p.vel[i].z;
      if (pos[i*3+1] > 2.5) pos[i*3+1] = 0;
      if (Math.abs(pos[i*3]) > p.spread / 2) p.vel[i].x *= -1;
      if (Math.abs(pos[i*3+2]) > p.spread / 2) p.vel[i].z *= -1;
    }
    p.pts.geometry.attributes.position.needsUpdate = true;
  };
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.panel, roughness: 0.8, metalness: 0.2, transparent: true, opacity: 0.5 }));
    p.position.set(Math.cos(a) * 1.8, 0.12 + 0.15, Math.sin(a) * 1.8);
    scene.add(p);
  }
}

function cafeDecor() {
  const p = sparkleParticles(40, PALETTE.amber, 0.008, 3);
  sceneParticles = () => {
    const pos = p.pts.geometry.attributes.position.array;
    for (let i = 0; i < p.vel.length; i++) {
      pos[i*3] += p.vel[i].x;
      pos[i*3+1] += p.vel[i].y;
      pos[i*3+2] += p.vel[i].z;
      if (pos[i*3+1] > 2.5) pos[i*3+1] = 0;
      if (Math.abs(pos[i*3]) > p.spread / 2) p.vel[i].x *= -1;
      if (Math.abs(pos[i*3+2]) > p.spread / 2) p.vel[i].z *= -1;
    }
    p.pts.geometry.attributes.position.needsUpdate = true;
  };
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 0.8 }));
  lamp.position.set(1.2, 0.35, 0.8);
  scene.add(lamp);
  const tMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.03, 12), tMat);
  top.position.set(0.8, 0.08, 0.5); top.castShadow = true; scene.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), tMat);
  leg.position.set(0.8, 0.01, 0.5); scene.add(leg);
  const top2 = top.clone(); top2.position.set(-0.7, 0.08, -0.4); scene.add(top2);
  const leg2 = leg.clone(); leg2.position.set(-0.7, 0.01, -0.4); scene.add(leg2);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.04 }));
  glow.position.set(1.2, 0.3, 0.8); scene.add(glow);
}

function gardenDecor() {
  const p = sparkleParticles(80, PALETTE.teal, 0.006, 4);
  sceneParticles = () => {
    const pos = p.pts.geometry.attributes.position.array;
    for (let i = 0; i < p.vel.length; i++) {
      pos[i*3] += p.vel[i].x * 0.5;
      pos[i*3+1] += p.vel[i].y;
      pos[i*3+2] += p.vel[i].z * 0.5;
      if (pos[i*3+1] > 2.5) pos[i*3+1] = 0;
    }
    p.pts.geometry.attributes.position.needsUpdate = true;
  };
  function tree(x, z, s = 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025*s, 0.035*s, 0.25*s, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10 }));
    trunk.position.set(x, 0.08*s, z); scene.add(trunk);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12*s, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.9 }));
    leaf.position.set(x, 0.22*s, z); scene.add(leaf);
  }
  tree(1.0, 0.6, 1.2); tree(-0.9, -0.5, 1); tree(0.5, -0.9, 0.8);
  const colors = [PALETTE.amber, PALETTE.violet, PALETTE.rose, PALETTE.teal];
  for (let i = 0; i < 16; i++) {
    const x = (Math.random() - 0.5) * 3;
    const z = (Math.random() - 0.5) * 3;
    if (Math.hypot(x, z) < 0.5) continue;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4),
      new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * 4)] }));
    f.position.set(x, 0.01, z); scene.add(f);
  }
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, transparent: true, opacity: 0.4 });
  for (let i = 0; i < 6; i++) {
    const x = (Math.random() - 0.5) * 2.5;
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, 0.1 + Math.random()*0.15, 4), vineMat);
    v.position.set(x, 0.18, -1.2); scene.add(v);
  }
}

function studyDecor() {
  const p = sparkleParticles(30, PALETTE.gold, 0.005, 3);
  sceneParticles = () => {
    const pos = p.pts.geometry.attributes.position.array;
    for (let i = 0; i < p.vel.length; i++) {
      pos[i*3] += p.vel[i].x;
      pos[i*3+1] += p.vel[i].y;
      pos[i*3+2] += p.vel[i].z;
      if (pos[i*3+1] > 2.5) pos[i*3+1] = 0;
    }
    p.pts.geometry.attributes.position.needsUpdate = true;
  };
  function shelf(x, z) {
    const sMat = new THREE.MeshStandardMaterial({ color: 0x1a1228, roughness: 0.9 });
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.06), sMat);
    s.position.set(x, 0.17, z); scene.add(s);
    const bColors = [PALETTE.amber, PALETTE.violet, PALETTE.rose, PALETTE.teal, 0x3a2a5a, 0x5a3a2a];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02),
        new THREE.MeshStandardMaterial({ color: bColors[i % bColors.length] }));
      b.position.set(x - 0.09 + i * 0.045, 0.18, z - 0.04); scene.add(b);
    }
  }
  shelf(1.0, 0.6); shelf(-0.9, -0.4);
  const dl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 0.3 }));
  dl.position.set(0.5, 0.1, -0.3); scene.add(dl);
}

function observatoryDecor() {
  const starCount = 300;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) pos[i] = (Math.random() - 0.5) * 20;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.008, transparent: true, opacity: 0.5 });
  const stars = new THREE.Points(geo, mat);
  stars.position.y = 2; scene.add(stars);
  // Shooting star particles
  const sp = sparkleParticles(50, 0xffffff, 0.015, 6);
  sceneParticles = () => {
    const pos = sp.pts.geometry.attributes.position.array;
    for (let i = 0; i < sp.vel.length; i++) {
      pos[i*3] += sp.vel[i].x * 0.8;
      pos[i*3+1] -= sp.vel[i].y * 0.3;
      pos[i*3+2] += sp.vel[i].z;
      if (pos[i*3+1] < -0.5) { pos[i*3+1] = 2; pos[i*3] = (Math.random() - 0.5) * sp.spread; pos[i*3+2] = (Math.random() - 0.5) * sp.spread; }
    }
    sp.pts.geometry.attributes.position.needsUpdate = true;
  };
  function constel(pts, col = PALETTE.amber) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.15, depthWrite: false }));
    l.position.y = 1; scene.add(l);
  }
  constel([[-0.5,0.5,-1], [0,0.8,-1.2], [0.5,0.5,-1], [0.8,0.2,-0.8]]);
  constel([[-0.3,-0.2,-1.5], [0.2,0,-1.3], [0.5,-0.3,-1.4], [0.1,-0.5,-1.6]], PALETTE.violet);
  const orbMat = new THREE.MeshBasicMaterial({ color: PALETTE.violet, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  const orb = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.62, 64), orbMat);
  orb.position.y = 0.5; scene.add(orb);
}

buildScene('chamber');

// ── Animation Loop ──
const clock = new THREE.Clock();
let time = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (sceneParticles) sceneParticles();

  // Expression blend
  exprT = Math.min(1, exprT + dt * 2.5);
  const e0 = TARGET;
  const e1 = EXPR[curExpr] || EXPR.idle;
  const t = exprT < 0.5 ? 2 * exprT * exprT : 1 - (-2 * exprT + 2) ** 2 / 2;
  const s = e0.s + (e1.s - e0.s) * t;
  const bL = e0.bL + (e1.bL - e0.bL) * t;
  const bR = e0.bR + (e1.bR - e0.bR) * t;
  const eO = e0.eO + (e1.eO - e0.eO) * t;
  const hT = e0.hT + (e1.hT - e0.hT) * t;
  const aS = e0.aS + (e1.aS - e0.aS) * t;
  const eI = e0.eI + (e1.eI - e0.eI) * t;
  if (exprT >= 0.99) Object.assign(TARGET, e1);

  // Mouth
  const sm = 1 + s * 0.4;
  lipUpper.scale.x = 1.1 * (0.5 + 0.5 * sm);
  lipUpper.scale.y = 0.2 * (s > 0 ? 1 + s * 0.5 : Math.max(0.2, 1 + s * 0.8));
  lipLower.scale.x = 0.9 * (0.5 + 0.5 * sm);
  lipLower.scale.y = 0.15 * (s > 0 ? 1 + s * 0.3 : Math.max(0.15, 1 + s * 0.6));
  mouthGroup.position.y = 0.98 - s * 0.008;

  // Eyebrows
  lBrow.rotation.z = bL;
  rBrow.rotation.z = bR;

  // Blink
  const blink = Math.max(0.1, 1 - (Math.sin(time * 3) > 0.94 ? (Math.sin(time * 3) - 0.94) * 17 : 0));
  const eyeScale = blink * eO;
  lEye.scale.y = eyeScale;
  rEye.scale.y = eyeScale;

  // Head tilt
  char.rotation.z = hT;

  // Ahoge bounce
  ahoge.rotation.x = -0.3 + Math.sin(time * 2) * 0.05;
  ahoge.rotation.z = 0.08 + Math.sin(time * 1.7) * 0.04;

  // Breathing
  const breathe = Math.sin(time * 1.1) * 0.002 * (0.5 + aS * 0.5);
  body.position.y = 0.38 + breathe;
  head.position.y = 1.04 + breathe;
  neck.position.y = 0.84 + breathe;

  // Arm sway + speaking gesture
  const speakJitter = curExpr === 'speaking' || curExpr === 'excited' ? Math.sin(time * 8) * 0.03 * aS : 0;
  const armSway = Math.sin(time * 0.7) * 0.025 * aS + speakJitter;
  lArmG.group.rotation.z = 0.18 + armSway;
  rArmG.group.rotation.z = -0.18 - armSway;

  // Floating orbs
  orb.position.y = 0.15 + Math.sin(time * 1.3) * 0.04;
  orb.position.x = 0.15 + Math.sin(time * 0.8) * 0.02;
  orb2.position.y = 0.1 + Math.sin(time * 1.7 + 1) * 0.03;
  orb2.position.x = -0.12 + Math.sin(time * 0.9 + 1) * 0.02;

  // Glow rings
  const gIntensity = 0.15 + eI + Math.sin(time * 0.5) * 0.08;
  gRing.material.emissiveIntensity = Math.max(0, gIntensity);
  gRing2.material.emissiveIntensity = Math.max(0, 0.2 + eI * 0.5 + Math.sin(time * 0.7 + 1) * 0.1);
  gRing.rotation.z = Math.sin(time * 0.15) * 0.05;
  gRing2.rotation.z = Math.sin(time * 0.12 + 0.5) * 0.08;

  // Pedestal slow rotation
  ped.rotation.y = time * 0.04;
  gRing.rotation.y = time * 0.1;
  gRing2.rotation.y = time * 0.08;

  // Camera orbit
  const cTheta = Math.sin(time * 0.025) * 0.2;
  camera.position.x = Math.sin(cTheta) * 6.2;
  camera.position.z = Math.cos(cTheta) * 6.2;
  camera.position.y = 2.5 + Math.sin(time * 0.015) * 0.08 + (curExpr === 'excited' ? 0.05 : 0);
  camera.lookAt(0, 1.1, 0);

  // Bloom intensity based on expression energy
  bloom.strength = 0.12 + eI * 0.08;

  composer.render();
}

animate();

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
  div.className = `m ${role}`;
  div.innerHTML = `${text} <span class="ts">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
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
      body: JSON.stringify({ message: text, model: modelSelect.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    appendMsg('z', data.reply);
    setExpression('speaking');
    exprLabel.textContent = 'zoraasi';
    exprLabel.style.color = '#ed9b69';
    statusText.textContent = 'governed';
    setTimeout(() => { setExpression('happy'); }, 1500);
    setTimeout(() => { setExpression('idle'); }, 4000);
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

// Input focus → expression change
inp.addEventListener('focus', () => setExpression('listening'));
inp.addEventListener('blur', () => { if (curExpr === 'listening') setExpression('idle'); });

document.querySelectorAll('.sc-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    curScene = btn.dataset.scene;
    buildScene(curScene);
    setExpression('excited');
    exprLabel.textContent = curScene;
    exprLabel.style.color = '#3a9e6f';
    setTimeout(() => { setExpression('idle'); }, 2500);
  });
});

async function checkHealth() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) { setOnline(false); return; }
    setOnline(true);
    if (govVisible) {
      const d = await res.json();
      const curModel = modelSelect.value;
      const modelMeta = d.modelMeta?.[curModel] || {};
      govModel.textContent = modelMeta.label || curModel;
      const budget = d.budget?.[curModel];
      govBudget.textContent = budget ? `$${budget.spentTodayUsd.toFixed(3)}/$${budget.dailyCapUsd.toFixed(2)}` : 'free';
    }
  } catch { setOnline(false); }
}

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

// Mouse tracking — eyes + slight head turn
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 0.035;
  const y = (e.clientY / window.innerHeight - 0.5) * 0.015;
  [lEye, rEye].forEach((eye) => {
    eye.children[1].position.x = 0.04 + x;
    eye.children[1].position.y = y;
    eye.children[2].position.x = 0.06 + x * 1.3;
    eye.children[2].position.y = y * 1.3;
    eye.children[4].position.x = -0.025 + x * 0.5;
    eye.children[4].position.y = 0.025 + y * 0.5;
  });
  // Subtle head follow
  if (curExpr === 'idle' || curExpr === 'listening') {
    head.rotation.y = x * 0.15;
    head.rotation.x = -y * 0.1;
  }
});

setTimeout(() => { exprLabel.style.transition = 'opacity 2s'; }, 5000);
