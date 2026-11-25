// Built-in workouts. target = reps, or seconds for timed exercises (row machine, walking pad).
// capMin = time cap in minutes (0 = none). maxRounds = stop after this many rounds (0 = unlimited).
(function () {
  function W(group, id, name, desc, steps, o) {
    o = o || {};
    return { group: group, id: id, name: name, desc: desc,
      steps: steps.map(function (s) { return { ex: s[0], target: s[1] }; }),
      capMin: o.capMin || 0, maxRounds: o.maxRounds || 0, vest: !!o.vest, auto: !!o.auto };
  }
  var BAR = 'Pull-up bar', BW = 'Bodyweight', DB = 'Dumbbells (20 lb or less)', VEST = 'Weighted vest',
      ROW = 'Row machine', PAD = 'Walking pad', FREE = 'Free';
  window.WORKOUT_LIBRARY = [
    W(BAR, 'cindy', 'Cindy', '20-minute AMRAP (as many rounds as possible): 5 pull-ups, 10 push-ups, 15 squats.',
      [['pullup', 5], ['pushup', 10], ['squat', 15]], { capMin: 20 }),
    W(BAR, 'mini-cindy', 'Mini Cindy', '10-minute AMRAP: 3 pull-ups, 6 push-ups, 9 squats.',
      [['pullup', 3], ['pushup', 6], ['squat', 9]], { capMin: 10 }),
    W(BAR, 'pullup-sets', 'Pull-up sets', '5 rounds of 5 pull-ups, with a 10-squat reset between sets.',
      [['pullup', 5], ['squat', 10]], { maxRounds: 5 }),

    W(BW, 'bw-starter', 'Bodyweight starter', '3 rounds: 10 squats, 10 push-ups.',
      [['squat', 10], ['pushup', 10]], { maxRounds: 3 }),
    W(BW, 'bw-amrap', 'Bodyweight 10-minute AMRAP', '10 minutes: 10 squats, 5 push-ups. Count your rounds.',
      [['squat', 10], ['pushup', 5]], { capMin: 10 }),
    W(BW, 'bw-legs', 'Bodyweight legs', '3 rounds: 12 lunges, 15 squats. Film from the side so your feet are visible.',
      [['lunge', 12], ['squat', 15]], { maxRounds: 3 }),
    W(BW, 'bw-burpee', 'Burpee AMRAP (10 min)', '10 minutes: 5 burpees, 10 squats. Count your rounds.',
      [['burpee', 5], ['squat', 10]], { capMin: 10 }),
    W(BW, 'burpee-trio', 'Burpee trio', '5 rounds: 3 burpees, 6 push-ups, 9 squats.',
      [['burpee', 3], ['pushup', 6], ['squat', 9]], { maxRounds: 5 }),
    W(BW, 'bw-push', 'Push-up ladder', '5 rounds: 5 push-ups, 10 squats.',
      [['pushup', 5], ['squat', 10]], { maxRounds: 5 }),

    W(DB, 'cindy-db', 'Cindy with dumbbell rows', 'Cindy without a bar. 20-minute AMRAP: 5 dumbbell rows, 10 push-ups, 15 squats.',
      [['dbrow', 5], ['pushup', 10], ['squat', 15]], { capMin: 20 }),
    W(DB, 'arm-superset', 'Arm superset', '4 rounds: 10 hammer curls, 10 skull crushers.',
      [['hammercurl', 10], ['skullcrusher', 10]], { maxRounds: 4 }),
    W(DB, 'db-arms', 'Dumbbell arms', '3 rounds: 10 hammer curls, 10 skull crushers, 10 shoulder presses.',
      [['hammercurl', 10], ['skullcrusher', 10], ['dbpress', 10]], { maxRounds: 3 }),
    W(DB, 'db-full', 'Dumbbell full body', '3 rounds: 12 goblet squats, 10 rows, 10 shoulder presses, 10 biceps curls.',
      [['gobletsquat', 12], ['dbrow', 10], ['dbpress', 10], ['bicepcurl', 10]], { maxRounds: 3 }),

    W(VEST, 'vest-cindy', 'Cindy with a weighted vest', 'Cindy while wearing the vest. 20-minute AMRAP: 5 pull-ups, 10 push-ups, 15 squats.',
      [['pullup', 5], ['pushup', 10], ['squat', 15]], { capMin: 20, vest: true }),
    W(VEST, 'vest-bw', 'Vest bodyweight circuit', '3 rounds in the vest: 10 push-ups, 15 squats, 5 pull-ups.',
      [['pushup', 10], ['squat', 15], ['pullup', 5]], { maxRounds: 3, vest: true }),
    W(VEST, 'vest-walk', 'Vest walk (15 min)', 'Walk 15 minutes on the pad in the vest.',
      [['walkpad', 900]], { maxRounds: 1, vest: true }),

    W(ROW, 'row-intervals', 'Row intervals', '4 rounds: 2 minutes on the row machine, then 10 push-ups.',
      [['rowmachine', 120], ['pushup', 10]], { maxRounds: 4 }),
    W(ROW, 'row-10', 'Steady row (10 min)', '10 minutes on the row machine. Strokes are counted.',
      [['rowmachine', 600]], { maxRounds: 1 }),

    W(PAD, 'walk-20', 'Walk (20 min)', '20 minutes on the walking pad. Steps are counted.',
      [['walkpad', 1200]], { maxRounds: 1 }),
    W(PAD, 'walk-strength', 'Walk and strength', '5 rounds: 3 minutes walking, 10 squats, 10 push-ups.',
      [['walkpad', 180], ['squat', 10], ['pushup', 10]], { maxRounds: 5 }),

    W(FREE, 'free', 'Free workout (auto-detect everything)', 'No plan. Start moving and the app detects and counts each exercise.',
      [], { auto: true })
  ];
})();
