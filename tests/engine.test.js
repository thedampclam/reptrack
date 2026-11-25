const E = require('../engine.js');
const { poseAt, MOTION } = require('./gen.js');
const assert = require('assert');
const FPS = 20;
let fails = 0;
function check(name, cond, info) { if (!cond) { fails++; console.log('FAIL', name, info === undefined ? '' : info); } else console.log('ok  ', name, info === undefined ? '' : info); }

// 1. Detector classifies each movement
for (const name of [...Object.keys(MOTION), 'walk']) {
  const d = new E.Detector(); let t = 0, first = null;
  for (let i = 0; i < FPS * 10; i++, t += 1 / FPS) { const ch = d.push(E.features(poseAt(name, t), 1, 1), t); if (ch && first === null) first = t; }
  check('detect ' + name, d.current === name, `got=${d.current} at ${first && first.toFixed(1)}s`);
}
// 2. Counters: 6 reps each
for (const name of Object.keys(MOTION)) {
  const pat = name; const c = new E.RepCounter(pat); let t = 0;
  const T = MOTION[name][3];
  for (let i = 0; i < FPS * T * 6; i++, t += 1 / FPS) c.update(E.measure(pat, poseAt(name, t), 1, 1), t);
  check('count ' + name, c.reps === 6, 'reps=' + c.reps);
}
{ const c = new E.StepCounter(); let t = 0; for (let i = 0; i < FPS * 20; i++, t += 1 / FPS) c.update(E.sample('walk', poseAt('walk', t), 1, 1), t);
  check('count walk steps (~40 in 20 s)', Math.abs(c.reps - 40) <= 2, 'steps=' + c.reps); }
// 3. Shallow reps do not count
{ const c = new E.RepCounter('pushup'); let t = 0; for (let i = 0; i < FPS * 12; i++, t += 1 / FPS) { const a = 130 + 40 * (0.5 + 0.5 * Math.cos(2 * Math.PI * t / 2)); c.update(a, t); } check('shallow push-ups ignored', c.reps === 0, c.reps); }

// 4. Ordered workout with timed step
{
  const w = new E.Workout([{ ex: 'pushup', target: 4 }, { ex: 'walkpad', target: 8 }, { ex: 'squat', target: 3 }], { maxRounds: 1 });
  let t = 0, fin = false;
  const seg = (name, secs) => { for (let i = 0; i < FPS * secs; i++, t += 1 / FPS) { const o = w.update(poseAt(name, t), 1, 1, t); if (o.finished) fin = true; } };
  seg('pushup', 9); check('ordered: pushups done, now walk', w.currentIndex() === 1, 'i=' + w.currentIndex());
  seg('walk', 9);   check('ordered: walk done after 8 s, now squats', w.currentIndex() === 2, 'i=' + w.currentIndex() + ' steps=' + w.count[1]);
  seg('squat', 8);  check('ordered: round complete + finished', w.rounds === 1 && fin, 'rounds=' + w.rounds);
}
// 5. Auto workout: order-free, with lag credit
{
  const w = new E.Workout([{ ex: 'hammercurl', target: 5 }, { ex: 'skullcrusher', target: 5 }, { ex: 'dbpress', target: 5 }], { auto: true });
  let t = 0;
  const seg = (name, secs) => { for (let i = 0; i < FPS * secs; i++, t += 1 / FPS) w.update(poseAt(name, t), 1, 1, t); };
  seg('press', 12);  check('auto: press credited', w.progress[2] === 5, w.progress.join());
  seg('curl', 12);   check('auto: curl credited to hammer curls', w.progress[0] === 5, w.progress.join());
  seg('skull', 12);  check('auto: skull crushers credited, round done', w.rounds === 1, 'rounds=' + w.rounds + ' prog=' + w.progress.join());
}
// 6. Free workout tally
{
  const w = new E.Workout([], { free: true }); let t = 0;
  const seg = (name, secs) => { for (let i = 0; i < FPS * secs; i++, t += 1 / FPS) w.update(poseAt(name, t), 1, 1, t); };
  seg('pushup', 12); seg('squat', 12); seg('pullup', 15);
  check('free tally (no stray exercises)', Object.keys(w.tally).sort().join() === 'pullup,pushup,squat' && Math.abs(w.tally.pushup - 6) <= 1 && Math.abs(w.tally.squat - 6) <= 1 && Math.abs(w.tally.pullup - 6) <= 1, JSON.stringify(w.tally));
}
// 6b. Auto workout with lunges and burpees
{
  const w = new E.Workout([{ ex: 'lunge', target: 4 }, { ex: 'burpee', target: 3 }, { ex: 'squat', target: 4 }], { auto: true });
  let t = 0;
  const seg = (name, secs) => { for (let i = 0; i < FPS * secs; i++, t += 1 / FPS) w.update(poseAt(name, t), 1, 1, t); };
  seg('lunge', 11); seg('burpee', 16); seg('squat', 11);
  check('auto: lunges/burpees/squats round', w.rounds === 1, 'rounds=' + w.rounds + ' prog=' + w.progress.join());
}
// 7. Rest: detector clears after the person stops
{
  const w = new E.Workout([], { free: true }); let t = 0;
  for (let i = 0; i < FPS * 8; i++, t += 1 / FPS) w.update(poseAt('squat', t), 1, 1, t);
  const still = poseAt('squat', 0); // standing, no motion
  for (let i = 0; i < FPS * 12; i++, t += 1 / FPS) w.update(still, 1, 1, t);
  check('stops: detected clears when still', w.detected === null, w.detected);
}
console.log(fails ? fails + ' FAILED' : 'all engine tests passed');
process.exit(fails ? 1 : 0);
