import { store } from './store.js';
import { SYSTEMS, uid } from './data.js';

const app = document.querySelector('#app');
const bootSplash = document.querySelector('#bootSplash');
const toastRegion = document.querySelector('#toastRegion');
const validRoutes = new Set(['home', 'money', 'missions', 'streaming', 'body', 'learning', 'analytics', 'systems', 'settings', 'capture']);
let state = store.getState();
let captureType = 'note';
let installPrompt = null;
let refreshing = false;
let overlayReturn = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.currency || 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
const percent = (value, target) => Math.max(0, Math.min(100, target ? (Number(value) / Number(target)) * 100 : 0));
const dayLabel = date => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(date));
const timeLabel = date => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const system = key => SYSTEMS[key] || { label: 'Household', eyebrow: 'Shared system', icon: '⌂', accent: '#63e6ff' };

function routeParts() {
  const raw = location.hash.replace(/^#/, '') || 'home';
  const [base, detail] = raw.split('/');
  return validRoutes.has(base) ? { base, detail: detail ? decodeURIComponent(detail) : null } : { base: 'home', detail: null };
}

function go(route, replace = false) {
  const next = `#${route}`;
  const isOverlay = route === 'capture' || route.includes('/');
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

function topbar() {
  const online = navigator.onLine;
  return `<header class="topbar">
    <div class="brand">
      <img src="./assets/icon.svg" alt="" width="42" height="42" />
      <div class="brand-copy"><p class="eyebrow">Household command</p><h1>${escapeHtml(state.household.name)}</h1></div>
    </div>
    <div class="status-cluster">
      <div class="status-pill"><i class="status-dot" style="background:${online ? 'var(--green)' : 'var(--gold)'}"></i>${online ? 'Systems online' : 'Offline mode'}</div>
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
  const nextBill = [...state.finance.bills].filter(item => item.status !== 'paid').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
  const xpPct = percent(state.game.xp, state.game.xpToNext);
  const circumference = 2 * Math.PI * 54;
  const dash = circumference * (xpPct / 100);
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
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
      <div class="section-head"><h2>Today’s Calendar</h2><button class="section-link" data-route="capture">Add event</button></div>
      <div class="calendar-strip">${state.calendar.map(event => `<button class="calendar-event" style="--system:${system(event.system).accent}" data-route="home/${event.id}"><time>${timeLabel(event.startsAt)}</time><strong>${escapeHtml(event.title)}</strong>${ownerChip(event.ownerId)}</button>`).join('')}</div>
    </section>

    <div class="home-lower">
      <section class="section">
        <div class="section-head"><h2>Today’s Missions</h2><button class="section-link" data-route="missions">View board</button></div>
        <div class="glass list-panel">${state.missions.slice(0, 4).map(missionRow).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>Recent Activity</h2><button class="section-link" data-route="analytics">Open history</button></div>
        <div class="glass list-panel">${state.activity.slice(0, 4).map(activityRow).join('')}</div>
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
        <section class="section"><div class="section-head"><h2>Income by Source</h2><button class="section-link" data-route="capture">Add income</button></div><div class="glass list-panel">${f.income.slice().reverse().map(item => `<button class="data-row" style="--system:${system('money').accent}" data-route="money/${item.id}"><span class="row-icon">＋</span><span><span class="row-title">${escapeHtml(item.source)}</span><span class="row-detail">${dayLabel(item.date)}</span></span><span class="row-meta"><strong class="positive">+${money(item.amount)}</strong>${ownerChip(item.ownerId)}</span></button>`).join('')}</div></section>
        <section class="section"><div class="section-head"><h2>Bill Radar Queue</h2><span>${f.bills.filter(item => item.status !== 'paid').length} active</span></div><div class="glass list-panel">${f.bills.map(item => `<div class="data-row" style="--system:${item.status === 'paid' ? '#5ef2a5' : '#ffc857'}" data-route="money/${item.id}" role="button" tabindex="0"><span class="row-icon">${item.status === 'paid' ? '✓' : '◇'}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.category)} · ${dayLabel(item.dueDate)}</span></span><span class="row-meta"><strong>${money(item.amount)}</strong>${ownerChip(item.ownerId)}</span></div>`).join('')}</div></section>
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
    <section class="section glass wide-card"><div class="section-head"><h2>Reserved Funds</h2><span>${money(f.reserved)} allocated</span></div>${f.allocations.map(item => `<div class="allocation" data-route="money/${item.id}" role="button" tabindex="0"><div class="allocation-line"><span>${escapeHtml(item.label)} · ${ownerChip(item.ownerId)}</span><strong>${money(item.amount)} / ${money(item.target)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${percent(item.amount,item.target)}%;background:${item.color}"></div></div></div>`).join('')}</section>
  </main>`;
}

function statTile(label, value, note, route) {
  return `<button class="glass interactive-card stat-tile" data-route="${route}"><span class="card-label">${escapeHtml(label)} <i class="arrow">›</i></span><strong class="metric">${escapeHtml(value)}</strong><div class="metric-note">${escapeHtml(note)}</div></button>`;
}

function missionsView() {
  const completed = state.missions.filter(item => item.completed).length;
  const perfect = completed === state.missions.length;
  return `<main class="view" style="--system:${system('missions').accent}">
    ${moduleHeader('missions', 'Mission Control', 'Daily operations, category levels, streak rewards and goal boss battles.', `${completed}/${state.missions.length}`, perfect ? 'Perfect Day unlocked' : 'daily missions complete')}
    <section class="section glass wide-card boss-card interactive-card" style="--system:${system('missions').accent}" data-route="missions/perfect-day" role="button" tabindex="0"><span class="card-label">Perfect Day Protocol <i class="arrow">›</i></span><h2>${perfect ? 'Reward unlocked: +250 XP' : `${state.missions.length - completed} missions remain`}</h2><div class="boss-health"><i style="width:${percent(completed,state.missions.length)}%"></i></div><div class="metric-note">Chain every daily system to earn the household multiplier.</div></section>
    <section class="section"><div class="section-head"><h2>Today’s Mission Board</h2><button class="section-link" data-route="capture">Create mission</button></div><div class="glass list-panel">${state.missions.map(missionRow).join('')}</div></section>
    <section class="section"><div class="section-head"><h2>Category Levels</h2><span>Shared progression</span></div><div class="stats-grid">${Object.entries(state.game.categoryLevels).map(([key,value]) => statTile(system(key).label, `Lv ${value}`, 'Open skill track', `missions/category-${key}`)).join('')}</div></section>
    <section class="section"><div class="section-head"><h2>Achievements</h2><span>${state.game.achievements.filter(item=>item.earned).length}/${state.game.achievements.length} earned</span></div><div class="glass list-panel">${state.game.achievements.map(item => `<button class="data-row" style="--system:${item.earned ? '#ffc857' : '#927cff'}" data-route="missions/${item.id}"><span class="row-icon">${item.icon}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.detail)}</span></span><span class="row-meta"><strong>${item.earned ? 'Earned' : `${item.progress || 0}%`}</strong><span>›</span></span></button>`).join('')}</div></section>
  </main>`;
}

function streamingView() {
  const s = state.streaming;
  return `<main class="view" style="--system:${system('streaming').accent}">
    ${moduleHeader('streaming', 'Creator Operations', 'Turn setup, consistency and content output into a visible growth system.', `${s.consistency}%`, 'streaming consistency signal')}
    <div class="stats-grid section">${statTile('Setup', `${s.setupProgress}%`, 'Broadcast readiness', 'streaming/setup')}${statTile('Sessions', s.sessionsThisMonth, 'This month', 'streaming/sessions')}${statTile('Growth', `${s.revenueMilestone}%`, 'Monetization path', 'streaming/growth')}${statTile('Next stream', s.schedule[0].day, s.schedule[0].time, `streaming/${s.schedule[0].id}`)}</div>
    <div class="module-grid section"><div>
      <section><div class="section-head"><h2>Schedule</h2><button class="section-link" data-route="capture">Add session</button></div><div class="glass list-panel">${s.schedule.map(item => `<button class="data-row" style="--system:${system('streaming').accent}" data-route="streaming/${item.id}"><span class="row-icon">◉</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${item.day} · ${item.time}</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></button>`).join('')}</div></section>
      <section class="section"><div class="section-head"><h2>Content Pipeline</h2><span>${s.pipeline.length} active</span></div><div class="glass list-panel">${s.pipeline.map(item => `<button class="data-row" style="--system:${system('streaming').accent}" data-route="streaming/${item.id}"><span class="row-icon">${item.stage.slice(0,1)}</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">Stage: ${escapeHtml(item.stage)}</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></button>`).join('')}</div></section>
    </div><aside class="glass skill-tree module-sticky">${s.skills.map((item,index) => `<button class="skill-node ${item.unlocked ? '' : 'locked'}" style="--system:${system('streaming').accent};--x:${[50,22,78,34,70][index]}%;--y:${[18,48,48,78,78][index]}%" data-route="streaming/${item.id}"><strong>${escapeHtml(item.title)}</strong><span>Level ${item.level}</span></button>`).join('')}</aside></div>
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
    <section class="section"><div class="section-head"><h2>Workout Tracker</h2><button class="section-link" data-route="capture">Log workout</button></div><div class="glass list-panel">${b.workouts.map(item => `<div class="data-row ${item.completed ? 'is-complete' : ''}" style="--system:${system('body').accent}" data-route="body/${item.id}" role="button" tabindex="0"><button class="mission-check" data-action="toggle-workout" data-id="${item.id}" aria-label="Toggle workout">✓</button><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${dayLabel(item.date)} · ${item.duration} min</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></div>`).join('')}</div></section>
  </main>`;
}

function macroRing(value, target, label, color) {
  return `<button class="macro-ring interactive-card" style="--p:${percent(value,target)};--ring:${color}" data-route="body/${label.toLowerCase()}"><span><strong>${value}${label === 'Protein' ? 'g' : ''}</strong><span>${label}</span></span></button>`;
}

function learningView() {
  const l = state.learning;
  return `<main class="view" style="--system:${system('learning').accent}">
    ${moduleHeader('learning', 'AI Skill Matrix', 'Build individual mastery while advancing shared household capability.', `${l.weeklyMinutes} min`, `${l.weeklyTarget - l.weeklyMinutes} minutes to weekly mission`)}
    <section class="section glass skill-tree">${l.skills.map(item => `<button class="skill-node" style="--system:${system('learning').accent};--x:${item.x}%;--y:${item.y}%" data-route="learning/${item.id}"><strong>${escapeHtml(item.title)}</strong><span>Lv ${item.level} · ${item.xp} XP</span></button>`).join('')}</section>
    <section class="section glass wide-card interactive-card" data-route="learning/milestone" role="button" tabindex="0"><span class="card-label">Active Milestone <i class="arrow">›</i></span><h2>${escapeHtml(l.milestone)}</h2>${progress(l.weeklyMinutes,l.weeklyTarget)}<div class="metric-note">Weekly learning charge: ${percent(l.weeklyMinutes,l.weeklyTarget).toFixed(0)}%</div></section>
    <section class="section"><div class="section-head"><h2>Notes & Resources</h2><button class="section-link" data-route="capture">Add resource</button></div><div class="glass list-panel">${l.resources.map(item => `<button class="data-row" style="--system:${system('learning').accent}" data-route="learning/${item.id}"><span class="row-icon">⌁</span><span><span class="row-title">${escapeHtml(item.title)}</span><span class="row-detail">${escapeHtml(item.type)}</span></span><span class="row-meta">${ownerChip(item.ownerId)}<span>›</span></span></button>`).join('')}</div></section>
  </main>`;
}

function analyticsView() {
  const a = state.analytics;
  return `<main class="view" style="--system:${system('analytics').accent}">
    ${moduleHeader('analytics', 'Signal Observatory', 'A shared timeline, weekly scoreboard and automated reflection layer.', `${a.dailyScores.at(-1)}%`, 'today’s household score')}
    <section class="section glass wide-card interactive-card" data-route="analytics/scoreboard" role="button" tabindex="0"><span class="card-label">Weekly Scoreboard <i class="arrow">›</i></span>${bars(a.dailyScores,'analytics')}</section>
    <section class="section summary-grid">
      <button class="glass interactive-card summary-card" style="--summary:#5ef2a5" data-route="analytics/biggest-win"><strong>Biggest Win</strong><p>${escapeHtml(a.summaries.win)}</p></button>
      <button class="glass interactive-card summary-card" style="--summary:#ff5d7d" data-route="analytics/biggest-miss"><strong>Biggest Miss</strong><p>${escapeHtml(a.summaries.miss)}</p></button>
      <button class="glass interactive-card summary-card" style="--summary:#ffc857" data-route="analytics/next-priority"><strong>Next Priority</strong><p>${escapeHtml(a.summaries.priority)}</p></button>
    </section>
    <section class="section"><div class="section-head"><h2>Daily Activity Timeline</h2><span>${state.activity.length} recorded signals</span></div><div class="glass list-panel">${state.activity.map(activityRow).join('')}</div></section>
  </main>`;
}

function systemsView() {
  const cards = ['streaming','body','learning','analytics'];
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
    <section class="glass settings-section"><h2>Cinematic Effects</h2><div class="effects-picker">${['full','balanced','reduced'].map(value => `<button class="effect-option ${state.settings.effects === value ? 'active' : ''}" data-action="set-effects" data-value="${value}">${value[0].toUpperCase()+value.slice(1)}</button>`).join('')}</div><p class="metric-note">Reduced motion preferences from your device always take priority.</p></section>
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
  if (item?.detail) details.push(['Signal', item.detail]);
  if (item?.ownerId) details.push(['Ownership', owner(item.ownerId).label]);
  if (!details.length) details.push(['System status', 'Operational starter view'], ['Purpose', 'This drill-down is wired for the full module engine.']);
  let action = '';
  if (base === 'money' && item?.dueDate) action = `<button class="primary-button" data-action="toggle-bill" data-id="${item.id}">${item.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}</button>`;
  if (base === 'missions' && item?.xp != null && 'completed' in item) action = `<button class="primary-button" data-action="toggle-mission" data-id="${item.id}">${item.completed ? 'Reopen mission' : `Complete +${item.xp} XP`}</button>`;
  if (base === 'streaming' && item?.stage) action = `<button class="primary-button" data-action="advance-pipeline" data-id="${item.id}">Advance pipeline stage</button>`;
  if (base === 'body' && item?.duration) action = `<button class="primary-button" data-action="toggle-workout" data-id="${item.id}">${item.completed ? 'Mark incomplete' : 'Complete workout'}</button>`;
  if (base === 'learning' && item?.xp != null) action = `<button class="primary-button" data-action="add-skill-xp" data-id="${item.id}">Add 25 skill XP</button>`;
  return `<div class="sheet-wrap" data-action="close-overlay"><section class="sheet" style="--system:${info.accent}" role="dialog" aria-modal="true" aria-labelledby="detailTitle" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow" style="color:${info.accent}">${info.eyebrow}</p><h2 id="detailTitle">${escapeHtml(title)}</h2></div><button class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="detail-grid">${details.map(([label,value]) => `<div class="detail-block"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}</div><div class="button-row">${action}<button class="secondary-button" data-route="${base}">Open full ${escapeHtml(info.label)} system</button></div></section></div>`;
}

function captureSheet() {
  const types = [
    ['note','⌁','Note'],['income','＋','Income'],['expense','−','Expense'],['bill','◇','Bill'],['mission','✦','Mission'],['event','◷','Event'],['workout','⬡','Workout'],['meal','◌','Meal'],['stream','◉','Stream']
  ];
  const memberOptions = [{id:'household',name:'Shared Household'}, ...state.household.members].map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  const needsAmount = ['income','expense','bill'].includes(captureType);
  return `<div class="sheet-wrap" data-action="close-overlay"><form class="sheet" id="captureForm" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Smart Quick Capture</p><h2>Route a new signal</h2></div><button type="button" class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="capture-types">${types.map(([type,icon,label]) => `<button type="button" class="capture-type ${captureType === type ? 'active' : ''}" data-action="capture-type" data-value="${type}"><i>${icon}</i><span>${label}</span></button>`).join('')}</div><div class="field-grid"><label class="field-label">Title<input class="field" name="title" required maxlength="80" placeholder="What happened or needs action?" autofocus /></label>${needsAmount ? '<label class="field-label">Amount<input class="field" name="amount" type="number" min="0" step="0.01" required placeholder="0.00" /></label>' : ''}<label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions}</select></label><label class="field-label">Details<textarea class="field" name="detail" rows="2" maxlength="180" placeholder="Optional context"></textarea></label></div><button class="primary-button" type="submit" style="width:100%;margin-top:14px">Add to Our Life OS</button></form></div>`;
}

function render() {
  const route = routeParts();
  if (route.base !== 'capture' && !route.detail) overlayReturn = null;
  const base = route.base === 'capture' ? 'home' : route.base;
  const views = { home: homeView, money: moneyView, missions: missionsView, streaming: streamingView, body: bodyView, learning: learningView, analytics: analyticsView, systems: systemsView, settings: settingsView };
  document.body.dataset.effects = state.settings.effects || 'balanced';
  app.innerHTML = `${topbar()}${(views[base] || homeView)()}${bottomNav(base)}${route.base === 'capture' ? captureSheet() : route.detail ? detailSheet(base, route.detail) : ''}`;
}

function closeOverlay() {
  const route = routeParts();
  if (overlayReturn) { overlayReturn = null; history.back(); }
  else if (route.base === 'capture') go('home', true);
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
    next.game.xp = Math.max(0, next.game.xp + delta);
    while (next.game.xp >= next.game.xpToNext) { next.game.xp -= next.game.xpToNext; next.game.level += 1; }
    next.activity.unshift({ id: uid('activity'), title: `${mission.completed ? 'Completed' : 'Reopened'} ${mission.title}`, detail: `${delta > 0 ? '+' : ''}${delta} XP`, system: mission.category, ownerId: mission.ownerId, occurredAt: new Date().toISOString() });
    result = mission.completed;
  });
  toast(result ? 'Mission complete. XP charged.' : 'Mission reopened. XP adjusted.');
}

function submitCapture(form) {
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  const detail = String(data.get('detail') || '').trim();
  const ownerId = String(data.get('ownerId') || 'household');
  const amount = Math.max(0, Number(data.get('amount')) || 0);
  if (!title) return;
  store.update(next => {
    const now = new Date().toISOString();
    next.captures.unshift({ id: uid('capture'), type: captureType, title, detail, amount, ownerId, createdAt: now });
    let systemKey = 'missions';
    let activityDetail = detail || captureType;
    if (captureType === 'income') {
      const entry = { id: uid('income'), source: title, amount, date: now.slice(0,10), ownerId };
      next.finance.income.push(entry); next.finance.monthIncome += amount; next.finance.available += amount; next.finance.boss.current = next.finance.monthIncome; systemKey = 'money'; activityDetail = `+${money(amount)}`;
    } else if (captureType === 'expense') {
      next.finance.spent += amount; next.finance.available = Math.max(0, next.finance.available - amount); systemKey = 'money'; activityDetail = `-${money(amount)}`;
    } else if (captureType === 'bill') {
      next.finance.bills.push({ id: uid('bill'), title, amount, dueDate: new Date(Date.now()+7*86400000).toISOString().slice(0,10), status: 'upcoming', ownerId, category: detail || 'Other' }); systemKey = 'money'; activityDetail = `${money(amount)} due in 7 days`;
    } else if (captureType === 'mission') {
      next.missions.push({ id: uid('mission'), title, detail: detail || 'Custom household mission', category: 'household', xp: 75, completed: false, recurring: 'once', ownerId });
    } else if (captureType === 'event') {
      next.calendar.push({ id: uid('event'), title, startsAt: new Date(Date.now()+3600000).toISOString(), system: 'missions', ownerId });
    } else if (captureType === 'workout') {
      next.body.workouts.unshift({ id: uid('workout'), title, date: now.slice(0,10), duration: 30, completed: true, ownerId }); systemKey = 'body'; activityDetail = detail || '30 minute session';
    } else if (captureType === 'stream') systemKey = 'streaming';
    else if (captureType === 'meal') systemKey = 'body';
    next.activity.unshift({ id: uid('activity'), title: `Captured ${title}`, detail: activityDetail, system: systemKey, ownerId, occurredAt: now });
  });
  captureType = 'note';
  toast('Captured and routed successfully.');
  go('home', true);
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
  if (action === 'set-effects') { store.update(next => { next.settings.effects=button.dataset.value; }); return toast(`Effects set to ${button.dataset.value}.`); }
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
  if (event.key === 'Escape' && (routeParts().detail || routeParts().base === 'capture')) closeOverlay();
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
});

app.addEventListener('change', async event => {
  if (event.target.id !== 'importFile' || !event.target.files?.[0]) return;
  try { store.importData(await event.target.files[0].text()); toast('V2 data imported successfully.'); go('home'); }
  catch (error) { toast(error.message); }
});

window.addEventListener('hashchange', render);
window.addEventListener('online', render);
window.addEventListener('offline', render);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt=event; });
store.subscribe(next => { state=next; render(); });

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('./sw.js');
    if (registration.waiting) toast('A new visual engine update is ready. Reload to activate it.');
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !refreshing) { refreshing=true; location.reload(); } });
  } catch (error) { console.warn('Offline mode unavailable', error); }
}

if (!location.hash) go('home', true);
render();
const migrationNotice = store.consumeMigrationNotice();
if (migrationNotice) setTimeout(() => toast(migrationNotice), 900);
window.addEventListener('load', () => { setTimeout(() => bootSplash.classList.add('is-hidden'), 420); registerServiceWorker(); });
