export const SCHEMA_VERSION = 2;

export const SYSTEMS = {
  money: { label: 'Money', eyebrow: 'Financial command', icon: '◈', accent: '#5ef2a5' },
  missions: { label: 'Missions', eyebrow: 'Game system', icon: '✦', accent: '#b482ff' },
  streaming: { label: 'Streaming', eyebrow: 'Creator operations', icon: '◉', accent: '#ff5d8f' },
  body: { label: 'Body', eyebrow: 'Bio systems', icon: '⬡', accent: '#ff9d5c' },
  learning: { label: 'Learning', eyebrow: 'AI skill matrix', icon: '⌁', accent: '#63e6ff' },
  analytics: { label: 'Analytics', eyebrow: 'Signal observatory', icon: '⌁', accent: '#ffc857' }
};

const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const atTime = (hours, minutes = 0, offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

export function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), migratedFrom: null, migratedAt: null },
    household: {
      id: 'household', name: 'Our Household', activeScope: 'household',
      members: [
        { id: 'member-1', name: 'Member 1', color: '#63e6ff', avatar: 'M1' },
        { id: 'member-2', name: 'Member 2', color: '#ff6fcf', avatar: 'M2' }
      ]
    },
    settings: { effects: 'balanced', currency: 'USD', weekStartsOn: 1 },
    game: {
      level: 12, xp: 680, xpToNext: 1000, streak: 7, perfectDays: 3,
      categoryLevels: { money: 8, body: 6, streaming: 5, learning: 9, household: 7 },
      achievements: [
        { id: 'ach-1', title: 'Momentum Online', detail: 'Maintain a seven-day streak', earned: true, icon: '✦' },
        { id: 'ach-2', title: 'Bill Guardian', detail: 'Pay every bill before its due date', earned: false, progress: 72, icon: '◇' },
        { id: 'ach-3', title: 'Perfect Circuit', detail: 'Complete five Perfect Days', earned: false, progress: 60, icon: '◎' }
      ]
    },
    missions: [
      { id: 'mission-money', title: 'Protect the money plan', detail: 'Review cash, next bill and earning target', category: 'money', xp: 150, completed: false, recurring: 'daily', ownerId: 'household' },
      { id: 'mission-body', title: 'Build the body', detail: 'Complete training and protein target', category: 'body', xp: 100, completed: true, recurring: 'daily', ownerId: 'member-1' },
      { id: 'mission-stream', title: 'Creator mission', detail: 'Stream, configure, edit or publish', category: 'streaming', xp: 125, completed: false, recurring: 'weekdays', ownerId: 'member-2' },
      { id: 'mission-learn', title: 'Skill upgrade', detail: 'Finish one focused AI learning block', category: 'learning', xp: 75, completed: true, recurring: 'daily', ownerId: 'member-1' },
      { id: 'mission-reset', title: 'Reset the station', detail: 'Ten-minute household reset', category: 'household', xp: 50, completed: false, recurring: 'daily', ownerId: 'household' }
    ],
    finance: {
      monthGoal: 4000, monthIncome: 2140, available: 1378, reserved: 762, spent: 1280,
      dailyTarget: 118, projectedMonthEnd: 4210,
      income: [
        { id: 'income-1', source: 'Paycheck', amount: 1450, date: isoDay(-6), ownerId: 'member-1' },
        { id: 'income-2', source: 'Uber', amount: 410, date: isoDay(-3), ownerId: 'member-2' },
        { id: 'income-3', source: 'Streaming', amount: 280, date: isoDay(-1), ownerId: 'household' }
      ],
      bills: [
        { id: 'bill-rent', title: 'Rent', amount: 920, dueDate: isoDay(2), status: 'upcoming', ownerId: 'household', category: 'Housing' },
        { id: 'bill-phone', title: 'Phone', amount: 86, dueDate: isoDay(5), status: 'upcoming', ownerId: 'member-1', category: 'Utilities' },
        { id: 'bill-stream', title: 'Creator tools', amount: 42, dueDate: isoDay(8), status: 'upcoming', ownerId: 'member-2', category: 'Business' }
      ],
      allocations: [
        { id: 'allocation-rent', label: 'Rent reserve', amount: 520, target: 920, ownerId: 'household', color: '#5ef2a5' },
        { id: 'allocation-cushion', label: 'Safety cushion', amount: 180, target: 500, ownerId: 'household', color: '#63e6ff' },
        { id: 'allocation-tools', label: 'Creator tools', amount: 62, target: 100, ownerId: 'member-2', color: '#ff5d8f' }
      ],
      weekly: [420, 610, 380, 730, 540, 820, 640],
      boss: { id: 'boss-money', title: 'Month-End Fortress', current: 2140, target: 4000, reward: 600 }
    },
    calendar: [
      { id: 'event-1', title: 'Money check-in', startsAt: atTime(9), system: 'money', ownerId: 'household' },
      { id: 'event-2', title: 'Upper-body session', startsAt: atTime(13, 30), system: 'body', ownerId: 'member-1' },
      { id: 'event-3', title: 'Stream setup', startsAt: atTime(19), system: 'streaming', ownerId: 'member-2' }
    ],
    streaming: {
      setupProgress: 68, consistency: 74, sessionsThisMonth: 7, revenueMilestone: 42,
      schedule: [
        { id: 'stream-s1', day: 'Tue', time: '7:00 PM', title: 'Ranked session', ownerId: 'member-2' },
        { id: 'stream-s2', day: 'Thu', time: '7:30 PM', title: 'Community night', ownerId: 'household' },
        { id: 'stream-s3', day: 'Sat', time: '2:00 PM', title: 'Long-form build', ownerId: 'member-2' }
      ],
      pipeline: [
        { id: 'content-1', title: 'Boss-fight highlight', stage: 'Edit', ownerId: 'member-2' },
        { id: 'content-2', title: 'Setup tour short', stage: 'Capture', ownerId: 'household' },
        { id: 'content-3', title: 'Weekly montage', stage: 'Publish', ownerId: 'member-2' }
      ],
      skills: [
        { id: 'skill-audio', title: 'Broadcast Audio', level: 3, unlocked: true },
        { id: 'skill-scenes', title: 'Scene Craft', level: 2, unlocked: true },
        { id: 'skill-edit', title: 'Fast Editing', level: 2, unlocked: true },
        { id: 'skill-growth', title: 'Growth Loops', level: 1, unlocked: false },
        { id: 'skill-money', title: 'Monetization', level: 1, unlocked: false }
      ]
    },
    body: {
      calories: 1840, calorieTarget: 2550, protein: 142, proteinTarget: 180, water: 5, waterTarget: 8,
      workoutStreak: 4, muscleProgress: 47,
      workouts: [
        { id: 'workout-1', title: 'Upper Strength', date: isoDay(0), duration: 52, completed: false, ownerId: 'member-1' },
        { id: 'workout-2', title: 'Mobility Reset', date: isoDay(-1), duration: 22, completed: true, ownerId: 'member-2' },
        { id: 'workout-3', title: 'Lower Strength', date: isoDay(-2), duration: 48, completed: true, ownerId: 'member-1' }
      ]
    },
    learning: {
      weeklyMinutes: 210, weeklyTarget: 300, milestone: 'Build an AI-assisted household workflow',
      skills: [
        { id: 'ai-prompts', title: 'Prompt Systems', xp: 780, level: 5, ownerId: 'member-1', x: 50, y: 16 },
        { id: 'ai-visual', title: 'AI Visuals', xp: 520, level: 3, ownerId: 'member-2', x: 22, y: 50 },
        { id: 'ai-agents', title: 'Agent Workflows', xp: 410, level: 3, ownerId: 'household', x: 78, y: 50 },
        { id: 'ai-code', title: 'Build Systems', xp: 260, level: 2, ownerId: 'member-1', x: 50, y: 82 }
      ],
      resources: [
        { id: 'resource-1', title: 'Agent design notes', type: 'Note', ownerId: 'household' },
        { id: 'resource-2', title: 'Visual prompting guide', type: 'Resource', ownerId: 'member-2' },
        { id: 'resource-3', title: 'Storage architecture lab', type: 'Project', ownerId: 'member-1' }
      ]
    },
    activity: [
      { id: 'activity-1', title: 'Completed Skill upgrade', detail: '+75 XP', system: 'learning', occurredAt: atTime(8, 42), ownerId: 'member-1' },
      { id: 'activity-2', title: 'Added Streaming income', detail: '+$280', system: 'money', occurredAt: atTime(8, 10), ownerId: 'household' },
      { id: 'activity-3', title: 'Logged 5 cups of water', detail: '63% of target', system: 'body', occurredAt: atTime(7, 45), ownerId: 'member-2' },
      { id: 'activity-4', title: 'Perfect Day chain', detail: '3 this month', system: 'missions', occurredAt: atTime(21, 15, -1), ownerId: 'household' }
    ],
    captures: [],
    analytics: {
      dailyScores: [58, 72, 66, 81, 77, 91, 74],
      summaries: {
        win: 'Learning consistency climbed for the third week in a row.',
        miss: 'Reserved funds are behind the rent allocation checkpoint.',
        priority: 'Close the daily earning gap before the next bill window.'
      }
    }
  };
}

export function uid(prefix = 'item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
