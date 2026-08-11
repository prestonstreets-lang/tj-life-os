import { createDefaultState } from './data.js';
import { normalizeThemeSettings } from './themes.js';

const list = (value, fallback) => Array.isArray(value) ? value : fallback;

export function hydrateState(value = {}) {
  const defaults = createDefaultState();
  const current = value || {};
  return {
    ...defaults,
    ...current,
    meta: { ...defaults.meta, ...current.meta },
    household: {
      ...defaults.household, ...current.household,
      members: list(current.household?.members, defaults.household.members)
    },
    settings: {
      ...defaults.settings, ...current.settings,
      theme: normalizeThemeSettings(current.settings?.theme)
    },
    game: {
      ...defaults.game, ...current.game,
      categoryLevels: { ...defaults.game.categoryLevels, ...current.game?.categoryLevels },
      achievements: list(current.game?.achievements, defaults.game.achievements)
    },
    missions: list(current.missions, defaults.missions),
    finance: {
      ...defaults.finance, ...current.finance,
      income: list(current.finance?.income, defaults.finance.income),
      bills: list(current.finance?.bills, defaults.finance.bills),
      allocations: list(current.finance?.allocations, defaults.finance.allocations),
      weekly: list(current.finance?.weekly, defaults.finance.weekly),
      boss: { ...defaults.finance.boss, ...current.finance?.boss }
    },
    calendar: list(current.calendar, defaults.calendar),
    streaming: {
      ...defaults.streaming, ...current.streaming,
      schedule: list(current.streaming?.schedule, defaults.streaming.schedule),
      pipeline: list(current.streaming?.pipeline, defaults.streaming.pipeline),
      skills: list(current.streaming?.skills, defaults.streaming.skills)
    },
    body: { ...defaults.body, ...current.body, workouts: list(current.body?.workouts, defaults.body.workouts) },
    learning: {
      ...defaults.learning, ...current.learning,
      skills: list(current.learning?.skills, defaults.learning.skills),
      resources: list(current.learning?.resources, defaults.learning.resources)
    },
    activity: list(current.activity, defaults.activity),
    captures: list(current.captures, defaults.captures),
    analytics: { ...defaults.analytics, ...current.analytics, summaries: { ...defaults.analytics.summaries, ...current.analytics?.summaries } },
    career: {
      ...defaults.career, ...current.career,
      profile: { ...defaults.career.profile, ...current.career?.profile },
      opportunities: list(current.career?.opportunities, defaults.career.opportunities),
      logs: list(current.career?.logs, defaults.career.logs),
      searches: list(current.career?.searches, defaults.career.searches),
      resumePrompts: list(current.career?.resumePrompts, defaults.career.resumePrompts)
    }
  };
}
