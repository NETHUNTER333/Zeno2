import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Body, BodyExpression, Pose } from '@livliv-dev/player/body';

export type Procedural3dPreset = 'nova' | 'astra' | 'kuro' | 'lumi';

interface PresetColors {
  primary: number;
  secondary: number;
  accent: number;
  emissive: number;
  face: number;
}

const PRESET_PALETTES: Record<Procedural3dPreset, PresetColors> = {
  nova: {
    primary: 0xf8fafc,
    secondary: 0x1e293b,
    accent: 0x06b6d4,
    emissive: 0x22d3ee,
    face: 0x0f172a,
  },
  astra: {
    primary: 0xfef3c7,
    secondary: 0x312e81,
    accent: 0x8b5cf6,
    emissive: 0xa78bfa,
    face: 0x1e1b4b,
  },
  kuro: {
    primary: 0x18181b,
    secondary: 0x27272a,
    accent: 0xef4444,
    emissive: 0xf87171,
    face: 0x09090b,
  },
  lumi: {
    primary: 0xfdf2f8,
    secondary: 0x831843,
    accent: 0xec4899,
    emissive: 0xf472b6,
    face: 0x1f122b,
  },
};

export class Procedural3dBody implements Body {
  readonly format = '3d-procedural';
  private preset: Procedural3dPreset;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private rootGroup: THREE.Group | null = null;
  private torsoGroup: THREE.Group | null = null;
  private headGroup: THREE.Group | null = null;
  private eyeLeftMesh: THREE.Mesh | null = null;
  private eyeRightMesh: THREE.Mesh | null = null;
  private blushLeftMesh: THREE.Mesh | null = null;
  private blushRightMesh: THREE.Mesh | null = null;
  private mouthMesh: THREE.Mesh | null = null;
  private earLeftGroup: THREE.Group | null = null;
  private earRightGroup: THREE.Group | null = null;
  private haloMesh: THREE.Mesh | null = null;
  private accentMat: THREE.MeshStandardMaterial | null = null;
  private elapsed = 0;

  constructor(preset: Procedural3dPreset = 'nova') {
    this.preset = preset;
  }

  attach(canvas: HTMLCanvasElement): void {
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {}

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.25, 3.2);
    camera.lookAt(0, 0.18, 0);

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x312e81, 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(2.4, 3.2, 3.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-2.5, 2.0, -2.2);
    scene.add(rimLight);

    const palette = PRESET_PALETTES[this.preset] || PRESET_PALETTES.nova;

    const primaryMat = new THREE.MeshPhysicalMaterial({
      color: palette.primary,
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
    });
    const secondaryMat = new THREE.MeshStandardMaterial({
      color: palette.secondary,
      roughness: 0.52,
      metalness: 0.65,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      color: palette.face,
      roughness: 0.15,
      metalness: 0.35,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.emissive,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.4,
    });
    this.accentMat = accentMat;

    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0,
    });

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Contact shadow plane
    const shadowGeo = new THREE.CircleGeometry(0.85, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.68;
    rootGroup.add(shadowPlane);

    // 1. Torso & Shoulders Group
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.35, 0);
    rootGroup.add(torsoGroup);

    const chestGeo = new THREE.CapsuleGeometry(0.32, 0.34, 16, 24);
    const chestMesh = new THREE.Mesh(chestGeo, primaryMat);
    chestMesh.scale.set(1.22, 1.0, 0.72);
    torsoGroup.add(chestMesh);

    const armorTrimGeo = new THREE.TorusGeometry(0.28, 0.035, 16, 36);
    const armorTrim = new THREE.Mesh(armorTrimGeo, secondaryMat);
    armorTrim.rotation.x = Math.PI / 2.3;
    armorTrim.position.set(0, 0.18, 0.03);
    torsoGroup.add(armorTrim);

    const coreGemGeo = new THREE.OctahedronGeometry(0.085, 1);
    const coreGem = new THREE.Mesh(coreGemGeo, accentMat);
    coreGem.position.set(0, 0.06, 0.24);
    torsoGroup.add(coreGem);

    // Shoulders
    const shoulderGeo = new THREE.SphereGeometry(0.14, 20, 20);
    const leftShoulder = new THREE.Mesh(shoulderGeo, secondaryMat);
    leftShoulder.position.set(-0.42, 0.1, 0);
    torsoGroup.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeo, secondaryMat);
    rightShoulder.position.set(0.42, 0.1, 0);
    torsoGroup.add(rightShoulder);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.18, 20);
    const neckMesh = new THREE.Mesh(neckGeo, secondaryMat);
    neckMesh.position.set(0, 0.34, 0);
    torsoGroup.add(neckMesh);

    // 2. Articulated Head & Visor Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.56, 0.02);
    torsoGroup.add(headGroup);

    const skullGeo = new THREE.SphereGeometry(0.36, 32, 32);
    const skullMesh = new THREE.Mesh(skullGeo, primaryMat);
    skullMesh.scale.set(1.04, 0.96, 0.92);
    headGroup.add(skullMesh);

    // Visor / Face Screen
    const visorGeo = new THREE.SphereGeometry(0.345, 32, 24, 0, Math.PI * 0.82, Math.PI * 0.2, Math.PI * 0.58);
    const visorMesh = new THREE.Mesh(visorGeo, faceMat);
    visorMesh.rotation.y = -Math.PI * 0.41 + Math.PI / 2;
    visorMesh.position.set(0, -0.01, 0.035);
    headGroup.add(visorMesh);

    // Expressive LED Eyes
    const eyeGeo = new THREE.CapsuleGeometry(0.042, 0.055, 8, 16);
    const eyeLeft = new THREE.Mesh(eyeGeo, accentMat);
    eyeLeft.position.set(-0.125, 0.02, 0.34);
    headGroup.add(eyeLeft);

    const eyeRight = new THREE.Mesh(eyeGeo, accentMat);
    eyeRight.position.set(0.125, 0.02, 0.34);
    headGroup.add(eyeRight);

    // Blush Cheeks
    const blushGeo = new THREE.CircleGeometry(0.045, 16);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.18, -0.05, 0.33);
    blushL.rotation.y = -0.35;
    headGroup.add(blushL);

    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(0.18, -0.05, 0.33);
    blushR.rotation.y = 0.35;
    headGroup.add(blushR);

    // Reactive Lip-Sync Mouth
    const mouthGeo = new THREE.CapsuleGeometry(0.018, 0.05, 8, 12);
    const mouthMesh = new THREE.Mesh(mouthGeo, accentMat);
    mouthMesh.rotation.z = Math.PI / 2;
    mouthMesh.position.set(0, -0.1, 0.345);
    headGroup.add(mouthMesh);

    // 3. Articulated Cyber Ears / Twin-Tail Fins
    const earGeo = new THREE.ConeGeometry(0.11, 0.36, 16);
    const earLeftGroup = new THREE.Group();
    earLeftGroup.position.set(-0.28, 0.26, -0.02);
    earLeftGroup.rotation.z = 0.42;
    const earLeftMesh = new THREE.Mesh(earGeo, secondaryMat);
    earLeftMesh.position.y = 0.14;
    earLeftGroup.add(earLeftMesh);
    headGroup.add(earLeftGroup);

    const earRightGroup = new THREE.Group();
    earRightGroup.position.set(0.28, 0.26, -0.02);
    earRightGroup.rotation.z = -0.42;
    const earRightMesh = new THREE.Mesh(earGeo, secondaryMat);
    earRightMesh.position.y = 0.14;
    earRightGroup.add(earRightMesh);
    headGroup.add(earRightGroup);

    // 4. Floating Halo Crown
    const haloGeo = new THREE.TorusGeometry(0.26, 0.016, 12, 48);
    const haloMesh = new THREE.Mesh(haloGeo, accentMat);
    haloMesh.rotation.x = Math.PI / 2.1;
    haloMesh.position.set(0, 0.45, -0.04);
    headGroup.add(haloMesh);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.rootGroup = rootGroup;
    this.torsoGroup = torsoGroup;
    this.headGroup = headGroup;
    this.eyeLeftMesh = eyeLeft;
    this.eyeRightMesh = eyeRight;
    this.blushLeftMesh = blushL;
    this.blushRightMesh = blushR;
    this.mouthMesh = mouthMesh;
    this.earLeftGroup = earLeftGroup;
    this.earRightGroup = earRightGroup;
    this.haloMesh = haloMesh;
  }

  context(): WebGL2RenderingContext | null {
    return (this.renderer?.getContext() as WebGL2RenderingContext) || null;
  }

  async load(): Promise<{ name: string; expressions: BodyExpression[] }> {
    const expressions: BodyExpression[] = [
      { id: 'smile', label: 'Smile' },
      { id: 'shy', label: 'Shy' },
      { id: 'angry', label: 'Angry' },
      { id: 'sad', label: 'Sad' },
    ];
    return {
      name: `${this.preset.toUpperCase()} 3D`,
      expressions,
    };
  }

  render(canvas: HTMLCanvasElement, pose: Pose, w: number, h: number, dt: number): void {
    if (!this.renderer || !this.scene || !this.camera || !this.headGroup || !this.torsoGroup || !this.rootGroup) {
      return;
    }
    this.elapsed += Math.min(0.1, dt || 0.016);

    if (canvas.width !== w || canvas.height !== h) {
      this.renderer.setSize(w, h, false);
    }
    this.camera.aspect = Math.max(0.2, w / Math.max(1, h));
    this.camera.updateProjectionMatrix();

    const P = pose.params;
    const expr = pose.expr || {};

    // Apply view/move offset and scale
    const s = Math.max(0.4, pose.move?.s || 1);
    this.rootGroup.scale.setScalar(s);
    this.rootGroup.position.x = (pose.move?.x || 0) * 1.1;
    this.rootGroup.position.y = (pose.move?.y || 0) * 1.1;

    // Breathing and body sway
    const breathOffset = (P.breath || 0) * 0.03;
    this.torsoGroup.position.y = -0.35 + breathOffset;
    this.torsoGroup.rotation.y = THREE.MathUtils.degToRad((P.bodyX || 0) * 1.2);
    this.torsoGroup.rotation.x = THREE.MathUtils.degToRad(-(P.angleY || 0) * 0.35);
    this.torsoGroup.rotation.z = THREE.MathUtils.degToRad(-(P.bodyZ || 0) * 0.8);

    // Head tracking & rotation
    this.headGroup.rotation.y = THREE.MathUtils.degToRad((P.angleX || 0) * 1.1);
    this.headGroup.rotation.x = THREE.MathUtils.degToRad(-(P.angleY || 0) * 0.9);
    this.headGroup.rotation.z = THREE.MathUtils.degToRad(-(P.angleZ || 0) * 1.0);

    // Ear & Halo secondary spring physics
    if (this.earLeftGroup && this.earRightGroup) {
      const sway =
        Math.sin(this.elapsed * 3.2) * 0.06 -
        THREE.MathUtils.degToRad((P.angleZ || 0) * 0.4);
      this.earLeftGroup.rotation.z = 0.42 + sway;
      this.earRightGroup.rotation.z = -0.42 + sway;
    }
    if (this.haloMesh) {
      this.haloMesh.position.y = 0.45 + Math.sin(this.elapsed * 2.4) * 0.025;
      this.haloMesh.rotation.z = this.elapsed * 0.6;
    }

    // Eye blinking & gaze
    if (this.eyeLeftMesh && this.eyeRightMesh) {
      const openL = Math.max(0.08, Math.min(1.2, P.eyeLOpen ?? 1));
      const openR = Math.max(0.08, Math.min(1.2, P.eyeROpen ?? 1));
      const gazeX = (P.eyeBallX || 0) * 0.028;
      const gazeY = (P.eyeBallY || 0) * 0.022;

      this.eyeLeftMesh.scale.y = openL;
      this.eyeRightMesh.scale.y = openR;
      this.eyeLeftMesh.position.set(-0.125 + gazeX, 0.02 + gazeY, 0.34);
      this.eyeRightMesh.position.set(0.125 + gazeX, 0.02 + gazeY, 0.34);

      const angryWeight = expr.angry || 0;
      const sadWeight = expr.sad || 0;
      const shyWeight = expr.shy || 0;
      const targetEyeRot = -angryWeight * 0.36 + sadWeight * 0.28 + shyWeight * 0.14;
      const lerpFactor = Math.min(1, (dt || 0.016) * 10);
      this.eyeLeftMesh.rotation.z = THREE.MathUtils.lerp(
        this.eyeLeftMesh.rotation.z,
        targetEyeRot,
        lerpFactor
      );
      this.eyeRightMesh.rotation.z = THREE.MathUtils.lerp(
        this.eyeRightMesh.rotation.z,
        -targetEyeRot,
        lerpFactor
      );
    }

    // Smoothly interpolated Shy / Smile Blush
    if (this.blushLeftMesh && this.blushRightMesh) {
      const shyW = Math.max(
        expr.shy || 0,
        (expr.smile || 0) * 0.45,
        (P.browLY || 0) > 0.4 ? 0.35 : 0
      );
      const targetOpacity = Math.min(0.68, shyW * 0.68);
      const mat = this.blushLeftMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        targetOpacity,
        Math.min(1, (dt || 0.016) * 8)
      );
    }

    // Lip-sync mouth open + smooth smile width interpolation
    if (this.mouthMesh) {
      const mouthOpen = Math.max(0, Math.min(1, P.mouthOpen || 0));
      const smileW = Math.max(expr.smile || 0, P.smile > 0 ? P.smile * 0.5 : 0);
      const targetScaleX = 1 + mouthOpen * 2.6;
      const targetScaleY = 1 + smileW * 0.42;
      const mouthLerp = Math.min(1, (dt || 0.016) * 14);
      this.mouthMesh.scale.x = THREE.MathUtils.lerp(
        this.mouthMesh.scale.x,
        targetScaleX,
        mouthLerp
      );
      this.mouthMesh.scale.y = THREE.MathUtils.lerp(
        this.mouthMesh.scale.y,
        targetScaleY,
        mouthLerp
      );
    }

    // Smooth expression color interpolation on accent material
    if (this.accentMat) {
      const palette = PRESET_PALETTES[this.preset] || PRESET_PALETTES.nova;
      const targetColor = new THREE.Color(palette.emissive);
      if ((expr.angry || 0) > 0.15) {
        targetColor.lerp(new THREE.Color(0xef4444), Math.min(1, expr.angry || 0));
      } else if ((expr.shy || 0) > 0.15) {
        targetColor.lerp(new THREE.Color(0xf472b6), Math.min(1, expr.shy || 0));
      } else if ((expr.sad || 0) > 0.15) {
        targetColor.lerp(new THREE.Color(0x60a5fa), Math.min(1, expr.sad || 0));
      } else if ((expr.smile || 0) > 0.15) {
        targetColor.lerp(new THREE.Color(0x34d399), Math.min(0.65, (expr.smile || 0) * 0.65));
      }
      this.accentMat.emissive.lerp(targetColor, Math.min(1, (dt || 0.016) * 7));
    }

    this.renderer.render(this.scene, this.camera);
  }

  head(): { x: number; y: number; rx: number; ry: number } {
    return { x: 0.5, y: 0.34, rx: 0.18, ry: 0.2 };
  }

  dispose(): void {
    if (this.scene) {
      this.scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    }
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
  }
}
