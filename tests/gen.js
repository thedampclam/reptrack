// Synthetic stick-figure generators (normalised coords, w=h=1). One function per movement.
const R = (v, deg) => { const t = deg * Math.PI / 180; return [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t)]; };
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
function mk(pts) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  for (const [i, p] of Object.entries(pts)) lm[i] = { x: p[0], y: p[1], visibility: 1 };
  return lm;
}
// Same point for left and right sides (index pairs 11/12, 13/14 ...).
function both(S, E, W, H, K, A) {
  return mk({ 11: S, 12: S, 13: E, 14: E, 15: W, 16: W, 23: H, 24: H, 25: K, 26: K, 27: A, 28: A });
}
const L = 0.15;
// upper arm direction angle psi from "straight down" (+x positive), elbow angle a
function arm(S, psi, a, sign = 1) {
  const u = [Math.sin(psi * Math.PI / 180), Math.cos(psi * Math.PI / 180)];
  const E = add(S, u, L);
  const f = R(u, sign * (180 - a));
  return [E, add(E, f, L)];
}
const standing = (S) => { const H = [S[0], S[1] + 0.25]; const K = [H[0], H[1] + 0.22]; return [H, K, [K[0], K[1] + 0.22]]; };

const G = {
  pullup(a) {
    const Wp = [0.5, 0.15], d = 2 * L * Math.sin(a * Math.PI / 360);
    const S = [0.5, 0.15 + d], E = [0.5 + L * Math.cos(a * Math.PI / 360), 0.15 + d / 2];
    const [H, K, A] = standing(S); return both(S, E, Wp, H, K, A);
  },
  pushup(a) {
    const Wp = [0.75, 0.8], d = 2 * L * Math.sin(a * Math.PI / 360);
    const S = [0.75, 0.8 - d], E = [0.75 - L * Math.cos(a * Math.PI / 360), 0.8 - d / 2];
    const H = [S[0] - 0.3, S[1] + 0.05], K = add(H, [-0.2, 0.03]), A = add(K, [-0.2, 0.03]);
    return both(S, E, Wp, H, K, A);
  },
  squat(k) {
    const Aa = [0.5, 0.9], beta = 0.4 * (1 - k / 180);
    const Kk = add(Aa, [Math.sin(beta), -Math.cos(beta)], 0.22);
    const u = [(Aa[0] - Kk[0]) / 0.22, (Aa[1] - Kk[1]) / 0.22];
    const c1 = add(Kk, R(u, k), 0.22), c2 = add(Kk, R(u, -k), 0.22);
    const H = c1[0] < c2[0] ? c1 : c2;
    const th = 0.6 * (1 - k / 180);
    const S = add(H, [Math.sin(th), -Math.cos(th)], 0.25);
    const E = add(S, [0.1, 0.12]), W = add(E, [0.12, -0.01]);
    return both(S, E, W, H, Kk, Aa);
  },
  row(a) {
    const H = [0.4, 0.6], S = add(H, [Math.sin(1.0472), -Math.cos(1.0472)], 0.25);
    const K = add(H, [0.07, 0.21]), A = add(K, [-0.03, 0.22]);
    const psi = -Math.min(40, Math.max(0, (170 - a) * 0.4));
    const [E, W] = arm(S, psi, a, 1); return both(S, E, W, H, K, A);
  },
  curl(a) {
    const H = [0.5, 0.5], S = [0.5, 0.25], K = [0.5, 0.72], A = [0.5, 0.94];
    const [E, W] = arm(S, 0, a, 1); return both(S, E, W, H, K, A);
  },
  skull(a) {
    const H = [0.3, 0.7], S = [0.6, 0.7], K = add(H, [-0.15, -0.1]), A = add(K, [-0.1, 0.15]);
    const E = [S[0], S[1] - L], u = [0, -1], f = R(u, 180 - a), W = add(E, f, L);
    return both(S, E, W, H, K, A);
  },
  press(p) { // p: 0 bottom .. 1 top
    const H = [0.5, 0.5], S = [0.5, 0.25], K = [0.5, 0.72], A = [0.5, 0.94];
    const Eb = add(S, [0.14, 0.04]), Wb = add(Eb, [0, -0.15]), Et = add(S, [0, -0.15]), Wt = add(S, [0, -0.3]);
    const mix = (a, b) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
    return both(S, mix(Eb, Et), mix(Wb, Wt), H, K, A);
  },
  rower(p) { // p: 0 catch .. 1 finish
    const H = [0.5, 0.6], th = (20 - 35 * p) * Math.PI / 180, S = add(H, [Math.sin(th), -Math.cos(th)], 0.25);
    const k = 70 + 95 * p, K = add(H, [0.22, 0]), A = add(K, [-Math.cos(k * Math.PI / 180), Math.sin(k * Math.PI / 180)], 0.22);
    const a = 170 - 100 * p, [E, W] = arm(S, 80, a, 1); return both(S, E, W, H, K, A);
  },
  lunge(hy) { // hip height: ~0.5 top .. 0.7 bottom, split stance
    const H = [0.5, hy], S = [0.5, hy - 0.25];
    const ik = (hip, ank, sign) => { const d = Math.min(0.439, Math.hypot(ank[0]-hip[0], ank[1]-hip[1])); const a = Math.acos(Math.max(-1, Math.min(1, d / 0.44))); const base = Math.atan2(ank[1]-hip[1], ank[0]-hip[0]);
      const t = base + sign * a; return [hip[0] + 0.22 * Math.cos(t), hip[1] + 0.22 * Math.sin(t)]; };
    const Af = [0.68, 0.9], Ab = [0.32, 0.9], Kf = ik(H, Af, -1), Kb = ik(H, Ab, 1);
    const E = add(S, [0.1, 0.12]);
    const lm = mk({ 11: S, 12: S, 13: E, 14: E, 15: H, 16: H, 23: H, 24: H, 25: Kf, 26: Kb, 27: Af, 28: Ab });
    return lm;
  },
  burpee(th) { // torso angle from vertical, a straight board rotating about the hip
    const H = [0.5, 0.5], u = [Math.sin(th * Math.PI / 180), -Math.cos(th * Math.PI / 180)];
    const S = add(H, u, 0.25), K = add(H, u, -0.22), A = add(K, u, -0.22);
    const E = add(S, [0, 0.15]), W = add(E, [0, 0.15]);
    return both(S, E, W, H, K, A);
  },
  walk(phi) {
    const H = [0.5, 0.5], S = [0.5, 0.25], K = [0.5, 0.72];
    const aL = [0.5 + 0.12 * Math.sin(phi), 0.94 - 0.03 * Math.max(0, Math.cos(phi))];
    const aR = [0.5 - 0.12 * Math.sin(phi), 0.94 - 0.03 * Math.max(0, -Math.cos(phi))];
    const [E, W] = arm(S, 0, 160, 1);
    const lm = both(S, E, W, H, K, aL); lm[28] = { x: aR[0], y: aR[1], visibility: 1 }; return lm;
  }
};
// Motion definitions: [pattern, generator, lo, hi, period seconds]
const MOTION = {
  pullup: [G.pullup, 50, 170, 2.5], pushup: [G.pushup, 70, 170, 2], squat: [G.squat, 70, 172, 2],
  row: [G.row, 70, 170, 2], curl: [G.curl, 45, 170, 2], skull: [G.skull, 80, 170, 2],
  press: [G.press, 0, 1, 2], rower: [G.rower, 0, 1, 2],
  lunge: [G.lunge, 0.7, 0.5, 2], burpee: [G.burpee, 90, 0, 3.5]
};
// Pose at time t for a movement; phase 0 = start of rep (extended / start position).
function poseAt(name, t) {
  if (name === 'walk') return G.walk(2 * Math.PI * 1.0 * t);
  const [g, lo, hi, T] = MOTION[name];
  const s = 0.5 + 0.5 * Math.cos(2 * Math.PI * t / T);          // 1 at t=0
  if (name === 'press') return g(1 - s);                          // start at the bottom
  if (name === 'rower') return g(1 - s);                          // start at the catch
  return g(lo + (hi - lo) * s);                                   // start extended
}
module.exports = { G, MOTION, poseAt, mk };
