import { store } from './store.js';
import { SYSTEMS, uid } from './data.js';
import { compareDateOnly, formatDayLabel, toLocalDateKey } from './date.js';
import { applyXpDelta } from './progression.js';
import { buildJobSearchLinks, buildResumePrompt, scoreJob } from './career.js';
import { THEME_PACKS, normalizeThemeSettings, resolveTheme } from './themes.js';
import { parseVoiceCommand } from './voice.js';

const app = document.querySelector('#app');
const bootSplash = document.querySelector('#bootSplash');
const toastRegion = document.querySelector('#toastRegion');
const validRoutes = new Set(['home', 'money', 'missions', 'streaming', 'body', 'learning', 'analytics', 'career', 'systems', 'settings', 'capture', 'voice']);
let state = store.getState();
let captureType = 'note';
let installPrompt = null;
let refreshing = false;
let overlayReturn = null;
let voiceRecognition = null;
let voiceListening = false;

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.currency || 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
const percent = (value, target) => Math.max(0, Math.min(100, target ? (Number(value) / Number(target)) * 100 : 0));
const dayLabel = date => formatDayLabel(date);
const timeLabel = date => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const system = key => {
  const info = SYSTEMS[key] || { label: 'Household', eyebrow: 'Shared system', icon: '⌂', accent: '#63e6ff' };
  return state.settings.theme?.unifySystems ? { ...info, accent: 'var(--accent)' } : info;
};

function applyTheme() {
  const theme = resolveTheme(state.settings.theme);
  const root = document.documentElement;
  const { colors } = theme;
  root.dataset.theme = theme.key;
  document.body.dataset.theme = theme.key;
  document.body.dataset.glow = theme.settings.glow;
  document.body.dataset.oled = String(theme.settings.oled);
  root.style.setProperty('--bg', colors.bg);
  root.style.setProperty('--bg-2', colors.bg2);
  root.style.setProperty('--panel', `rgba(${colors.panel}, .68)`);
  root.style.setProperty('--panel-solid', `rgb(${colors.panel})`);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-2', colors.accent2);
  root.style.setProperty('--accent-3', colors.accent3);
  root.style.setProperty('--text', colors.text);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--theme-glow-rgb', colors.glow);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.bg);
}

function routeParts() {
  const raw = location.hash.replace(/^#/, '') || 'home';
  const [base, detail] = raw.split('/');
  return validRoutes.has(base) ? { base, detail: detail ? decodeURIComponent(detail) : null } : { base: 'home', detail: null };
}

function go(route, replace = false) {
  const next = `#${route}`;
  const isOverlay = route === 'capture' || route === 'voice' || route.includes('/');
  if (isOverlay) overlayReturn = location.hash || '#home';
  if (replace) {
    history.replaceState(null, '', next);
    render();
  }
  else if (location.hash === next) render();
  else location.hash = next;
  if (!isOverlay) requestAnimationFrame(() => window.scrollTo(0, 0));
}

function owner(ownerId) {
  if (ownerId === 'household') return { label: 'Shared Household', color: '#b482ff', short: 'SH' };
  const member = state.household.members.find(item => item.id === ownerId);
  return member ? { label: member.name, color: member.color, short: member.avatar } : { label: 'Shared Household', color: '#b482ff', short: 'SH' };
}

function ownerChip(ownerId) {
  const item = owner(ownerId);
  return `<span class="owner-chip" style="--owner:${item.color}">${escapeHtml(item.label)}</span>`;
}

function progress(value, target, className = '') {
  return `<div class="progress-track"><div class="progress-fill ${className}" style="width:${percent(value, target).toFixed(1)}%"></div></div>`;
}

function emptyState(title, detail, route = 'capture', action = 'Add first record') {
  return `<div class="empty-state"><span aria-hidden="true">◇</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p>${route ? `<button class="secondary-button" data-route="${route}">${escapeHtml(action)}</button>` : ''}</div>`;
}

function topbar() {
  const online = navigator.onLine;
  return `<header class="topbar">
    <div class="brand">
      <img src="./assets/icon.svg" alt="" width="42" height="42" />
      <div class="brand-copy"><p class="eyebrow">Household command</p><h1>${escapeHtml(state.household.name)}</h1></div>
    </div>
    <div class="status-cluster">
      <div class="status-pill"><i class="status-dot" style="background:${online ? 'var(--green)' : 'var(--gold)'}"></i>${online ? 'Systems online' : 'Offline mode'}</div>
      <button class="icon-button voice-launch" data-route="voice" aria-label="Open Voice Command">◉</button>
      <button class="icon-button" data-route="settings" aria-label="Open Settings">⚙</button>
    </div>
  </header>`;
}

function bottomNav(active) {
  const item = (route, icon, label) => `<button class="nav-item ${active === route ? 'active' : ''}" data-route="${route}" aria-label="${label}"><i>${icon}</i><span>${label}</span></button>`;
  return `<nav class="bottom-nav" aria-label="Primary navigation">
    ${item('home', '⌂', 'Home')}
    ${item('money', '◇', 'Money')}
    <button class="nav-item nav-quick" data-route="capture" aria-label="Quick Add"><i>＋</i><span>Quick Add</span></button>
    ${item('missions', '✦', 'Missions')}
    ${item('systems', '⬡', 'Systems')}
  </nav>`;
}

function viewHeader(title, subtitle, eyebrow = 'Our Life OS') {
  return `<div class="view-header"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="view-title">${escapeHtml(title)}</h1><p class="view-subtitle">${escapeHtml(subtitle)}</p></div></div>`;
}

function homeView() {
  const completed = state.missions.filter(item => item.completed).length;
  const nextBill = [...state.finance.bills].filter(item => item.status !== 'paid').sort((a, b) => compareDateOnly(a.dueDate, b.dueDate))[0];
  const xpPct = percent(state.game.xp, state.game.xpToNext);
  const circumference = 2 * Math.PI * 54;
  const dash = circumference * (xpPct / 100);
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const rankedJobs = state.career.opportunities.map(item => ({ ...item, ...scoreJob(item, state.career.profile) })).sort((a, b) => b.score - a.score);
  const topJob = rankedJobs[0];
  return `<main class="view" data-view="home">
    ${viewHeader('Good momentum.', `${today} · Your shared systems are ready.`, 'Daily command brief')}
    <section class="hud-grid">
      <button class="glass interactive-card level-hero" data-route="missions">
        <div><span class="rank">Life Level</span><div class="level-number">${state.game.level}</div><div class="xp-copy">${state.game.xp.toLocaleString()} / ${state.game.xpToNext.toLocaleString()} XP · ${state.game.xpToNext - state.game.xp} to level ${state.game.level + 1}</div></div>
        <div class="orbit" aria-label="${xpPct.toFixed(0)} percent to next level">
          <i class="orbit-tick"></i>
          <svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="9"/><circle cx="64" cy="64" r="54" fill="none" stroke="url(#xpGradient)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${dash} ${circumference}"/><defs><linearGradient id="xpGradient"><stop stop-color="#63e6ff"/><stop offset="1" stop-color="#ff6fcf"/></linearGradient></defs></svg>
          <div class="orbit-center"><strong>${xpPct.toFixed(0)}%</strong><span>charged</span></div>
        </div>
      </button>
      <div class="mini-grid">
        <button class="glass interactive-card card-pad money-card" data-route="money"><span class="card-label">Money Status <i class="arrow">›</i></span><strong class="metric">${money(state.finance.available)}</strong><div class="metric-note">Available · ${money(state.finance.reserved)} reserved</div>${progress(state.finance.monthIncome, state.finance.monthGoal)}</button>
        <button class="glass interactive-card card-pad mission-card" data-route="missions"><span class="card-label">Today’s Missions <i class="arrow">›</i></span><strong class="metric">${completed}/${state.missions.length}</strong><div class="metric-note">${state.missions.length - completed === 0 ? 'Perfect Day unlocked' : `${state.missions.length - completed} remaining`}</div>${progress(completed, state.missions.length)}</button>
      </div>
      <div class="mini-grid">
        <button class="glass interactive-card card-pad streak-card" data-route="missions/streak"><span class="card-label">Momentum <i class="arrow">›</i></span><strong class="metric">${state.game.streak}<small style="font-size:.42em"> days</small></strong><div class="metric-note">${state.game.perfectDays} Perfect Days this month</div></button>
        <button class="glass interactive-card card-pad" data-route="capture"><span class="card-label">Quick Add <i class="arrow">＋</i></span><strong class="metric accent">Capture</strong><div class="metric-note">Money, mission, meal, event or idea</div></button>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Bill Radar</h2><button class="section-link" data-route="money">Open finance</button></div>
      <button class="glass interactive-card radar-card" data-route="money/${nextBill ? nextBill.id : 'overview'}">
        <div class="radar"><i class="radar-sweep"></i>${nextBill ? '<i class="radar-blip"></i>' : ''}</div>
        <div class="bill-copy"><span class="card-label">Next Bill <i class="arrow">›</i></span><strong class="metric">${nextBill ? money(nextBill.amount) : 'Clear'}</strong><div class="metric-note">${nextBill ? `${escapeHtml(nextBill.title)} · ${dayLabel(nextBill.dueDate)}` : 'No upcoming bills'}</div><div style="margin-top:10px">${nextBill ? ownerChip(nextBill.ownerId) : ''}</div></div>
      </button>
    </section>

    <section class="section">
      <div class="section-head"><h2>Career Radar</h2><button class="section-link" data-route="career">Open career command</button></div>
      <button class="glass interactive-card career-radar" data-route="career">
        <div class="career-beacon"><i></i><span>⌖</span></div>
        <div><span class="card-label">Opportunity Signal <i class="arrow">›</i></span><strong class="metric">${topJob ? `${topJob.score}% match` : 'Ready'}</strong><div class="metric-note">${topJob ? `${escapeHtml(topJob.title)} · ${escapeHtml(topJob.company || 'Tracked lead')}` : `${escapeHtml(state.career.profile.location || 'Set your location')} · ${state.career.opportunities.length} tracked jobs`}</div></div>
      </button>
    </section>

    <section class="section">
      <div class="section-head"><h2>Today’s Calendar</h2><button class="section-link" data-route="capture">Add event</button></div>
      ${state.calendar.length ? `<div class="calendar-strip">${state.calendar.map(event => `<button class="calendar-event" style="--system:${system(event.system).accent}" data-route="home/${event.id}"><time>${timeLabel(event.startsAt)}</time><strong>${escapeHtml(event.title)}</strong>${ownerChip(event.ownerId)}</button>`).join('')}</div>` : `<div class="glass">${emptyState('No events yet', 'V1 had no calendar records to migrate.', 'capture', 'Add an event')}</div>`}
    </section>

    <div class="home-lower">
      <section class="section">
        <div class="section-head"><h2>Today’s Missions</h2><button class="section-link" data-route="missions">View board</button></div>
        <div class="glass list-panel">${state.missions.length ? state.missions.slice(0, 4).map(missionRow).join('') : emptyState('No missions yet', 'Create the household’s first mission.')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>Recent Activity</h2><button class="section-link" data-route="analytics">Open history</button></div>
        <div class="glass list-panel">${state.activity.length ? state.activity.slice(0, 4).map(activityRow).join('') : emptyState('No activity yet', 'New actions will appear here without fabricated history.')}</div>
      </section>
    </div>
  </main>`;
}

function missionRow(item) {
  const info = system(item.category);
  return `<div class="data-row mission-row ${item.completed ? 'is-complete' : ''}" style="--system:${info.accent}" data-route="missions/${item.id}" role="button" tabindex="0">
    <button class="mission-check" data-action="toggle-mission" data-id="${item.id}" aria-label="${item.completed ? 'Mark incomplete' : 'Complete mission'}">✓</button>
    <div><div class="row-title">${escapeHtml(item.title)}</div><div class="row-detail">${escapeHtml(item.detail)}</div></div>
    <div class="row-meta"><strong style="color:${info.accent}">+${item.xp} XP</strong>${ownerChip(item.ownerId)}</div>
  </div>`;
}

function activityRow(item) {
  const info = system(item.system);
  return `<button class="data-row" style="--system:${info.accent}" data-route="analytics/${item.id}"><span class="row-icon">${info.icon}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.detail)}</span></span><span class="row-meta"><time>${timeLabel(item.occurredAt)}</time>${ownerChip(item.ownerId)}</span></button>`;
}

function moduleHeader(key, title, subtitle, value, valueLabel) {
  const info = system(key);
  return `${viewHeader(title, subtitle, info.eyebrow)}<section class="glass module-hero" style="--system:${info.accent}"><div><p class="eyebrow" style="color:${info.accent}">${info.icon} ${info.label} system</p><h2>${escapeHtml(value)}</h2><p>${escapeHtml(valueLabel)}</p></div></section>`;
}

function bars(values, key = 'analytics') {
  if (!values.length) return `<div class="chart-empty">No weekly history has been recorded yet.</div>`;
  const max = Math.max(...values, 1);
  return `<div class="chart" style="--system:${system(key).accent}">${values.map((value, index) => `<div class="bar-col" style="--h:${Math.max(8, value / max * 100)}%;animation-delay:${index * 45}ms"><span>${['M','T','W','T','F','S','S'][index] || index + 1}</span></div>`).join('')}</div>`;
}

function moneyView() {
  const f = state.finance;
  const fill = percent(f.monthIncome, f.monthGoal);
  return `<main class="view" style="--system:${system('money').accent}">
    ${moduleHeader('money', 'Money Command', 'Income, bills, reserves and the month-end battle in one operational view.', money(f.available), 'available household funds')}
    <div class="module-grid section">
      <div>
        <button class="glass interactive-card wide-card boss-card" style="--system:${system('money').accent}" data-route="money/${f.boss.id}"><span class="card-label">Money Boss Battle <i class="arrow">›</i></span><h2>${escapeHtml(f.boss.title)}</h2><div class="boss-health"><i style="width:${fill}%"></i></div><div class="metric-note">${money(f.boss.current)} secured of ${money(f.boss.target)} · Reward +${f.boss.reward} XP</div></button>
        <section class="section"><div class="section-head"><h2>Income by Source</h2><button class="section-link" data-route="capture">Add income</button></div><div class="glass list-panel">${f.income.length ? f.income.slice().reverse().map(item => `<button class="data-row" style="--system:${system('money').accent}" data-route="money/${item.id}"><span class="row-icon">＋</span><span><span class="row-title">${escapeHtml(item.source)}</span><span class="row-detail">${dayLabel(item.date)}</span></span><span class="row-meta"><strong class="positive">+${money(item.amount)}</strong>${ownerChip(item.ownerId)}</span></button>`).join('') : emptyState('No income entries', 'Only real V1 income records are carried forward.', 'capture', 'Add income')}</div></section>
        <section class="section"><div class="section-head"><h2>Bill Radar Queue</h2><span>${f.bills.filter(item => item.status !== 'paid').length} active</span></div><div class="glass list-panel">${f.bills.length ? f.bills.map(item => `<div class="data-row" style="--system:${item.status === 'paid' ? '#5ef2a5' : '#ffc857'}" data-route="money/${item.id}" role="button" tabindex="0"><span class="row-icon">${item.status === 'paid' ? '✓' : '◇'}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.category)} · ${dayLabel(item.dueDate)}</span></span><span class="row-meta"><strong>${money(item.amount)}</strong>${ownerChip(item.ownerId)}</span></div>`).join('') : emptyState('Bill Radar is clear', 'V1 had no bill records to migrate.', 'capture', 'Add a bill')}</div></section>
      </div>
      <aside class="module-sticky">
        <button class="glass interactive-card suitcase-stage" data-route="money/${f.boss.id}" aria-label="Open Money Suitcase"><div class="suitcase" style="--fill:${fill}%"><i class="suitcase-fill"></i><i class="suitcase-grid"></i></div></button>
        <div class="stats-grid section">
          ${statTile('Daily target', money(f.dailyTarget), 'Today’s earning engine', 'money/daily-target')}
          ${statTile('Projection', money(f.projectedMonthEnd), 'End-of-month estimate', 'money/projection')}
          ${statTile('Reserved', money(f.reserved), 'Protected from spend', 'money/reserves')}
          ${statTile('Goal', `${fill.toFixed(0)}%`, `${money(f.monthGoal)} target`, `money/${f.boss.id}`)}
        </div>
      </aside>
    </div>
    <section class="section glass wide-card interactive-card" data-route="money/weekly" role="button" tabindex="0"><span class="card-label">Weekly Income Signal <i class="arrow">›</i></span>${bars(f.weekly, 'money')}</section>
    <section class="section glass wide-card"><div class="section-head"><h2>Reserved Funds</h2><span>${money(f.reserved)} allocated</span></div>${f.allocations.length ? f.allocations.map(item => `<div class="allocation" data-route="money/${item.id}" role="button" tabindex="0"><div class="allocation-line"><span>${escapeHtml(item.label)} · ${ownerChip(item.ownerId)}</span><strong>${money(item.amount)} / ${money(item.target)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${percent(item.amount,item.target)}%;background:${item.color}"></div></div></div>`).join('') : emptyState('No reserved-fund allocations', 'Create allocations when the full money plan is ready.', 'capture', 'Quick Add')}</section>
  </main>`;
}

function statTile(label, value, note, route) {
  return `<button class="glass interactive-card stat-tile" data-route="${route}"><span class="card-label">${escapeHtml(label)} <i class="arrow">›</i></span><strong class="metric">${escapeHtml(value)}</strong><div class="metric-note">${escapeHtml(note)}</div></button>`;
}

function missionsView() {
  const completed = state.missions.filter(item => item.completed).length;
  const perfect = state.missions.length > 0 && completed === state.missions.length;
  return `<main class="view" style="--system:${system('missions').accent}">
    ${moduleHeader('missions', 'Mission Control', 'Daily operations, category levels, streak rewards and goal boss battles.', `${completed}/${state.missions.length}`, perfect ? 'Perfect Day unlocked' : 'daily missions complete')}
    <section class="section glass wide-card boss-card interactive-card" style="--system:${system('missions').accent}" data-route="missions/perfect-day" role="button" tabindex="0"><span class="card-label">Perfect Day Protocol <i class="arrow">›</i></span><h2>${perfect ? 'Reward unlocked: +250 XP' : `${state.missions.length - completed} missions remain`}</h2><div class="boss-health"><i style="width:${percent(completed,state.missions.length)}%"></i></div><div class="metric-note">Chain every daily system to earn the household multiplier.</div></section>
    <section class="section"><div class="section-head"><h2>Today’s Mission Board</h2><button class="section-link" data-route="capture">Create mission</button></div><div class="glass list-panel">${state.missions.length ? state.missions.map(missionRow).join('') : emptyState('No missions yet', 'Create the first shared or member-owned mission.')}</div></section>
    <section class="section"><div class="section-head"><h2>Category Levels</h2><span>Shared progression</span></div><div class="stats-grid">${Object.entries(state.game.categoryLevels).map(([key,value]) => statTile(system(key).label, `Lv ${value}`, 'Open skill track', `missions/category-${key}`)).join('')}</div></section>
    <section class="section"><div class="section-head"><h2>Achievements</h2><span>${state.game.achievements.filter(item=>item.earned).length}/${state.game.achievements.length} earned</span></div><div class="glass list-panel">${state.game.achievements.length ? state.game.achievements.map(item => `<button class="data-row" style="--system:${item.earned ? '#ffc857' : '#927cff'}" data-route="missions/${item.id}"><span class="row-icon">${item.icon}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.detail)}</span></span><span class="row-meta"><strong>${item.earned ? 'Earned' : `${item.progress || 0}%`}</strong><span>›</span></span></button>`).join('') : emptyState('No achievements imported', 'New achievements begin with V2 activity.', 'missions', 'Open mission board')}</div></section>
  </main>`;
}

function streamingView() {
  const s = state.streaming;
  const nextStream = s.schedule[0];
  return `<main class="view" style="--system:${system('streaming').accent}">
    ${moduleHeader('streaming', 'Creator Operations', 'Turn setup, consistency and content output into a visible growth system.', `${s.consistency}%`, 'streaming consistency signal')}
    <div class="stats-grid section">${statTile('Setup', `${s.setupProgress}%`, 'Broadcast readiness', 'streaming/setup')}${statTile('Sessions', s.sessionsThisMonth, 'This month', 'streaming/sessions')}${statTile('Growth', `${s.revenueMilestone}%`, 'Monetization path', 'streaming/growth')}${statTile('Next stream', nextStream?.day || 'None', nextStream?.time || 'Not scheduled', nextStream ? `streaming/${nextStream.id}` : 'capture')}</div>
    <div class="module-grid section"><div>
      <section><div class="section-head"><h2>Schedule</h2><button class="section-link" data-route="capture">Add session</button></div><div class="glass list-panel">${s.schedule.length ? s.schedule.map(item => `<button class="data-row" style="--system:${system('streaming').accent}" data-route="streaming/${item.id}"><span class="row-icon">◉</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${item.day} · ${item.time}</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></button>`).join('') : emptyState('No streaming schedule', 'V1 had no session records to migrate.', 'capture', 'Add a session')}</div></section>
      <section class="section"><div class="section-head"><h2>Content Pipeline</h2><span>${s.pipeline.length} active</span></div><div class="glass list-panel">${s.pipeline.length ? s.pipeline.map(item => `<button class="data-row" style="--system:${system('streaming').accent}" data-route="streaming/${item.id}"><span class="row-icon">${item.stage.slice(0,1)}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">Stage: ${escapeHtml(item.stage)}</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></button>`).join('') : emptyState('Content pipeline is empty', 'New V2 content will appear here.', 'capture', 'Capture content')}</div></section>
    </div><aside class="glass skill-tree module-sticky">${s.skills.length ? s.skills.map((item,index) => `<button class="skill-node ${item.unlocked ? '' : 'locked'}" style="--system:${system('streaming').accent};--x:${[50,22,78,34,70][index]}%;--y:${[18,48,48,78,78][index]}%" data-route="streaming/${item.id}"><strong>${escapeHtml(item.title)}</strong><span>Level ${item.level}</span></button>`).join('') : emptyState('No streaming skills yet', 'The visual skill tree starts clean after migration.', 'streaming/setup', 'Open setup')}</aside></div>
  </main>`;
}

function bodyView() {
  const b = state.body;
  return `<main class="view" style="--system:${system('body').accent}">
    ${moduleHeader('body', 'Body Systems', 'Training, nutrition, hydration and muscle-building momentum.', `${b.workoutStreak} days`, 'current workout streak')}
    <section class="section glass wide-card"><div class="section-head"><h2>Today’s Bio Readout</h2><span>Live targets</span></div><div class="macro-grid">
      ${macroRing(b.calories,b.calorieTarget,'Calories','#ff9d5c')}${macroRing(b.protein,b.proteinTarget,'Protein','#ff6fcf')}${macroRing(b.water,b.waterTarget,'Water','#63e6ff')}${macroRing(b.muscleProgress,100,'Muscle','#5ef2a5')}
    </div></section>
    <div class="stats-grid section">${statTile('Calories', `${b.calories}`, `${b.calorieTarget} target`, 'body/calories')}${statTile('Protein', `${b.protein}g`, `${b.proteinTarget}g target`, 'body/protein')}${statTile('Water', `${b.water}/${b.waterTarget}`, 'Cups today', 'body/water')}${statTile('Build phase', `${b.muscleProgress}%`, 'Muscle trajectory', 'body/muscle')}</div>
    <section class="section"><div class="section-head"><h2>Workout Tracker</h2><button class="section-link" data-route="capture">Log workout</button></div><div class="glass list-panel">${b.workouts.length ? b.workouts.map(item => `<div class="data-row ${item.completed ? 'is-complete' : ''}" style="--system:${system('body').accent}" data-route="body/${item.id}" role="button" tabindex="0"><button class="mission-check" data-action="toggle-workout" data-id="${item.id}" aria-label="Toggle workout">✓</button><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${dayLabel(item.date)} · ${item.duration} min</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></div>`).join('') : emptyState('No workouts recorded', 'V1 had no workout history to migrate.', 'capture', 'Log a workout')}</div></section>
  </main>`;
}

function macroRing(value, target, label, color) {
  return `<button class="macro-ring interactive-card" style="--p:${percent(value,target)};--ring:${color}" data-route="body/${label.toLowerCase()}"><span><strong>${value}${label === 'Protein' ? 'g' : ''}</strong><span>${label}</span></span></button>`;
}

function learningView() {
  const l = state.learning;
  const remaining = Math.max(0, l.weeklyTarget - l.weeklyMinutes);
  return `<main class="view" style="--system:${system('learning').accent}">
    ${moduleHeader('learning', 'AI Skill Matrix', 'Build individual mastery while advancing shared household capability.', `${l.weeklyMinutes} min`, l.weeklyTarget ? `${remaining} minutes to weekly mission` : 'No learning target set yet')}
    <section class="section glass skill-tree">${l.skills.length ? l.skills.map(item => `<button class="skill-node" style="--system:${system('learning').accent};--x:${item.x}%;--y:${item.y}%" data-route="learning/${item.id}"><strong>${escapeHtml(item.title)}</strong><span>Lv ${item.level} · ${item.xp} XP</span></button>`).join('') : emptyState('No AI skills yet', 'The migrated skill tree contains no demo nodes.', 'capture', 'Capture a learning goal')}</section>
    ${l.milestone ? `<section class="section glass wide-card interactive-card" data-route="learning/milestone" role="button" tabindex="0"><span class="card-label">Active Milestone <i class="arrow">›</i></span><h2>${escapeHtml(l.milestone)}</h2>${progress(l.weeklyMinutes,l.weeklyTarget)}<div class="metric-note">Weekly learning charge: ${percent(l.weeklyMinutes,l.weeklyTarget).toFixed(0)}%</div></section>` : `<section class="section glass wide-card">${emptyState('No active learning milestone', 'Choose a real V2 goal when you are ready.', 'capture', 'Capture a milestone')}</section>`}
    <section class="section"><div class="section-head"><h2>Notes & Resources</h2><button class="section-link" data-route="capture">Add resource</button></div><div class="glass list-panel">${l.resources.length ? l.resources.map(item => `<button class="data-row" style="--system:${system('learning').accent}" data-route="learning/${item.id}"><span class="row-icon">⌁</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.type)}</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></button>`).join('') : emptyState('No notes or resources', 'V1 had no learning library to migrate.', 'capture', 'Add a resource')}</div></section>
  </main>`;
}

function analyticsView() {
  const a = state.analytics;
  const latestScore = a.dailyScores.at(-1);
  const summaries = [
    ['Biggest Win', a.summaries.win, '#5ef2a5', 'analytics/biggest-win'],
    ['Biggest Miss', a.summaries.miss, '#ff5d7d', 'analytics/biggest-miss'],
    ['Next Priority', a.summaries.priority, '#ffc857', 'analytics/next-priority']
  ].filter(([, value]) => value);
  return `<main class="view" style="--system:${system('analytics').accent}">
    ${moduleHeader('analytics', 'Signal Observatory', 'A shared timeline, weekly scoreboard and automated reflection layer.', latestScore == null ? 'No score' : `${latestScore}%`, latestScore == null ? 'Analytics starts with real V2 activity' : 'today’s household score')}
    <section class="section glass wide-card interactive-card" data-route="analytics/scoreboard" role="button" tabindex="0"><span class="card-label">Weekly Scoreboard <i class="arrow">›</i></span>${bars(a.dailyScores,'analytics')}</section>
    <section class="section summary-grid">${summaries.length ? summaries.map(([label,value,color,route]) => `<button class="glass interactive-card summary-card" style="--summary:${color}" data-route="${route}"><strong>${label}</strong><p>${escapeHtml(value)}</p></button>`).join('') : `<div class="glass summary-empty">${emptyState('No automated summary yet', 'Wins, misses and priorities will be generated from real history.', 'capture', 'Add activity')}</div>`}</section>
    <section class="section"><div class="section-head"><h2>Daily Activity Timeline</h2><span>${state.activity.length} recorded signals</span></div><div class="glass list-panel">${state.activity.length ? state.activity.map(activityRow).join('') : emptyState('No timeline history', 'Migrated users begin without fabricated analytics.', 'capture', 'Record first activity')}</div></section>
  </main>`;
}

function memberOptions(selected = 'household') {
  return [{ id: 'household', name: 'Shared Household' }, ...state.household.members]
    .map(item => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
}

function careerView() {
  const career = state.career;
  const profile = career.profile;
  const ranked = career.opportunities.map(item => ({ ...item, ...scoreJob(item, profile) })).sort((a, b) => b.score - a.score);
  const active = career.opportunities.find(item => item.id === career.activeJobId) || ranked[0] || null;
  const providers = buildJobSearchLinks(profile);
  const statuses = ['Saved', 'Applied', 'Interview', 'Offer'];
  const prompt = career.resumePrompts[0];
  return `<main class="view career-view" style="--system:${system('career').accent}">
    ${moduleHeader('career', 'Career Command', 'Find relevant local roles, rank opportunities, track applications and tailor truthful resumes.', ranked[0] ? `${ranked[0].score}%` : 'Ready', ranked[0] ? 'top opportunity match' : 'configure your search signal')}
    <section class="career-pipeline section">${statuses.map(status => `<button class="glass pipeline-tile" data-route="career"><span>${escapeHtml(status)}</span><strong>${career.opportunities.filter(item => (item.status || 'Saved') === status).length}</strong></button>`).join('')}</section>
    <div class="module-grid section">
      <div>
        <form class="glass settings-section" id="careerProfileForm">
          <div class="section-head"><h2>Search Signal</h2><span>Saved only on this device</span></div>
          <div class="field-grid career-fields">
            <label class="field-label">Target roles<input class="field" name="targetRoles" value="${escapeHtml(profile.targetRoles)}" placeholder="Operations manager, support specialist" required /></label>
            <label class="field-label">Location<input class="field" name="location" value="${escapeHtml(profile.location)}" placeholder="City, state or ZIP" required /></label>
            <label class="field-label">Radius (miles)<input class="field" name="radius" type="number" min="1" max="100" value="${profile.radius}" /></label>
            <label class="field-label">Work mode<select class="field" name="workMode">${['any','onsite','hybrid','remote'].map(value => `<option value="${value}" ${profile.workMode === value ? 'selected' : ''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label>
            <label class="field-label">Skills / keywords<input class="field" name="skills" value="${escapeHtml(profile.skills)}" placeholder="Excel, customer success, AI" /></label>
            <label class="field-label">Minimum salary<input class="field" name="salaryMin" type="number" min="0" step="1000" value="${profile.salaryMin || ''}" placeholder="50000" /></label>
            <label class="field-label">Search belongs to<select class="field" name="ownerId">${memberOptions(profile.ownerId)}</select></label>
          </div>
          <button class="primary-button" type="submit">Save search profile</button>
        </form>
        <section class="section"><div class="section-head"><h2>Live Search Launchers</h2><span>Opens trusted job providers</span></div><div class="provider-grid">${providers.map(provider => `<button class="glass provider-card" data-action="open-job-provider" data-url="${escapeHtml(provider.url)}" data-provider="${provider.id}"><i>${provider.id === 'usajobs' ? '★' : '⌖'}</i><strong>${escapeHtml(provider.label)}</strong><span>${escapeHtml(provider.detail)}</span><b>Search now ↗</b></button>`).join('')}</div></section>
        <section class="section"><div class="section-head"><h2>Opportunity Pipeline</h2><span>${ranked.length} tracked</span></div><div class="glass list-panel">${ranked.length ? ranked.map(item => `<button class="data-row job-row" style="--system:${system('career').accent}" data-route="career/${item.id}"><span class="match-score">${item.score}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.company || 'Company not set')} · ${escapeHtml(item.location || 'Location not set')}</span></span><span class="row-meta"><strong>${escapeHtml(item.status || 'Saved')}</strong>${ownerChip(item.ownerId)}</span></button>`).join('') : emptyState('No tracked opportunities', 'Run a tailored search, then add a promising role below.', null)}</div></section>
      </div>
      <aside class="module-sticky">
        <form class="glass settings-section" id="jobLeadForm">
          <div class="section-head"><h2>Track a Job</h2><span>Local relevance scoring</span></div>
          <div class="field-grid">
            <label class="field-label">Job title<input class="field" name="title" required placeholder="Role title" /></label>
            <label class="field-label">Company<input class="field" name="company" placeholder="Company" /></label>
            <label class="field-label">Location<input class="field" name="location" value="${escapeHtml(profile.location)}" placeholder="City, state or Remote" /></label>
            <label class="field-label">Listing URL<input class="field" name="url" type="url" placeholder="https://…" /></label>
            <label class="field-label">Description<textarea class="field" name="description" rows="5" required placeholder="Paste the complete job description"></textarea></label>
            <label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions(profile.ownerId)}</select></label>
          </div><button class="primary-button" type="submit">Score & track opportunity</button>
        </form>
      </aside>
    </div>
    <section class="section glass settings-section resume-lab">
      <div class="section-head"><h2>Resume Retargeting Lab</h2><span>Prompt-based · never fabricates experience</span></div>
      <form id="resumeForm" class="field-grid career-fields">
        <label class="field-label">Tracked job<select class="field" name="jobId" id="resumeJobSelect"><option value="">Custom job description</option>${ranked.map(item => `<option value="${item.id}" ${active?.id === item.id ? 'selected' : ''}>${escapeHtml(item.title)} — ${escapeHtml(item.company)}</option>`).join('')}</select></label>
        <label class="field-label">Base resume<textarea class="field" name="resume" rows="8" required placeholder="Paste your current resume">${escapeHtml(profile.resumeText)}</textarea></label>
        <label class="field-label">Job description<textarea class="field" name="jobDescription" rows="8" required placeholder="Paste the target job description">${escapeHtml(active?.description || '')}</textarea></label>
        <label class="field-label">Job title<input class="field" name="jobTitle" value="${escapeHtml(active?.title || '')}" /></label>
        <label class="field-label">Company<input class="field" name="company" value="${escapeHtml(active?.company || '')}" /></label>
        <label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions(active?.ownerId || profile.ownerId)}</select></label>
        <button class="primary-button" type="submit">Generate tailoring prompt</button>
      </form>
      ${prompt ? `<div class="prompt-output"><div class="section-head"><h2>Ready-to-use prompt</h2><span>${timeLabel(prompt.createdAt)}</span></div><pre>${escapeHtml(prompt.prompt)}</pre><div class="button-row"><button class="secondary-button" data-action="copy-resume-prompt">Copy prompt</button><button class="secondary-button" data-action="download-resume-prompt">Download .txt</button></div></div>` : ''}
    </section>
    <section class="section"><div class="section-head"><h2>Application Log</h2><span>${career.logs.length} events</span></div><div class="glass list-panel">${career.logs.length ? career.logs.map(log => `<button class="data-row" data-route="career/${log.jobId}"><span class="row-icon">⌁</span><span><span class="row-title">${escapeHtml(log.title)}</span><span class="row-detail">${escapeHtml(log.detail)}</span></span><span class="row-meta"><time>${timeLabel(log.occurredAt)}</time>${ownerChip(log.ownerId)}</span></button>`).join('') : emptyState('No application activity', 'Status changes and resume work will appear here.', null)}</div></section>
  </main>`;
}

function systemsView() {
  const cards = ['career','streaming','body','learning','analytics'];
  return `<main class="view">${viewHeader('System Matrix', 'Open a complete visual command center for each area of household growth.', 'All operational systems')}<div class="stats-grid">${cards.map(key => { const info=system(key); return `<button class="glass interactive-card module-hero" style="--system:${info.accent};min-height:210px" data-route="${key}"><div><p class="eyebrow" style="color:${info.accent}">${info.eyebrow}</p><h2 style="font-size:32px">${info.label}</h2><p>Open system command ›</p></div></button>`; }).join('')}</div></main>`;
}

function settingsView() {
  const storage = store.storageInfo();
  return `<main class="view">${viewHeader('Settings', 'Personalize the household, motion level and local data controls.', 'Command configuration')}
    <form class="glass settings-section" id="settingsForm">
      <h2>Household Identity</h2><div class="field-grid">
        <label class="field-label">Household name<input class="field" name="householdName" maxlength="40" value="${escapeHtml(state.household.name)}" /></label>
        ${state.household.members.map((member,index) => `<label class="field-label">Member ${index + 1} display name<input class="field" name="${member.id}" maxlength="32" value="${escapeHtml(member.name)}" /></label>`).join('')}
      </div><button class="primary-button" type="submit" style="margin-top:14px">Save household names</button>
    </form>
    <section class="glass settings-section"><div class="section-head"><h2>Full-Spectrum Theme Packs</h2><span>Tap for instant preview</span></div><div class="theme-grid">${Object.entries(THEME_PACKS).map(([key,theme]) => `<button class="theme-card ${state.settings.theme.pack === key && !state.settings.theme.autoTime ? 'active' : ''}" data-action="set-theme" data-value="${key}" style="--swatch-a:${theme.colors.accent};--swatch-b:${theme.colors.accent2};--swatch-c:${theme.colors.accent3}"><i>${theme.icon}</i><strong>${escapeHtml(theme.name)}</strong><span>${escapeHtml(theme.detail)}</span><b></b></button>`).join('')}<button class="theme-card ${state.settings.theme.pack === 'custom-spectrum' && !state.settings.theme.autoTime ? 'active' : ''}" data-action="set-theme" data-value="custom-spectrum" style="--swatch-a:hsl(${state.settings.theme.customHue} 90% 58%);--swatch-b:hsl(${(state.settings.theme.customHue+72)%360} 90% 63%);--swatch-c:hsl(${(state.settings.theme.customHue+188)%360} 90% 66%)"><i>◎</i><strong>Custom Spectrum</strong><span>Calibrate any hue across the full color wheel</span><b></b></button></div></section>
    <form class="glass settings-section" id="themeForm"><h2>Theme Calibration</h2><div class="field-grid theme-controls"><label class="field-label">Hue <output>${state.settings.theme.customHue}°</output><input name="customHue" type="range" min="0" max="360" value="${state.settings.theme.customHue}" /></label><label class="field-label">Saturation <output>${state.settings.theme.customSaturation}%</output><input name="customSaturation" type="range" min="20" max="100" value="${state.settings.theme.customSaturation}" /></label><label class="field-label">Brightness <output>${state.settings.theme.customBrightness}%</output><input name="customBrightness" type="range" min="30" max="75" value="${state.settings.theme.customBrightness}" /></label><label class="field-label">Glow intensity<select class="field" name="glow">${['off','low','cinematic'].map(value => `<option value="${value}" ${state.settings.theme.glow === value ? 'selected' : ''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label></div><div class="toggle-grid"><label><input type="checkbox" name="oled" ${state.settings.theme.oled ? 'checked' : ''}/> OLED true black</label><label><input type="checkbox" name="unifySystems" ${state.settings.theme.unifySystems ? 'checked' : ''}/> Unify system colors</label><label><input type="checkbox" name="autoTime" ${state.settings.theme.autoTime ? 'checked' : ''}/> Shift palette by time</label></div><button class="primary-button" type="submit">Apply calibration</button></form>
    <section class="glass settings-section"><h2>Cinematic Effects</h2><div class="effects-picker">${['full','balanced','reduced'].map(value => `<button class="effect-option ${state.settings.effects === value ? 'active' : ''}" data-action="set-effects" data-value="${value}">${value[0].toUpperCase()+value.slice(1)}</button>`).join('')}</div><p class="metric-note">Reduced motion preferences from your device always take priority.</p></section>
    <form class="glass settings-section" id="voiceSettingsForm"><h2>Voice Command</h2><label class="field-label">Recognition language<select class="field" name="voiceLanguage">${[['en-US','English (United States)'],['en-GB','English (United Kingdom)'],['es-US','Español (Estados Unidos)']].map(([value,label]) => `<option value="${value}" ${state.settings.voiceLanguage === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="secondary-button" type="submit">Save voice settings</button></form>
    <section class="glass settings-section"><h2>PWA & Storage</h2><div class="storage-note">Active store: ${storage.activeKey}<br>V1 rollback source: ${storage.legacyPreserved ? 'Preserved and untouched' : 'No V1 state found on this device'}<br>Components use the storage abstraction only.</div><div class="button-row"><button class="secondary-button" data-action="install-app">Install app</button><button class="secondary-button" data-action="export-data">Export V2 data</button><button class="secondary-button" data-action="import-data">Import V2 data</button><input type="file" id="importFile" accept="application/json" hidden /></div></section>
    <section class="glass settings-section"><h2>Recovery</h2><p class="metric-note">Resetting V2 restores starter data but does not delete or modify the original V1 key.</p><button class="danger-button" data-action="reset-v2">Reset V2 only</button></section>
  </main>`;
}

function detailFor(base, id) {
  const collections = {
    money: [...state.finance.bills, ...state.finance.income, ...state.finance.allocations, state.finance.boss],
    missions: [...state.missions, ...state.game.achievements],
    streaming: [...state.streaming.schedule, ...state.streaming.pipeline, ...state.streaming.skills],
    body: state.body.workouts,
    learning: [...state.learning.skills, ...state.learning.resources],
    analytics: state.activity,
    career: state.career.opportunities,
    home: state.calendar
  };
  return collections[base]?.find(item => item.id === id) || null;
}

function detailSheet(base, id) {
  const item = detailFor(base, id);
  const info = system(base);
  const titles = {
    overview: `${info.label} overview`, streak: 'Momentum streak', 'perfect-day': 'Perfect Day Protocol',
    'daily-target': 'Daily earning target', projection: 'Month-end projection', reserves: 'Reserved funds', weekly: 'Weekly signal',
    setup: 'Broadcast setup', sessions: 'Session log', growth: 'Growth milestones', calories: 'Calories', protein: 'Protein target', water: 'Hydration', muscle: 'Muscle-building progress', milestone: 'Learning milestone', scoreboard: 'Weekly scoreboard',
    'biggest-win': 'Biggest win', 'biggest-miss': 'Biggest miss', 'next-priority': 'Next priority'
  };
  const title = item?.title || item?.label || item?.source || titles[id] || `${info.label} detail`;
  const details = [];
  if (item?.amount != null) details.push(['Amount', money(item.amount)]);
  if (item?.dueDate) details.push(['Due', dayLabel(item.dueDate)]);
  if (item?.date) details.push(['Date', dayLabel(item.date)]);
  if (item?.stage) details.push(['Pipeline stage', item.stage]);
  if (item?.level != null) details.push(['Level', item.level]);
  if (item?.xp != null) details.push(['XP', item.xp]);
  if (item?.duration) details.push(['Duration', `${item.duration} minutes`]);
  if (item?.company) details.push(['Company', item.company]);
  if (item?.location) details.push(['Location', item.location]);
  if (base === 'career' && item) details.push(['Match score', `${scoreJob(item, state.career.profile).score}%`], ['Pipeline', item.status || 'Saved']);
  if (item?.detail) details.push(['Signal', item.detail]);
  if (item?.ownerId) details.push(['Ownership', owner(item.ownerId).label]);
  if (!details.length) details.push(['System status', 'No records yet'], ['Purpose', 'This drill-down is ready for real household data.']);
  let action = '';
  if (base === 'money' && item?.dueDate) action = `<button class="primary-button" data-action="toggle-bill" data-id="${item.id}">${item.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}</button>`;
  if (base === 'missions' && item?.xp != null && 'completed' in item) action = `<button class="primary-button" data-action="toggle-mission" data-id="${item.id}">${item.completed ? 'Reopen mission' : `Complete +${item.xp} XP`}</button>`;
  if (base === 'streaming' && item?.stage) action = `<button class="primary-button" data-action="advance-pipeline" data-id="${item.id}">Advance pipeline stage</button>`;
  if (base === 'body' && item?.duration) action = `<button class="primary-button" data-action="toggle-workout" data-id="${item.id}">${item.completed ? 'Mark incomplete' : 'Complete workout'}</button>`;
  if (base === 'learning' && item?.xp != null) action = `<button class="primary-button" data-action="add-skill-xp" data-id="${item.id}">Add 25 skill XP</button>`;
  if (base === 'career' && item) action = `<button class="primary-button" data-action="advance-job" data-id="${item.id}">Advance from ${escapeHtml(item.status || 'Saved')}</button><button class="secondary-button" data-action="prepare-resume" data-id="${item.id}">Tailor resume</button>${item.url ? `<button class="secondary-button" data-action="open-job-listing" data-id="${item.id}">Open listing ↗</button>` : ''}`;
  return `<div class="sheet-wrap" data-action="close-overlay"><section class="sheet" style="--system:${info.accent}" role="dialog" aria-modal="true" aria-labelledby="detailTitle" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow" style="color:${info.accent}">${info.eyebrow}</p><h2 id="detailTitle">${escapeHtml(title)}</h2></div><button class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="detail-grid">${details.map(([label,value]) => `<div class="detail-block"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}</div><div class="button-row">${action}<button class="secondary-button" data-route="${base}">Open full ${escapeHtml(info.label)} system</button></div></section></div>`;
}

function captureSheet() {
  const types = [
    ['note','⌁','Note'],['income','＋','Income'],['expense','−','Expense'],['bill','◇','Bill'],['mission','✦','Mission'],['event','◷','Event'],['workout','⬡','Workout'],['meal','◌','Meal'],['stream','◉','Stream']
  ];
  const owners = memberOptions();
  const needsAmount = ['income','expense','bill'].includes(captureType);
  return `<div class="sheet-wrap" data-action="close-overlay"><form class="sheet" id="captureForm" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Smart Quick Capture</p><h2>Route a new signal</h2></div><button type="button" class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><button type="button" class="voice-invite" data-route="voice"><i>◉</i><span><strong>Speak it instead</strong><small>Log money, jobs, missions, meals and more</small></span><b>›</b></button><div class="capture-types">${types.map(([type,icon,label]) => `<button type="button" class="capture-type ${captureType === type ? 'active' : ''}" data-action="capture-type" data-value="${type}"><i>${icon}</i><span>${label}</span></button>`).join('')}</div><div class="field-grid"><label class="field-label">Title<input class="field" name="title" required maxlength="80" placeholder="What happened or needs action?" autofocus /></label>${needsAmount ? '<label class="field-label">Amount<input class="field" name="amount" type="number" min="0" step="0.01" required placeholder="0.00" /></label>' : ''}<label class="field-label">Ownership<select class="field" name="ownerId">${owners}</select></label><label class="field-label">Details<textarea class="field" name="detail" rows="2" maxlength="180" placeholder="Optional context"></textarea></label></div><button class="primary-button" type="submit" style="width:100%;margin-top:14px">Add to Our Life OS</button></form></div>`;
}

function voiceSheet() {
  const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  return `<div class="sheet-wrap" data-action="close-overlay"><form class="sheet voice-sheet" id="voiceForm" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Voice Command</p><h2>Speak to Our Life OS</h2></div><button type="button" class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="voice-core ${voiceListening ? 'is-listening' : ''}"><button type="button" class="voice-orb" data-action="${voiceListening ? 'stop-voice' : 'start-voice'}" aria-label="${voiceListening ? 'Stop listening' : 'Start voice input'}"><i></i><span>◉</span></button><strong id="voiceStatus">${voiceListening ? 'Listening…' : supported ? 'Tap to speak' : 'Type your command below'}</strong><small>${supported ? 'Your browser will ask for microphone permission.' : 'Speech recognition is unavailable here; typed routing still works.'}</small></div><label class="field-label">Command<textarea class="field voice-transcript" id="voiceTranscript" name="transcript" rows="3" required placeholder="Log income 200 dollars from delivery"></textarea></label><label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions()}</select></label><div class="voice-examples"><button type="button" data-action="voice-example" data-value="Log income 200 dollars from delivery">Income</button><button type="button" data-action="voice-example" data-value="Add mission review tomorrow's plan">Mission</button><button type="button" data-action="voice-example" data-value="Track a job product support specialist at Acme">Job</button><button type="button" data-action="voice-example" data-value="Log a workout upper body strength">Workout</button></div><button class="primary-button" type="submit">Understand & route command</button></form></div>`;
}

function render() {
  const route = routeParts();
  applyTheme();
  if (!['capture','voice'].includes(route.base) && !route.detail) overlayReturn = null;
  const base = ['capture','voice'].includes(route.base) ? 'home' : route.base;
  const views = { home: homeView, money: moneyView, missions: missionsView, streaming: streamingView, body: bodyView, learning: learningView, analytics: analyticsView, career: careerView, systems: systemsView, settings: settingsView };
  document.body.dataset.effects = state.settings.effects || 'balanced';
  app.innerHTML = `${topbar()}${(views[base] || homeView)()}${bottomNav(base)}${route.base === 'capture' ? captureSheet() : route.base === 'voice' ? voiceSheet() : route.detail ? detailSheet(base, route.detail) : ''}`;
}

function closeOverlay() {
  const route = routeParts();
  if (overlayReturn) { overlayReturn = null; history.back(); }
  else if (['capture','voice'].includes(route.base)) go('home', true);
  else if (route.detail) go(route.base, true);
}

function toast(message) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  toastRegion.append(element);
  setTimeout(() => element.remove(), 3800);
}

function toggleMission(id) {
  let result;
  store.update(next => {
    const mission = next.missions.find(item => item.id === id);
    if (!mission) return;
    mission.completed = !mission.completed;
    const delta = mission.completed ? mission.xp : -mission.xp;
    next.game = applyXpDelta(next.game, delta);
    next.activity.unshift({ id: uid('activity'), title: `${mission.completed ? 'Completed' : 'Reopened'} ${mission.title}`, detail: `${delta > 0 ? '+' : ''}${delta} XP`, system: mission.category, ownerId: mission.ownerId, occurredAt: new Date().toISOString() });
    result = mission.completed;
  });
  toast(result ? 'Mission complete. XP charged.' : 'Mission reopened. XP adjusted.');
}

function applyCapture({ type = captureType, title, detail = '', amount = 0, ownerId = 'household' }) {
  title = String(title || '').trim();
  detail = String(detail || '').trim();
  amount = Math.max(0, Number(amount) || 0);
  if (!title) return;
  store.update(next => {
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const localDay = toLocalDateKey(nowDate);
    next.captures.unshift({ id: uid('capture'), type, title, detail, amount, ownerId, createdAt: now });
    let systemKey = 'missions';
    let activityDetail = detail || type;
    if (type === 'income') {
      const entry = { id: uid('income'), source: title, amount, date: localDay, ownerId };
      next.finance.income.push(entry); next.finance.monthIncome += amount; next.finance.available += amount; next.finance.boss.current = next.finance.monthIncome; systemKey = 'money'; activityDetail = `+${money(amount)}`;
    } else if (type === 'expense') {
      next.finance.spent += amount; next.finance.available = Math.max(0, next.finance.available - amount); systemKey = 'money'; activityDetail = `-${money(amount)}`;
    } else if (type === 'bill') {
      const dueDate = new Date(nowDate); dueDate.setDate(dueDate.getDate() + 7);
      next.finance.bills.push({ id: uid('bill'), title, amount, dueDate: toLocalDateKey(dueDate), status: 'upcoming', ownerId, category: detail || 'Other' }); systemKey = 'money'; activityDetail = `${money(amount)} due in 7 days`;
    } else if (type === 'mission') {
      next.missions.push({ id: uid('mission'), title, detail: detail || 'Custom household mission', category: 'household', xp: 75, completed: false, recurring: 'once', ownerId });
    } else if (type === 'event') {
      next.calendar.push({ id: uid('event'), title, startsAt: new Date(Date.now()+3600000).toISOString(), system: 'missions', ownerId });
    } else if (type === 'workout') {
      next.body.workouts.unshift({ id: uid('workout'), title, date: localDay, duration: 30, completed: true, ownerId }); systemKey = 'body'; activityDetail = detail || '30 minute session';
    } else if (type === 'stream') systemKey = 'streaming';
    else if (type === 'meal') systemKey = 'body';
    next.activity.unshift({ id: uid('activity'), title: `Captured ${title}`, detail: activityDetail, system: systemKey, ownerId, occurredAt: now });
  });
  return true;
}

function submitCapture(form) {
  const data = new FormData(form);
  const saved = applyCapture({ type: captureType, title: data.get('title'), detail: data.get('detail'), ownerId: String(data.get('ownerId') || 'household'), amount: data.get('amount') });
  if (!saved) return;
  captureType = 'note';
  toast('Captured and routed successfully.');
  go('home', true);
}

function addJob(job, ownerId = state.career.profile.ownerId) {
  const saved = { id: uid('job'), title: String(job.title || '').trim(), company: String(job.company || '').trim(), location: String(job.location || state.career.profile.location || '').trim(), url: String(job.url || '').trim(), description: String(job.description || '').trim(), workMode: job.workMode || 'any', status: 'Saved', ownerId, createdAt: new Date().toISOString() };
  if (!saved.title) return null;
  store.update(next => {
    next.career.opportunities.unshift(saved);
    next.career.activeJobId = saved.id;
    next.career.logs.unshift({ id: uid('job-log'), jobId: saved.id, title: `Tracked ${saved.title}`, detail: saved.company || 'New opportunity', status: 'Saved', ownerId, occurredAt: saved.createdAt });
    next.activity.unshift({ id: uid('activity'), title: `Tracked job: ${saved.title}`, detail: saved.company || saved.location || 'Career opportunity', system: 'career', ownerId, occurredAt: saved.createdAt });
  });
  return saved;
}

function startVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast('Voice recognition is unavailable here. Type the command instead.');
  voiceRecognition?.abort();
  voiceRecognition = new Recognition();
  voiceRecognition.lang = state.settings.voiceLanguage || 'en-US';
  voiceRecognition.interimResults = true;
  voiceRecognition.continuous = false;
  voiceRecognition.onstart = () => { voiceListening = true; render(); };
  voiceRecognition.onresult = event => {
    const transcript = Array.from(event.results).map(result => result[0].transcript).join(' ');
    const field = document.querySelector('#voiceTranscript');
    if (field) field.value = transcript;
  };
  voiceRecognition.onerror = event => { voiceListening = false; render(); toast(event.error === 'not-allowed' ? 'Microphone permission was not granted. You can still type.' : 'Voice input paused. Try again or type your command.'); };
  voiceRecognition.onend = () => { voiceListening = false; const field = document.querySelector('#voiceTranscript'); const transcript = field?.value || ''; render(); const next = document.querySelector('#voiceTranscript'); if (next) next.value = transcript; };
  try { voiceRecognition.start(); } catch { toast('Voice is already listening.'); }
}

function stopVoice() { voiceRecognition?.stop(); voiceListening = false; render(); }

function routeVoiceCommand(transcript, ownerId) {
  const command = parseVoiceCommand(transcript);
  if (command.kind === 'empty') return toast('Say or type a command first.');
  if (command.kind === 'navigate') { toast(`Opening ${command.route}.`); return go(command.route, true); }
  if (command.kind === 'job') {
    const saved = addJob(command.job, ownerId);
    if (saved) { toast('Job tracked in Career Command.'); return go(`career/${saved.id}`, true); }
  }
  if (command.kind === 'bodyMetric') {
    store.update(next => { next.body[command.field] = Math.max(0, Number(next.body[command.field] || 0) + command.amount); next.activity.unshift({ id:uid('activity'), title:`Logged ${command.amount} ${command.unit} ${command.field}`, detail:`${next.body[command.field]} ${command.unit} today`, system:'body', ownerId, occurredAt:new Date().toISOString() }); });
    toast(`${command.field[0].toUpperCase()+command.field.slice(1)} logged.`); return go('body', true);
  }
  if (command.kind === 'capture') {
    applyCapture({ ...command, type: command.captureType, ownerId });
    toast('Voice command logged and routed.'); return go('home', true);
  }
  toast('I could not route that command yet.');
}

async function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'close-overlay') return closeOverlay();
  if (action === 'toggle-mission') { toggleMission(id); return closeOverlayIfDetail(); }
  if (action === 'toggle-workout') {
    store.update(next => { const item=next.body.workouts.find(x=>x.id===id); if(item){ item.completed=!item.completed; next.activity.unshift({id:uid('activity'),title:`${item.completed?'Completed':'Reopened'} ${item.title}`,detail:`${item.duration} minute workout`,system:'body',ownerId:item.ownerId,occurredAt:new Date().toISOString()}); } });
    toast('Workout status updated.'); return closeOverlayIfDetail();
  }
  if (action === 'toggle-bill') {
    store.update(next => { const item=next.finance.bills.find(x=>x.id===id); if(item){ item.status=item.status==='paid'?'upcoming':'paid'; next.activity.unshift({id:uid('activity'),title:`${item.status==='paid'?'Paid':'Reopened'} ${item.title}`,detail:money(item.amount),system:'money',ownerId:item.ownerId,occurredAt:new Date().toISOString()}); } });
    toast('Bill Radar updated.'); return closeOverlayIfDetail();
  }
  if (action === 'advance-pipeline') {
    const stages=['Capture','Edit','Publish','Complete'];
    store.update(next => { const item=next.streaming.pipeline.find(x=>x.id===id); if(item){ item.stage=stages[Math.min(stages.length-1,stages.indexOf(item.stage)+1)]; } });
    toast('Content advanced to the next stage.'); return closeOverlayIfDetail();
  }
  if (action === 'add-skill-xp') {
    store.update(next => { const item=next.learning.skills.find(x=>x.id===id); if(item){ item.xp+=25; item.level=Math.max(item.level,Math.floor(item.xp/160)+1); } });
    toast('+25 skill XP'); return closeOverlayIfDetail();
  }
  if (action === 'capture-type') { captureType = button.dataset.value; return render(); }
  if (action === 'set-theme') { store.update(next => { next.settings.theme = normalizeThemeSettings({ ...next.settings.theme, pack: button.dataset.value, autoTime: false }); }); return toast(`${button.textContent.trim().split(/\s{2,}|\n/)[0]} theme active.`); }
  if (action === 'set-effects') { store.update(next => { next.settings.effects=button.dataset.value; }); return toast(`Effects set to ${button.dataset.value}.`); }
  if (action === 'open-job-provider') {
    store.update(next => { next.career.searches.unshift({ id: uid('search'), provider: button.dataset.provider, query: next.career.profile.targetRoles, location: next.career.profile.location, ownerId: next.career.profile.ownerId, occurredAt: new Date().toISOString() }); });
    window.open(button.dataset.url, '_blank', 'noopener'); return toast('Search opened. Add promising roles to your pipeline.');
  }
  if (action === 'advance-job') {
    const stages = ['Saved','Applied','Interview','Offer','Closed'];
    store.update(next => { const item=next.career.opportunities.find(x=>x.id===id); if (!item) return; const current=Math.max(0,stages.indexOf(item.status || 'Saved')); item.status=stages[Math.min(stages.length-1,current+1)]; const occurredAt=new Date().toISOString(); next.career.logs.unshift({id:uid('job-log'),jobId:item.id,title:`${item.title}: ${item.status}`,detail:item.company || 'Pipeline updated',status:item.status,ownerId:item.ownerId,occurredAt}); next.activity.unshift({id:uid('activity'),title:`Career stage: ${item.status}`,detail:`${item.title}${item.company ? ` at ${item.company}` : ''}`,system:'career',ownerId:item.ownerId,occurredAt}); });
    toast('Application pipeline advanced.'); return closeOverlayIfDetail();
  }
  if (action === 'prepare-resume') { store.update(next => { next.career.activeJobId=id; }); return go('career', true); }
  if (action === 'open-job-listing') { const item=state.career.opportunities.find(x=>x.id===id); if (item?.url) window.open(item.url,'_blank','noopener'); return; }
  if (action === 'copy-resume-prompt') { const prompt=state.career.resumePrompts[0]?.prompt; if (!prompt) return; try { await navigator.clipboard.writeText(prompt); toast('Resume prompt copied.'); } catch { toast('Copy unavailable. Select the prompt text manually.'); } return; }
  if (action === 'download-resume-prompt') { const prompt=state.career.resumePrompts[0]?.prompt; if (!prompt) return; const blob=new Blob([prompt],{type:'text/plain'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='our-life-os-resume-tailoring-prompt.txt'; link.click(); URL.revokeObjectURL(url); return toast('Resume prompt downloaded.'); }
  if (action === 'start-voice') return startVoice();
  if (action === 'stop-voice') return stopVoice();
  if (action === 'voice-example') { const field=document.querySelector('#voiceTranscript'); if(field){ field.value=button.dataset.value; field.focus(); } return; }
  if (action === 'export-data') {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=`our-life-os-v2-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url); return toast('V2 export created.');
  }
  if (action === 'import-data') return document.querySelector('#importFile')?.click();
  if (action === 'reset-v2') {
    if (confirm('Reset V2 starter data? Your original V1 state will remain untouched.')) { store.resetV2(); toast('V2 reset. V1 rollback preserved.'); go('home'); }
  }
  if (action === 'install-app') {
    if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt=null; }
    else toast('Use your browser’s Add to Home Screen command to install.');
  }
}

function closeOverlayIfDetail() { if (routeParts().detail) closeOverlay(); }

app.addEventListener('click', event => {
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.classList.contains('sheet-wrap') && event.target !== action) return;
    event.preventDefault(); event.stopPropagation(); handleAction(action); return;
  }
  const route = event.target.closest('[data-route]');
  if (route) { event.preventDefault(); go(route.dataset.route); }
});

app.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[role="button"][data-route]')) { event.preventDefault(); go(event.target.dataset.route); }
  if (event.key === 'Escape' && (routeParts().detail || ['capture','voice'].includes(routeParts().base))) closeOverlay();
});

app.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'captureForm') submitCapture(event.target);
  if (event.target.id === 'settingsForm') {
    const data = new FormData(event.target);
    store.update(next => {
      next.household.name = String(data.get('householdName') || '').trim() || 'Our Household';
      next.household.members.forEach(member => { member.name = String(data.get(member.id) || '').trim() || member.name; member.avatar = member.name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase(); });
    });
    toast('Household identity updated everywhere.');
  }
  if (event.target.id === 'themeForm') {
    const data=new FormData(event.target);
    store.update(next => { next.settings.theme=normalizeThemeSettings({ ...next.settings.theme, pack:'custom-spectrum', customHue:data.get('customHue'), customSaturation:data.get('customSaturation'), customBrightness:data.get('customBrightness'), glow:data.get('glow'), oled:data.has('oled'), unifySystems:data.has('unifySystems'), autoTime:data.has('autoTime') }); });
    toast('Theme calibration applied.');
  }
  if (event.target.id === 'voiceSettingsForm') { const data=new FormData(event.target); store.update(next => { next.settings.voiceLanguage=String(data.get('voiceLanguage') || 'en-US'); }); toast('Voice language saved.'); }
  if (event.target.id === 'careerProfileForm') {
    const data=new FormData(event.target);
    store.update(next => { next.career.profile={ ...next.career.profile, targetRoles:String(data.get('targetRoles')||'').trim(), location:String(data.get('location')||'').trim(), radius:Math.max(1,Number(data.get('radius'))||25), workMode:String(data.get('workMode')||'any'), skills:String(data.get('skills')||'').trim(), salaryMin:Math.max(0,Number(data.get('salaryMin'))||0), ownerId:String(data.get('ownerId')||'household') }; });
    toast('Career search signal updated.');
  }
  if (event.target.id === 'jobLeadForm') {
    const data=new FormData(event.target); const saved=addJob({title:data.get('title'),company:data.get('company'),location:data.get('location'),url:data.get('url'),description:data.get('description')},String(data.get('ownerId')||'household'));
    if(saved){ const score=scoreJob(saved,state.career.profile).score; toast(`Opportunity tracked at ${score}% match.`); go(`career/${saved.id}`); }
  }
  if (event.target.id === 'resumeForm') {
    const data=new FormData(event.target); const prompt=buildResumePrompt({resume:data.get('resume'),jobDescription:data.get('jobDescription'),jobTitle:data.get('jobTitle'),company:data.get('company')}); const jobId=String(data.get('jobId')||''); const ownerId=String(data.get('ownerId')||'household');
    store.update(next => { next.career.profile.resumeText=String(data.get('resume')||''); next.career.activeJobId=jobId || null; next.career.resumePrompts.unshift({id:uid('resume-prompt'),jobId,jobTitle:String(data.get('jobTitle')||''),company:String(data.get('company')||''),prompt,ownerId,createdAt:new Date().toISOString()}); if(jobId) next.career.logs.unshift({id:uid('job-log'),jobId,title:'Prepared resume tailoring prompt',detail:String(data.get('jobTitle')||'Target role'),status:'Resume prepared',ownerId,occurredAt:new Date().toISOString()}); });
    toast('Truthful resume tailoring prompt generated.');
  }
  if (event.target.id === 'voiceForm') { const data=new FormData(event.target); routeVoiceCommand(String(data.get('transcript')||''),String(data.get('ownerId')||'household')); }
});

app.addEventListener('change', async event => {
  if (event.target.id === 'resumeJobSelect') { store.update(next => { next.career.activeJobId=event.target.value || null; }); return; }
  if (event.target.id !== 'importFile' || !event.target.files?.[0]) return;
  try { store.importData(await event.target.files[0].text()); toast('V2 data imported successfully.'); go('home'); }
  catch (error) { toast(error.message); }
});

window.addEventListener('hashchange', render);
window.addEventListener('online', render);
window.addEventListener('offline', render);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt=event; });
store.subscribe(next => { state=next; render(); });

window.addEventListener('pointermove', event => {
  document.documentElement.style.setProperty('--pointer-x', `${(event.clientX / Math.max(1, innerWidth) * 100).toFixed(1)}%`);
  document.documentElement.style.setProperty('--pointer-y', `${(event.clientY / Math.max(1, innerHeight) * 100).toFixed(1)}%`);
}, { passive: true });

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('./sw.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !refreshing) { refreshing=true; location.reload(); } });

    const activateUpdate = worker => {
      if (!hadController || !worker) return;
      toast('Update ready. Activating now — the app will reload automatically.');
      worker.postMessage({ type: 'SKIP_WAITING' });
    };

    if (registration.waiting) activateUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') activateUpdate(worker);
      });
    });
  } catch (error) { console.warn('Offline mode unavailable', error); }
}

if (!location.hash) go('home', true);
render();
const migrationNotice = store.consumeMigrationNotice();
if (migrationNotice) setTimeout(() => toast(migrationNotice), 900);
window.addEventListener('load', () => { setTimeout(() => bootSplash.classList.add('is-hidden'), 420); registerServiceWorker(); });
