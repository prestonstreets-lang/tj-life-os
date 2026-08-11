import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateLegacyState } from '../js/migration.js';
import { applyXpDelta } from '../js/progression.js';

test('reopening a mission after crossing a level boundary restores exact progression', () => {
  const before = { level: 4, xp: 950, xpToNext: 1000, streak: 3 };
  const completed = applyXpDelta(before, 125);
  assert.deepEqual(completed, { level: 5, xp: 75, xpToNext: 1000, streak: 3 });

  const reopened = applyXpDelta(completed, -125);
  assert.deepEqual(reopened, before);
});

test('V1 migration preserves real values without injecting V2 demo records', () => {
  const legacy = {
    goal: 5200,
    money: 1875,
    xp: 940,
    level: 7,
    streak: 11,
    missions: [true, false, true, false, true],
    incomes: [{ source: 'Paycheck', amount: 875, date: '7/4/2026' }],
    captures: ['Call the dentist'],
    systems: [{ name: 'Streaming Business', pct: 54 }]
  };
  const original = structuredClone(legacy);
  let sequence = 0;
  const migrated = migrateLegacyState(legacy, {
    now: '2026-08-11T15:30:00.000Z',
    makeId: prefix => `${prefix}-test-${++sequence}`
  });

  assert.deepEqual(legacy, original, 'migration must not mutate the V1 rollback object');
  assert.equal(migrated.meta.dataMode, 'migrated');
  assert.equal(migrated.finance.monthGoal, 5200);
  assert.equal(migrated.finance.monthIncome, 1875);
  assert.deepEqual(migrated.missions.map(item => item.completed), legacy.missions);
  assert.deepEqual(migrated.finance.income.map(item => ({ source: item.source, amount: item.amount, date: item.date })), [
    { source: 'Paycheck', amount: 875, date: '2026-07-04' }
  ]);
  assert.equal(migrated.captures[0].title, 'Call the dentist');

  assert.deepEqual(migrated.finance.bills, []);
  assert.deepEqual(migrated.finance.allocations, []);
  assert.deepEqual(migrated.finance.weekly, []);
  assert.deepEqual(migrated.calendar, []);
  assert.deepEqual(migrated.body.workouts, []);
  assert.deepEqual(migrated.streaming.schedule, []);
  assert.deepEqual(migrated.streaming.pipeline, []);
  assert.deepEqual(migrated.streaming.skills, []);
  assert.deepEqual(migrated.learning.skills, []);
  assert.deepEqual(migrated.learning.resources, []);
  assert.deepEqual(migrated.activity, []);
  assert.deepEqual(migrated.analytics.dailyScores, []);
  assert.deepEqual(migrated.analytics.summaries, { win: '', miss: '', priority: '' });
  assert.deepEqual(migrated.game.achievements, []);

  const serialized = JSON.stringify(migrated);
  for (const demoId of ['bill-rent', 'allocation-rent', 'event-1', 'workout-1', 'stream-s1', 'ai-prompts', 'activity-1']) {
    assert.equal(serialized.includes(demoId), false, `${demoId} must not appear in migrated state`);
  }
});

test('the storage layer copies clean V1 data without changing the rollback value', async () => {
  const legacyRaw = JSON.stringify({
    goal: 4600, money: 900, xp: 975, level: 2, streak: 4,
    missions: [false, true, false, false, false], incomes: [], captures: []
  });
  const values = new Map([['tjLifeOS', legacyRaw]]);
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };

  try {
    const { store } = await import(`../js/store.js?migration-regression=${Date.now()}`);
    const migrated = store.getState();
    assert.equal(values.get('tjLifeOS'), legacyRaw);
    assert.equal(migrated.finance.monthIncome, 900);
    assert.deepEqual(migrated.finance.bills, []);
    assert.deepEqual(migrated.calendar, []);
    assert.deepEqual(migrated.streaming.pipeline, []);
    assert.deepEqual(migrated.body.workouts, []);
    assert.deepEqual(migrated.learning.skills, []);
    assert.deepEqual(migrated.analytics.dailyScores, []);
  } finally {
    delete globalThis.localStorage;
  }
});
