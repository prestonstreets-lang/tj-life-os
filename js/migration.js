import { createDefaultState, uid } from './data.js';
import { normalizeDateOnly } from './date.js';

const LEGACY_KEY = 'tjLifeOS';

const nonNegative = value => Math.max(0, Number(value) || 0);

export function migrateLegacyState(legacy, options = {}) {
  const makeId = options.makeId || uid;
  const nowValue = typeof options.now === 'function' ? options.now() : (options.now || new Date());
  const now = new Date(nowValue);
  const nowIso = Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();
  const next = createDefaultState();
  const completed = Array.isArray(legacy?.missions) ? legacy.missions : [];

  next.meta = { ...next.meta, migratedFrom: LEGACY_KEY, migratedAt: nowIso, dataMode: 'migrated' };
  next.game.level = Math.max(1, Number(legacy?.level) || 1);
  next.game.xp = nonNegative(legacy?.xp);
  next.game.streak = nonNegative(legacy?.streak);
  next.game.perfectDays = 0;
  next.game.categoryLevels = { money: 1, body: 1, streaming: 1, learning: 1, household: 1 };
  next.game.achievements = [];
  next.missions = next.missions.map((mission, index) => ({ ...mission, completed: Boolean(completed[index]), ownerId: 'household' }));

  next.finance.monthGoal = Math.max(1, Number(legacy?.goal) || next.finance.monthGoal);
  next.finance.monthIncome = nonNegative(legacy?.money);
  next.finance.available = next.finance.monthIncome;
  next.finance.reserved = 0;
  next.finance.spent = 0;
  next.finance.dailyTarget = 0;
  next.finance.projectedMonthEnd = next.finance.monthIncome;
  next.finance.income = Array.isArray(legacy?.incomes) ? legacy.incomes.map(item => ({
    id: makeId('income'),
    source: String(item?.source || 'Other'),
    amount: nonNegative(item?.amount),
    date: normalizeDateOnly(item?.date, now),
    ownerId: 'household'
  })) : [];
  next.finance.bills = [];
  next.finance.allocations = [];
  next.finance.weekly = [];
  next.finance.boss = { id: 'boss-money', title: 'Month-End Fortress', current: next.finance.monthIncome, target: next.finance.monthGoal, reward: 0 };

  next.calendar = [];
  next.streaming = { setupProgress: 0, consistency: 0, sessionsThisMonth: 0, revenueMilestone: 0, schedule: [], pipeline: [], skills: [] };
  next.body = { calories: 0, calorieTarget: 0, protein: 0, proteinTarget: 0, water: 0, waterTarget: 0, workoutStreak: 0, muscleProgress: 0, workouts: [] };
  next.learning = { weeklyMinutes: 0, weeklyTarget: 0, milestone: '', skills: [], resources: [] };
  next.activity = [];
  next.captures = Array.isArray(legacy?.captures) ? legacy.captures.map(text => ({
    id: makeId('capture'), type: 'note', title: String(text), createdAt: nowIso, ownerId: 'household'
  })) : [];
  next.analytics = { dailyScores: [], summaries: { win: '', miss: '', priority: '' } };
  next.visionBoards = [];
  next.visionItems = [];
  next.visionMedia = [];
  next.goalLinks = [];
  next.goalMilestones = [];
  next.rewards = [];
  next.rewardUnlocks = [];
  next.motivationHistory = [];
  next.career = { ...next.career, opportunities: [], logs: [], searches: [], resumePrompts: [], activeJobId: null };

  return next;
}
