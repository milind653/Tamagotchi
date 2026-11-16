import * as THREE from '/vendor/three/three.module.js';

export const MODEL_SPECIES = new Set(['panda', 'kitsune', 'penguin', 'hamster', 'axolotl']);

let webglOk = null;
export function webglSupported() {
  if (webglOk === null) {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      webglOk = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webglOk = false;
    }
  }
  return webglOk;
}

const WHITE = new THREE.Color('#ffffff');
const INK = '#2a1d33';
const STAGE_SCALE = { baby: 0.66, child: 0.8, teen: 0.92, adult: 1 };
const STAGE_EYES = { baby: 1.22, child: 1.12, teen: 1.05, adult: 1 };

const EGG_COLORS = {
  panda: ['#f7f7f7', '#3a3342', '#b9b2c4'],
  kitsune: ['#ffc58f', '#ff8a3d', '#fff2e0'],
  penguin: ['#cfe3ff', '#5a6a96', '#ffffff'],
  hamster: ['#ffe2b8', '#e9a766', '#ffb3c1'],
  axolotl: ['#ffd3e2', '#ff7fa8', '#fff0f6'],
};

function plush(color, opts = {}) {
  const c = new THREE.Color(color);
  const m = new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.78,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: c.clone().lerp(WHITE, 0.65),
    ...opts,
  });
  m.userData.base = c.clone();
  return m;
}
const flat = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...opts });

function ell(rx, ry, rz, material, segs = 40) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, segs, Math.round(segs * 0.7)), material);
  m.scale.set(rx, ry, rz);
  return m;
}
function at(obj, x, y, z, parent) {
  obj.position.set(x, y, z);
  parent?.add(obj);
  return obj;
}

// Point on the head ellipsoid plus its outward normal, so face parts can sit flush on the surface.
function onSurface(obj, spec, x, y, lift = 0.012) {
  const { rx, ry, rz } = spec;
  const k = 1 - (x / rx) ** 2 - (y / ry) ** 2;
  const z = rz * Math.sqrt(Math.max(0.02, k));
  const n = new THREE.Vector3(x / rx ** 2, y / ry ** 2, z / rz ** 2).normalize();
  obj.position.set(x, y, z).addScaledVector(n, lift);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return obj;
}

function tube(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8), material);
  return m;
}

function heartTexture(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(60,30,70,.38)');
  grad.addColorStop(1, 'rgba(60,30,70,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- face

function buildFace(head, spec) {
  const face = new THREE.Group();
  head.add(face);
  const ink = new THREE.MeshPhysicalMaterial({ color: INK, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  const lineMat = flat(INK);
  const blushMat = flat('#ff7fa6', { transparent: true, opacity: 0.55, depthWrite: false });
  const parts = { eyes: [], brows: [], tears: [], blush: [], mouths: {} };

  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    onSurface(eye, spec, s * spec.eyeX, spec.eyeY);
    face.add(eye);
    const r = spec.eyeR;

    const open = new THREE.Group();
    open.add(ell(r, r * 1.14, r * 0.4, ink, 28));
    at(ell(r * 0.34, r * 0.34, r * 0.1, flat('#ffffff'), 16), -r * 0.3, r * 0.42, r * 0.38, open);
    at(ell(r * 0.17, r * 0.17, r * 0.1, flat('#ffffff'), 12), r * 0.32, -r * 0.34, r * 0.38, open);
    at(ell(r * 0.09, r * 0.09, r * 0.1, flat('#ffffff'), 10), r * 0.5, r * 0.1, r * 0.38, open);
    const wet = ell(r * 0.62, r * 0.26, r * 0.1, flat('#a8e2ff', { transparent: true, opacity: 0.75 }), 16);
    wet.position.set(0, -r * 0.58, r * 0.4);
    wet.visible = false;
    open.add(wet);
    eye.add(open);

    const happy = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.14, 8, 24, Math.PI), lineMat);
    happy.position.y = -r * 0.25;
    eye.add(happy);
    const sleep = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.14, 8, 24, Math.PI), lineMat);
    sleep.rotation.z = Math.PI;
    sleep.position.y = r * 0.25;
    eye.add(sleep);
    const x = new THREE.Group();
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 1.7, r * 0.3, r * 0.2), lineMat);
      bar.rotation.z = a;
      x.add(bar);
    }
    eye.add(x);

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.1, r * 0.9, 4, 8), lineMat);
    brow.rotation.z = Math.PI / 2;
    const browHolder = new THREE.Group();
    browHolder.add(brow);
    onSurface(browHolder, spec, s * spec.eyeX, spec.eyeY + r * (spec.browK ?? 1.65), 0.015);
    face.add(browHolder);

    const tear = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.3, 14, 12),
      new THREE.MeshPhysicalMaterial({ color: '#8fd8ff', emissive: '#4aa8e8', emissiveIntensity: 0.35, transparent: true, opacity: 0.95, roughness: 0.05, clearcoat: 1 }),
    );
    tear.scale.y = 1.5;
    tear.position.set(s * r * 0.55, -r * 1.5, r * 0.45);
    eye.add(tear);

    const blush = new THREE.Mesh(new THREE.CircleGeometry(spec.blushR, 24), blushMat);
    onSurface(blush, spec, s * spec.blushX, spec.blushY, 0.006);
    blush.scale.y = 0.62;
    face.add(blush);

    parts.eyes.push({ eye, open, wet, happy, sleep, x, side: s });
    parts.brows.push({ holder: browHolder, brow, side: s, baseY: browHolder.position.y });
    parts.tears.push({ tear, r, side: s, phase: s > 0 ? 0.5 : 0.15 });
    parts.blush.push(blush);
  }

  const mouth = new THREE.Group();
  onSurface(mouth, spec, 0, spec.mouthY, 0.025);
  face.add(mouth);
  const w = spec.mouthW;
  const tr = spec.mouthW * 0.085;
  const smile = tube([[-w, 0.0], [-w * 0.5, -w * 0.38], [0, -w * 0.5], [w * 0.5, -w * 0.38], [w, 0.0]], tr, lineMat);
  const cat = new THREE.Group();
  cat.add(tube([[-w, 0.02], [-w * 0.55, -w * 0.4], [0, -0.02]], tr, lineMat));
  cat.add(tube([[0, -0.02], [w * 0.55, -w * 0.4], [w, 0.02]], tr, lineMat));
  const frown = tube([[-w * 0.8, -w * 0.35], [-w * 0.4, 0], [0, 0.03], [w * 0.4, 0], [w * 0.8, -w * 0.35]], tr, lineMat);
  const flatM = tube([[-w * 0.5, 0], [w * 0.5, 0]], tr, lineMat);
  const openM = new THREE.Group();
  const cavity = ell(w * 0.55, w * 0.7, w * 0.25, flat('#4a1f33'), 20);
  openM.add(cavity);
  at(ell(w * 0.34, w * 0.26, w * 0.18, flat('#ff7b9c'), 16), 0, -w * 0.32, w * 0.06, openM);
  const bigOpen = new THREE.Group();
  const dMat = new THREE.MeshBasicMaterial({ color: '#4a1f33', side: THREE.DoubleSide, toneMapped: false });
  const dGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const dMouth = new THREE.Mesh(dGeo, dMat);
  dMouth.scale.set(w * 0.8, w * 0.85, w * 0.25);
  dMouth.position.y = w * 0.15;
  bigOpen.add(dMouth);
  at(ell(w * 0.4, w * 0.24, w * 0.18, flat('#ff7b9c'), 16), 0, -w * 0.5, w * 0.06, bigOpen);
  for (const m of [smile, cat, frown, flatM, openM, bigOpen]) mouth.add(m);
  parts.mouths = { smile, cat, frown, flat: flatM, open: openM, bigOpen };
  parts.mouth = mouth;
  parts.face = face;
  return parts;
}

// ---------------------------------------------------------------- species

function panda() {
  const white = plush('#fbfbfb');
  const black = plush('#2f2836');
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  at(ell(0.64, 0.6, 0.58, white), 0, 0.6, 0, bodyG);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    at(ell(0.2, 0.34, 0.2, black), 0, -0.2, 0, arm);
    at(arm, s * 0.66, 0.78, 0.1, bodyG);
    arm.rotation.z = s * 0.3;
    arm.userData.side = s;
    root.userData.arms = [...(root.userData.arms ?? []), arm];
    at(ell(0.26, 0.2, 0.32, black), s * 0.34, 0.2, 0.16, bodyG);
  }
  at(ell(0.16, 0.16, 0.16, white), 0, 0.5, -0.56, bodyG);

  const spec = { rx: 0.84, ry: 0.74, rz: 0.76, eyeX: 0.34, eyeY: 0.02, eyeR: 0.125, mouthY: -0.34, mouthW: 0.1, blushX: 0.56, blushY: -0.22, blushR: 0.11, browK: 2.7 };
  const head = new THREE.Group();
  head.position.y = 1.3;
  root.add(head);
  head.add(ell(spec.rx, spec.ry, spec.rz, white));
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    at(ell(0.27, 0.27, 0.2, black), 0, 0, 0, ear);
    at(ear, s * 0.58, 0.58, -0.04, head);
    ear.userData = { side: s, base: s * 0.0 };
    ears.push(ear);
    const patch = ell(0.2, 0.27, 0.03, black, 24);
    onSurface(patch, spec, s * 0.35, 0.03, -0.015);
    patch.rotateZ(-s * 0.5);
    head.add(patch);
  }
  const face = buildFace(head, spec);
  const nose = ell(0.07, 0.05, 0.05, plush('#201a26'), 16);
  onSurface(nose, spec, 0, -0.17, 0.02);
  head.add(nose);
  return { root, head, ears, tail: null, arms: root.userData.arms, face, spec, headY: 1.3, bodyG };
}

function kitsune() {
  const orange = plush('#ff9a4d');
  const cream = plush('#fff3e3');
  const dark = plush('#5a3027');
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  at(ell(0.56, 0.56, 0.5, orange), 0, 0.58, 0, bodyG);
  at(ell(0.34, 0.4, 0.2, cream), 0, 0.55, 0.36, bodyG);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    at(ell(0.15, 0.3, 0.16, orange), 0, -0.18, 0, arm);
    at(ell(0.16, 0.12, 0.17, dark), 0, -0.4, 0.02, arm);
    at(arm, s * 0.58, 0.76, 0.12, bodyG);
    arm.rotation.z = s * 0.25;
    arms.push(arm);
    at(ell(0.2, 0.15, 0.3, dark), s * 0.3, 0.17, 0.16, bodyG);
  }
  const tail = new THREE.Group();
  at(ell(0.3, 0.34, 0.72, orange), 0, 0.2, -0.3, tail);
  at(ell(0.28, 0.3, 0.3, cream), 0, 0.22, -0.9, tail);
  at(tail, 0, 0.35, -0.5, root);
  tail.rotation.x = -0.55;

  const spec = { rx: 0.86, ry: 0.7, rz: 0.74, eyeX: 0.36, eyeY: 0.04, eyeR: 0.12, mouthY: -0.32, mouthW: 0.1, blushX: 0.58, blushY: -0.2, blushR: 0.1 };
  const head = new THREE.Group();
  head.position.y = 1.3;
  root.add(head);
  head.add(ell(spec.rx, spec.ry, spec.rz, orange));
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.72, 24), orange);
    outer.scale.z = 0.55;
    at(outer, 0, 0.3, 0, ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.5, 24), cream);
    inner.scale.z = 0.5;
    at(inner, 0, 0.22, 0.07, ear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 16), dark);
    tip.scale.z = 0.55;
    at(tip, 0, 0.58, 0, ear);
    at(ear, s * 0.52, 0.46, -0.04, head);
    ear.rotation.z = -s * 0.32;
    ear.userData = { side: s, base: -s * 0.32 };
    ears.push(ear);
    for (const k of [0, 1]) {
      const fluff = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 16), cream);
      fluff.position.set(s * (0.78 - k * 0.04), -0.2 - k * 0.12, 0.22);
      fluff.rotation.z = -s * (Math.PI / 2 + 0.2 - k * 0.15);
      fluff.rotation.y = s * 0.3;
      head.add(fluff);
    }
  }
  const muzzle = ell(0.27, 0.2, 0.05, cream, 24);
  onSurface(muzzle, spec, 0, -0.2, -0.035);
  head.add(muzzle);
  const face = buildFace(head, spec);
  const nose = ell(0.06, 0.045, 0.05, plush('#2a1d33'), 16);
  onSurface(nose, spec, 0, -0.13, 0.03);
  head.add(nose);
  return { root, head, ears, tail, arms, face, spec, headY: 1.3, bodyG };
}

function penguin() {
  const navy = plush('#3f4b73');
  const white = plush('#fdfdff');
  const orange = plush('#ffa53d');
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  at(ell(0.78, 0.9, 0.7, navy), 0, 0.9, 0, bodyG);
  at(ell(0.6, 0.76, 0.5, white), 0, 0.82, 0.2, bodyG);
  const arms = [];
  for (const s of [-1, 1]) {
    const fl = new THREE.Group();
    at(ell(0.13, 0.42, 0.22, navy), 0, -0.28, 0, fl);
    at(fl, s * 0.8, 1.05, 0, bodyG);
    fl.rotation.z = s * 0.38;
    arms.push(fl);
    at(ell(0.27, 0.07, 0.36, orange), s * 0.3, 0.05, 0.3, bodyG);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 16), navy);
  tail.rotation.x = -2.1;
  at(tail, 0, 0.25, -0.7, bodyG);

  const spec = { rx: 0.7, ry: 0.6, rz: 0.62, eyeX: 0.27, eyeY: 0.0, eyeR: 0.13, mouthY: -0.36, mouthW: 0.085, blushX: 0.46, blushY: -0.2, blushR: 0.09 };
  const head = new THREE.Group();
  head.position.y = 1.62;
  root.add(head);
  head.add(ell(spec.rx, spec.ry, spec.rz, navy));
  const mask = ell(0.58, 0.42, 0.04, white, 28);
  onSurface(mask, spec, 0, -0.1, -0.06);
  head.add(mask);
  const face = buildFace(head, spec);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 20), orange);
  beak.scale.set(1.2, 1, 0.7);
  onSurface(beak, spec, 0, -0.2, 0.06);
  beak.rotateX(Math.PI / 2);
  head.add(beak);
  return { root, head, ears: [], tail: null, arms, face, spec, headY: 1.62, bodyG };
}

function hamster() {
  const tan = plush('#f2b97a');
  const cream = plush('#fff4e4');
  const pink = plush('#ffb4c2');
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  at(ell(0.74, 0.58, 0.66, tan), 0, 0.55, 0, bodyG);
  at(ell(0.5, 0.42, 0.3, cream), 0, 0.5, 0.42, bodyG);
  for (const s of [-1, 1]) at(ell(0.2, 0.12, 0.26, pink), s * 0.34, 0.1, 0.22, bodyG);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    at(ell(0.12, 0.14, 0.12, tan), 0, 0, 0, arm);
    at(arm, s * 0.26, 0.62, 0.62, bodyG);
    arms.push(arm);
  }
  const seed = ell(0.13, 0.2, 0.06, plush('#4a3b44'), 20);
  at(seed, 0, 0.66, 0.7, bodyG);
  seed.rotation.z = 0.5;
  at(ell(0.025, 0.17, 0.065, plush('#f6efe6'), 10), 0.03, 0.66, 0.73, bodyG).rotation.z = 0.5;
  const tail = ell(0.1, 0.1, 0.1, tan, 16);
  at(tail, 0, 0.4, -0.68, bodyG);

  const spec = { rx: 1.0, ry: 0.8, rz: 0.82, eyeX: 0.4, eyeY: 0.1, eyeR: 0.13, mouthY: -0.3, mouthW: 0.095, blushX: 0.66, blushY: -0.14, blushR: 0.13 };
  const head = new THREE.Group();
  head.position.y = 1.25;
  root.add(head);
  head.add(ell(spec.rx, spec.ry, spec.rz, tan));
  const chin = ell(0.58, 0.36, 0.04, cream, 28);
  onSurface(chin, spec, 0, -0.34, -0.03);
  head.add(chin);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    at(ell(0.26, 0.26, 0.12, tan), 0, 0, 0, ear);
    at(ell(0.17, 0.17, 0.1, pink), 0, 0, 0.05, ear);
    at(ear, s * 0.66, 0.66, -0.1, head);
    ear.rotation.z = -s * 0.25;
    ear.userData = { side: s, base: -s * 0.25 };
    ears.push(ear);
  }
  const face = buildFace(head, spec);
  const nose = ell(0.055, 0.04, 0.04, plush('#ff8aa1'), 16);
  onSurface(nose, spec, 0, -0.1, 0.03);
  head.add(nose);
  return { root, head, ears, tail, arms, face, spec, headY: 1.25, bodyG };
}

function axolotl() {
  const pink = plush('#ffb8d0');
  const light = plush('#ffe6f0');
  const gill = plush('#ff6c9d');
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  at(ell(0.62, 0.52, 0.58, pink), 0, 0.52, 0, bodyG);
  at(ell(0.4, 0.34, 0.2, light), 0, 0.46, 0.4, bodyG);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    at(ell(0.12, 0.2, 0.12, pink), 0, -0.1, 0, arm);
    for (const k of [-1, 0, 1]) at(ell(0.035, 0.07, 0.035, light, 10), k * 0.07, -0.3, 0.02, arm);
    at(arm, s * 0.6, 0.6, 0.15, bodyG);
    arm.rotation.z = s * 0.5;
    arms.push(arm);
    at(ell(0.17, 0.1, 0.26, pink), s * 0.32, 0.1, 0.24, bodyG);
  }
  const tail = new THREE.Group();
  at(ell(0.18, 0.28, 0.7, pink), 0, 0.28, -0.35, tail);
  at(ell(0.05, 0.4, 0.5, gill), 0, 0.5, -0.45, tail);
  at(tail, 0, 0.2, -0.45, root);
  tail.rotation.x = -0.25;

  const spec = { rx: 1.0, ry: 0.72, rz: 0.74, eyeX: 0.42, eyeY: 0.08, eyeR: 0.13, mouthY: -0.26, mouthW: 0.16, blushX: 0.68, blushY: -0.16, blushR: 0.12 };
  const head = new THREE.Group();
  head.position.y = 1.2;
  root.add(head);
  head.add(ell(spec.rx, spec.ry, spec.rz, pink));
  const ears = [];
  const ANG = [0.95, 0.5, 0.05];
  for (const s of [-1, 1]) {
    for (const k of [0, 1, 2]) {
      const g = new THREE.Group();
      g.rotation.order = 'YXZ';
      at(ell(0.085, 0.085, 0.24, gill, 14), 0, 0, 0.2, g);
      for (const j of [-1, 1]) {
        const frond = ell(0.05, 0.05, 0.2, gill, 10);
        frond.position.set(j * 0.07, 0, 0.42);
        frond.rotation.y = j * 0.45;
        g.add(frond);
        at(ell(0.07, 0.07, 0.07, plush('#ff4d86'), 10), j * 0.14, 0, 0.58, g);
      }
      at(ell(0.09, 0.09, 0.09, plush('#ff4d86'), 12), 0, 0, 0.5, g);
      at(g, s * 0.84, 0.3 - k * 0.2, -0.06, head);
      g.rotation.y = s * (Math.PI / 2 - 0.15);
      g.rotation.x = -ANG[k];
      g.userData = { side: s, base: -ANG[k], axis: 'x', phase: k * 0.8 };
      ears.push(g);
    }
  }
  const face = buildFace(head, spec);
  return { root, head, ears, tail, arms, face, spec, headY: 1.2, bodyG };
}

const BUILDERS = { panda, kitsune, penguin, hamster, axolotl };

// ---------------------------------------------------------------- accessories

function buildAccessories(head, spec) {
  const pink = plush('#ff6f9c');
  const bow = new THREE.Group();
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 20), pink);
    wing.rotation.z = s * -Math.PI / 2;
    wing.position.x = s * 0.17;
    bow.add(wing);
  }
  bow.add(ell(0.08, 0.08, 0.08, plush('#ff3d7f'), 16));
  bow.position.set(spec.rx * 0.42, spec.ry * 0.86, spec.rz * 0.35);
  bow.rotation.z = -0.35;
  head.add(bow);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.045, 12, 40),
    flat('#ffd34d'),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = spec.ry + 0.4;
  head.add(halo);

  const sparkles = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), flat('#ffe27a'));
    star.userData.angle = (i / 4) * Math.PI * 2;
    sparkles.add(star);
  }
  head.add(sparkles);
  return { bow, halo, sparkles };
}

// ---------------------------------------------------------------- egg

function eggTexture(species, cracked) {
  const [base, spot, spot2] = EGG_COLORS[species] ?? EGG_COLORS.panda;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 256);
  let seed = [...species].reduce((a, ch) => a + ch.charCodeAt(0), 7);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = i % 2 ? spot : spot2;
    const r = 8 + rnd() * 20;
    g.beginPath();
    g.ellipse(rnd() * 512, 50 + rnd() * 160, r, r * 0.9, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (cracked) {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    for (const cx of [128, 384]) {
      g.beginPath();
      g.moveTo(cx - 40, 70);
      g.lineTo(cx - 14, 100);
      g.lineTo(cx - 34, 120);
      g.lineTo(cx, 150);
      g.lineTo(cx - 18, 170);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildEgg(species) {
  const geo = new THREE.SphereGeometry(1, 48, 36);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = 1 - 0.16 * y;
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const normal = new THREE.MeshPhysicalMaterial({ map: eggTexture(species, false), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const cracked = new THREE.MeshPhysicalMaterial({ map: eggTexture(species, true), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const mesh = new THREE.Mesh(geo, normal);
  mesh.scale.set(0.82, 1.08, 0.82);
  mesh.position.y = 1.05;
  const g = new THREE.Group();
  g.add(mesh);
  return { group: g, mesh, normal, cracked };
}

// ---------------------------------------------------------------- stage

export class PetStage {
  constructor({ live = true, size = 256 } = {}) {
    this.live = live;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !live });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'pet3d-canvas';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.camera.position.set(0, 1.4, 6.7);
    this.camera.lookAt(0, 1.2, 0);

    this.scene.add(new THREE.HemisphereLight('#fff6fb', '#ffd9e8', 1.35));
    const key = new THREE.DirectionalLight('#ffffff', 2.1);
    key.position.set(2.5, 5, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#ffd1e6', 1.1);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.scene.add(this.shadow);

    this.models = new Map();
    this.eggs = new Map();
    this.current = null;
    this.particles = [];
    this.textures = {};
    this.state = { species: null, stage: 'baby', form: null, mood: 'happy', alive: true, hatchesInMs: 60000 };
    this.look = { x: 0, y: 0, tx: 0, ty: 0 };
    this.react_ = null;
    this.blink = { next: 2, t: -1 };
    this.elapsed = 0;
    this.last = 0;
    this.setSize(size, size);
    this.running = false;
    this.onPointer = (e) => {
      const r = this.canvas.getBoundingClientRect();
      if (!r.width) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / Math.max(300, window.innerWidth * 0.4);
      const dy = (e.clientY - (r.top + r.height * 0.4)) / Math.max(300, window.innerHeight * 0.4);
      this.look.tx = Math.max(-1, Math.min(1, dx));
      this.look.ty = Math.max(-1, Math.min(1, dy));
    };
    if (live) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      this.canvas.addEventListener('pointerdown', () => this.react('love'));
      this.canvas.style.cursor = 'pointer';
      this.ro = new ResizeObserver(() => this.fit());
    }
  }

  mount(container) {
    container.append(this.canvas);
    this.container = container;
    this.ro?.disconnect();
    this.ro?.observe(container);
    this.fit();
    this.start();
  }

  fit() {
    const c = this.container;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    this.setSize(w, h);
  }

  setSize(w, h) {
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.size && this.size.w === w && this.size.h === h && this.size.pr === pr) return;
    this.size = { w, h, pr };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  modelFor(species) {
    if (!this.models.has(species)) {
      const m = BUILDERS[species]();
      m.acc = buildAccessories(m.head, m.spec);
      m.materials = [];
      m.root.traverse((o) => { if (o.isMesh && o.material?.userData?.base) m.materials.push(o.material); });
      this.models.set(species, m);
    }
    return this.models.get(species);
  }

  eggFor(species) {
    if (!this.eggs.has(species)) this.eggs.set(species, buildEgg(species));
    return this.eggs.get(species);
  }

  setPet(p) {
    const prevSpecies = this.state.species;
    this.state = {
      species: p.species,
      stage: p.stage,
      form: p.form,
      mood: p.mood,
      alive: p.alive !== false,
      hatchesInMs: p.hatchesInMs ?? 0,
    };
    if (p.species !== prevSpecies || !this.current) this.swap();
    else if ((p.stage === 'egg') !== this.current.isEgg) this.swap();
    this.applyStaticLook();
    this.renderOnce();
  }

  swap() {
    this.pivot.clear();
    const { species, stage } = this.state;
    if (stage === 'egg') {
      const egg = this.eggFor(species);
      this.pivot.add(egg.group);
      this.current = { isEgg: true, egg };
    } else {
      const m = this.modelFor(species);
      this.pivot.add(m.root);
      this.current = { isEgg: false, m };
    }
  }

  applyStaticLook() {
    const s = this.state;
    const cur = this.current;
    if (!cur) return;
    if (cur.isEgg) {
      const hatching = s.hatchesInMs < 15000;
      cur.egg.mesh.material = hatching ? cur.egg.cracked : cur.egg.normal;
      return;
    }
    const m = cur.m;
    const ghost = !s.alive;
    const scale = STAGE_SCALE[s.stage] ?? 1;
    m.root.scale.setScalar(scale);
    const eyeK = STAGE_EYES[s.stage] ?? 1;
    const mood = s.mood;
    const sleeping = mood === 'sleeping' || mood === 'sleepy';
    const sad = ['sad', 'lonely', 'hungry', 'tired'].includes(mood);
    const sick = mood === 'sick';
    const happy = ['happy', 'excited', 'love', 'proud'].includes(mood);
    const grumpy = mood === 'grumpy';
    const shy = mood === 'shy';
    const curious = mood === 'curious' || mood === 'bored';
    const f = m.face;
    this.expr = {
      eyeK, sleeping, sad, sick, happy, ghost, shy, curious, grumpy,
      love: mood === 'love' || mood === 'excited',
      angry: grumpy || (s.form === 'rascal' && s.stage === 'adult' && !sad && !sick),
    };

    for (const mat of m.materials) {
      mat.color.copy(mat.userData.base);
      if (sick) mat.color.lerp(new THREE.Color('#9fd66a'), 0.45);
      if (mood === 'tired') mat.color.lerp(new THREE.Color('#c5c0d0'), 0.25);
      if (ghost) mat.color.lerp(new THREE.Color('#eaf2ff'), 0.65);
      mat.transparent = ghost;
      mat.opacity = ghost ? 0.62 : 1;
    }
    m.acc.bow.visible = !ghost && (s.stage === 'adult' || s.stage === 'teen') && s.form === 'angel';
    m.acc.sparkles.visible = m.acc.bow.visible;
    m.acc.halo.visible = ghost;

    this.applyFace();
    m.ears.forEach((e) => {
      const droop = sad || sick || sleeping ? 0.45 : shy ? 0.25 : 0;
      e.userData.droop = droop;
    });
    f.blush.forEach((b) => {
      b.material.opacity = this.expr.love || shy ? 0.9 : happy ? 0.8 : sad ? 0.35 : 0.55;
    });
  }

  applyFace() {
    const m = this.current.m;
    const f = m.face;
    const x = this.expr;
    const react = this.react_?.type;
    const loveEyes = react === 'love' || x.love;
    const eyeMode = x.ghost ? 'x' : x.sleeping ? 'sleep' : loveEyes ? 'happy' : 'open';
    for (const e of f.eyes) {
      e.open.visible = eyeMode === 'open';
      e.wet.visible = x.sad && !x.sleeping;
      e.happy.visible = eyeMode === 'happy';
      e.sleep.visible = eyeMode === 'sleep';
      e.x.visible = eyeMode === 'x';
      const k = x.eyeK * (x.sad ? 1.12 : x.curious ? 1.08 : 1);
      e.eye.scale.set(k * (x.curious && e.side < 0 ? 1.15 : 1), k * (x.sick && eyeMode === 'open' ? 0.55 : x.shy ? 0.85 : 1), 1);
    }
    const browMode = x.ghost || x.sleeping ? 'none'
      : x.angry ? 'angry'
      : x.sad || x.sick || x.shy ? 'worried'
      : 'none';
    for (const b of f.brows) {
      b.holder.visible = browMode !== 'none';
      const tilt = browMode === 'worried' ? -b.side * 0.4 : b.side * 0.4;
      b.brow.rotation.z = Math.PI / 2 + tilt;
    }
    const tears = x.sad && !x.sleeping && !x.ghost;
    f.tears.forEach((t) => { t.tear.visible = tears; });
    const chew = react === 'eat';
    const mm = f.mouths;
    let show = 'smile';
    if (x.ghost) show = 'open';
    else if (x.sleeping) show = 'smile';
    else if (chew) show = 'open';
    else if (x.sick || x.grumpy) show = 'flat';
    else if (this.state.mood === 'hungry' || this.state.mood === 'curious') show = 'open';
    else if (x.sad) show = 'frown';
    else if (loveEyes) show = 'bigOpen';
    else if (x.happy) show = 'cat';
    else show = 'smile';
    for (const [k, mesh] of Object.entries(mm)) mesh.visible = k === show;
  }

  react(type) {
    this.react_ = { type, t: 0 };
    if (type === 'love') this.burst('💗', 5);
    if (type === 'chat') this.burst('💬', 4);
    if (type === 'excited') this.burst('✨', 5);
    if (type === 'eat') this.burst('🍙', 3);
    if (type === 'play') this.burst('⭐', 5);
    if (type === 'clean') this.burst('✨', 6);
    if (type === 'heal') this.burst('💊', 3);
    if (type === 'sad') this.burst('💧', 3);
    if (type === 'shy') this.burst('😳', 3);
    if (type === 'proud') this.burst('🌟', 4);
    if (this.current && !this.current.isEgg) this.applyFace();
    if (!this.running) this.start();
  }

  burst(emoji, n) {
    this.textures[emoji] ??= heartTexture(emoji);
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures[emoji], transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.5);
      sp.position.set((Math.random() - 0.5) * 1.4, 1.2 + Math.random() * 0.8, 0.9);
      this.pivot.parent.add(sp);
      this.particles.push({ sp, vy: 0.9 + Math.random() * 0.7, vx: (Math.random() - 0.5) * 0.4, life: 0, max: 1.6 + Math.random() * 0.5, delay: i * 0.12 });
    }
  }

  start() {
    if (this.running || !this.live) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = (now - this.last) / 1000;
      this.last = now;
      if (!document.hidden && this.canvas.isConnected && this.canvas.offsetParent !== null) {
        this.elapsed += Math.min(dt, 0.05);
        this.update(dt, this.elapsed);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    window.removeEventListener('pointermove', this.onPointer);
    this.ro?.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  update(dt, t) {
    dt = Math.min(dt, 0.05);
    const cur = this.current;
    if (!cur) return;
    const r = this.react_;
    if (r) {
      r.t += dt;
      if (r.t > (r.type === 'eat' ? 1.8 : 1.5)) {
        this.react_ = null;
        if (!cur.isEgg) this.applyFace();
      }
    }

    if (cur.isEgg) {
      const hatching = this.state.hatchesInMs < 15000;
      const mesh = cur.egg.mesh;
      mesh.rotation.z = Math.sin(t * (hatching ? 22 : 2.2)) * (hatching ? 0.16 : 0.08);
      mesh.rotation.y = hatching ? 0 : Math.sin(t * 0.7) * 0.25;
      mesh.position.y = 1.05 + (hatching ? Math.abs(Math.sin(t * 11)) * 0.05 : Math.sin(t * 2) * 0.02);
      this.pivot.position.y = 0;
      this.pivot.scale.set(1, 1, 1);
      this.shadow.scale.setScalar(1);
      this.tickParticles(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const m = cur.m;
    const x = this.expr;
    const mood = this.state.mood;
    const breathSpeed = x.sleeping ? 1.4 : x.sad || x.sick ? 1.8 : 2.4;
    const breathAmp = x.sleeping ? 0.035 : 0.022;
    const br = Math.sin(t * breathSpeed);

    let jump = 0;
    let squash = 0;
    if (r && (r.type === 'love' || r.type === 'play' || r.type === 'clean' || r.type === 'heal')) {
      const ph = Math.min(1, r.t / 0.7);
      jump = Math.sin(ph * Math.PI) * (r.type === 'play' ? 0.75 : 0.45);
      squash = ph < 0.12 ? ph / 0.12 * 0.12 : 0;
      if (r.type === 'play') m.root.rotation.y = ph * Math.PI * 2;
    } else if (!r) {
      m.root.rotation.y *= 0.9;
    }
    if (mood === 'happy' && !r) {
      const hop = (t % 2.8) / 2.8;
      if (hop < 0.22) jump = Math.sin((hop / 0.22) * Math.PI) * 0.22;
    }
    if (x.ghost) jump = 0.35 + Math.sin(t * 1.6) * 0.08;
    this.pivot.position.y = jump;
    const sy = 1 + br * breathAmp - squash;
    const sx = 1 - br * breathAmp * 0.5 + squash * 0.7;
    this.pivot.scale.set(sx, sy, sx);
    this.shadow.scale.setScalar(Math.max(0.55, 1 - jump * 0.5) * (STAGE_SCALE[this.state.stage] ?? 1) * 1.05);
    this.shadow.material.opacity = x.ghost ? 0.3 : 1;
    m.root.position.x = x.sick ? Math.sin(t * 40) * 0.012 : 0;

    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 5);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 5);
    const droop = x.sleeping ? 0.45 : x.sad || x.sick ? 0.28 : 0;
    const nod = x.sleeping ? Math.sin(t * 0.9) * 0.05 : 0;
    const cuddle = r?.type === 'love' ? Math.sin(t * 9) * 0.12 : 0;
    const eatNod = r?.type === 'eat' ? Math.abs(Math.sin(t * 9)) * 0.12 : 0;
    const look = x.sleeping || x.ghost ? 0.1 : 1;
    m.head.rotation.y = this.look.x * 0.5 * look + Math.sin(t * 0.8) * 0.04;
    m.head.rotation.x = droop + nod + eatNod + this.look.y * 0.25 * look;
    m.head.rotation.z = Math.sin(t * 0.6) * 0.04 + cuddle + (x.sad ? 0.1 : 0) + (mood === 'happy' ? Math.sin(t * 2.4) * 0.05 : 0);
    m.head.position.y = m.headY + br * 0.012;

    const fast = mood === 'happy' || r?.type === 'love' || r?.type === 'play';
    for (const e of m.ears) {
      const u = e.userData;
      const wig = Math.sin(t * (fast ? 7 : 1.6) + (u.phase ?? 0)) * (fast ? 0.14 : 0.04);
      if (u.axis === 'x') e.rotation.x = u.base + wig * 1.6;
      else e.rotation.z = u.base - u.side * (u.droop ?? 0) + wig;
    }
    if (m.tail) {
      const wag = Math.sin(t * (fast ? 9 : 2)) * (fast ? 0.5 : 0.12);
      m.tail.rotation.y = wag;
    }
    m.arms?.forEach((a, i) => {
      const base = a.userData.base ?? (a.userData.base = a.rotation.z);
      const side = i === 0 ? -1 : 1;
      const lift = fast ? Math.abs(Math.sin(t * 7 + i)) * 0.5 : x.sleeping ? 0 : Math.sin(t * 1.6 + i) * 0.04;
      a.rotation.z = base + side * lift;
    });

    if (!x.sleeping && !x.ghost) {
      this.blink.next -= dt;
      if (this.blink.next <= 0 && this.blink.t < 0) { this.blink.t = 0; }
      if (this.blink.t >= 0) {
        this.blink.t += dt;
        const k = this.blink.t < 0.07 ? 1 - this.blink.t / 0.07 * 0.9 : this.blink.t < 0.16 ? 0.1 + (this.blink.t - 0.07) / 0.09 * 0.9 : 1;
        for (const e of m.face.eyes) e.open.scale.y = Math.max(0.1, k);
        if (this.blink.t > 0.16) { this.blink.t = -1; this.blink.next = 2 + Math.random() * 3.5; }
      }
    }

    if (r?.type === 'eat' || mood === 'hungry') {
      const open = 0.75 + Math.abs(Math.sin(t * (r ? 9 : 3))) * 0.45;
      m.face.mouth.scale.set(1, open, 1);
    } else {
      m.face.mouth.scale.set(1, 1, 1);
    }

    if (x.sad && !x.sleeping && !x.ghost) {
      for (const tr of m.face.tears) {
        const p = ((t * 0.55 + tr.phase) % 1);
        tr.tear.position.set(tr.side * tr.r * 0.55, -tr.r * 1.15 - p * tr.r * 3.4, tr.r * 0.45);
        tr.tear.material.opacity = 0.95 * (1 - p * p);
        tr.tear.scale.setScalar(0.7 + (1 - p) * 0.4);
        tr.tear.scale.y *= 1.5;
      }
    }

    const acc = m.acc;
    if (acc.sparkles.visible) {
      acc.sparkles.children.forEach((s, i) => {
        const a = s.userData.angle + t * 0.8;
        s.position.set(Math.cos(a) * 1.1, 0.2 + Math.sin(t * 2 + i) * 0.25, Math.sin(a) * 0.7);
        s.rotation.y = t * 3;
        s.scale.setScalar(0.7 + Math.sin(t * 4 + i * 2) * 0.35);
      });
    }
    if (acc.halo.visible) acc.halo.rotation.z = t * 0.5;
    if (x.sleeping && Math.random() < dt * 0.6) this.burst('💤', 1);

    this.tickParticles(dt);
    this.renderer.render(this.scene, this.camera);
  }

  tickParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.delay > 0) { p.delay -= dt; p.sp.visible = false; continue; }
      p.sp.visible = true;
      p.life += dt;
      p.sp.position.y += p.vy * dt;
      p.sp.position.x += p.vx * dt;
      const k = p.life / p.max;
      p.sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      p.sp.scale.setScalar(0.35 + Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 0.25);
      if (k >= 1) {
        p.sp.parent?.remove(p.sp);
        p.sp.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  renderOnce() {
    if (!this.current) return;
    const cur = this.current;
    if (!cur.isEgg) {
      const m = cur.m;
      m.head.rotation.set(0, 0, 0);
      m.head.position.y = m.headY;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------------------------------------------------------------- portraits

let previewStage = null;
const portraitCache = new Map();

export function portrait(pet) {
  if (!webglSupported()) return null;
  const key = [pet.species, pet.stage ?? 'adult', pet.form ?? '', pet.mood ?? 'happy', pet.alive === false ? 'x' : ''].join('|');
  if (portraitCache.has(key)) return portraitCache.get(key);
  try {
    previewStage ??= new PetStage({ live: false, size: 256 });
    previewStage.setPet({ stage: 'adult', form: 'normal', mood: 'happy', alive: true, hatchesInMs: 60000, ...pet });
    previewStage.renderOnce();
    const url = previewStage.canvas.toDataURL('image/png');
    portraitCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}
