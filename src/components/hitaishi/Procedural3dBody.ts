import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Body, BodyExpression, Pose } from '@livliv-dev/player/body';

export type Procedural3dPreset = 'nova' | 'astra' | 'kuro' | 'lumi' | 'x402';

interface PresetColors {
  primary: number; secondary: number; accent: number; emissive: number; face: number;
}

const PRESET_PALETTES: Record<Procedural3dPreset, PresetColors> = {
  nova: { primary: 0xf8fafc, secondary: 0x1e293b, accent: 0x06b6d4, emissive: 0x22d3ee, face: 0x0f172a },
  astra: { primary: 0xfef3c7, secondary: 0x312e81, accent: 0x8b5cf6, emissive: 0xa78bfa, face: 0x1e1b4b },
  kuro: { primary: 0x18181b, secondary: 0x27272a, accent: 0xef4444, emissive: 0xf87171, face: 0x09090b },
  lumi: { primary: 0xfdf2f8, secondary: 0x831843, accent: 0xec4899, emissive: 0xf472b6, face: 0x1f122b },
  x402: { primary: 0x67e8f9, secondary: 0xa78bfa, accent: 0xf472b6, emissive: 0x38bdf8, face: 0x090d1a },
};

function makeRadialTexture(stops: Array<[number, string]>, size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const MOUTH_SEGMENTS = 28;

export class Procedural3dBody implements Body {
  readonly format = '3d-procedural';
  private preset: Procedural3dPreset;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private rootGroup: THREE.Group | null = null;
  private torsoGroup: THREE.Group | null = null;
  private headGroup: THREE.Group | null = null;
  private eyeLeftMesh: THREE.Object3D | null = null;
  private eyeRightMesh: THREE.Object3D | null = null;
  private blushLeftMesh: THREE.Mesh | null = null;
  private blushRightMesh: THREE.Mesh | null = null;
  private mouthMesh: THREE.Object3D | null = null;
  private earLeftGroup: THREE.Group | null = null;
  private earRightGroup: THREE.Group | null = null;
  private haloMesh: THREE.Mesh | null = null;
  private accentMat: THREE.MeshStandardMaterial | null = null;

  // x402 expressive rig references
  private x402ThreadMat: THREE.LineBasicMaterial | null = null;
  private x402MeridianMat: THREE.LineBasicMaterial | null = null;
  private x402AuraMat: THREE.SpriteMaterial | null = null;
  private x402IrisMats: THREE.MeshBasicMaterial[] = [];
  private x402PupilGroups: THREE.Group[] = [];
  private x402HappyArcs: THREE.Mesh[] = [];
  private x402OpenEyeGroups: THREE.Group[] = [];
  private x402BrowL: THREE.Mesh | null = null;
  private x402BrowR: THREE.Mesh | null = null;
  private x402CheekMats: THREE.SpriteMaterial[] = [];
  private x402MouthUpper: THREE.Line | null = null;
  private x402MouthLower: THREE.Line | null = null;
  private x402MouthFillMat: THREE.MeshBasicMaterial | null = null;
  private x402MouthFillMesh: THREE.Mesh | null = null;
  private x402TongueMesh: THREE.Group | null = null;
  private x402Sparkles: THREE.Points | null = null;
  private x402Textures: THREE.Texture[] = [];
  private elapsed = 0;
  private readonly tmpTarget = new THREE.Color();
  private readonly tmpTint = new THREE.Color();
  private readonly tmpIris = new THREE.Color();
  private readonly tmpAura = new THREE.Color();

  constructor(preset: Procedural3dPreset = 'nova') {
    this.preset = preset;
  }

  attach(canvas: HTMLCanvasElement): void {
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const gpu = String(probe.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch { return false; }
    })();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSoftwareGl, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.preset === 'x402' ? 1.18 : 1.12;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {}

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, this.preset === 'x402' ? 0.08 : 0.25, this.preset === 'x402' ? 2.85 : 3.2);
    camera.lookAt(0, this.preset === 'x402' ? 0.06 : 0.18, 0);

    const rootGroup = new THREE.Group();
    const torsoGroup = new THREE.Group();
    const headGroup = new THREE.Group();
    scene.add(rootGroup);
    rootGroup.add(torsoGroup);

    if (this.preset === 'x402') {
      torsoGroup.position.set(0, -0.04, 0);
      headGroup.position.set(0, 0.1, 0);
      torsoGroup.add(headGroup);
      this.buildX402ThreadMind(headGroup, torsoGroup);
    } else {
      this.buildStandardBot(scene, rootGroup, torsoGroup, headGroup);
    }

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.rootGroup = rootGroup;
    this.torsoGroup = torsoGroup;
    this.headGroup = headGroup;
  }

  private buildX402ThreadMind(headGroup: THREE.Group, torsoGroup: THREE.Group): void {
    const auraTex = makeRadialTexture([
      [0, 'rgba(125,211,252,0.55)'],
      [0.42, 'rgba(167,139,250,0.28)'],
      [0.75, 'rgba(244,114,182,0.10)'],
      [1, 'rgba(0,0,0,0)'],
    ], 256);
    const cheekTex = makeRadialTexture([
      [0, 'rgba(255,138,175,0.95)'],
      [0.45, 'rgba(251,113,133,0.45)'],
      [1, 'rgba(251,113,133,0)'],
    ], 128);
    const irisTex = makeRadialTexture([
      [0, 'rgba(255,255,255,0.95)'],
      [0.32, 'rgba(103,232,249,0.95)'],
      [0.72, 'rgba(99,102,241,0.75)'],
      [1, 'rgba(56,189,248,0)'],
    ], 128);
    const sparkTex = makeRadialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(196,181,253,0.75)'],
      [1, 'rgba(56,189,248,0)'],
    ], 64);
    this.x402Textures.push(auraTex, cheekTex, irisTex, sparkTex);

    // Warm luminous halo behind the rounded head
    const auraMat = new THREE.SpriteMaterial({ map: auraTex, color: 0xffffff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
    this.x402AuraMat = auraMat;
    const auraSprite = new THREE.Sprite(auraMat);
    auraSprite.scale.set(1.65, 1.65, 1);
    auraSprite.position.set(0, 0.02, -0.35);
    headGroup.add(auraSprite);

    // Soft dark translucent inner rounded sphere so front glowing silk threads read cleanly & warmly (not spooky hollow skull!)
    const coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.415, 36, 32),
      new THREE.MeshBasicMaterial({ color: 0x0b1024, transparent: true, opacity: 0.82 })
    );
    coreMesh.scale.set(1.03, 1.01, 0.78);
    headGroup.add(coreMesh);

    // Friendly round/soft-human head contour surface helper: smooth sphere-oval with soft cheeks & rounded chin
    const headPoint = (theta: number, phi: number) => {
      // phi: -PI/2 (chin) .. +PI/2 (crown), theta: -PI..PI (0 = front +Z)
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      // Slight gentle cheek fullness & soft rounded chin (never pointy!)
      const cheekRound = 1 + 0.05 * Math.exp(-((phi + 0.12) ** 2) * 5.5);
      const chinSoft = phi < -0.2 ? 1 - 0.08 * ((-0.2 - phi) / (Math.PI / 2 - 0.2)) ** 2 : 1;
      const rx = 0.44 * cheekRound * chinSoft;
      const ry = 0.435;
      const rz = 0.34;
      return new THREE.Vector3(Math.sin(theta) * cosP * rx, sinP * ry, Math.cos(theta) * cosP * rz);
    };

    // Multi-color aurora vertex color gradient across the rounded glowing threads
    const cTop = new THREE.Color(0x38bdf8);    // bright sky cyan
    const cMidL = new THREE.Color(0xc084fc);   // soft luminous violet
    const cMidR = new THREE.Color(0x34d399);   // fresh aurora mint
    const cCheek = new THREE.Color(0xf472b6);  // warm sakura pink
    const cChin = new THREE.Color(0x60a5fa);   // soft periwinkle
    const tmpC = new THREE.Color();

    const colorAt = (x: number, y: number, z: number) => {
      const ny = (y + 0.44) / 0.88; // 0 bottom .. 1 top
      const nx = (x + 0.44) / 0.88; // 0 left .. 1 right
      tmpC.copy(cChin).lerp(cTop, Math.max(0, Math.min(1, ny)));
      tmpC.lerp(nx < 0.5 ? cMidL : cMidR, Math.abs(nx - 0.5) * 0.85);
      // Warm rose highlight along mid-lower cheeks
      const cheekGlow = Math.exp(-((y + 0.08) ** 2) * 14) * Math.min(1, Math.abs(x) * 2.1);
      tmpC.lerp(cCheek, cheekGlow * 0.48);
      // Brighter front-facing filaments, softer edges
      const frontBoost = 0.55 + Math.max(0, z / 0.34) * 0.55;
      return [tmpC.r * frontBoost, tmpC.g * frontBoost, tmpC.b * frontBoost] as const;
    };

    const threadMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false });
    const meridianMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    this.x402ThreadMat = threadMat;
    this.x402MeridianMat = meridianMat;

    // 36 smooth horizontal aurora silk contour rings wrapping the friendly rounded face
    for (let i = 0; i < 36; i++) {
      const frac = (i + 1.5) / 38;
      const phi = -Math.PI * 0.44 + frac * Math.PI * 0.88;
      const pos: number[] = [];
      const col: number[] = [];
      const segs = 56;
      for (let s = 0; s <= segs; s++) {
        const theta = -Math.PI * 0.68 + (s / segs) * Math.PI * 1.36;
        const p = headPoint(theta, phi);
        // Gentle organic silk wave (subtle, fluid, never jagged)
        const wave = Math.sin(theta * 3 + i * 0.55) * 0.004;
        pos.push(p.x, p.y + wave, p.z);
        const [r, g, b] = colorAt(p.x, p.y, p.z);
        col.push(r, g, b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      headGroup.add(new THREE.Line(geo, threadMat));
    }

    // 18 flowing meridian silk ribbons framing the rounded silhouette
    for (let m = -8; m <= 8; m++) {
      const theta = (m / 8.5) * Math.PI * 0.62;
      const pos: number[] = [];
      const col: number[] = [];
      for (let k = 0; k <= 32; k++) {
        const phi = -Math.PI * 0.43 + (k / 32) * Math.PI * 0.86;
        const p = headPoint(theta, phi);
        pos.push(p.x, p.y, p.z);
        const [r, g, b] = colorAt(p.x, p.y, p.z);
        col.push(r, g, b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      headGroup.add(new THREE.Line(geo, meridianMat));
    }

    // Soft glowing shoulder/collar aurora wisps below the head
    for (let s = 0; s < 5; s++) {
      const yBase = -0.45 - s * 0.042;
      const wSpan = 0.24 + s * 0.075;
      const pos: number[] = [];
      const col: number[] = [];
      for (let k = 0; k <= 28; k++) {
        const u = (k / 28) * 2 - 1;
        const x = u * wSpan;
        const y = yBase - Math.abs(u) * 0.045;
        const z = Math.cos(u * Math.PI * 0.5) * 0.14 - 0.04;
        pos.push(x, y, z);
        const fade = (1 - s * 0.16) * (1 - Math.abs(u) * 0.55);
        col.push(0.45 * fade, 0.72 * fade, 0.98 * fade);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      torsoGroup.add(new THREE.Line(geo, threadMat));
    }

    // Rosy glowing cheeks (☺️) — always softly warm, blooming brightly on smile/shy
    this.x402CheekMats = [];
    ([-1, 1] as const).forEach((side) => {
      const mat = new THREE.SpriteMaterial({ map: cheekTex, color: 0xff8fab, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
      this.x402CheekMats.push(mat);
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.18, 0.105, 1);
      sp.position.set(side * 0.232, -0.055, 0.305);
      headGroup.add(sp);
    });

    // Warm Expressive Friendly Eyes (colored luminous iris + dark friendly pupil + 2 bright sparkles + happy ^ ^ squint arc!)
    this.x402IrisMats = [];
    this.x402PupilGroups = [];
    this.x402HappyArcs = [];
    this.x402OpenEyeGroups = [];

    const buildFriendlyEye = (side: -1 | 1) => {
      const eyeRoot = new THREE.Group();
      eyeRoot.position.set(side * 0.148, 0.055, 0.338);
      eyeRoot.rotation.y = side * 0.22;

      const openGroup = new THREE.Group();
      const socket = new THREE.Mesh(
        new THREE.CircleGeometry(0.072, 28),
        new THREE.MeshBasicMaterial({ color: 0x0c1428, transparent: true, opacity: 0.92 })
      );
      socket.scale.set(1.04, 0.98, 1);
      openGroup.add(socket);

      const rimMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.074, 0.0045, 10, 36),
        new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.88 })
      );
      rimMesh.scale.set(1.04, 0.96, 1);
      rimMesh.position.z = 0.004;
      openGroup.add(rimMesh);

      const pupilGroup = new THREE.Group();
      pupilGroup.position.z = 0.008;
      const irisMat = new THREE.MeshBasicMaterial({ map: irisTex, color: 0x67e8f9, transparent: true, opacity: 0.96, depthWrite: false });
      this.x402IrisMats.push(irisMat);
      const irisMesh = new THREE.Mesh(new THREE.CircleGeometry(0.06, 28), irisMat);
      const pupilCore = new THREE.Mesh(new THREE.CircleGeometry(0.032, 24), new THREE.MeshBasicMaterial({ color: 0x090d1c }));
      pupilCore.position.z = 0.004;
      const sparkBig = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      sparkBig.position.set(0.017, 0.017, 0.008);
      const sparkSmall = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 12), new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
      sparkSmall.position.set(-0.015, -0.013, 0.008);
      pupilGroup.add(irisMesh, pupilCore, sparkBig, sparkSmall);
      openGroup.add(pupilGroup);
      this.x402PupilGroups.push(pupilGroup);
      this.x402OpenEyeGroups.push(openGroup);

      const happyCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 13 }, (_, i) => {
          const u = (i / 12) * 2 - 1;
          return new THREE.Vector3(u * 0.074, Math.cos(u * Math.PI * 0.5) * 0.042 - 0.008, 0.012);
        })
      );
      const happyArc = new THREE.Mesh(
        new THREE.TubeGeometry(happyCurve, 24, 0.0075, 8, false),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0 })
      );
      this.x402HappyArcs.push(happyArc);

      eyeRoot.add(openGroup, happyArc);
      headGroup.add(eyeRoot);
      return eyeRoot;
    };

    this.eyeLeftMesh = buildFriendlyEye(-1);
    this.eyeRightMesh = buildFriendlyEye(1);

    const buildBrow = (side: -1 | 1) => {
      const browCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 11 }, (_, i) => {
          const u = (i / 10) * 2 - 1;
          return new THREE.Vector3(u * 0.068, Math.cos(u * Math.PI * 0.5) * 0.016, 0.006);
        })
      );
      const brow = new THREE.Mesh(
        new THREE.TubeGeometry(browCurve, 20, 0.0052, 8, false),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.82 })
      );
      brow.position.set(side * 0.148, 0.162, 0.328);
      brow.rotation.y = side * 0.2;
      headGroup.add(brow);
      return brow;
    };
    this.x402BrowL = buildBrow(-1);
    this.x402BrowR = buildBrow(1);

    // Dynamic Expressive Smile / Mouth + Playful Tongue (😜)
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.148, 0.332);
    const makeMouthLine = (color: number, opacity: number) => {
      const arr = new Float32Array((MOUTH_SEGMENTS + 1) * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    };
    this.x402MouthUpper = makeMouthLine(0xffffff, 0.94);
    this.x402MouthLower = makeMouthLine(0xfbcfe8, 0.88);

    const fillVerts = new Float32Array((MOUTH_SEGMENTS + 1) * 2 * 3);
    const fillIndices: number[] = [];
    for (let i = 0; i < MOUTH_SEGMENTS; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      fillIndices.push(a, b, c, b, d, c);
    }
    const fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.BufferAttribute(fillVerts, 3));
    fillGeo.setIndex(fillIndices);
    const mouthFillMat = new THREE.MeshBasicMaterial({ color: 0x4c1026, transparent: true, opacity: 0, side: THREE.DoubleSide });
    this.x402MouthFillMat = mouthFillMat;
    const mouthFill = new THREE.Mesh(fillGeo, mouthFillMat);
    this.x402MouthFillMesh = mouthFill;

    const tongueGroup = new THREE.Group();
    const tongueBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.018, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.98 })
    );
    tongueBody.scale.set(1.12, 1.0, 0.45);
    const tongueCrease = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0038, 0.016, 4, 8),
      new THREE.MeshBasicMaterial({ color: 0xbe123c, transparent: true, opacity: 0.45 })
    );
    tongueCrease.position.set(0, 0.004, 0.011);
    tongueGroup.add(tongueBody, tongueCrease);
    tongueGroup.position.set(0.016, -0.022, 0.022);
    tongueGroup.rotation.z = -0.14;
    tongueGroup.scale.set(0.001, 0.001, 0.001);
    tongueGroup.visible = false;
    this.x402TongueMesh = tongueGroup;

    mouthGroup.add(mouthFill, tongueGroup, this.x402MouthUpper, this.x402MouthLower);
    headGroup.add(mouthGroup);
    this.mouthMesh = mouthGroup;

    // Floating iridescent stardust sparkles orbiting around the head aura
    const sparkCount = 34;
    const sPos = new Float32Array(sparkCount * 3);
    const sCol = new Float32Array(sparkCount * 3);
    const sparkPalette = [0x38bdf8, 0xc084fc, 0xf472b6, 0x34d399, 0xfde047];
    for (let i = 0; i < sparkCount; i++) {
      const a = (i / sparkCount) * Math.PI * 2 + (i % 3) * 0.4;
      const rad = 0.56 + (i % 5) * 0.07;
      sPos[i * 3] = Math.cos(a) * rad;
      sPos[i * 3 + 1] = Math.sin(a) * rad * 0.92;
      sPos[i * 3 + 2] = ((i % 7) - 3) * 0.06 - 0.1;
      tmpC.setHex(sparkPalette[i % sparkPalette.length]);
      sCol[i * 3] = tmpC.r; sCol[i * 3 + 1] = tmpC.g; sCol[i * 3 + 2] = tmpC.b;
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    const sparkles = new THREE.Points(sGeo, new THREE.PointsMaterial({
      size: 0.055, map: sparkTex, vertexColors: true, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    torsoGroup.add(sparkles);
    this.x402Sparkles = sparkles;

    this.updateX402MouthCurve(0.28, 0, 0);
  }

  private updateX402MouthCurve(smileAmt: number, openAmt: number, playfulAmt: number): void {
    if (!this.x402MouthUpper || !this.x402MouthLower) return;
    const uAttr = this.x402MouthUpper.geometry.getAttribute('position') as THREE.BufferAttribute;
    const lAttr = this.x402MouthLower.geometry.getAttribute('position') as THREE.BufferAttribute;
    const fAttr = this.x402MouthFillMesh?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;

    const halfW = 0.098 + Math.max(0, smileAmt) * 0.024 + openAmt * 0.012;
    const cornerLift = smileAmt * 0.036;
    const openSep = openAmt * 0.05 + Math.max(0, smileAmt - 0.48) * 0.026 + playfulAmt * 0.022;

    for (let i = 0; i <= MOUTH_SEGMENTS; i++) {
      const u = (i / MOUTH_SEGMENTS) * 2 - 1;
      const arch = Math.sqrt(Math.max(0, 1 - u * u));
      const smirk = playfulAmt > 0.1 ? (u > 0 ? u * 0.012 * playfulAmt : -u * 0.005 * playfulAmt) : 0;
      const baseCurveY = (u * u - 0.45) * cornerLift + smirk;
      const z = Math.cos(u * Math.PI * 0.42) * 0.022;
      const upperY = baseCurveY + arch * (0.003 + openSep * 0.22);
      const lowerY = baseCurveY - arch * (0.004 + openSep * 0.88);
      const x = u * halfW;
      uAttr.setXYZ(i, x, upperY, z + 0.003);
      lAttr.setXYZ(i, x, lowerY, z + 0.003);
      if (fAttr) {
        fAttr.setXYZ(i * 2, x, upperY, z - 0.001);
        fAttr.setXYZ(i * 2 + 1, x, lowerY, z - 0.001);
      }
    }
    uAttr.needsUpdate = true;
    lAttr.needsUpdate = true;
    if (fAttr) fAttr.needsUpdate = true;

    if (this.x402MouthFillMat) {
      const showFill = Math.max(openAmt, Math.max(0, smileAmt - 0.48) * 0.8, playfulAmt * 0.75);
      this.x402MouthFillMat.opacity = Math.min(0.88, showFill * 0.92);
    }
    if (this.x402TongueMesh) {
      this.x402TongueMesh.position.y = -0.015 - openSep * 0.46;
    }
  }

  private buildStandardBot(scene: THREE.Scene, rootGroup: THREE.Group, torsoGroup: THREE.Group, headGroup: THREE.Group): void {
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x312e81, 0.9));
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2); keyLight.position.set(2.4, 3.2, 3.5); scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4); rimLight.position.set(-2.5, 2.0, -2.2); scene.add(rimLight);

    const pal = PRESET_PALETTES[this.preset] || PRESET_PALETTES.nova;
    const primaryMat = new THREE.MeshPhysicalMaterial({ color: pal.primary, roughness: 0.22, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.18 });
    const secondaryMat = new THREE.MeshStandardMaterial({ color: pal.secondary, roughness: 0.52, metalness: 0.65 });
    const faceMat = new THREE.MeshStandardMaterial({ color: pal.face, roughness: 0.15, metalness: 0.35 });
    const accentMat = new THREE.MeshStandardMaterial({ color: pal.accent, emissive: pal.emissive, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.4 });
    this.accentMat = accentMat;
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0 });

    const shadowPlane = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = -0.68; rootGroup.add(shadowPlane);

    torsoGroup.position.set(0, -0.35, 0);
    const chestMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.34, 16, 24), primaryMat);
    chestMesh.scale.set(1.22, 1.0, 0.72); torsoGroup.add(chestMesh);
    const armorTrim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 16, 36), secondaryMat);
    armorTrim.rotation.x = Math.PI / 2.3; armorTrim.position.set(0, 0.18, 0.03); torsoGroup.add(armorTrim);
    const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 1), accentMat);
    coreGem.position.set(0, 0.06, 0.24); torsoGroup.add(coreGem);

    const shoulderGeo = new THREE.SphereGeometry(0.14, 20, 20);
    [-0.42, 0.42].forEach((sx) => { const s = new THREE.Mesh(shoulderGeo, secondaryMat); s.position.set(sx, 0.1, 0); torsoGroup.add(s); });
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 20), secondaryMat);
    neckMesh.position.set(0, 0.34, 0); torsoGroup.add(neckMesh);

    headGroup.position.set(0, 0.56, 0.02); torsoGroup.add(headGroup);
    const skullMesh = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 32), primaryMat);
    skullMesh.scale.set(1.04, 0.96, 0.92); headGroup.add(skullMesh);
    const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.345, 32, 24, 0, Math.PI * 0.82, Math.PI * 0.2, Math.PI * 0.58), faceMat);
    visorMesh.rotation.y = -Math.PI * 0.41 + Math.PI / 2; visorMesh.position.set(0, -0.01, 0.035); headGroup.add(visorMesh);

    const eyeGeo = new THREE.CapsuleGeometry(0.042, 0.055, 8, 16);
    const eyeLeft = new THREE.Mesh(eyeGeo, accentMat); eyeLeft.position.set(-0.125, 0.02, 0.34); headGroup.add(eyeLeft);
    const eyeRight = new THREE.Mesh(eyeGeo, accentMat); eyeRight.position.set(0.125, 0.02, 0.34); headGroup.add(eyeRight);

    const blushGeo = new THREE.CircleGeometry(0.045, 16);
    const blushL = new THREE.Mesh(blushGeo, blushMat); blushL.position.set(-0.18, -0.05, 0.33); blushL.rotation.y = -0.35; headGroup.add(blushL);
    const blushR = new THREE.Mesh(blushGeo, blushMat); blushR.position.set(0.18, -0.05, 0.33); blushR.rotation.y = 0.35; headGroup.add(blushR);

    const mouthMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.05, 8, 12), accentMat);
    mouthMesh.rotation.z = Math.PI / 2; mouthMesh.position.set(0, -0.1, 0.345); headGroup.add(mouthMesh);

    const earGeo = new THREE.ConeGeometry(0.11, 0.36, 16);
    const makeEar = (side: -1 | 1) => {
      const g = new THREE.Group(); g.position.set(side * 0.28, 0.26, -0.02); g.rotation.z = -side * 0.42;
      const m = new THREE.Mesh(earGeo, secondaryMat); m.position.y = 0.14; g.add(m); headGroup.add(g); return g;
    };
    this.earLeftGroup = makeEar(-1); this.earRightGroup = makeEar(1);

    const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.016, 12, 48), accentMat);
    haloMesh.rotation.x = Math.PI / 2.1; haloMesh.position.set(0, 0.45, -0.04); headGroup.add(haloMesh);

    this.eyeLeftMesh = eyeLeft; this.eyeRightMesh = eyeRight;
    this.blushLeftMesh = blushL; this.blushRightMesh = blushR;
    this.mouthMesh = mouthMesh; this.haloMesh = haloMesh;
  }

  context(): WebGL2RenderingContext | null {
    return (this.renderer?.getContext() as WebGL2RenderingContext) || null;
  }

  async load(): Promise<{ name: string; expressions: BodyExpression[] }> {
    return {
      name: `${this.preset.toUpperCase()} 3D`,
      expressions: [
        { id: 'smile', label: 'Happy' },
        { id: 'shy', label: 'Shy' },
        { id: 'playful', label: 'Playful' },
        { id: 'angry', label: 'Fiery' },
        { id: 'sad', label: 'Sad' },
      ],
    };
  }

  render(canvas: HTMLCanvasElement, pose: Pose, w: number, h: number, dt: number): void {
    if (!this.renderer || !this.scene || !this.camera || !this.headGroup || !this.torsoGroup || !this.rootGroup) return;
    const step = Math.min(0.1, dt || 0.016);
    this.elapsed += step;
    if (canvas.width !== w || canvas.height !== h) this.renderer.setSize(w, h, false);
    const aspect = Math.max(0.32, w / Math.max(1, h));
    this.camera.aspect = aspect;

    // Responsive framing so tall mobile screens never crop or zoom too close into the face!
    if (this.preset === 'x402') {
      const portraitFactor = aspect < 0.85 ? Math.min(1.85, 0.85 / aspect) : 1;
      this.camera.position.z = 2.65 * portraitFactor;
      this.camera.position.y = 0.06;
    }
    this.camera.updateProjectionMatrix();

    const P = pose.params;
    const expr = pose.expr || {};
    const s = Math.max(0.4, pose.move?.s || 1);
    this.rootGroup.scale.setScalar(s);
    this.rootGroup.position.set((pose.move?.x || 0) * 1.1, (pose.move?.y || 0) * 1.1, 0);

    const floatY = this.preset === 'x402' ? Math.sin(this.elapsed * 1.8) * 0.022 : 0;
    const breathOffset = (P.breath || 0) * 0.024 + floatY;
    const baseTorsoY = this.preset === 'x402' ? -0.04 : -0.35;
    this.torsoGroup.position.y = baseTorsoY + breathOffset;
    this.torsoGroup.rotation.set(THREE.MathUtils.degToRad(-(P.angleY || 0) * 0.32), THREE.MathUtils.degToRad((P.bodyX || 0) * 1.1), THREE.MathUtils.degToRad(-(P.bodyZ || 0) * 0.75));
    this.headGroup.rotation.set(THREE.MathUtils.degToRad(-(P.angleY || 0) * 0.82), THREE.MathUtils.degToRad((P.angleX || 0) * 0.95), THREE.MathUtils.degToRad(-(P.angleZ || 0) * 0.9));

    const lerpFast = Math.min(1, step * 12);
    const lerpSmooth = Math.min(1, step * 6);
    const smileW = Math.max(expr.smile || 0, (P.smile || 0) * 0.65);
    const shyW = expr.shy || 0;
    const playfulW = expr.playful || 0;
    const angryW = expr.angry || 0;
    const sadW = expr.sad || 0;
    const mouthOpen = Math.max(0, Math.min(1, P.mouthOpen || 0));

    if (this.preset === 'x402') {
      // Orbiting stardust sparkles
      if (this.x402Sparkles) {
        this.x402Sparkles.rotation.z = this.elapsed * 0.14;
        this.x402Sparkles.rotation.y = Math.sin(this.elapsed * 0.5) * 0.25;
      }

      // Expressive eyes: gaze, blink, happy ^ ^ arcs, playful wink (😜)
      const gazeX = (P.eyeBallX || 0) * 0.022;
      const gazeY = (P.eyeBallY || 0) * 0.016;
      const openL = Math.max(0.06, Math.min(1.15, P.eyeLOpen ?? 1));
      const openR = Math.max(0.06, Math.min(1.15, P.eyeROpen ?? 1));
      const happySquintL = Math.max(0, Math.min(1, (smileW - 0.32) * 1.6));
      const happySquintR = Math.max(happySquintL, Math.min(1, playfulW * 1.4)); // playful winks right eye!

      this.x402PupilGroups.forEach((pg) => {
        pg.position.x = THREE.MathUtils.lerp(pg.position.x, gazeX, lerpFast);
        pg.position.y = THREE.MathUtils.lerp(pg.position.y, gazeY, lerpFast);
      });

      [happySquintL, happySquintR].forEach((sq, idx) => {
        const openGrp = this.x402OpenEyeGroups[idx];
        const arc = this.x402HappyArcs[idx];
        const eyeOpen = idx === 0 ? openL : openR;
        if (openGrp) {
          openGrp.visible = sq < 0.72;
          openGrp.scale.y = Math.max(0.06, eyeOpen * (1 - sq * 0.75));
        }
        if (arc) {
          const mat = arc.material as THREE.MeshBasicMaterial;
          mat.opacity = THREE.MathUtils.lerp(mat.opacity, sq > 0.25 ? 0.96 : 0, lerpFast);
          arc.visible = mat.opacity > 0.02;
        }
      });

      // Expressive curved eyebrows
      if (this.x402BrowL && this.x402BrowR) {
        const browLift = (P.browLY || 0) * 0.02 + smileW * 0.018 + playfulW * 0.014 - angryW * 0.024 - sadW * 0.01;
        this.x402BrowL.position.y = THREE.MathUtils.lerp(this.x402BrowL.position.y, 0.162 + browLift + playfulW * 0.012, lerpFast);
        this.x402BrowR.position.y = THREE.MathUtils.lerp(this.x402BrowR.position.y, 0.162 + browLift - playfulW * 0.008, lerpFast);
        const browTilt = -angryW * 0.34 + sadW * 0.3 + shyW * 0.2;
        this.x402BrowL.rotation.z = THREE.MathUtils.lerp(this.x402BrowL.rotation.z, browTilt, lerpFast);
        this.x402BrowR.rotation.z = THREE.MathUtils.lerp(this.x402BrowR.rotation.z, -browTilt, lerpFast);
      }

      // Warm rosy cheek blushes (soft, never harsh or overlapping lips)
      const targetBlush = Math.min(0.76, 0.2 + shyW * 0.52 + smileW * 0.28 + playfulW * 0.26 - sadW * 0.1);
      this.x402CheekMats.forEach((m) => { m.opacity = THREE.MathUtils.lerp(m.opacity, targetBlush, lerpSmooth); });

      // Smooth morphing curved smile + mouth lip-sync + cheeky playful tongue
      const targetSmile = 0.28 + smileW * 0.72 + playfulW * 0.56 + shyW * 0.16 - angryW * 0.82 - sadW * 0.78;
      this.updateX402MouthCurve(targetSmile, mouthOpen, playfulW);

      if (this.x402TongueMesh) {
        const showTongue = playfulW > 0.22;
        this.x402TongueMesh.visible = showTongue;
        const ts = showTongue ? Math.min(0.92, (playfulW - 0.15) * 1.15) : 0.001;
        this.x402TongueMesh.scale.setScalar(THREE.MathUtils.lerp(this.x402TongueMesh.scale.x, ts, lerpFast));
      }

      // Live Emotion Color Morphing across threads, iris, and ambient aura!
      this.tmpTarget.setHex(0xffffff); // neutral aurora preserves vivid vertex rainbow
      this.tmpIris.setHex(0x67e8f9);
      this.tmpAura.setHex(0x93c5fd);
      if (angryW > 0.15) {
        this.tmpTarget.lerp(this.tmpTint.setHex(0xff8c69), Math.min(1, angryW));
        this.tmpIris.setHex(0xfb923c); this.tmpAura.setHex(0xf97316);
      } else if (shyW > 0.15) {
        this.tmpTarget.lerp(this.tmpTint.setHex(0xffb3d9), Math.min(1, shyW));
        this.tmpIris.setHex(0xf472b6); this.tmpAura.setHex(0xf472b6);
      } else if (playfulW > 0.15) {
        this.tmpTarget.lerp(this.tmpTint.setHex(0xe8b4ff), Math.min(1, playfulW));
        this.tmpIris.setHex(0xe879f9); this.tmpAura.setHex(0xc084fc);
      } else if (sadW > 0.15) {
        this.tmpTarget.lerp(this.tmpTint.setHex(0x93c5fd), Math.min(1, sadW));
        this.tmpIris.setHex(0x60a5fa); this.tmpAura.setHex(0x6366f1);
      } else if (smileW > 0.15) {
        this.tmpTarget.lerp(this.tmpTint.setHex(0xa7f3d0), Math.min(0.8, smileW * 0.8));
        this.tmpIris.setHex(0x34d399); this.tmpAura.setHex(0x34d399);
      }

      if (this.x402ThreadMat) {
        this.x402ThreadMat.color.lerp(this.tmpTarget, lerpSmooth);
        this.x402ThreadMat.opacity = 0.58 + Math.sin(this.elapsed * 2.2) * 0.06;
      }
      if (this.x402MeridianMat) this.x402MeridianMat.color.lerp(this.tmpTarget, lerpSmooth);
      if (this.x402AuraMat) this.x402AuraMat.color.lerp(this.tmpAura, lerpSmooth);
      this.x402IrisMats.forEach((im) => im.color.lerp(this.tmpIris, lerpSmooth));
    } else {
      if (this.earLeftGroup && this.earRightGroup) {
        const sway = Math.sin(this.elapsed * 3.2) * 0.06 - THREE.MathUtils.degToRad((P.angleZ || 0) * 0.4);
        this.earLeftGroup.rotation.z = 0.42 + sway;
        this.earRightGroup.rotation.z = -0.42 + sway;
      }
      if (this.haloMesh) {
        this.haloMesh.position.y = 0.45 + Math.sin(this.elapsed * 2.4) * 0.025;
        this.haloMesh.rotation.z = this.elapsed * 0.6;
      }
      if (this.eyeLeftMesh && this.eyeRightMesh) {
        const openL = Math.max(0.08, Math.min(1.2, P.eyeLOpen ?? 1));
        const openR = Math.max(0.08, Math.min(1.2, P.eyeROpen ?? 1));
        const gazeX = (P.eyeBallX || 0) * 0.024, gazeY = (P.eyeBallY || 0) * 0.018;
        this.eyeLeftMesh.scale.y = openL; this.eyeRightMesh.scale.y = openR;
        this.eyeLeftMesh.position.set(-0.125 + gazeX, 0.02 + gazeY, 0.34);
        this.eyeRightMesh.position.set(0.125 + gazeX, 0.02 + gazeY, 0.34);
        const targetEyeRot = -angryW * 0.36 + sadW * 0.28 + shyW * 0.14;
        this.eyeLeftMesh.rotation.z = THREE.MathUtils.lerp(this.eyeLeftMesh.rotation.z, targetEyeRot, lerpFast);
        this.eyeRightMesh.rotation.z = THREE.MathUtils.lerp(this.eyeRightMesh.rotation.z, -targetEyeRot, lerpFast);
      }
      if (this.blushLeftMesh && this.blushRightMesh) {
        const bW = Math.max(shyW, smileW * 0.45, (P.browLY || 0) > 0.4 ? 0.35 : 0);
        const mat = this.blushLeftMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, Math.min(0.68, bW * 0.68), Math.min(1, step * 8));
      }
      if (this.mouthMesh) {
        this.mouthMesh.scale.x = THREE.MathUtils.lerp(this.mouthMesh.scale.x, 1 + mouthOpen * 2.6, Math.min(1, step * 14));
        this.mouthMesh.scale.y = THREE.MathUtils.lerp(this.mouthMesh.scale.y, 1 + smileW * 0.42, Math.min(1, step * 14));
      }
      if (this.accentMat) {
        const pal = PRESET_PALETTES[this.preset] || PRESET_PALETTES.nova;
        const target = this.tmpTarget.setHex(pal.emissive);
        if (angryW > 0.15) target.lerp(this.tmpTint.setHex(0xef4444), Math.min(1, angryW));
        else if (shyW > 0.15) target.lerp(this.tmpTint.setHex(0xf472b6), Math.min(1, shyW));
        else if (playfulW > 0.15) target.lerp(this.tmpTint.setHex(0xc084fc), Math.min(1, playfulW));
        else if (sadW > 0.15) target.lerp(this.tmpTint.setHex(0x60a5fa), Math.min(1, sadW));
        else if (smileW > 0.15) target.lerp(this.tmpTint.setHex(0x34d399), Math.min(0.65, smileW * 0.65));
        this.accentMat.emissive.lerp(target, Math.min(1, step * 7));
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  head(): { x: number; y: number; rx: number; ry: number } {
    return { x: 0.5, y: 0.34, rx: 0.18, ry: 0.2 };
  }

  dispose(): void {
    this.scene?.traverse((obj: any) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose?.());
      else obj.material?.dispose?.();
    });
    this.x402Textures.forEach((t) => t.dispose());
    this.x402Textures = [];
    this.x402IrisMats = [];
    this.x402PupilGroups = [];
    this.x402HappyArcs = [];
    this.x402OpenEyeGroups = [];
    this.x402CheekMats = [];
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
  }
}
