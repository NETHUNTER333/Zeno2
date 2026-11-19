//#region src/lib/springMotion.ts
function createSpring(initial = 0, k = 400, c = 30) {
	return {
		x: initial,
		v: 0,
		t: initial,
		k,
		c
	};
}
function tuneSpring(s, k, c) {
	const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	s.k = k;
	s.c = reduce ? 2 * Math.sqrt(k) : c;
}
function stepSpring(s, dt) {
	const a = -s.k * (s.x - s.t) - s.c * s.v;
	s.v += a * dt;
	s.x += s.v * dt;
}
function clampVal(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
//#endregion
export { tuneSpring as i, createSpring as n, stepSpring as r, clampVal as t };
