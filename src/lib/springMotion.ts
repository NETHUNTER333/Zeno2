// Shared DesignBookmark Spring Physics Engine (tokens, springs, clamp, raf loop)

export interface SpringState {
  x: number;
  v: number;
  t: number;
  k: number;
  c: number;
}

export function createSpring(initial = 0, k = 400, c = 30): SpringState {
  return { x: initial, v: 0, t: initial, k, c };
}

export function tuneSpring(s: SpringState, k: number, c: number) {
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  s.k = k;
  s.c = reduce ? 2 * Math.sqrt(k) : c;
}

export function stepSpring(s: SpringState, dt: number) {
  const a = -s.k * (s.x - s.t) - s.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

export function clampVal(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function isSpringSettled(s: SpringState, eps = 0.002): boolean {
  return Math.abs(s.x - s.t) < eps && Math.abs(s.v) < eps;
}
