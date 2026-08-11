import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJobSearchLinks, buildResumePrompt, scoreJob } from '../js/career.js';
import { hydrateState } from '../js/state.js';
import { normalizeThemeSettings, packForTime, resolveTheme } from '../js/themes.js';
import { parseVoiceCommand } from '../js/voice.js';
import { addCalendarDays, calendarMonthGrid, calendarWeek, dateTimeFromLocalInputs, shiftCalendar } from '../js/calendar.js';

test('theme packs normalize invalid settings and resolve custom spectrum safely', () => {
  const normalized = normalizeThemeSettings({ pack: 'missing', customHue: 999, glow: 'extreme' });
  assert.equal(normalized.pack, 'neon-nexus');
  assert.equal(normalized.customHue, 360);
  assert.equal(normalized.glow, 'cinematic');
  assert.equal(packForTime(8), 'solar-command');
  const custom = resolveTheme({ pack: 'custom-spectrum', customHue: 42, customSaturation: 80, customBrightness: 60 }, 12);
  assert.equal(custom.key, 'custom-spectrum');
  assert.match(custom.colors.accent, /hsl\(42 80% 60%\)/);
});

test('career matching ranks a relevant local role above an unrelated one', () => {
  const profile = { targetRoles: 'customer support specialist', skills: 'zendesk excel ai', location: 'Raleigh', workMode: 'hybrid', salaryMin: 45000 };
  const relevant = scoreJob({ title: 'Customer Support Specialist', location: 'Raleigh, NC', workMode: 'hybrid', salaryMax: 60000, description: 'Use Zendesk, Excel and AI tools.' }, profile);
  const unrelated = scoreJob({ title: 'Warehouse Associate', location: 'Denver, CO', workMode: 'onsite', salaryMax: 35000, description: 'Forklift and inventory.' }, profile);
  assert.ok(relevant.score > unrelated.score);
  assert.ok(relevant.matched.includes('zendesk'));
});

test('job provider links carry the tailored role and location', () => {
  const links = buildJobSearchLinks({ targetRoles: 'product support', location: 'Durham NC' });
  assert.equal(links.length, 4);
  assert.ok(links.every(link => link.url.includes('product')));
  assert.ok(links.some(link => link.url.includes('Durham')));
});

test('resume prompt preserves truth and includes both source documents', () => {
  const prompt = buildResumePrompt({ resume: 'Support lead at Example Co.', jobDescription: 'Needs Zendesk and reporting.', jobTitle: 'Support Manager', company: 'Acme' });
  assert.match(prompt, /Never invent experience/);
  assert.match(prompt, /Support lead at Example Co\./);
  assert.match(prompt, /Needs Zendesk and reporting\./);
  assert.match(prompt, /Support Manager/);
});

test('voice commands route navigation, income, jobs and freeform notes', () => {
  assert.deepEqual(parseVoiceCommand('open jobs'), { kind: 'navigate', route: 'career' });
  assert.equal(parseVoiceCommand('log income $245 from delivery').amount, 245);
  assert.equal(parseVoiceCommand('track a job support specialist at Acme').kind, 'job');
  assert.equal(parseVoiceCommand('track a job support specialist at Acme').job.company, 'Acme');
  assert.deepEqual(parseVoiceCommand('log 3 cups of water'), { kind: 'bodyMetric', field: 'water', amount: 3, unit: 'cups' });
  assert.deepEqual(parseVoiceCommand('log 45 grams of protein'), { kind: 'bodyMetric', field: 'protein', amount: 45, unit: 'g' });
  assert.equal(parseVoiceCommand('pick up prescriptions tomorrow').captureType, 'note');
});

test('hydrating an existing V2 state preserves records and adds empty career state', () => {
  const existing = { schemaVersion: 2, household: { name: 'The Crew', members: [{ id: 'member-1', name: 'Alex' }, { id: 'member-2', name: 'Sam' }] }, settings: {}, missions: [], finance: { income: [], bills: [], allocations: [], weekly: [] }, calendar: [], streaming: { schedule: [], pipeline: [], skills: [] }, body: { workouts: [] }, learning: { skills: [], resources: [] }, activity: [], captures: [] };
  const hydrated = hydrateState(existing);
  assert.equal(hydrated.household.name, 'The Crew');
  assert.deepEqual(hydrated.missions, []);
  assert.deepEqual(hydrated.finance.bills, []);
  assert.deepEqual(hydrated.career.opportunities, []);
});

test('calendar month, week and day navigation remain local-date safe', () => {
  const month = calendarMonthGrid('2026-08-11', 0);
  assert.equal(month.length, 42);
  assert.equal(month[0], '2026-07-26');
  assert.equal(month[41], '2026-09-05');
  assert.deepEqual(calendarWeek('2026-08-11', 0), ['2026-08-09','2026-08-10','2026-08-11','2026-08-12','2026-08-13','2026-08-14','2026-08-15']);
  assert.equal(addCalendarDays('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftCalendar('2026-01-31', 'month', 1), '2026-02-01');
  const local = new Date(dateTimeFromLocalInputs('2026-08-11','09:30'));
  assert.equal(local.getFullYear(), 2026);
  assert.equal(local.getMonth(), 7);
  assert.equal(local.getDate(), 11);
  assert.equal(local.getHours(), 9);
  assert.equal(local.getMinutes(), 30);
});
