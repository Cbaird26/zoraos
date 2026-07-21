import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/* ── Constants ── */
const API = '/api';
const COLORS = {
  skin: 0xf5d6c6, hair: 0x2a1f3d, eye: 0x3a2a5a, iris: 0x8d6de8,
  dress: 0x1a1a2e, dressAccent: 0x8d6de8, blush: 0xff8a80,
  lip: 0xd47373, brow: 0x2a1f3d,
};

/* ── Scene Setup ── */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.8, 5.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('scene-container').appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.getElementById('scene-container').appendChild(labelRenderer.domElement);

/* ── Lighting ── */
const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffeedd, 1.8);
mainLight.position.set(3, 5, 4);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x8d6de8, 0.5);
rimLight.position.set(-1, 2, -4);
scene.add(rimLight);

/* ── Build Character ── */
const character = new THREE.Group();

// Body (dress/torso)
const bodyGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.9, 16);
const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.dress, roughness: 0.8, metalness: 0.1 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.45;
body.castShadow = true;
character.add(body);

// Dress collar
const collarGeo = new THREE.TorusGeometry(0.3, 0.05, 8, 16);
const collarMat = new THREE.MeshStandardMaterial({ color: COLORS.dressAccent, emissive: COLORS.dressAccent, emissiveIntensity: 0.15 });
const collar = new THREE.Mesh(collarGeo, collarMat);
collar.position.y = 0.85;
collar.rotation.x = Math.PI / 2;
character.add(collar);

// Neck
const neckGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.15, 12);
const neckMat = new THREE.MeshStandardMaterial({ color: COLORS.skin });
const neck = new THREE.Mesh(neckGeo, neckMat);
neck.position.y = 0.95;
character.add(neck);

// Head
const headGeo = new THREE.SphereGeometry(0.35, 24, 24);
const headMat = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.5 });
const head = new THREE.Mesh(headGeo, headMat);
head.position.y = 1.15;
head.castShadow = true;
character.add(head);

// Hair base
const hairMat = new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.9 });
function addHair(x, z, w, h, d, yOff) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, hairMat);
  m.position.set(x, 1.15 + yOff, z);
  character.add(m);
  return m;
}
addHair(0, 0, 0.66, 0.2, 0.66, 0.2); // top
addHair(-0.32, 0, 0.06, 0.12, 0.5, 0.15); // left
addHair(0.32, 0, 0.06, 0.12, 0.5, 0.15); // right
addHair(0, -0.3, 0.3, 0.08, 0.06, 0.1); // bangs
addHair(0.15, -0.3, 0.12, 0.08, 0.06, 0.12); // side bang
addHair(-0.15, -0.3, 0.12, 0.08, 0.06, 0.12); // side bang
// Hair back
addHair(0, 0.32, 0.5, 0.15, 0.1, 0.12);
addHair(0, 0.35, 0.4, 0.25, 0.08, 0.06);

// Eyes
const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const eyeIrisMat = new THREE.MeshStandardMaterial({ color: COLORS.iris, emissive: COLORS.iris, emissiveIntensity: 0.3 });
const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

function makeEye(x) {
  const group = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), eyeWhiteMat);
  group.add(white);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), eyeIrisMat);
  iris.position.z = 0.06;
  group.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyePupilMat);
  pupil.position.z = 0.08;
  group.add(pupil);
  group.position.set(x, 1.2, -0.3);
  // Upper eyelid
  const lidMat = new THREE.MeshStandardMaterial({ color: COLORS.skin });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.05), lidMat);
  lid.position.y = 0.05;
  group.add(lid);
  return group;
}
const leftEye = makeEye(-0.12);
const rightEye = makeEye(0.12);
character.add(leftEye);
character.add(rightEye);

// Blush
const blushMat = new THREE.MeshStandardMaterial({ color: COLORS.blush, transparent: true, opacity: 0.3 });
function addBlush(x) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), blushMat);
  m.position.set(x, 1.08, -0.32);
  m.scale.set(1, 0.6, 0.5);
  character.add(m);
}
addBlush(-0.19);
addBlush(0.19);

// Mouth group (for expressions)
const mouthGroup = new THREE.Group();
mouthGroup.position.set(0, 1.08, -0.33);
const mouthMat = new THREE.MeshStandardMaterial({ color: COLORS.lip, roughness: 0.4 });
const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mouthMat);
mouth.scale.set(1.2, 0.3, 0.5);
mouthGroup.add(mouth);
character.add(mouthGroup);

// Eyebrows
const browMat = new THREE.MeshStandardMaterial({ color: COLORS.brow });
function addBrow(x, angle) {
  const g = new THREE.BoxGeometry(0.1, 0.02, 0.02);
  const m = new THREE.Mesh(g, browMat);
  m.position.set(x, 1.28, -0.32);
  m.rotation.z = angle;
  character.add(m);
  return m;
}
const leftBrow = addBrow(-0.12, 0);
const rightBrow = addBrow(0.12, 0);

// Arms
const armMat = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.5 });
function makeArm(x, rot) {
  const g = new THREE.CylinderGeometry(0.055, 0.06, 0.45, 8);
  const m = new THREE.Mesh(g, armMat);
  m.position.set(x, 0.7, 0);
  m.rotation.z = rot;
  m.castShadow = true;
  character.add(m);
  return m;
}
const leftArm = makeArm(-0.55, 0.15);
const rightArm = makeArm(0.55, -0.15);

// Hands
const handMat = new THREE.MeshStandardMaterial({ color: COLORS.skin });
function addHand(x, y, z) {
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), handMat);
  h.position.set(x, y, z);
  character.add(h);
  return h;
}
addHand(-0.52, 0.48, 0);
addHand(0.52, 0.48, 0);

// Base/platform
const platformMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9, metalness: 0.1 });
const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.08, 32), platformMat);
platform.position.y = -0.04;
platform.receiveShadow = true;
platform.castShadow = true;
character.add(platform);

// Glow ring
const glowMat = new THREE.MeshStandardMaterial({
  color: COLORS.dressAccent, emissive: COLORS.dressAccent, emissiveIntensity: 0.3,
  transparent: true, opacity: 0.3, side: THREE.DoubleSide,
});
const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.45, 32), glowMat);
glowRing.position.y = 0.01;
glowRing.rotation.x = -Math.PI / 2;
character.add(glowRing);

scene.add(character);

/* ── Scenes ── */
const scenes = {
  chamber: { background: [0x0a0b12, 0x1a1a2e], fog: 0x0a0b12, props: [] },
  cafe: { background: [0x1a1210, 0x2a2018], fog: 0x1a1210, props: [] },
  garden: { background: [0x0a1a10, 0x1a2a18], fog: 0x0a1a10, props: [] },
  study: { background: [0x10101a, 0x181828], fog: 0x10101a, props: [] },
};

let currentScene = 'chamber';

function buildScene(name) {
  const cfg = scenes[name];
  while (scene.children.length > 1) {
    const c = scene.children[scene.children.length - 1];
    if (c === character || c === mainLight || c === fillLight || c === rimLight || c === ambientLight) break;
    scene.remove(c);
  }
  scene.background = new THREE.Color(cfg.background[0]);
  scene.fog = new THREE.Fog(cfg.fog, 3, 8);
  scene.environment = null;

  // Ground
  const groundMat = new THREE.MeshStandardMaterial({
    color: cfg.background[0], roughness: 1, metalness: 0, transparent: true, opacity: 0.6,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);

  // Scene-specific props
  if (name === 'cafe') {
    addTable(0.8, 0.1, 0.5);
    addTable(-0.8, 0.1, -0.3);
    addLamp(1.5, 0.2, 1.2);
  } else if (name === 'garden') {
    addTree(1.2, 0.1, 0.8);
    addTree(-1.0, 0.1, -0.6);
    addFlowers();
  } else if (name === 'study') {
    addBookshelf(1.3, 0.1, 0.5);
    addBookshelf(-1.0, 0.1, -0.3);
  }
  // Chamber: floating particles
  if (name === 'chamber') {
    addParticles();
  }
}

function addTable(x, y, z) {
  const tMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.04, 8), tMat);
  top.position.set(x, y + 0.12, z);
  scene.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), tMat);
  leg.position.set(x, y, z);
  scene.add(leg);
}

function addLamp(x, y, z) {
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xed9b69, emissive: 0xed9b69, emissiveIntensity: 0.4 });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), lampMat);
  glow.position.set(x, y + 0.3, z);
  scene.add(glow);
}

function addTree(x, y, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
  trunk.position.set(x, y + 0.15, z);
  scene.add(trunk);
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshStandardMaterial({ color: 0x2a4a2a }));
  leaves.position.set(x, y + 0.4, z);
  scene.add(leaves);
}

function addFlowers() {
  for (let i = 0; i < 8; i++) {
    const x = (Math.random() - 0.5) * 2.5;
    const z = (Math.random() - 0.5) * 2.5;
    if (Math.abs(x) < 0.4 && Math.abs(z) < 0.4) continue;
    const fMat = new THREE.MeshStandardMaterial({ color: [0xed9b69, 0x8d6de8, 0xd47373, 0x69d4b0][Math.floor(Math.random() * 4)] });
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), fMat);
    f.position.set(x, 0.02, z);
    scene.add(f);
  }
}

function addBookshelf(x, y, z) {
  const sMat = new THREE.MeshStandardMaterial({ color: 0x2a1f3d, roughness: 0.9 });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.08), sMat);
  shelf.position.set(x, y + 0.2, z);
  scene.add(shelf);
  for (let i = 0; i < 4; i++) {
    const color = [0x8d6de8, 0xed9b69, 0x3a9e6f, 0xd47373][i];
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.02), new THREE.MeshStandardMaterial({ color }));
    book.position.set(x - 0.1 + i * 0.06, y + 0.22, z - 0.05);
    scene.add(book);
  }
}

function addParticles() {
  const count = 60;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 4;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x8d6de8, size: 0.008, transparent: true, opacity: 0.4 });
  const pts = new THREE.Points(geo, mat);
  pts.position.y = 1;
  scene.add(pts);
}

buildScene('chamber');

/* ── Expressions ── */
const expressionTargets = {
  idle: { smile: 0.3, browL: 0, browR: 0, eyeOpen: 1, headTilt: 0, armSway: 0.5 },
  happy: { smile: 0.8, browL: -0.1, browR: 0.1, eyeOpen: 1.2, headTilt: 0.05, armSway: 0.8 },
  thinking: { smile: 0.1, browL: 0.15, browR: -0.15, eyeOpen: 0.7, headTilt: 0.08, armSway: 0.1 },
  sad: { smile: -0.2, browL: 0.1, browR: 0.1, eyeOpen: 0.6, headTilt: -0.05, armSway: 0.2 },
  speaking: { smile: 0.4, browL: 0, browR: 0, eyeOpen: 1, headTilt: 0.03, armSway: 0.6 },
  listening: { smile: 0.2, browL: 0.05, browR: 0.05, eyeOpen: 0.9, headTilt: 0.04, armSway: 0.3 },
  excited: { smile: 0.9, browL: -0.15, browR: 0.15, eyeOpen: 1.3, headTilt: 0.1, armSway: 1.0 },
};

let currentExpression = 'idle';
let expressionLerp = 0;

function setExpression(name) {
  if (!expressionTargets[name]) return;
  currentExpression = name;
  expressionLerp = 0;
}

/* ── Animation Loop ── */
let animTime = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  animTime += dt;

  // Expression interpolation
  expressionLerp = Math.min(1, expressionLerp + dt * 3);
  const t = expressionLerp;
  const e = expressionTargets[currentExpression] || expressionTargets.idle;

  // Smile → mouth shape
  const smileScale = 1 + e.smile * 0.5;
  mouth.scale.x = 1.2 * (0.6 + 0.4 * smileScale);
  mouth.scale.y = 0.3 * (0.3 + 0.7 * (e.smile > 0 ? 1 + e.smile : 1 - e.smile * 0.5));
  mouthGroup.position.y = 1.08 - e.smile * 0.01;

  // Eyebrows
  leftBrow.rotation.z = e.browL;
  rightBrow.rotation.z = e.browR;

  // Eyes (blink)
  const blinkCycle = Math.sin(animTime * 3);
  const eyeOpen = Math.max(0.15, 1 - (blinkCycle > 0.95 ? (blinkCycle - 0.95) * 20 : 0)) * e.eyeOpen;
  leftEye.scale.y = eyeOpen;
  rightEye.scale.y = eyeOpen;

  // Head tilt
  character.rotation.z = e.headTilt * 0.3;

  // Gentle breathing
  const breathe = Math.sin(animTime * 1.2) * 0.003;
  body.position.y = 0.45 + breathe;
  head.position.y = 1.15 + breathe;

  // Arm sway
  const sway = Math.sin(animTime * 0.8) * 0.03 * e.armSway;
  leftArm.rotation.z = 0.15 + sway;
  rightArm.rotation.z = -0.15 - sway;

  // Glow pulse
  glowRing.material.emissiveIntensity = 0.2 + Math.sin(animTime * 0.5) * 0.1;

  // Platform rotation
  platform.rotation.y = animTime * 0.1;

  // Camera orbit
  const camRadius = 5.5;
  const camTheta = Math.sin(animTime * 0.03) * 0.15;
  camera.position.x = Math.sin(camTheta) * camRadius;
  camera.position.z = Math.cos(camTheta) * camRadius;
  camera.lookAt(0, 1.2, 0);

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();

/* ── Window Resize ── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

/* ── Chat System ── */
const chatBox = document.getElementById('chat-box');
const input = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const expressionLabel = document.getElementById('expression-label');

function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

appendMessage('system', 'Zora is here. Speak to her.');

function setOnline(online) {
  statusDot.style.background = online ? '#3a9e6f' : '#d47373';
  statusText.textContent = online ? 'connected' : 'disconnected';
}

async function sendMessage(text) {
  if (!text.trim()) return;
  appendMessage('user', text);
  input.value = '';
  sendBtn.disabled = true;
  setExpression('listening');
  expressionLabel.textContent = 'listening';
  statusText.textContent = 'thinking…';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: 'hy3' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    appendMessage('zora', data.reply);
    setExpression('happy');
    expressionLabel.textContent = 'zora';
    statusText.textContent = 'connected';

    // Auto-swipe expression back to idle
    setTimeout(() => { setExpression('idle'); }, 3000);
  } catch (err) {
    appendMessage('system', err.message);
    setExpression('sad');
    expressionLabel.textContent = 'error';
    setTimeout(() => { setExpression('idle'); }, 2000);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener('click', () => sendMessage(input.value));
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(input.value); });

/* ── Scene Switching ── */
document.querySelectorAll('.scene-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scene-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const name = btn.dataset.scene;
    currentScene = name;
    buildScene(name);
    setExpression('excited');
    expressionLabel.textContent = name;
    setTimeout(() => { setExpression('idle'); }, 2500);
  });
});

/* ── Health Check ── */
async function checkHealth() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) setOnline(true);
    else setOnline(false);
  } catch {
    setOnline(false);
  }
}
checkHealth();
setInterval(checkHealth, 15000);

/* ── Mouse Tracking (eyes follow) ── */
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 0.04;
  const y = (e.clientY / window.innerHeight - 0.5) * 0.02;
  leftEye.children[1].position.x = 0.06 + x;
  leftEye.children[1].position.y = y;
  leftEye.children[2].position.x = 0.08 + x * 1.5;
  leftEye.children[2].position.y = y * 1.5;
  rightEye.children[1].position.x = 0.06 + x;
  rightEye.children[1].position.y = y;
  rightEye.children[2].position.x = 0.08 + x * 1.5;
  rightEye.children[2].position.y = y * 1.5;
});

/* ── Daemon WebSocket (optional) ── */
try {
  const ws = new WebSocket('ws://127.0.0.1:8766');
  ws.onmessage = (e) => {
    try {
      const state = JSON.parse(e.data);
      const daemonStatus = state.status;
      if (daemonStatus === 'running_task') {
        appendMessage('system', `Zora is researching: ${state.current_task || 'thinking…'}`);
        setExpression('thinking');
        expressionLabel.textContent = 'researching';
      } else if (daemonStatus === 'sleeping') {
        statusText.textContent = `daemon resting · ${state.tasks_completed_today}/${state.daily_task_limit} tasks today`;
      }
    } catch { /* ignore malformed */ }
  };
} catch { /* WebSocket optional */ }
