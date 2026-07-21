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
scene.fog = new THREE.FogExp2(PALETTE.ink, 0.045);

const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 2.35, 5.9);

const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  alpha: true, 
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false
});
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
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.45, 0.6);
composer.addPass(bloom);

// ── Lighting System ──
const ambient = new THREE.HemisphereLight(PALETTE.frost, PALETTE.ink, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffeedd, 2.8);
keyLight.position.set(5, 7, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
fillLight.position.set(-4, 5, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(PALETTE.violet, 0.6);
rimLight.position.set(-3, 2, -5);
scene.add(rimLight);

const accentLight = new THREE.DirectionalLight(PALETTE.amber, 0.25);
accentLight.position.set(0, -1, 3);
scene.add(accentLight);

// ── Character Group ──
const char = new THREE.Group();

// Custom shader material for skin with subtle fresnel
const skinMat = new THREE.MeshStandardMaterial({
  color: PALETTE.skin,
  roughness: 0.38,
  metalness: 0.0,
  clearcoat: 0.1,
  clearcoatRoughness: 0.2,
  envMapIntensity: 0.4
});

// Hair material with subtle sheen
const hairMat = new THREE.MeshStandardMaterial({
  color: PALETTE.hair,
  roughness: 0.75,
  metalness: 0.15,
  emissive: 0x000000,
  emissiveIntensity: 0.0
});

// Eye material with refraction-like highlight
const eyeMat = new THREE.MeshStandardMaterial({
  color: PALETTE.eyeWhite,
  roughness: 0.1,
  metalness: 0.0
});

// Iris material with glow
const irisMat = new THREE.MeshStandardMaterial({
  color: PALETTE.iris,
  emissive: PALETTE.iris,
  emissiveIntensity: 0.15,
  roughness: 0.12,
  metalness: 0.05
});

// ── Pedestal (crystalline platform) ──
const pedMat = new THREE.MeshStandardMaterial({
  color: PALETTE.panel,
  roughness: 0.25,
  metalness: 0.35,
  transparent: true,
  opacity: 0.7
});
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.78, 0.92, 0.08, 64),
  pedMat
);
pedestal.position.y = -0.04;
pedestal.receiveShadow = true;
pedestal.castShadow = true;
char.add(pedestal);

// Glow orbs around pedestal
const glowMat = new THREE.MeshBasicMaterial({
  color: PALETTE.gold,
  transparent: true,
  opacity: 0.25,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const glowOrb1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), glowMat.clone());
glowOrb1.position.set(0.22, 0.08, 0.18);
const glowOrb2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), glowMat.clone());
glowOrb2.material.color.setHex(PALETTE.violet);
glowOrb2.material.emissive.setHex(PALETTE.violet);
glowOrb2.material.emissiveIntensity = 0.3;
glowOrb2.position.set(-0.18, 0.05, -0.22);
char.add(glowOrb1, glowOrb2);

// ── Body (anime proportions) ──
const bodyMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a2e,
  roughness: 0.82,
  metalness: 0.04
});
const body = new THREE.Mesh(
  new THREE.CylinderGeometry(0.38, 0.52, 0.68, 24),
  bodyMat
);
body.position.y = 0.36;
body.castShadow = true;
char.add(body);

// Skirt with layered volume
const skirtMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a2e,
  roughness: 0.88,
  metalness: 0.02,
  transparent: true,
  opacity: 0.92
});
const skirt = new THREE.Mesh(
  new THREE.ConeGeometry(0.55, 0.42, 32, 1, true),
  skirtMat
);
skirt.position.y = 0.18;
skirt.rotation.x = Math.PI;
char.add(skirt);

// Neck and collar
const neckMat = pbrMat(PALETTE.skin, { roughness: 0.5 });
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.08, 12), neckMat);
neck.position.y = 0.82;
char.add(neck);

const collarMat = pbrMat(PALETTE.dressAccent, { emissive: PALETTE.dressAccent, emissiveIntensity: 0.08, roughness: 0.25 });
const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 10, 20), collarMat);
collar.position.y = 0.78;
collar.rotation.x = Math.PI / 2 * 0.82;
char.add(collar);

// ── Head ──
const headMat = new THREE.MeshStandardMaterial({
  color: PALETTE.skin,
  roughness: 0.35,
  metalness: 0.0,
  clearcoat: 0.05
});
const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), headMat);
head.position.y = 1.02;
head.castShadow = true;
char.add(head);

// ── Anime Eyes (large, expressive) ──
function buildEye(x, isLeft) {
  const g = new THREE.Group();
  const eyeDist = 0.12;
  
  // Eye socket
  const socket = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.8 })
  );
  socket.position.set(x, 1.14, -0.28);
  g.add(socket);
  
  // White of eye
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 20), eyeMat);
  white.position.set(x, 1.14, -0.255);
  g.add(white);
  
  // Iris (large)
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), irisMat);
  iris.position.set(x, 1.14, -0.23);
  g.add(iris);
  
  // Iris inner (gradient)
  const irisInner = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 16), 
    new THREE.MeshStandardMaterial({
      color: PALETTE.irisInner,
      emissive: PALETTE.irisInner,
      emissiveIntensity: 0.2,
      roughness: 0.08
    })
  );
  irisInner.position.set(x, 1.14, -0.21);
  g.add(irisInner);
  
  // Pupil
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), 
    new THREE.MeshStandardMaterial({ color: PALETTE.pupil, roughness: 0.08 })
  );
  pupil.position.set(x, 1.14, -0.195);
  g.add(pupil);
  
  // Upper eyelid
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.055, 0.018, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.5 })
  );
  lid.position.set(x, 1.18, -0.23);
  lid.rotation.x = 0.3;
  g.add(lid);
  
  // Lower eyelid
  const lowerLid = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.008, 0.03),
    new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.5 })
  );
  lowerLid.position.set(x, 1.11, -0.22);
  g.add(lowerLid);
  
  // Catchlights (multiple for anime look)
  const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
  );
  hl1.position.set(x - 0.025, 1.145, -0.205);
  g.add(hl1);
  
  const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.006, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
  );
  hl2.position.set(x + 0.015, 1.155, -0.21);
  g.add(hl2);
  
  return { group: g, iris, pupil, hl1, hl2 };
}

const lEye = buildEye(-0.14, true);
const rEye = buildEye(0.14, false);
char.add(lEye.group, rEye.group);

// Eyebrows
const browMat = pbrMat(PALETTE.hair, { roughness: 0.7 });
const lBrow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.014, 0.014), browMat);
lBrow.position.set(-0.14, 1.21, -0.3);
lBrow.rotation.z = -0.03;
const rBrow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.014, 0.014), browMat);
rBrow.position.set(0.14, 1.21, -0.3);
rBrow.rotation.z = 0.03;
char.add(lBrow, rBrow);

// Blush
const blushMat = pbrMat(PALETTE.blush, { transparent: true, opacity: 0.28, roughness: 0.85 });
for (let side = -1; side <= 1; side += 2) {
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), blushMat);
  bl.position.set(side * 0.145, 0.995, -0.3);
  bl.scale.set(1.35, 0.55, 0.4);
  char.add(bl);
}

// Mouth
const mouthGroup = new THREE.Group();
mouthGroup.position.set(0, 0.96, -0.3);
const lipMat = pbrMat(PALETTE.lip, { roughness: 0.32 });
const lipUpper = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), lipMat);
lipUpper.scale.set(1.15, 0.22, 0.32);
lipUpper.position.y = 0.002;
mouthGroup.add(lipUpper);
const lipLower = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 10), lipMat);
lipLower.scale.set(0.95, 0.17, 0.28);
lipLower.position.y = -0.002;
mouthGroup.add(lipLower);
char.add(mouthGroup);

// ── Arms with sleeves ──
function makeArm(x, rot) {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.28, 12), skinMat);
  upper.position.y = 0.12;
  upper.castShadow = true;
  g.add(upper);
  
  // Sleeve puff
  const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), bodyMat);
  sleeve.position.set(0, 0.22, 0);
  sleeve.scale.set(1, 0.45, 1);
  g.add(sleeve);
  
  // Hand
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skinMat);
  hand.position.set(0, 0.28, 0);
  g.add(hand);
  
  g.position.set(x, 0.52, 0);
  g.rotation.z = rot;
  char.add(g);
  return g;
}
const lArm = makeArm(-0.48, 0.18);
const rArm = makeArm(0.48, -0.18);

scene.add(char);

// ── Expressions ──
const EXPR = {
  idle:     { s: 0.22, bL: -0.03, bR: 0.03, eO: 1,    hT: 0,   aS: 0.35, eI: 0.12, label: 'zoraasi' },
  happy:    { s: 0.65, bL: -0.08, bR: 0.08, eO: 1.12, hT: 0.02, aS: 0.65, eI: 0.28, label: 'zoraasi' },
  thinking: { s: 0.08, bL: 0.08,  bR: -0.06, eO: 0.58, hT: 0.05, aS: 0.12, eI: 0.18, label: '·' },
  sad:      { s: -0.12, bL: 0.06,  bR: 0.06, eO: 0.52, hT: -0.02, aS: 0.15, eI: 0.08, label: '·' },
  speaking: { s: 0.35, bL: 0,     bR: 0,     eO: 0.95, hT: 0.01, aS: 0.45, eI: 0.22, label: 'zoraasi' },
  listening:{ s: 0.18, bL: 0.02,  bR: 0.02,  eO: 0.88, hT: 0.01, aS: 0.28, eI: 0.15, label: 'zoraasi' },
  excited:  { s: 0.78, bL: -0.11, bR: 0.11, eO: 1.22, hT: 0.05, aS: 0.85, eI: 0.42, label: 'zoraasi' },
  error:    { s: -0.18, bL: 0.05,  bR: 0.05, eO: 0.48, hT: -0.02, aS: 0.12, eI: 0.08, label: '·' },
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
  chamber: { bg: [0x06070b, 0x0e0f17], fogD: 0.045, floorC: PALETTE.panel, amb: 0.55 },
  cafe:    { bg: [0x141010, 0x1a1410], fogD: 0.055, floorC: { r: 0.12, g: 0.08, b: 0.06 }, amb: 0.52 },
  garden:  { bg: [0x081410, 0x101a12], fogD: 0.05, floorC: { r: 0.06, g: 0.12, b: 0.08 }, amb: 0.5 },
  study:   { bg: [0x0a0810, 0x120e1a], fogD: 0.045, floorC: PALETTE.panel, amb: 0.53 },
  observatory: { bg: [0x04060e, 0x080a18], fogD: 0.032, floorC: 0x080a18, amb: 0.45 },
};
let curScene = 'chamber';
let sceneVFX = null;

function buildScene(name) {
  const cfg = sceneDefs[name];
  if (!cfg) return;
  const keep = new Set([char, keyLight, fillLight, rimLight, accentLight, ambient]);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const c = scene.children[i];
    if (!keep.has(c)) scene.remove(c);
  }
  if (sceneVFX) { scene.remove(sceneVFX); sceneVFX = null; }
  scene.background = new THREE.Color(cfg.bg[0]);
  scene.fog = new THREE.FogExp2(cfg.bg[0], cfg.fogD);
  ambient.intensity = cfg.amb;
  
  const flMat = new THREE.MeshStandardMaterial({ 
    color: cfg.floorC, 
    roughness: 0.92, 
    metalness: 0.03,
    transparent: true, 
    opacity: 0.48
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), flMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.08;
  floor.receiveShadow = true;
  scene.add(floor);
  
  const sceneFns = { chamber: chamberDecor, cafe: cafeDecor, garden: gardenDecor, study: studyDecor, observatory: observatoryDecor };
  (sceneFns[name] || chamberDecor)();
}

// Scene decorators
function chamberDecor() {
  const cnt = 45;
  const pos = new Float32Array(cnt * 3);
  const sizes = new Float32Array(cnt);
  for (let i = 0; i < cnt; i++) {
    pos[i*3] = (Math.random() - 0.5) * 4.5;
    pos[i*3+1] = Math.random() * 2.2;
    pos[i*3+2] = (Math.random() - 0.5) * 4;
    sizes[i] = 0.004 + Math.random() * 0.008;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.PointsMaterial({
    color: PALETTE.violet, size: 0.008, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  sceneVFX = new THREE.Points(geo, mat);
  scene.add(sceneVFX);
  
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const r = 1.6;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.panel, roughness: 0.78, metalness: 0.18, transparent: true, opacity: 0.4 }));
    p.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r);
    scene.add(p);
  }
}

function cafeDecor() {
  const cnt = 35;
  const pos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    pos[i*3] = (Math.random() - 0.5) * 3.5;
    pos[i*3+1] = Math.random() * 1.8;
    pos[i*3+2] = (Math.random() - 0.5) * 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: PALETTE.amber, size: 0.006, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  sceneVFX = new THREE.Points(geo, mat);
  scene.add(sceneVFX);
  
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 0.6 }));
  lamp.position.set(1.1, 0.32, 0.7);
  scene.add(lamp);
  
  const tMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.91 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.025, 12), tMat);
  top.position.set(0.75, 0.07, 0.45); top.castShadow = true; scene.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), tMat);
  leg.position.set(0.75, 0.005, 0.45); scene.add(leg);
}

function gardenDecor() {
  const cnt = 55;
  const pos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    pos[i*3] = (Math.random() - 0.5) * 4;
    pos[i*3+1] = Math.random() * 1.5;
    pos[i*3+2] = (Math.random() - 0.5) * 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: PALETTE.teal, size: 0.005, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  sceneVFX = new THREE.Points(geo, mat);
  scene.add(sceneVFX);
  
  function tree(x, z, s = 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.022*s, 0.032*s, 0.22*s, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10 }));
    trunk.position.set(x, 0.07*s, z); scene.add(trunk);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.88 }));
    leaf.position.set(x, 0.18*s, z); scene.add(leaf);
  }
  tree(1.0, 0.6, 1.1); tree(-0.85, -0.45, 1); tree(0.45, -0.85, 0.85);
  
  const colors = [PALETTE.amber, PALETTE.violet, PALETTE.rose, PALETTE.teal];
  for (let i = 0; i < 14; i++) {
    const x = (Math.random() - 0.5) * 3.5;
    const z = (Math.random() - 0.5) * 3.5;
    if (Math.hypot(x, z) < 0.4) continue;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4),
      new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * 4)] }));
    f.position.set(x, 0.008, z); scene.add(f);
  }
  
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 4; i++) {
    const x = (Math.random() - 0.5) * 2.8;
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.004, 0.12 + Math.random()*0.12, 4), vineMat);
    v.position.set(x, 0.16, -1.1); scene.add(v);
  }
}

function studyDecor() {
  const cnt = 25;
  const pos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    pos[i*3] = (Math.random() - 0.5) * 3;
    pos[i*3+1] = Math.random() * 1.2;
    pos[i*3+2] = (Math.random() - 0.5) * 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: PALETTE.gold, size: 0.004, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  sceneVFX = new THREE.Points(geo, mat);
  scene.add(sceneVFX);
  
  function shelf(x, z) {
    const sMat = new THREE.MeshStandardMaterial({ color: 0x1a1228, roughness: 0.92 });
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.05), sMat);
    s.position.set(x, 0.15, z); scene.add(s);
    const bColors = [PALETTE.amber, PALETTE.violet, PALETTE.rose, PALETTE.teal, 0x3a2a5a, 0x5a3a2a];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.018),
        new THREE.MeshStandardMaterial({ color: bColors[i % bColors.length] }));
      b.position.set(x - 0.075 + i * 0.035, 0.16, z - 0.035); scene.add(b);
    }
  }
  shelf(1.0, 0.55); shelf(-0.85, -0.35);
  
  const dl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 0.25 }));
  dl.position.set(0.45, 0.085, -0.25); scene.add(dl);
}

function observatoryDecor() {
  const starCnt = 400;
  const pos = new Float32Array(starCnt * 3);
  for (let i = 0; i < starCnt * 3; i++) pos[i] = (Math.random() - 0.5) * 18;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.006, transparent: true, opacity: 0.45 });
  const stars = new THREE.Points(geo, mat);
  stars.position.y = 1.8; scene.add(stars);
  
  const sp = sparkleParticles(60, 0xffffff, 0.012, 5);
  sceneVFX = sp.group;
  scene.add(sceneVFX);
  sp.update = () => {
    const pos = sp.group.geometry.attributes.position.array;
    for (let i = 0; i < sp.vel.length; i++) {
      pos[i*3] += sp.vel[i].x;
      pos[i*3+1] -= sp.vel[i].y;
      pos[i*3+2] += sp.vel[i].z;
      if (pos[i*3+1] < -0.5) { pos[i*3+1] = 2; pos[i*3] = (Math.random() - 0.5) * 5; pos[i*3+2] = (Math.random() - 0.5) * 5; }
    }
    sp.group.geometry.attributes.position.needsUpdate = true;
  };
  
  function constel(pts, col = PALETTE.amber) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false }));
    l.position.y = 0.95; scene.add(l);
  }
  constel([[-0.5,0.5,-1], [0,0.8,-1.2], [0.5,0.5,-1], [0.8,0.2,-0.8]]);
  constel([[-0.3,-0.2,-1.5], [0.2,0,-1.3], [0.5,-0.3,-1.4], [0.1,-0.5,-1.6]], PALETTE.violet);
  
  const orbMat = new THREE.MeshBasicMaterial({ color: PALETTE.violet, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false });
  const orb = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.58, 64), orbMat);
  orb.position.y = 0.45; scene.add(orb);
}

function sparkleParticles(count, color, size, spread) {
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i*3] = (Math.random() - 0.5) * spread;
    pos[i*3+1] = Math.random() * 1.8;
    pos[i*3+2] = (Math.random() - 0.5) * spread;
    vel.push({ x: (Math.random() - 0.5) * 0.003, y: 0.003 + Math.random() * 0.004, z: (Math.random() - 0.5) * 0.003 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.userData.update = () => {
    const pos = pts.geometry.attributes.position.array;
    for (let i = 0; i < vel.length; i++) {
      pos[i*3] += vel[i].x; pos[i*3+1] += vel[i].y; pos[i*3+2] += vel[i].z;
      if (pos[i*3+1] > 2.2) pos[i*3+1] = 0;
      if (Math.abs(pos[i*3]) > spread * 0.45) vel[i].x *= -1;
      if (Math.abs(pos[i*3+2]) > spread * 0.45) vel[i].z *= -1;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  };
  return { group: pts, vel, spread, update: null };
}

buildScene('chamber');

// ── Animation Loop ──
const clock = new THREE.Clock();
let time = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  
  if (sceneVFX?.userData?.update) sceneVFX.userData.update();
  
  exprT = Math.min(1, exprT + dt * 2.2);
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
  
  const sm = 1 + s * 0.35;
  lipUpper.scale.x = 1.15 * (0.5 + 0.5 * sm);
  lipUpper.scale.y = 0.22 * (s > 0 ? 1 + s * 0.45 : Math.max(0.2, 1 + s * 0.7));
  lipLower.scale.x = 0.95 * (0.5 + 0.5 * sm);
  mouthGroup.position.y = 0.96 - s * 0.006;
  
  lBrow.rotation.z = bL;
  rBrow.rotation.z = bR;
  
  const blink = Math.max(0.15, 1 - (Math.sin(time * 2.8) > 0.93 ? (Math.sin(time * 2.8) - 0.93) * 15 : 0));
  const eyeScale = blink * eO;
  lEye.group.scale.y = eyeScale;
  rEye.group.scale.y = eyeScale;
  
  char.rotation.z = hT;
  
  const breathe = Math.sin(time * 1.2) * 0.0025 * (0.5 + aS * 0.5);
  body.position.y = 0.36 + breathe;
  head.position.y = 1.02 + breathe;
  neck.position.y = 0.82 + breathe;
  
  const armSway = Math.sin(time * 0.8) * 0.02 * aS;
  lArm.rotation.z = 0.18 + armSway;
  rArm.rotation.z = -0.18 - armSway;
  
  glowOrb1.position.y = 0.08 + Math.sin(time * 1.4) * 0.03;
  glowOrb1.position.x = 0.22 + Math.sin(time * 1.1) * 0.015;
  glowOrb2.position.y = 0.05 + Math.sin(time * 1.6 + 0.5) * 0.02;
  glowOrb2.position.x = -0.18 + Math.sin(time * 1.3 + 0.5) * 0.012;
  
  const glowInt = 0.12 + eI + Math.sin(time * 0.4) * 0.05;
  bloom.strength = 0.15 + eI * 0.12;
  
  pedestal.rotation.y = time * 0.03;
  glowOrb1.rotation.y = time * 0.08;
  glowOrb2.rotation.y = time * 0.06;
  
  const cTheta = Math.sin(time * 0.022) * 0.15;
  camera.position.x = Math.sin(cTheta) * 5.9;
  camera.position.z = Math.cos(cTheta) * 5.9;
  camera.position.y = 2.35 + Math.sin(time * 0.012) * 0.06;
  camera.lookAt(0, 1.1, 0);
  
  composer.render();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

/* ── UI Integration ── */

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

document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 0.03;
  const y = (e.clientY / window.innerHeight - 0.5) * 0.012;
  rEye.group.position.x = 0.14 + x * 0.6;
  rEye.group.position.y = 1.14 + y * 0.3;
  lEye.group.position.x = -0.14 + x * 0.6;
  lEye.group.position.y = 1.14 + y * 0.3;
  
  if (curExpr === 'idle' || curExpr === 'listening') {
    head.rotation.y = x * 0.12;
    head.rotation.x = -y * 0.08;
  }
});

setTimeout(() => { exprLabel.style.transition = 'opacity 2s'; }, 5000);