export type PhysicsPresetId = 'projectile' | 'pendulum' | 'spring' | 'wave' | 'orbital';

export interface Vector2 {
  x: number;
  y: number;
}

export const vec2 = {
  add: (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (a: Vector2, s: number): Vector2 => ({ x: a.x * s, y: a.y * s }),
  mag: (a: Vector2): number => Math.hypot(a.x, a.y),
  dot: (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y,
  dist: (a: Vector2, b: Vector2): number => Math.hypot(a.x - b.x, a.y - b.y),
  normalize: (a: Vector2): Vector2 => {
    const m = Math.hypot(a.x, a.y);
    return m > 1e-9 ? { x: a.x / m, y: a.y / m } : { x: 0, y: 0 };
  },
};

export interface PhysicsParamSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface PhysicsPresetDefinition {
  id: PhysicsPresetId;
  title: string;
  formula: string;
  description: string;
  params: PhysicsParamSpec[];
}

export const PHYSICS_PRESETS: Record<PhysicsPresetId, PhysicsPresetDefinition> = {
  projectile: {
    id: 'projectile',
    title: 'Projectile Motion & Air Drag',
    formula: 'a = g − (c_d / m) · |v| v',
    description: '2D kinematics with configurable gravity, launch angle, initial speed, and quadratic drag.',
    params: [
      { key: 'speed', label: 'Launch Speed', unit: 'm/s', min: 5, max: 45, step: 1, defaultValue: 24 },
      { key: 'angle', label: 'Launch Angle', unit: '°', min: 5, max: 85, step: 1, defaultValue: 48 },
      { key: 'gravity', label: 'Gravity (g)', unit: 'm/s²', min: 1.6, max: 25, step: 0.1, defaultValue: 9.8 },
      { key: 'drag', label: 'Air Drag', unit: 'kg/m', min: 0, max: 0.08, step: 0.005, defaultValue: 0.01 },
    ],
  },
  pendulum: {
    id: 'pendulum',
    title: 'Simple & Damped Pendulum',
    formula: 'α = −(g / L) sin(θ) − ζ ω',
    description: 'Nonlinear rotational oscillator tracking angular displacement, period T ≈ 2π√(L/g), and energy.',
    params: [
      { key: 'length', label: 'Rod Length (L)', unit: 'm', min: 0.5, max: 4.0, step: 0.1, defaultValue: 2.0 },
      { key: 'angle0', label: 'Release Angle', unit: '°', min: 10, max: 145, step: 1, defaultValue: 65 },
      { key: 'gravity', label: 'Gravity (g)', unit: 'm/s²', min: 1.6, max: 25, step: 0.1, defaultValue: 9.8 },
      { key: 'damping', label: 'Damping (ζ)', unit: '1/s', min: 0, max: 0.6, step: 0.02, defaultValue: 0.04 },
    ],
  },
  spring: {
    id: 'spring',
    title: "Hooke's Law Spring-Mass",
    formula: 'F = −k · x − b · v',
    description: 'Harmonic oscillator showing restoring force vectors, natural frequency ω₀ = √(k/m), and damping.',
    params: [
      { key: 'stiffness', label: 'Stiffness (k)', unit: 'N/m', min: 5, max: 80, step: 1, defaultValue: 28 },
      { key: 'mass', label: 'Mass (m)', unit: 'kg', min: 0.5, max: 8.0, step: 0.1, defaultValue: 2.0 },
      { key: 'displacement', label: 'Initial Pull', unit: 'm', min: 0.2, max: 2.5, step: 0.1, defaultValue: 1.6 },
      { key: 'damping', label: 'Friction (b)', unit: 'N·s/m', min: 0, max: 4.0, step: 0.1, defaultValue: 0.3 },
    ],
  },
  wave: {
    id: 'wave',
    title: 'Wave Superposition & Beats',
    formula: 'y(x,t) = A₁ sin(k₁x − ω₁t) + A₂ sin(k₂x ± ω₂t)',
    description: 'Interference of two traveling waves showing constructive nodes, antinodes, and beat envelopes.',
    params: [
      { key: 'freq1', label: 'Source 1 Freq', unit: 'Hz', min: 0.5, max: 5.0, step: 0.1, defaultValue: 2.0 },
      { key: 'freq2', label: 'Source 2 Freq', unit: 'Hz', min: 0.5, max: 5.0, step: 0.1, defaultValue: 2.4 },
      { key: 'amp1', label: 'Amplitude 1', unit: 'm', min: 0.2, max: 1.5, step: 0.1, defaultValue: 1.0 },
      { key: 'counter', label: 'Counter-Propagate', unit: 'dir', min: -1, max: 1, step: 2, defaultValue: 1 },
    ],
  },
  orbital: {
    id: 'orbital',
    title: 'Kepler Central-Force Orbit',
    formula: 'F_g = −(G M m / r³) · r_vec',
    description: 'Two-body Newtonian gravitation illustrating elliptical vs circular orbits and conservation of energy.',
    params: [
      { key: 'mu', label: 'Central GM', unit: '×10⁴', min: 1.0, max: 8.0, step: 0.2, defaultValue: 3.6 },
      { key: 'speed', label: 'Orbital Speed', unit: 'u/s', min: 6, max: 28, step: 0.5, defaultValue: 15.5 },
      { key: 'radius', label: 'Periapsis Dist', unit: 'u', min: 70, max: 170, step: 5, defaultValue: 115 },
      { key: 'mass', label: 'Satellite Mass', unit: 'kg', min: 1, max: 10, step: 0.5, defaultValue: 2 },
    ],
  },
};

export interface PhysicsSimulationState {
  preset: PhysicsPresetId;
  time: number;
  paused: boolean;
  pos: Vector2; // World coordinates
  vel: Vector2;
  acc: Vector2;
  angle: number; // radians for pendulum
  angularVel: number;
  trail: Vector2[];
  maxHeight: number;
  maxRange: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  history: Array<{ t: number; ke: number; pe: number; disp: number }>;
}

export function getDefaultPresetParams(preset: PhysicsPresetId): Record<string, number> {
  const def = PHYSICS_PRESETS[preset];
  const out: Record<string, number> = {};
  for (const p of def.params) {
    out[p.key] = p.defaultValue;
  }
  return out;
}

export function createInitialPhysicsState(
  preset: PhysicsPresetId,
  params: Record<string, number>
): PhysicsSimulationState {
  if (preset === 'projectile') {
    const speed = params.speed ?? 24;
    const angleRad = ((params.angle ?? 48) * Math.PI) / 180;
    const vx = speed * Math.cos(angleRad);
    const vy = speed * Math.sin(angleRad);
    const ke = 0.5 * 1 * (vx * vx + vy * vy);
    return {
      preset,
      time: 0,
      paused: false,
      pos: { x: 0, y: 0 },
      vel: { x: vx, y: vy },
      acc: { x: 0, y: -(params.gravity ?? 9.8) },
      angle: angleRad,
      angularVel: 0,
      trail: [{ x: 0, y: 0 }],
      maxHeight: 0,
      maxRange: 0,
      kineticEnergy: ke,
      potentialEnergy: 0,
      totalEnergy: ke,
      history: [{ t: 0, ke, pe: 0, disp: 0 }],
    };
  }

  if (preset === 'pendulum') {
    const L = params.length ?? 2.0;
    const g = params.gravity ?? 9.8;
    const theta0 = ((params.angle0 ?? 65) * Math.PI) / 180;
    const x = L * Math.sin(theta0);
    const y = -L * Math.cos(theta0);
    const pe = Math.max(0, 1 * g * (L + y));
    return {
      preset,
      time: 0,
      paused: false,
      pos: { x, y },
      vel: { x: 0, y: 0 },
      acc: { x: 0, y: 0 },
      angle: theta0,
      angularVel: 0,
      trail: [{ x, y }],
      maxHeight: L + y,
      maxRange: Math.abs(x),
      kineticEnergy: 0,
      potentialEnergy: pe,
      totalEnergy: pe,
      history: [{ t: 0, ke: 0, pe, disp: theta0 }],
    };
  }

  if (preset === 'spring') {
    const x0 = params.displacement ?? 1.6;
    const k = params.stiffness ?? 28;
    const m = params.mass ?? 2.0;
    const pe = 0.5 * k * x0 * x0;
    return {
      preset,
      time: 0,
      paused: false,
      pos: { x: x0, y: 0 },
      vel: { x: 0, y: 0 },
      acc: { x: (-k * x0) / m, y: 0 },
      angle: 0,
      angularVel: 0,
      trail: [{ x: 0, y: x0 }],
      maxHeight: x0,
      maxRange: x0,
      kineticEnergy: 0,
      potentialEnergy: pe,
      totalEnergy: pe,
      history: [{ t: 0, ke: 0, pe, disp: x0 }],
    };
  }

  if (preset === 'orbital') {
    const r0 = params.radius ?? 115;
    const v0 = params.speed ?? 15.5;
    const mu = (params.mu ?? 3.6) * 10000;
    const satMass = params.mass ?? 2;
    const ke = 0.5 * satMass * v0 * v0;
    const pe = -(mu * satMass) / Math.max(20, r0);
    return {
      preset,
      time: 0,
      paused: false,
      pos: { x: r0, y: 0 },
      vel: { x: 0, y: v0 },
      acc: { x: -mu / (r0 * r0), y: 0 },
      angle: 0,
      angularVel: v0 / r0,
      trail: [{ x: r0, y: 0 }],
      maxHeight: r0,
      maxRange: r0,
      kineticEnergy: ke,
      potentialEnergy: pe,
      totalEnergy: ke + pe,
      history: [{ t: 0, ke, pe, disp: r0 }],
    };
  }

  // Wave preset
  return {
    preset: 'wave',
    time: 0,
    paused: false,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    acc: { x: 0, y: 0 },
    angle: 0,
    angularVel: 0,
    trail: [],
    maxHeight: params.amp1 ?? 1.0,
    maxRange: 10,
    kineticEnergy: 0.5 * (params.amp1 ?? 1.0) ** 2,
    potentialEnergy: 0.5 * (params.amp1 ?? 1.0) ** 2,
    totalEnergy: (params.amp1 ?? 1.0) ** 2,
    history: [{ t: 0, ke: 0.5, pe: 0.5, disp: 0 }],
  };
}

export function stepPhysicsState(
  prev: PhysicsSimulationState,
  dtRaw: number,
  params: Record<string, number>
): PhysicsSimulationState {
  if (prev.paused) return prev;
  const dt = Math.min(0.035, Math.max(0.001, dtRaw));
  const nextTime = prev.time + dt;

  if (prev.preset === 'projectile') {
    if (prev.pos.y <= 0 && prev.time > 0.04 && prev.vel.y < 0) {
      return { ...prev, paused: true };
    }
    const g = params.gravity ?? 9.8;
    const drag = params.drag ?? 0.01;
    const speedMag = vec2.mag(prev.vel);
    const ax = -drag * speedMag * prev.vel.x;
    const ay = -g - drag * speedMag * prev.vel.y;

    const vx = prev.vel.x + ax * dt;
    const vy = prev.vel.y + ay * dt;
    let nx = prev.pos.x + vx * dt;
    let ny = prev.pos.y + vy * dt;

    let hitGround = false;
    if (ny < 0 && nextTime > 0.03) {
      ny = 0;
      hitGround = true;
    }

    const ke = 0.5 * (vx * vx + vy * vy);
    const pe = Math.max(0, g * ny);
    const trail =
      prev.trail.length > 260 ? [...prev.trail.slice(1), { x: nx, y: ny }] : [...prev.trail, { x: nx, y: ny }];
    const history =
      prev.history.length > 120
        ? [...prev.history.slice(1), { t: nextTime, ke, pe, disp: ny }]
        : [...prev.history, { t: nextTime, ke, pe, disp: ny }];

    return {
      ...prev,
      time: nextTime,
      paused: hitGround,
      pos: { x: nx, y: ny },
      vel: { x: vx, y: vy },
      acc: { x: ax, y: ay },
      trail,
      maxHeight: Math.max(prev.maxHeight, ny),
      maxRange: Math.max(prev.maxRange, nx),
      kineticEnergy: ke,
      potentialEnergy: pe,
      totalEnergy: ke + pe,
      history,
    };
  }

  if (prev.preset === 'pendulum') {
    const L = Math.max(0.2, params.length ?? 2.0);
    const g = params.gravity ?? 9.8;
    const damping = params.damping ?? 0.04;
    const subSteps = 4;
    const h = dt / subSteps;
    let theta = prev.angle;
    let omega = prev.angularVel;
    let alpha = 0;

    for (let i = 0; i < subSteps; i++) {
      alpha = -(g / L) * Math.sin(theta) - damping * omega;
      omega += alpha * h;
      theta += omega * h;
    }

    const x = L * Math.sin(theta);
    const y = -L * Math.cos(theta);
    const speed = L * omega;
    const ke = 0.5 * speed * speed;
    const pe = Math.max(0, g * (L + y));
    const trail =
      prev.trail.length > 180 ? [...prev.trail.slice(1), { x, y }] : [...prev.trail, { x, y }];
    const history =
      prev.history.length > 120
        ? [...prev.history.slice(1), { t: nextTime, ke, pe, disp: theta }]
        : [...prev.history, { t: nextTime, ke, pe, disp: theta }];

    return {
      ...prev,
      time: nextTime,
      pos: { x, y },
      vel: { x: speed * Math.cos(theta), y: speed * Math.sin(theta) },
      acc: { x: alpha * L, y: 0 },
      angle: theta,
      angularVel: omega,
      trail,
      maxHeight: Math.max(prev.maxHeight, L + y),
      maxRange: Math.max(prev.maxRange, Math.abs(x)),
      kineticEnergy: ke,
      potentialEnergy: pe,
      totalEnergy: ke + pe,
      history,
    };
  }

  if (prev.preset === 'spring') {
    const k = params.stiffness ?? 28;
    const m = Math.max(0.2, params.mass ?? 2.0);
    const b = params.damping ?? 0.3;
    const subSteps = 4;
    const h = dt / subSteps;
    let x = prev.pos.x;
    let vx = prev.vel.x;
    let ax = 0;

    for (let i = 0; i < subSteps; i++) {
      ax = (-k * x - b * vx) / m;
      vx += ax * h;
      x += vx * h;
    }

    const ke = 0.5 * m * vx * vx;
    const pe = 0.5 * k * x * x;
    const trail =
      prev.trail.length > 220
        ? [...prev.trail.slice(1), { x: nextTime, y: x }]
        : [...prev.trail, { x: nextTime, y: x }];
    const history =
      prev.history.length > 120
        ? [...prev.history.slice(1), { t: nextTime, ke, pe, disp: x }]
        : [...prev.history, { t: nextTime, ke, pe, disp: x }];

    return {
      ...prev,
      time: nextTime,
      pos: { x, y: 0 },
      vel: { x: vx, y: 0 },
      acc: { x: ax, y: 0 },
      trail,
      maxHeight: Math.max(prev.maxHeight, Math.abs(x)),
      maxRange: Math.max(prev.maxRange, Math.abs(vx)),
      kineticEnergy: ke,
      potentialEnergy: pe,
      totalEnergy: ke + pe,
      history,
    };
  }

  if (prev.preset === 'orbital') {
    const mu = (params.mu ?? 3.6) * 10000;
    const satMass = params.mass ?? 2;
    const subSteps = 6;
    const h = dt / subSteps;
    let px = prev.pos.x;
    let py = prev.pos.y;
    let vx = prev.vel.x;
    let vy = prev.vel.y;
    let ax = 0;
    let ay = 0;

    for (let i = 0; i < subSteps; i++) {
      const r2 = Math.max(400, px * px + py * py);
      const r = Math.sqrt(r2);
      const aMag = -mu / r2;
      ax = (aMag * px) / r;
      ay = (aMag * py) / r;
      vx += ax * h;
      vy += ay * h;
      px += vx * h;
      py += vy * h;
    }

    const r = Math.hypot(px, py);
    const v2 = vx * vx + vy * vy;
    const ke = 0.5 * satMass * v2;
    const pe = -(mu * satMass) / Math.max(20, r);
    const trail =
      prev.trail.length > 340 ? [...prev.trail.slice(1), { x: px, y: py }] : [...prev.trail, { x: px, y: py }];
    const history =
      prev.history.length > 120
        ? [...prev.history.slice(1), { t: nextTime, ke, pe: Math.abs(pe), disp: r }]
        : [...prev.history, { t: nextTime, ke, pe: Math.abs(pe), disp: r }];

    return {
      ...prev,
      time: nextTime,
      pos: { x: px, y: py },
      vel: { x: vx, y: vy },
      acc: { x: ax, y: ay },
      trail,
      maxHeight: Math.max(prev.maxHeight, r),
      maxRange: Math.min(prev.maxRange, r),
      kineticEnergy: ke,
      potentialEnergy: pe,
      totalEnergy: ke + pe,
      history,
    };
  }

  // Wave
  const amp1 = params.amp1 ?? 1.0;
  const f1 = params.freq1 ?? 2.0;
  const f2 = params.freq2 ?? 2.4;
  const dir = params.counter ?? 1;
  const phase = 2 * Math.PI * f1 * nextTime;
  const ySample = amp1 * Math.sin(phase) + amp1 * 0.85 * Math.sin(2 * Math.PI * f2 * nextTime * dir);
  const ke = 0.5 * Math.pow(ySample, 2);
  const pe = 0.5 * Math.pow(amp1 * 1.85 - Math.abs(ySample), 2);
  return {
    ...prev,
    time: nextTime,
    pos: { x: nextTime, y: ySample },
    kineticEnergy: ke,
    potentialEnergy: pe,
    totalEnergy: ke + pe,
    history:
      prev.history.length > 120
        ? [...prev.history.slice(1), { t: nextTime, ke, pe, disp: ySample }]
        : [...prev.history, { t: nextTime, ke, pe, disp: ySample }],
  };
}

export function detectPhysicsPresetFromTopic(topic: string): PhysicsPresetId {
  const lower = String(topic || '').toLowerCase();
  if (/\b(pendulum|oscillat|harmonic|swing|moment of inertia)\b/.test(lower)) return 'pendulum';
  if (/\b(spring|hooke|elastic|stiffness|shm|simple harmonic)\b/.test(lower)) return 'spring';
  if (/\b(wave|interfer|frequency|doppler|standing|optics|acoustic|sound|light)\b/.test(lower)) return 'wave';
  if (/\b(orbit|kepler|gravity|black hole|planet|satellite|celestial|astro|gravitation)\b/.test(lower)) {
    return 'orbital';
  }
  return 'projectile';
}

// Safe recursive-descent multi-variable math evaluator (no eval/Function)
export function evaluateSafeFormula(
  expr: string,
  vars: Record<string, number> = {}
): number | null {
  if (!expr || typeof expr !== 'string' || expr.length > 320) return null;
  const clean = expr.replace(/\s+/g, '');
  if (!clean) return null;

  let idx = 0;
  const peek = () => clean[idx] || '';
  const consume = () => clean[idx++] || '';

  const parsePrimary = (): number => {
    const ch = peek();
    if (ch === '(') {
      consume();
      const val = parseExpression();
      if (peek() !== ')') return NaN;
      consume();
      return val;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let numStr = '';
      while ((peek() >= '0' && peek() <= '9') || peek() === '.') {
        numStr += consume();
      }
      // Optional scientific notation like 1e-3 or 2.5e4
      if ((peek() === 'e' || peek() === 'E') && /[0-9+\-]/.test(clean[idx + 1] || '')) {
        numStr += consume();
        if (peek() === '+' || peek() === '-') numStr += consume();
        while (peek() >= '0' && peek() <= '9') {
          numStr += consume();
        }
      }
      const parsed = parseFloat(numStr);
      return Number.isFinite(parsed) ? parsed : NaN;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = '';
      while (
        (peek() >= 'a' && peek() <= 'z') ||
        (peek() >= 'A' && peek() <= 'Z') ||
        (peek() >= '0' && peek() <= '9') ||
        peek() === '_'
      ) {
        ident += consume();
      }

      if (peek() === '(') {
        consume();
        const args: number[] = [];
        if (peek() !== ')') {
          args.push(parseExpression());
          while (peek() === ',') {
            consume();
            args.push(parseExpression());
          }
        }
        if (peek() !== ')') return NaN;
        consume();

        const fn = ident.toLowerCase();
        const a = args[0];
        const b = args[1];
        if (fn === 'sin' && args.length === 1) return Math.sin(a);
        if (fn === 'cos' && args.length === 1) return Math.cos(a);
        if (fn === 'tan' && args.length === 1) return Math.tan(a);
        if (fn === 'sqrt' && args.length === 1) return a >= 0 ? Math.sqrt(a) : NaN;
        if (fn === 'abs' && args.length === 1) return Math.abs(a);
        if (fn === 'exp' && args.length === 1) return Math.exp(Math.max(-30, Math.min(30, a)));
        if (fn === 'log' && args.length === 1) return a > 0 ? Math.log10(a) : NaN;
        if (fn === 'ln' && args.length === 1) return a > 0 ? Math.log(a) : NaN;
        if (fn === 'sign' && args.length === 1) return Math.sign(a);
        if (fn === 'floor' && args.length === 1) return Math.floor(a);
        if (fn === 'ceil' && args.length === 1) return Math.ceil(a);
        if (fn === 'min' && args.length === 2) return Math.min(a, b);
        if (fn === 'max' && args.length === 2) return Math.max(a, b);
        if (fn === 'pow' && args.length === 2) return Math.pow(a, b);
        if (fn === 'atan2' && args.length === 2) return Math.atan2(a, b);
        if (fn === 'hypot' && args.length === 2) return Math.hypot(a, b);
        return NaN;
      }

      if (Object.prototype.hasOwnProperty.call(vars, ident)) {
        return vars[ident];
      }
      const low = ident.toLowerCase();
      if (low === 'pi') return Math.PI;
      if (low === 'e') return Math.E;
      if (Object.prototype.hasOwnProperty.call(vars, low)) {
        return vars[low];
      }
      return NaN;
    }

    return NaN;
  };

  const parsePower = (): number => {
    const base = parsePrimary();
    if (peek() === '^') {
      consume();
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  };

  const parseUnary = (): number => {
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    return parsePower();
  };

  const parseTerm = (): number => {
    let val = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseUnary();
      val = op === '*' ? val * right : right !== 0 ? val / right : NaN;
    }
    return val;
  };

  const parseExpression = (): number => {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  };

  const result = parseExpression();
  if (idx !== clean.length || !Number.isFinite(result) || Math.abs(result) > 1e7) {
    return null;
  }
  return result;
}

export function evaluateMathExpression(expr: string, xVal: number): number | null {
  const res = evaluateSafeFormula(expr, { x: xVal });
  if (res === null || Math.abs(res) > 1e6) return null;
  return res;
}

export type CustomSimRenderStyle = 'particle' | 'orbit' | 'pendulum_rod' | 'spring_block' | 'incline';

export interface CustomPhysicsSimSpec {
  id: string;
  title: string;
  formula: string;
  description: string;
  renderStyle: CustomSimRenderStyle;
  params: PhysicsParamSpec[];
  initial: { x: string; y: string; vx: string; vy: string };
  axExpr: string;
  ayExpr: string;
  peExpr?: string;
  keExpr?: string;
  floorY?: number | null;
  restitution?: number;
  inclineAngleDeg?: number;
  scaleHint?: number;
}

export interface CustomPhysicsSimState {
  specId: string;
  time: number;
  paused: boolean;
  pos: Vector2;
  vel: Vector2;
  acc: Vector2;
  trail: Vector2[];
  maxHeight: number;
  maxRange: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  history: Array<{ t: number; ke: number; pe: number; disp: number }>;
}

export function sanitizeCustomPhysicsSpec(raw: any, fallbackTitle = 'Custom Physics Simulation'): CustomPhysicsSimSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawParams = Array.isArray(raw.params) ? raw.params.slice(0, 4) : [];
  const params: PhysicsParamSpec[] = [];
  const usedKeys = new Set<string>(['x', 'y', 'vx', 'vy', 'r', 'v', 't', 'pi', 'e']);

  for (let i = 0; i < rawParams.length; i++) {
    const p = rawParams[i];
    if (!p || typeof p !== 'object') continue;
    let key = String(p.key || `p${i + 1}`)
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 16);
    if (!key || /^[0-9]/.test(key) || usedKeys.has(key)) {
      key = `p${i + 1}`;
    }
    usedKeys.add(key);

    const min = Number.isFinite(Number(p.min)) ? Number(p.min) : 0;
    const maxRaw = Number.isFinite(Number(p.max)) ? Number(p.max) : min + 10;
    const max = maxRaw > min ? maxRaw : min + 10;
    const defRaw = Number.isFinite(Number(p.defaultValue)) ? Number(p.defaultValue) : (min + max) / 2;
    const defaultValue = Math.max(min, Math.min(max, defRaw));
    const stepRaw = Number(p.step);
    const step = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : Number(((max - min) / 40).toPrecision(2)) || 0.1;

    params.push({
      key,
      label: String(p.label || key).trim().slice(0, 28),
      unit: String(p.unit || '').trim().slice(0, 12),
      min,
      max,
      step,
      defaultValue,
    });
  }

  if (params.length === 0) {
    params.push({
      key: 'g',
      label: 'Gravity (g)',
      unit: 'm/s²',
      min: 1,
      max: 25,
      step: 0.2,
      defaultValue: 9.8,
    });
  }

  const paramVars: Record<string, number> = {};
  for (const p of params) paramVars[p.key] = p.defaultValue;

  const initObj = raw.initial && typeof raw.initial === 'object' ? raw.initial : {};
  const initX = String(initObj.x ?? '0').slice(0, 120);
  const initY = String(initObj.y ?? '0').slice(0, 120);
  const initVx = String(initObj.vx ?? '0').slice(0, 120);
  const initVy = String(initObj.vy ?? '0').slice(0, 120);

  const x0 = evaluateSafeFormula(initX, paramVars);
  const y0 = evaluateSafeFormula(initY, paramVars);
  const vx0 = evaluateSafeFormula(initVx, paramVars);
  const vy0 = evaluateSafeFormula(initVy, paramVars);
  if (x0 === null || y0 === null || vx0 === null || vy0 === null) return null;

  const axExpr = String(raw.axExpr ?? '0').trim().slice(0, 240);
  const ayExpr = String(raw.ayExpr ?? '0').trim().slice(0, 240);
  const testVars = {
    ...paramVars,
    x: x0 === 0 ? 0.5 : x0,
    y: y0 === 0 ? 0.5 : y0,
    vx: vx0 === 0 ? 0.5 : vx0,
    vy: vy0 === 0 ? 0.5 : vy0,
    r: Math.max(0.5, Math.hypot(x0, y0)),
    v: Math.max(0.5, Math.hypot(vx0, vy0)),
    t: 0.1,
  };
  const axTest = evaluateSafeFormula(axExpr, testVars);
  const ayTest = evaluateSafeFormula(ayExpr, testVars);
  if (axTest === null || ayTest === null) return null;

  const peExpr = typeof raw.peExpr === 'string' && raw.peExpr.trim() ? raw.peExpr.trim().slice(0, 240) : undefined;
  const validPe = peExpr && evaluateSafeFormula(peExpr, testVars) !== null ? peExpr : undefined;

  const validStyles: CustomSimRenderStyle[] = ['particle', 'orbit', 'pendulum_rod', 'spring_block', 'incline'];
  const renderStyle: CustomSimRenderStyle = validStyles.includes(raw.renderStyle) ? raw.renderStyle : 'particle';

  const floorY =
    raw.floorY === null || raw.floorY === undefined || raw.floorY === ''
      ? null
      : Number.isFinite(Number(raw.floorY))
      ? Number(raw.floorY)
      : null;

  const restitution = Number.isFinite(Number(raw.restitution))
    ? Math.max(0, Math.min(0.98, Number(raw.restitution)))
    : 0;

  const inclineAngleDeg = Number.isFinite(Number(raw.inclineAngleDeg))
    ? Math.max(5, Math.min(75, Number(raw.inclineAngleDeg)))
    : undefined;

  const scaleHint = Number.isFinite(Number(raw.scaleHint)) && Number(raw.scaleHint) > 0
    ? Math.max(1, Math.min(500, Number(raw.scaleHint)))
    : undefined;

  return {
    id: String(raw.id || `custom-${Date.now()}`).slice(0, 64),
    title: String(raw.title || fallbackTitle).trim().slice(0, 72) || fallbackTitle,
    formula: String(raw.formula || `a_x = ${axExpr}, a_y = ${ayExpr}`).trim().slice(0, 120),
    description:
      String(raw.description || `Generated 2D physics simulation for ${fallbackTitle}.`).trim().slice(0, 240),
    renderStyle,
    params,
    initial: { x: initX, y: initY, vx: initVx, vy: initVy },
    axExpr,
    ayExpr,
    peExpr: validPe,
    floorY,
    restitution,
    inclineAngleDeg,
    scaleHint,
  };
}

export function getDefaultCustomParams(spec: CustomPhysicsSimSpec): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of spec.params) out[p.key] = p.defaultValue;
  return out;
}

export function createInitialCustomPhysicsState(
  spec: CustomPhysicsSimSpec,
  params: Record<string, number>
): CustomPhysicsSimState {
  const pVars = { ...getDefaultCustomParams(spec), ...params };
  const x = evaluateSafeFormula(spec.initial.x, pVars) ?? 0;
  const y = evaluateSafeFormula(spec.initial.y, pVars) ?? 0;
  const vx = evaluateSafeFormula(spec.initial.vx, pVars) ?? 0;
  const vy = evaluateSafeFormula(spec.initial.vy, pVars) ?? 0;

  const vars = {
    ...pVars,
    x,
    y,
    vx,
    vy,
    r: Math.hypot(x, y),
    v: Math.hypot(vx, vy),
    t: 0,
  };
  const ax = evaluateSafeFormula(spec.axExpr, vars) ?? 0;
  const ay = evaluateSafeFormula(spec.ayExpr, vars) ?? 0;
  const m = Math.max(0.1, pVars.mass ?? pVars.m ?? 1);
  const ke = 0.5 * m * (vx * vx + vy * vy);
  const pe = spec.peExpr ? evaluateSafeFormula(spec.peExpr, vars) ?? 0 : 0;

  return {
    specId: spec.id,
    time: 0,
    paused: false,
    pos: { x, y },
    vel: { x: vx, y: vy },
    acc: { x: ax, y: ay },
    trail: [{ x, y }],
    maxHeight: y,
    maxRange: Math.hypot(x, y),
    kineticEnergy: ke,
    potentialEnergy: pe,
    totalEnergy: ke + pe,
    history: [{ t: 0, ke, pe, disp: Math.hypot(x, y) }],
  };
}

export function stepCustomPhysicsState(
  prev: CustomPhysicsSimState,
  dtRaw: number,
  spec: CustomPhysicsSimSpec,
  params: Record<string, number>
): CustomPhysicsSimState {
  if (prev.paused) return prev;
  const dt = Math.min(0.035, Math.max(0.001, dtRaw));
  const subSteps = 4;
  const h = dt / subSteps;
  const pVars = { ...getDefaultCustomParams(spec), ...params };

  let px = prev.pos.x;
  let py = prev.pos.y;
  let vx = prev.vel.x;
  let vy = prev.vel.y;
  let ax = prev.acc.x;
  let ay = prev.acc.y;
  let t = prev.time;

  for (let i = 0; i < subSteps; i++) {
    t += h;
    const vars = {
      ...pVars,
      x: px,
      y: py,
      vx,
      vy,
      r: Math.hypot(px, py),
      v: Math.hypot(vx, vy),
      t,
    };
    const rawAx = evaluateSafeFormula(spec.axExpr, vars);
    const rawAy = evaluateSafeFormula(spec.ayExpr, vars);
    ax = rawAx !== null ? Math.max(-5000, Math.min(5000, rawAx)) : 0;
    ay = rawAy !== null ? Math.max(-5000, Math.min(5000, rawAy)) : 0;

    vx += ax * h;
    vy += ay * h;
    px += vx * h;
    py += vy * h;

    if (spec.floorY !== null && spec.floorY !== undefined && py <= spec.floorY && vy < 0) {
      py = spec.floorY;
      const e = Math.max(0, Math.min(0.98, spec.restitution ?? 0));
      if (e > 0.02 && Math.abs(vy) > 0.25) {
        vy = -vy * e;
      } else {
        vy = 0;
      }
    }
  }

  const nextVars = {
    ...pVars,
    x: px,
    y: py,
    vx,
    vy,
    r: Math.hypot(px, py),
    v: Math.hypot(vx, vy),
    t,
  };
  const m = Math.max(0.1, pVars.mass ?? pVars.m ?? 1);
  const ke = 0.5 * m * (vx * vx + vy * vy);
  const pe = spec.peExpr ? evaluateSafeFormula(spec.peExpr, nextVars) ?? 0 : 0;

  const trail =
    prev.trail.length > 320 ? [...prev.trail.slice(1), { x: px, y: py }] : [...prev.trail, { x: px, y: py }];
  const history =
    prev.history.length > 120
      ? [...prev.history.slice(1), { t, ke, pe, disp: Math.hypot(px, py) }]
      : [...prev.history, { t, ke, pe, disp: Math.hypot(px, py) }];

  return {
    ...prev,
    time: t,
    pos: { x: px, y: py },
    vel: { x: vx, y: vy },
    acc: { x: ax, y: ay },
    trail,
    maxHeight: Math.max(prev.maxHeight, py),
    maxRange: Math.max(prev.maxRange, Math.hypot(px, py)),
    kineticEnergy: ke,
    potentialEnergy: pe,
    totalEnergy: ke + pe,
    history,
  };
}

export function buildFallbackPhysicsSimulation(prompt: string): CustomPhysicsSimSpec {
  const q = String(prompt || '').trim();
  const lower = q.toLowerCase();

  // 1. Bouncing Ball / Elastic Restitution
  if (/\b(bounc|restitut|rebound|drop|ball)\b/.test(lower)) {
    return {
      id: `sim-bounce-${Date.now()}`,
      title: 'Bouncing Ball with Air Drag & Restitution',
      formula: 'a_y = −g − c·v_y,  v_y′ = −e·v_y (on floor impact)',
      description: '2D inelastic rebound under uniform gravity with horizontal drift and configurable restitution coefficient.',
      renderStyle: 'particle',
      floorY: 0,
      restitution: 0.82,
      scaleHint: 14,
      params: [
        { key: 'h0', label: 'Drop Height', unit: 'm', min: 2, max: 20, step: 0.5, defaultValue: 10 },
        { key: 'vx0', label: 'Forward Speed', unit: 'm/s', min: 0, max: 12, step: 0.5, defaultValue: 3.5 },
        { key: 'g', label: 'Gravity (g)', unit: 'm/s²', min: 1.6, max: 25, step: 0.2, defaultValue: 9.8 },
        { key: 'drag', label: 'Air Drag', unit: '1/s', min: 0, max: 0.4, step: 0.02, defaultValue: 0.04 },
      ],
      initial: { x: '-6', y: 'h0', vx: 'vx0', vy: '0' },
      axExpr: '-drag * vx',
      ayExpr: '-g - drag * vy',
      peExpr: 'g * max(0, y)',
    };
  }

  // 2. Cyclotron / Lorentz Magnetic Field Motion
  if (/\b(cyclotron|magnetic|lorentz|electron|proton|charge|tesla|helix)\b/.test(lower)) {
    return {
      id: `sim-lorentz-${Date.now()}`,
      title: 'Charged Particle in Magnetic Field',
      formula: 'F = q(v × B) + qE  ⇒  a_x = (qB/m)·v_y + E_x, a_y = −(qB/m)·v_x',
      description: 'Circular cyclotron and E×B drift trajectory of a charged particle perpendicular to a uniform magnetic field.',
      renderStyle: 'particle',
      scaleHint: 10,
      params: [
        { key: 'B', label: 'Magnetic Field (B)', unit: 'T', min: 0.4, max: 4.0, step: 0.1, defaultValue: 1.6 },
        { key: 'qm', label: 'Charge/Mass (q/m)', unit: 'C/kg', min: 0.5, max: 3.0, step: 0.1, defaultValue: 1.2 },
        { key: 'v0', label: 'Injection Speed', unit: 'm/s', min: 2, max: 14, step: 0.5, defaultValue: 7.5 },
        { key: 'E', label: 'Electric Drift (E_x)', unit: 'V/m', min: -1.5, max: 1.5, step: 0.1, defaultValue: 0.2 },
      ],
      initial: { x: '0', y: '4', vx: 'v0', vy: '0' },
      axExpr: 'qm * B * vy + qm * E',
      ayExpr: '-qm * B * vx',
      peExpr: '-qm * E * x',
    };
  }

  // 3. Inclined Plane / Ramp Sliding with Friction
  if (/\b(incline|ramp|slope|friction|wedge|slide|sliding)\b/.test(lower)) {
    return {
      id: `sim-incline-${Date.now()}`,
      title: 'Block Sliding Down Inclined Plane',
      formula: 'a = g(sin θ − μ_k cos θ)',
      description: '2D motion along a tilted ramp balancing tangential gravity and kinetic friction.',
      renderStyle: 'incline',
      inclineAngleDeg: 30,
      floorY: 0,
      restitution: 0,
      scaleHint: 14,
      params: [
        { key: 'theta', label: 'Ramp Angle (θ)', unit: '°', min: 10, max: 60, step: 1, defaultValue: 30 },
        { key: 'mu', label: 'Friction (μ_k)', unit: '', min: 0, max: 0.7, step: 0.02, defaultValue: 0.15 },
        { key: 'g', label: 'Gravity (g)', unit: 'm/s²', min: 1.6, max: 25, step: 0.2, defaultValue: 9.8 },
        { key: 'mass', label: 'Block Mass', unit: 'kg', min: 0.5, max: 10, step: 0.5, defaultValue: 2 },
      ],
      initial: { x: '-8', y: '8 * sin(theta * pi / 180) / cos(theta * pi / 180)', vx: '0', vy: '0' },
      axExpr: 'max(0, g * (sin(theta * pi / 180) - mu * cos(theta * pi / 180))) * cos(theta * pi / 180)',
      ayExpr: '-max(0, g * (sin(theta * pi / 180) - mu * cos(theta * pi / 180))) * sin(theta * pi / 180)',
      peExpr: 'mass * g * max(0, y)',
    };
  }

  // 4. Driven / Forced Harmonic Oscillator & Resonance
  if (/\b(driven|forced|resonanc|rlc|coupled|damped|lissajous|2d spring)\b/.test(lower)) {
    return {
      id: `sim-driven-${Date.now()}`,
      title: '2D Driven & Damped Oscillator',
      formula: 'a_x = −(k/m)x − b·v_x + F₀ cos(ωt),  a_y = −(k/m)y − b·v_y',
      description: 'Two-axis harmonic oscillator driven into orbital or Lissajous resonance modes.',
      renderStyle: 'spring_block',
      scaleHint: 6,
      params: [
        { key: 'k', label: 'Stiffness (k)', unit: 'N/m', min: 2, max: 24, step: 0.5, defaultValue: 9 },
        { key: 'b', label: 'Damping (b)', unit: '1/s', min: 0, max: 1.2, step: 0.05, defaultValue: 0.15 },
        { key: 'F0', label: 'Drive Force (F₀)', unit: 'N', min: 0, max: 8, step: 0.2, defaultValue: 3.2 },
        { key: 'w', label: 'Drive Freq (ω)', unit: 'rad/s', min: 0.5, max: 6, step: 0.1, defaultValue: 2.9 },
      ],
      initial: { x: '2.5', y: '0', vx: '0', vy: '3.2' },
      axExpr: '-k * x - b * vx + F0 * cos(w * t)',
      ayExpr: '-k * y - b * vy',
      peExpr: '0.5 * k * (x^2 + y^2)',
    };
  }

  // 5. Moon / Mars / Planetary Projectile Launch
  if (/\b(moon|lunar|mars|jupiter|projectile|cannon|launch|trajectory)\b/.test(lower)) {
    const isMoon = /\b(moon|lunar)\b/.test(lower);
    const isMars = /\bmars\b/.test(lower);
    const defaultG = isMoon ? 1.62 : isMars ? 3.72 : 9.8;
    const labelSuffix = isMoon ? ' (Moon)' : isMars ? ' (Mars)' : '';
    return {
      id: `sim-proj-${Date.now()}`,
      title: `Ballistic Trajectory${labelSuffix}`,
      formula: 'a_x = −(c/m)|v|v_x,  a_y = −g − (c/m)|v|v_y',
      description: `2D projectile kinematics${labelSuffix ? ` tuned for${labelSuffix} gravity` : ''} with quadratic atmospheric drag.`,
      renderStyle: 'particle',
      floorY: 0,
      restitution: 0.45,
      scaleHint: 36,
      params: [
        { key: 'v0', label: 'Launch Speed', unit: 'm/s', min: 5, max: 40, step: 1, defaultValue: 18 },
        { key: 'ang', label: 'Launch Angle', unit: '°', min: 10, max: 80, step: 1, defaultValue: 45 },
        { key: 'g', label: 'Gravity (g)', unit: 'm/s²', min: 1.0, max: 25, step: 0.1, defaultValue: defaultG },
        { key: 'drag', label: 'Air Drag', unit: '', min: 0, max: 0.05, step: 0.002, defaultValue: isMoon ? 0 : 0.008 },
      ],
      initial: { x: '-20', y: '0.1', vx: 'v0 * cos(ang * pi / 180)', vy: 'v0 * sin(ang * pi / 180)' },
      axExpr: '-drag * v * vx',
      ayExpr: '-g - drag * v * vy',
      peExpr: 'g * max(0, y)',
    };
  }

  // 6. Binary / Elliptical / Central Force Orbit
  if (/\b(orbit|comet|planet|kepler|gravity|star|satellite|black hole|sling)\b/.test(lower)) {
    return {
      id: `sim-orbit-${Date.now()}`,
      title: q ? `Central-Force Orbit: ${q.slice(0, 36)}` : 'Elliptical Central-Force Orbit',
      formula: 'a = −(GM / r³) r',
      description: 'Inverse-square gravitational two-body trajectory demonstrating Keplerian ellipses and speed changes.',
      renderStyle: 'orbit',
      scaleHint: 14,
      params: [
        { key: 'GM', label: 'Central GM', unit: 'u³/s²', min: 40, max: 300, step: 5, defaultValue: 140 },
        { key: 'r0', label: 'Start Radius', unit: 'u', min: 4, max: 14, step: 0.5, defaultValue: 8 },
        { key: 'v0', label: 'Tangential Speed', unit: 'u/s', min: 1.5, max: 8.5, step: 0.2, defaultValue: 4.8 },
        { key: 'mass', label: 'Orbiter Mass', unit: 'kg', min: 0.5, max: 8, step: 0.5, defaultValue: 2 },
      ],
      initial: { x: 'r0', y: '0', vx: '0', vy: 'v0' },
      axExpr: '-GM * x / max(4, (x^2 + y^2)^1.5)',
      ayExpr: '-GM * y / max(4, (x^2 + y^2)^1.5)',
      peExpr: '-mass * GM / max(1.5, r)',
    };
  }

  // Default custom 2D damped nonlinear oscillator tailored to the user's topic
  const shortTitle = q ? q.slice(0, 48) : 'Custom 2D Dynamical System';
  return {
    id: `sim-custom-${Date.now()}`,
    title: shortTitle,
    formula: 'a_x = −k_x·x − ζ·v_x,  a_y = −k_y·y − ζ·v_y',
    description: `Interactive 2D phase-space oscillator modeling "${shortTitle}" with adjustable stiffness and damping.`,
    renderStyle: 'orbit',
    scaleHint: 8,
    params: [
      { key: 'kx', label: 'X Restoring (k_x)', unit: '1/s²', min: 1, max: 16, step: 0.5, defaultValue: 5 },
      { key: 'ky', label: 'Y Restoring (k_y)', unit: '1/s²', min: 1, max: 16, step: 0.5, defaultValue: 9 },
      { key: 'damp', label: 'Damping (ζ)', unit: '1/s', min: 0, max: 0.8, step: 0.02, defaultValue: 0.06 },
      { key: 'v0', label: 'Initial Impulse', unit: 'm/s', min: 1, max: 12, step: 0.5, defaultValue: 6 },
    ],
    initial: { x: '4', y: '0', vx: '0', vy: 'v0' },
    axExpr: '-kx * x - damp * vx',
    ayExpr: '-ky * y - damp * vy',
    peExpr: '0.5 * (kx * x^2 + ky * y^2)',
  };
}

