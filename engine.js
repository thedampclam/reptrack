// RepTrack engine. Pure functions and classes: no DOM, no MediaPipe. Testable in Node.
(function (root) {
  var IDX = { LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16, LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28 };
  var MIN_VIS = 0.5;
  var MIN_REP_SECONDS = 0.4;     // ignore "reps" faster than this (jitter)
  var WIN = 4.0;                 // detector look-back window, seconds
  var EVAL_EVERY = 0.3;          // detector runs this often, seconds
  var CONFIRM = 3;               // consecutive identical results before the detector switches
  var FORGET = 4.0;              // seconds without a result before "detected" clears
  var CREDIT_BACK = 6.0;         // reps counted this long before a switch are credited to the new exercise
  var HOLD = 2.0;                // a new detection must last this long before its reps and time are credited

  // ---------- Movement patterns ----------
  // low  = angle that counts as the working end of the movement
  // high = angle that counts as full extension. A rep = go below low, then return above high.
  var PATTERNS = {
    pullup: { name: 'Pull-ups',       metric: 'elbow', low: 80,  high: 150 },
    pushup: { name: 'Push-ups',       metric: 'elbow', low: 95,  high: 155 },
    squat:  { name: 'Squats',         metric: 'knee',  low: 100, high: 160 },
    lunge:  { name: 'Lunges',         metric: 'knee',  low: 110, high: 160 },
    burpee: { name: 'Burpees',        metric: 'tilt',  low: 120, high: 150 },   // value = 180 - torso tilt
    row:    { name: 'Rows',           metric: 'elbow', low: 110, high: 150 },
    curl:   { name: 'Curls',          metric: 'elbow', low: 80,  high: 150 },
    skull:  { name: 'Skull crushers', metric: 'elbow', low: 100, high: 150 },
    press:  { name: 'Shoulder press', metric: 'elbow', low: 100, high: 150 },
    rower:  { name: 'Row machine',    metric: 'knee',  low: 100, high: 150 },
    walk:   { name: 'Walking',        metric: 'steps' }
  };

  var EQUIPMENT = {
    bar: 'Pull-up bar',
    bodyweight: 'Bodyweight',
    dumbbell: 'Dumbbells (20 lb or less each)',
    rowmachine: 'Row machine',
    walkingpad: 'Walking pad'
  };

  // Library. timed:true means the target is seconds, and the rep counter only tallies strokes or steps.
  var EXERCISES = {
    pullup:       { name: 'Pull-ups',          pattern: 'pullup', equip: 'bar' },
    chinup:       { name: 'Chin-ups',          pattern: 'pullup', equip: 'bar' },
    pushup:       { name: 'Push-ups',          pattern: 'pushup', equip: 'bodyweight' },
    squat:        { name: 'Squats',            pattern: 'squat',  equip: 'bodyweight' },
    lunge:        { name: 'Lunges',            pattern: 'lunge',  equip: 'bodyweight' },
    burpee:       { name: 'Burpees',           pattern: 'burpee', equip: 'bodyweight' },
    gobletsquat:  { name: 'Goblet squats',     pattern: 'squat',  equip: 'dumbbell' },
    dbrow:        { name: 'Dumbbell rows',     pattern: 'row',    equip: 'dumbbell' },
    hammercurl:   { name: 'Hammer curls',      pattern: 'curl',   equip: 'dumbbell' },
    bicepcurl:    { name: 'Biceps curls',      pattern: 'curl',   equip: 'dumbbell' },
    skullcrusher: { name: 'Skull crushers',    pattern: 'skull',  equip: 'dumbbell' },
    dbpress:      { name: 'Shoulder press',    pattern: 'press',  equip: 'dumbbell' },
    rowmachine:   { name: 'Row machine',       pattern: 'rower',  equip: 'rowmachine', timed: true },
    walkpad:      { name: 'Walking pad',       pattern: 'walk',   equip: 'walkingpad', timed: true }
  };

  // ---------- Geometry ----------
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function visOk(p) { return p && (p.visibility == null ? 1 : p.visibility) >= MIN_VIS; }
  function pt(lm, i, w, h) { var p = lm[i]; return visOk(p) ? { x: p.x * w, y: p.y * h } : null; }
  function avgPt(list) {
    var s = list.filter(Boolean); if (!s.length) return null;
    return { x: s.reduce(function (a, p) { return a + p.x; }, 0) / s.length, y: s.reduce(function (a, p) { return a + p.y; }, 0) / s.length };
  }
  function avg(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  function ang(a, b, c) {
    var v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    var m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (!m) return null;
    return Math.acos(clamp((v1x * v2x + v1y * v2y) / m, -1, 1)) * 180 / Math.PI;
  }
  function angleDeg(a, b, c, w, h) {
    return ang({ x: a.x * w, y: a.y * h }, { x: b.x * w, y: b.y * h }, { x: c.x * w, y: c.y * h });
  }
  function sideAngles(lm, tris, w, h) {
    var out = [];
    tris.forEach(function (t) {
      var a = pt(lm, t[0], w, h), b = pt(lm, t[1], w, h), c = pt(lm, t[2], w, h);
      if (a && b && c) { var v = ang(a, b, c); if (v != null) out.push(v); }
    });
    return out;
  }
  var ELBOW = [[IDX.LS, IDX.LE, IDX.LW], [IDX.RS, IDX.RE, IDX.RW]];
  var KNEE = [[IDX.LH, IDX.LK, IDX.LA], [IDX.RH, IDX.RK, IDX.RA]];

  // Torso angle from vertical: 0 upright, 90 horizontal.
  function torsoTilt(lm, w, h) {
    var sh = avgPt([pt(lm, IDX.LS, w, h), pt(lm, IDX.RS, w, h)]), hip = avgPt([pt(lm, IDX.LH, w, h), pt(lm, IDX.RH, w, h)]);
    if (!sh || !hip) return null;
    var len = Math.hypot(sh.x - hip.x, sh.y - hip.y); if (len < 0.03 * Math.max(w, h)) return null;
    return Math.acos(clamp((hip.y - sh.y) / len, -1, 1)) * 180 / Math.PI;
  }
  // Joint angle (degrees) for an angle-based pattern, averaged over visible sides.
  function measure(pattern, lm, w, h) {
    var m = PATTERNS[pattern].metric;
    if (m === 'steps') return null;
    if (m === 'tilt') { var tl = torsoTilt(lm, w, h); return tl == null ? null : 180 - tl; }
    return avg(sideAngles(lm, m === 'knee' ? KNEE : ELBOW, w, h));
  }
  // Ankle separation, normalised by torso length: used to count steps.
  function ankleSignal(lm, w, h) {
    var a = pt(lm, IDX.LA, w, h), b = pt(lm, IDX.RA, w, h);
    var sh = avgPt([pt(lm, IDX.LS, w, h), pt(lm, IDX.RS, w, h)]), hip = avgPt([pt(lm, IDX.LH, w, h), pt(lm, IDX.RH, w, h)]);
    if (!a || !b || !sh || !hip) return null;
    var torso = Math.hypot(sh.x - hip.x, sh.y - hip.y); if (!torso) return null;
    return { dx: (a.x - b.x) / torso, dy: (a.y - b.y) / torso };
  }
  function sample(pattern, lm, w, h) {
    return PATTERNS[pattern].metric === 'steps' ? ankleSignal(lm, w, h) : measure(pattern, lm, w, h);
  }

  // ---------- Counters ----------
  function RepCounter(pattern) { this.pattern = pattern; this.cfg = PATTERNS[pattern]; this.reset(); }
  RepCounter.prototype.reset = function () { this.state = 'start'; this.angle = null; this.lastRepT = -Infinity; this.reps = 0; };
  RepCounter.prototype.update = function (raw, t) {
    if (raw == null) return false;
    this.angle = this.angle == null ? raw : this.angle * 0.5 + raw * 0.5;
    var a = this.angle;
    if (this.state === 'start' && a < this.cfg.low) {
      this.state = 'work';
    } else if (this.state === 'work' && a > this.cfg.high) {
      this.state = 'start';
      if (t - this.lastRepT >= MIN_REP_SECONDS) { this.reps++; this.lastRepT = t; return true; }
    }
    return false;
  };
  RepCounter.prototype.depth = function () {
    if (this.angle == null) return 0;
    return clamp((this.cfg.high - this.angle) / (this.cfg.high - this.cfg.low), 0, 1);
  };

  // Counts steps from ankle separation. Uses whichever axis (side view: dx, front view: dy) swings more.
  function ZeroCross() { this.mean = null; this.amp = 0; this.sign = 0; }
  ZeroCross.prototype.update = function (v) {
    if (this.mean == null) this.mean = v;
    this.mean += (v - this.mean) * 0.03;
    var d = v - this.mean;
    this.amp += (Math.abs(d) - this.amp) * 0.05;
    var hyst = 0.08, crossed = false;
    if (d > hyst) { if (this.sign < 0) crossed = true; this.sign = 1; }
    else if (d < -hyst) { if (this.sign > 0) crossed = true; this.sign = -1; }
    return crossed;
  };
  function StepCounter() { this.cfg = PATTERNS.walk; this.reset(); }
  StepCounter.prototype.reset = function () { this.x = new ZeroCross(); this.y = new ZeroCross(); this.reps = 0; this.lastRepT = -Infinity; this.angle = null; };
  StepCounter.prototype.update = function (s, t) {
    if (!s) return false;
    var cx = this.x.update(s.dx), cy = this.y.update(s.dy);
    var crossed = this.x.amp >= this.y.amp ? cx : cy;
    if (crossed && t - this.lastRepT >= 0.2) { this.reps++; this.lastRepT = t; return true; }
    return false;
  };
  StepCounter.prototype.depth = function () { return 0; };
  function makeCounter(pattern) { return pattern === 'walk' ? new StepCounter() : new RepCounter(pattern); }

  // ---------- Auto-detect ----------
  function features(lm, w, h) {
    var sh = avgPt([pt(lm, IDX.LS, w, h), pt(lm, IDX.RS, w, h)]);
    var hip = avgPt([pt(lm, IDX.LH, w, h), pt(lm, IDX.RH, w, h)]);
    if (!sh || !hip) return null;
    var torso = Math.hypot(sh.x - hip.x, sh.y - hip.y);
    if (torso < 0.03 * Math.max(w, h)) return null;
    var f = {};
    f.tilt = Math.acos(clamp((hip.y - sh.y) / torso, -1, 1)) * 180 / Math.PI;   // 0 upright, 90 horizontal
    var kn = avgPt([pt(lm, IDX.LK, w, h), pt(lm, IDX.RK, w, h)]);
    f.hipAng = kn ? ang(sh, hip, kn) : null;
    f.elbow = avg(sideAngles(lm, ELBOW, w, h));
    f.knee = avg(sideAngles(lm, KNEE, w, h));
    var wr = [], er = [], wy = [];
    [[IDX.LS, IDX.LE, IDX.LW], [IDX.RS, IDX.RE, IDX.RW]].forEach(function (s) {
      var S = pt(lm, s[0], w, h), E = pt(lm, s[1], w, h), W = pt(lm, s[2], w, h);
      if (S && E && W) { wr.push((W.y - S.y) / torso); er.push((E.y - S.y) / torso); wy.push(W.y / torso); }
    });
    f.wrRel = avg(wr); f.elbRel = avg(er); f.wristY = avg(wy);
    f.shY = sh.y / torso; f.hipY = hip.y / torso;
    var a = pt(lm, IDX.LA, w, h), b = pt(lm, IDX.RA, w, h);
    f.adx = a && b ? (a.x - b.x) / torso : null;
    f.ady = a && b ? (a.y - b.y) / torso : null;
    return f;
  }
  function series(buf, key) {
    var o = []; for (var i = 0; i < buf.length; i++) { var v = buf[i].f[key]; if (v != null) o.push(v); } return o;
  }
  function pct(a, p) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), k = (s.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k);
    return s[lo] + (s[hi] - s[lo]) * (k - lo);
  }
  function median(a) { return pct(a, 0.5); }
  function range(a) { return a.length < 8 ? 0 : pct(a, 0.9) - pct(a, 0.1); }
  function crossings(a) {
    if (a.length < 8) return 0;
    var m = avg(a), s = 0, n = 0;
    for (var i = 0; i < a.length; i++) {
      var d = a[i] - m;
      if (d > 0.08) { if (s < 0) n++; s = 1; } else if (d < -0.08) { if (s > 0) n++; s = -1; }
    }
    return n;
  }

  // Number of times a series crosses the midpoint of its own range, with a 12-degree dead band.
  function swings(a) {
    if (a.length < 8) return 0;
    var mid = (Math.max.apply(null, a) + Math.min.apply(null, a)) / 2, st = 0, n = 0;
    for (var i = 0; i < a.length; i++) {
      var d = a[i] - mid;
      if (d > 12) { if (st < 0) n++; st = 1; } else if (d < -12) { if (st > 0) n++; st = -1; }
    }
    return n;
  }

  // Rules. Returns a pattern key or null. Thresholds assume joint angles in degrees and lengths in torso units.
  function classify(buf) {
    var tilt = median(series(buf, 'tilt')); if (tilt == null) return null;
    var hipAng = median(series(buf, 'hipAng'));
    var wr = median(series(buf, 'wrRel')), er = median(series(buf, 'elbRel'));
    var E = range(series(buf, 'elbow')), K = range(series(buf, 'knee'));
    var hipMove = range(series(buf, 'hipY')), shMove = range(series(buf, 'shY')), wristMove = range(series(buf, 'wristY'));

    // 0. Burpees: the torso swings between upright and horizontal
    //    A real burpee crosses the mid angle at least twice (down and up). One crossing is just a change of exercise.
    var tl = series(buf, 'tilt');
    if (range(tl) > 50 && swings(tl) >= 2) return 'burpee';

    var adx = series(buf, 'adx'), ady = series(buf, 'ady');
    // 1a. Lunges: split stance (feet far apart), knees bend, hips travel
    var absAdx = adx.map(Math.abs);
    if (tilt < 35 && K > 40 && hipMove > 0.2 && absAdx.length >= 8 && median(absAdx) > 0.6) return 'lunge';
    // 1b. Walking: ankles alternate, upright, arms quiet
    if (tilt < 35 && E < 45 &&
        ((range(adx) > 0.3 && crossings(adx) >= 3) || (range(ady) > 0.3 && crossings(ady) >= 3))) return 'walk';

    // 2. Lying down with the arms above the shoulders: skull crushers
    if (tilt > 60 && E > 35 && wr != null && wr < -0.1) return 'skull';
    // 3. Straight body, hands below the shoulders: push-ups
    if (tilt > 55 && E > 35 && hipAng != null && hipAng > 150 && wr != null && wr > 0.1) return 'pushup';
    // 4. Hinged forward at the hips, bent arms pulling: dumbbell rows
    if (tilt >= 28 && tilt <= 80 && E > 35 && K < 45 && hipAng != null && hipAng <= 150) return 'row';

    if (tilt < 45) {
      // 5. Seated on a rower: legs drive, hips stay level
      if (K > 50 && hipMove < 0.2 && E > 30) return 'rower';
      // 6. Squats: knees bend, hips travel
      if (K > 40 && hipMove > 0.25 && E < 45) return 'squat';
      if (E > 35 && wr != null) {
        // 7. Hands overhead and the shoulders move more than the hands: pull-ups
        if (wr < -0.35 && shMove > wristMove * 1.5) return 'pullup';
        // 8. Hands travel overhead while the shoulders stay put: shoulder press
        if (wr < -0.2 && wristMove > shMove * 1.5) return 'press';
        // 9. Elbows pinned at the sides, hands travel up: curls
        if (wr > -0.2 && er != null && er > 0.3) return 'curl';
      }
    }
    return null;
  }

  function Detector() { this.reset(); }
  Detector.prototype.reset = function () {
    this.buf = []; this.current = null; this.cand = null; this.candN = 0; this.lastEval = -Infinity; this.lastSeen = -Infinity;
  };
  // Returns true when `current` changed.
  Detector.prototype.push = function (f, t) {
    if (f) this.buf.push({ t: t, f: f });
    while (this.buf.length && t - this.buf[0].t > WIN) this.buf.shift();
    if (t - this.lastEval < EVAL_EVERY) return false;
    this.lastEval = t;
    var changed = false;
    if (this.current && t - this.lastSeen > FORGET) { this.current = null; this.cand = null; this.candN = 0; changed = true; }
    if (this.buf.length < 12 || t - this.buf[0].t < 2.0) return changed;
    var c = classify(this.buf);
    if (c) {
      this.lastSeen = t;
      if (c === this.current) { this.cand = null; this.candN = 0; }
      else {
        if (c === this.cand) this.candN++; else { this.cand = c; this.candN = 1; }
        if (this.candN >= CONFIRM) { this.current = c; this.cand = null; this.candN = 0; changed = true; }
      }
    }
    return changed;
  };

  // ---------- Workout ----------
  // steps: [{ex, target}]. target = reps, or seconds when the exercise is timed.
  // opts: { auto, maxRounds, free }. free = no steps; tally whatever is detected.
  function Workout(steps, opts) {
    opts = opts || {};
    this.steps = steps || [];
    this.auto = !!opts.auto || !!opts.free;
    this.free = !!opts.free || !this.steps.length;
    this.maxRounds = opts.maxRounds || 0;
    this.counters = {};
    var self = this;
    Object.keys(PATTERNS).forEach(function (p) { self.counters[p] = makeCounter(p); });
    this.detector = new Detector();
    this.reset();
  }
  Workout.prototype.reset = function () {
    var n = this.steps.length;
    this.i = 0; this.rounds = 0; this.totalReps = 0; this.lastT = null;
    this.progress = []; this.count = [];
    for (var k = 0; k < n; k++) { this.progress.push(0); this.count.push(0); }
    this.tally = {};      // pattern -> reps/steps (free mode)
    this.timeTally = {};  // pattern -> seconds (free mode, timed patterns)
    this.pending = {};    // pattern -> [times]
    this.detected = null; this.hold = null;
    var self = this;
    Object.keys(this.counters).forEach(function (p) { self.counters[p].reset(); });
    this.detector.reset();
  };
  function isTimed(step) { return !!EXERCISES[step.ex].timed; }
  Workout.prototype.patternOf = function (i) { return EXERCISES[this.steps[i].ex].pattern; };
  Workout.prototype.stepDone = function (i) { return this.progress[i] >= this.steps[i].target; };
  // Index of the step the HUD should show.
  Workout.prototype.currentIndex = function () {
    if (this.free || !this.steps.length) return -1;
    if (!this.auto) return Math.min(this.i, this.steps.length - 1);
    if (this.detected) {
      for (var j = 0; j < this.steps.length; j++) if (this.patternOf(j) === this.detected && !this.stepDone(j)) return j;
    }
    for (var k = 0; k < this.steps.length; k++) if (!this.stepDone(k)) return k;   // auto: show the next unfinished step
    return 0;
  };
  Workout.prototype.current = function () { var j = this.currentIndex(); return j < 0 ? null : this.steps[j]; };

  Workout.prototype._credit = function (pattern, out) {
    if (this.free) {
      this.tally[pattern] = (this.tally[pattern] || 0) + 1;
      this.totalReps++; out.rep = true; out.pattern = pattern; return;
    }
    for (var j = 0; j < this.steps.length; j++) {
      if (this.patternOf(j) !== pattern || this.stepDone(j)) continue;
      this.count[j]++;
      if (!isTimed(this.steps[j])) {
        this.progress[j]++; this.totalReps++; out.rep = true; out.pattern = pattern; out.stepIdx = j;
        if (this.stepDone(j)) out.stepDone = true;
      }
      return;
    }
  };
  Workout.prototype._checkRound = function (out) {
    if (this.free) return;
    for (var j = 0; j < this.steps.length; j++) if (!this.stepDone(j)) return;
    this.rounds++; out.roundDone = true;
    for (var k = 0; k < this.steps.length; k++) { this.progress[k] = 0; this.count[k] = 0; }
    this.i = 0;
    if (this.maxRounds && this.rounds >= this.maxRounds) out.finished = true;
  };

  // Add seconds to the first unfinished timed step of this pattern (or the free-mode tally).
  Workout.prototype._accrue = function (pattern, dt, out) {
    if (this.free) {
      if (PATTERNS[pattern].metric === 'steps' || pattern === 'rower') this.timeTally[pattern] = (this.timeTally[pattern] || 0) + dt;
      return;
    }
    for (var j = 0; j < this.steps.length; j++) {
      if (this.patternOf(j) === pattern && isTimed(this.steps[j]) && !this.stepDone(j)) {
        this.progress[j] += dt; if (this.stepDone(j)) out.stepDone = true; return;
      }
    }
  };

  // Feed one pose sample. lm: MediaPipe landmarks, w/h: frame size, t: seconds on the workout clock.
  Workout.prototype.update = function (lm, w, h, t) {
    var dt = this.lastT == null ? 0 : clamp(t - this.lastT, 0, 0.5); this.lastT = t;
    var out = { rep: false, stepDone: false, roundDone: false, finished: false, pattern: null, stepIdx: -1 };
    var self = this;

    if (!this.auto) {
      var step = this.steps[this.i], pat = this.patternOf(this.i), c = this.counters[pat];
      var rep = c.update(sample(pat, lm, w, h), t);
      if (isTimed(step)) {
        if (rep) this.count[this.i]++;
        this.progress[this.i] += dt;
      } else if (rep) {
        this.count[this.i]++; this.progress[this.i]++; this.totalReps++;
        out.rep = true; out.pattern = pat; out.stepIdx = this.i;
      }
      if (this.stepDone(this.i)) {
        out.stepDone = true; c.reset(); this.i++;
        if (this.i < this.steps.length) this.counters[this.patternOf(this.i)].reset();
        else { this._checkRound(out); }
      }
      return out;
    }

    // Auto mode: every counter runs; the detector decides who gets credit.
    // A new detection is held for HOLD seconds before it earns credit, so a wrong guess while the
    // look-back window still holds the previous exercise cannot add reps.
    var changed = this.detector.push(features(lm, w, h), t);
    this.detected = this.detector.current;
    if (changed) {
      this.hold = null;
      if (this.detected) {
        var back = (this.pending[this.detected] || []).filter(function (tt) { return t - tt <= CREDIT_BACK; });
        this.hold = { pattern: this.detected, since: t, reps: back.length, time: 0 };
        this.pending[this.detected] = [];
      }
    }
    Object.keys(this.counters).forEach(function (p) {
      var rep = self.counters[p].update(sample(p, lm, w, h), t);
      if (!rep) return;
      if (p !== self.detected) (self.pending[p] = self.pending[p] || []).push(t);
      else if (self.hold && self.hold.pattern === p) self.hold.reps++;
      else self._credit(p, out);
    });
    Object.keys(this.pending).forEach(function (p) {
      self.pending[p] = self.pending[p].filter(function (tt) { return t - tt <= CREDIT_BACK; });
    });
    if (this.detected && dt > 0) {
      if (this.hold && this.hold.pattern === this.detected) this.hold.time += dt;
      else this._accrue(this.detected, dt, out);
    }
    if (this.hold && this.detected === this.hold.pattern && t - this.hold.since >= HOLD) {
      var hd = this.hold; this.hold = null;
      for (var n = 0; n < hd.reps; n++) this._credit(hd.pattern, out);
      if (hd.time > 0) this._accrue(hd.pattern, hd.time, out);
    }
    this._checkRound(out);
    return out;
  };

  // Call when no person is in frame, so the detector can clear.
  Workout.prototype.idle = function (t) {
    this.lastT = t;
    if (!this.auto) return;
    if (this.detector.push(null, t)) { this.hold = null; }
    this.detected = this.detector.current;
  };

  var api = {
    IDX: IDX, PATTERNS: PATTERNS, EXERCISES: EXERCISES, EQUIPMENT: EQUIPMENT,
    angleDeg: angleDeg, measure: measure, sample: sample, features: features, classify: classify,
    RepCounter: RepCounter, StepCounter: StepCounter, Detector: Detector, Workout: Workout
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RepEngine = api;
})(typeof window !== 'undefined' ? window : this);
