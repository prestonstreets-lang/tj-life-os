import { store } from './store.js';
import { SYSTEMS, uid } from './data.js';
import { compareDateOnly, formatDayLabel, toLocalDateKey } from './date.js';
import { applyXpDelta } from './progression.js';
import { COLLAGE_TEMPLATES, IMAGE_SHAPES, VISION_CATEGORIES, calculateVisionProgress, createMotivationEngine, createVisionBoard, createVisionItem, duplicateVisionItem, evaluateMilestones, evaluateTargets, removeVisionItem, reorderVisionItems, resolveBoardTemplate, rewardShouldUnlock, transitionReward, updateVisionItem } from './vision.js';

const app = document.querySelector('#app');
const bootSplash = document.querySelector('#bootSplash');
const toastRegion = document.querySelector('#toastRegion');
const validRoutes = new Set(['home', 'money', 'missions', 'streaming', 'body', 'learning', 'analytics', 'vision', 'systems', 'settings', 'capture']);
let state = store.getState();
let captureType = 'note';
let installPrompt = null;
let refreshing = false;
let overlayReturn = null;
let activeVisionBoardId = null;
let visionEditingId = null;
let visionFilters = { owner:'all', category:'all', status:'active', affordability:'all', priority:'all' };
let visionMediaObserver = null;
const visionMediaUrls = new Map();
const motivationEngine = createMotivationEngine();
let pendingCelebration = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.currency || 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
const percent = (value, target) => Math.max(0, Math.min(100, target ? (Number(value) / Number(target)) * 100 : 0));
const dayLabel = date => formatDayLabel(date);
const timeLabel = date => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const system = key => SYSTEMS[key] || { label: 'Household', eyebrow: 'Shared system', icon: '⌂', accent: '#63e6ff' };
const memberOptions = selected => [{id:'household',name:'Shared Household'}, ...state.household.members].map(item => `<option value="${item.id}" ${item.id===(selected||'household')?'selected':''}>${escapeHtml(item.name)}</option>`).join('');

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

function visionImage(item, className='') {
  return item?.mediaId ? `<img class="vision-media ${className}" data-vision-media="${item.mediaId}" alt="${escapeHtml(item.altText || item.title)}" loading="lazy" decoding="async" style="object-position:${item.focalX ?? 50}% ${item.focalY ?? 50}%" />` : `<div class="vision-placeholder ${className}" role="img" aria-label="No image added"><i>◐</i><span>Add a dream image</span></div>`;
}

function visionFundingLabel(progress) {
  return progress.available ? `${money(progress.saved)} of ${money(progress.target)} · ${progress.percent}%` : 'Funding link needed';
}

function dailyFocusId(source=state,now=new Date()) {
  const ids=(source.motivationSettings.featuredItemIds||[]).filter(id=>source.visionItems.some(item=>item.id===id&&item.status==='active'&&!item.dismissed));
  if(!ids.length)return source.visionItems.find(item=>item.featured&&item.status==='active'&&!item.dismissed)?.id||source.visionItems.find(item=>item.status==='active'&&!item.dismissed)?.id||null;
  if(!source.motivationSettings.autoRotate)return ids[0];
  const day=Math.floor(new Date(`${toLocalDateKey(now)}T00:00:00`).getTime()/86400000);return ids[(day+(Number(source.motivationSettings.rotationOffset)||0))%ids.length];
}

function homeView() {
  const completed = state.missions.filter(item => item.completed).length;
  const nextBill = [...state.finance.bills].filter(item => item.status !== 'paid').sort((a, b) => compareDateOnly(a.dueDate, b.dueDate))[0];
  const xpPct = percent(state.game.xp, state.game.xpToNext);
  const circumference = 2 * Math.PI * 54;
  const dash = circumference * (xpPct / 100);
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const featured = state.visionItems.find(item=>item.id===dailyFocusId());
  const visionProgress = featured ? calculateVisionProgress(featured,state) : null;
  const motivation = motivationEngine.generate(state,new Date(),featured?.id);
  const targets = evaluateTargets(state);
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
      <div class="section-head"><h2>Daily Vision</h2><button class="section-link" data-route="vision">Open Vision Board</button></div>
      <button class="glass interactive-card home-vision-card" data-route="vision/${featured?.id || 'new'}">
        <div class="home-vision-media">${visionImage(featured)}</div><div class="home-vision-copy"><span class="card-label">${featured ? 'Featured aspiration' : 'Vision system ready'} <i class="arrow">›</i></span><h2>${escapeHtml(featured?.title || 'Build the life you can see')}</h2><p>${escapeHtml(motivation.message)}</p>${featured ? `<div class="vision-home-progress">${progress(visionProgress?.saved||0,visionProgress?.target||0)}<small>${escapeHtml(visionFundingLabel(visionProgress))}</small></div>` : ''}<div class="vision-target-status ${targets.dailyComplete?'complete':''}">${targets.dailyComplete?'✓ Today’s financial target reached':`Next action · ${escapeHtml(motivation.nextAction)}`}</div></div>
      </button>
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
        <button class="glass interactive-card wide-card money-vision-link" data-route="vision"><span class="card-label">Fund the Vision <i class="arrow">›</i></span><strong>${state.visionItems.filter(item=>item.status==='active').length} active goals</strong><p>Connect allocations and boss battles to visible household dreams.</p></button>
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

function filteredVisionItems(boardId) {
  return state.visionItems.filter(item => {
    if (item.boardId!==boardId) return false;
    if (visionFilters.owner!=='all'&&item.ownerId!==visionFilters.owner) return false;
    if (visionFilters.category!=='all'&&item.category!==visionFilters.category) return false;
    if (visionFilters.status!=='all'&&item.status!==visionFilters.status) return false;
    if (visionFilters.priority!=='all'&&item.priority!==Number(visionFilters.priority)) return false;
    const goal=calculateVisionProgress(item,state);
    if (visionFilters.affordability==='funded'&&goal.percent!==100) return false;
    if (visionFilters.affordability==='close'&&(!goal.available||goal.percent<75||goal.percent>=100)) return false;
    if (visionFilters.affordability==='unlinked'&&goal.available) return false;
    return true;
  }).sort((a,b)=>(b.featured-a.featured)||(b.priority-a.priority)||((a.order||0)-(b.order||0)));
}

function visionCollageItem(item,index) {
  const funding=calculateVisionProgress(item,state);
  return `<article class="vision-tile priority-${item.priority} shape-${item.shape||'auto'} ${item.featured?'featured':''}" style="--vision-index:${index}"><button class="vision-photo" data-route="vision/${item.id}" aria-label="Open ${escapeHtml(item.title)}">${visionImage(item)}<span class="vision-photo-shade"></span><span class="vision-status">${funding.available?`${funding.percent}% funded`:'Inspiration'}</span></button><div class="vision-tile-copy"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reason||item.description||item.category)}</p></div><div class="vision-tile-meta">${ownerChip(item.ownerId)}<span>${escapeHtml(item.category)}</span></div></div><div class="vision-quick-actions"><button data-action="favorite-vision" data-id="${item.id}" aria-label="${item.favorite?'Remove favorite':'Favorite vision'}">${item.favorite?'♥':'♡'}</button><button data-action="move-vision" data-id="${item.id}" data-direction="-1" aria-label="Move earlier">↑</button><button data-action="move-vision" data-id="${item.id}" data-direction="1" aria-label="Move later">↓</button></div></article>`;
}

function visionBoardView() {
  const activeBoards=state.visionBoards.filter(board=>board.status!=='archived');
  const archivedBoards=state.visionBoards.filter(board=>board.status==='archived');
  const board=activeBoards.find(entry=>entry.id===activeVisionBoardId)||activeBoards[0]||null;
  if (board && activeVisionBoardId!==board.id) activeVisionBoardId=board.id;
  const items=board?filteredVisionItems(board.id):[];
  const template=board?resolveBoardTemplate(board,items,innerWidth):'smart-auto';
  const motivation=motivationEngine.generate(state,new Date(),dailyFocusId());
  const focus=state.visionItems.find(item=>item.id===motivation.itemId);
  const targets=evaluateTargets(state);
  return `<main class="view vision-view" style="--system:${system('vision').accent}">
    ${viewHeader('Vision Board', 'Turn real household progress into a cinematic daily reminder of what you are building.', 'Aspirational command')}
    <section class="glass vision-command-hero"><div class="vision-spotlight"></div><div><p class="eyebrow">Daily motivation signal</p><h2>${escapeHtml(motivation.message)}</h2><p>${escapeHtml(motivation.nextAction)} · ${targets.dailyComplete?'Today’s target complete':`${money(targets.dailyActual)} earned today`}</p><div class="button-row"><button class="primary-button" data-route="vision/${focus?.id||'new'}">${focus?'Open daily focus':'Add first vision'}</button><button class="secondary-button" data-action="refresh-motivation">Refresh</button><button class="secondary-button" data-action="save-motivation">Save</button><button class="secondary-button" data-action="dismiss-motivation">Dismiss</button></div></div><div class="motivation-orb"><i></i><span>◐</span></div></section>
    <section class="vision-board-tabs section"><div>${activeBoards.map(entry=>`<button class="${entry.id===board?.id?'active':''}" data-action="select-vision-board" data-id="${entry.id}">${escapeHtml(entry.title)} ${ownerChip(entry.ownerId)}</button>`).join('')}</div><button class="secondary-button" data-action="show-board-form">＋ Board</button></section>
    <form class="glass settings-section vision-board-form ${activeBoards.length?'is-collapsed':''}" id="visionBoardForm"><div class="section-head"><h2>Create Vision Board</h2><span>Personal or shared</span></div><div class="field-grid vision-form-grid"><label class="field-label">Board name<input class="field" name="title" required maxlength="50" placeholder="Our next chapter" /></label><label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions()}</select></label><label class="field-label">Category<select class="field" name="category">${VISION_CATEGORIES.map(value=>`<option>${value}</option>`).join('')}</select></label><label class="field-label">Description<input class="field" name="description" maxlength="120" placeholder="What this board represents" /></label></div><button class="primary-button" type="submit">Create board</button></form>
    ${board ? `<section class="section"><div class="section-head"><div><h2>${escapeHtml(board.title)}</h2><span>${items.length} visible · ${state.visionItems.filter(item=>item.boardId===board.id).length} total</span></div><div class="button-row"><button class="section-link" data-route="vision/new">Add vision</button><button class="section-link" data-action="archive-board" data-id="${board.id}">Archive</button></div></div>
      <div class="glass vision-toolbar"><div class="template-rail">${COLLAGE_TEMPLATES.map(([key,label])=>`<button class="${board.template===key?'active':''}" data-action="set-collage-template" data-id="${board.id}" data-value="${key}">${escapeHtml(label)}</button>`).join('')}</div><form id="visionFilterForm" class="vision-filters"><select class="field" name="owner"><option value="all">All owners</option><option value="household">Shared Household</option>${state.household.members.map(member=>`<option value="${member.id}">${escapeHtml(member.name)}</option>`).join('')}</select><select class="field" name="category"><option value="all">All categories</option>${VISION_CATEGORIES.map(value=>`<option>${value}</option>`).join('')}</select><select class="field" name="status"><option value="active">Active</option><option value="completed">Completed</option><option value="all">All statuses</option></select><select class="field" name="affordability"><option value="all">All funding</option><option value="funded">Fully funded</option><option value="close">Close to funded</option><option value="unlinked">Needs link</option></select><select class="field" name="priority"><option value="all">All priorities</option>${[5,4,3,2,1].map(value=>`<option value="${value}">Priority ${value}</option>`).join('')}</select><button class="secondary-button" type="submit">Filter</button></form></div>
      <div class="vision-collage collage-${template} shape-${board.shape||'auto'}">${items.length?items.slice(0,30).map(visionCollageItem).join(''):`<div class="glass vision-collage-empty">${emptyState('This board is ready', 'Add photos, rewards, purchases, experiences or unlinked inspiration.', 'vision/new', 'Add first vision')}</div>`}</div>
    </section>` : `<section class="glass section vision-onboarding">${emptyState('Create your first real vision board','No sample goals or financial progress have been added. Start with a board for personal or shared dreams.',null)}<button class="primary-button" data-action="show-board-form">Create Vision Board</button></section>`}
    <section class="section"><div class="section-head"><h2>Reward Vault</h2><button class="section-link" data-route="vision/reward-new">Define reward</button></div><div class="reward-vault">${state.rewards.length?state.rewards.map(reward=>`<button class="glass reward-card status-${reward.status}" data-route="vision/${reward.id}"><div class="reward-thumb">${reward.mediaId?visionImage({mediaId:reward.mediaId,altText:reward.altText||reward.name,title:reward.name,focalX:50,focalY:50}):`<div class="reward-lock">${reward.status==='locked'?'⌾':reward.status==='unlocked'?'✦':'✓'}</div>`}</div><div><span>${escapeHtml(reward.status)}</span><h3>${escapeHtml(reward.name)}</h3><p>${escapeHtml(reward.description||reward.unlockCondition?.label||'Household reward')}</p></div>${ownerChip(reward.ownerId)}</button>`).join(''):`<div class="glass reward-empty">${emptyState('Reward Vault empty','Define free, low-cost, or purchase rewards. Unlocking never spends money.', 'vision/reward-new','Create reward')}</div>`}</div></section>
    <form class="glass settings-section" id="motivationSettingsForm"><div class="section-head"><h2>Motivation Controls</h2><span>Local rule engine</span></div><div class="vision-form-grid"><label class="field-label">Frequency<select class="field" name="frequency">${['daily','twice-daily','weekly','manual'].map(value=>`<option value="${value}" ${state.motivationSettings.frequency===value?'selected':''}>${value}</option>`).join('')}</select></label><label class="field-label">Intensity<select class="field" name="intensity">${['gentle','balanced','intense'].map(value=>`<option value="${value}" ${state.motivationSettings.intensity===value?'selected':''}>${value}</option>`).join('')}</select></label></div><div class="vision-checks"><label><input type="checkbox" name="enabled" ${state.motivationSettings.enabled?'checked':''}/> Motivation enabled</label><label><input type="checkbox" name="autoRotate" ${state.motivationSettings.autoRotate?'checked':''}/> Rotate featured visions</label><label><input type="checkbox" name="effects" ${state.motivationSettings.effects?'checked':''}/> Celebration effects</label></div><button class="secondary-button" type="submit">Save motivation settings</button></form>
    ${archivedBoards.length?`<section class="section archived-boards"><div class="section-head"><h2>Archived Boards</h2><span>History preserved</span></div>${archivedBoards.map(entry=>`<button data-action="restore-board" data-id="${entry.id}">${escapeHtml(entry.title)} · Restore</button>`).join('')}</section>`:''}
  </main>`;
}

function systemsView() {
  const cards = ['vision','streaming','body','learning','analytics'];
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
    <section class="glass settings-section"><h2>PWA & Storage</h2><div class="storage-note">Active store: ${storage.activeKey}<br>V1 rollback source: ${storage.legacyPreserved ? 'Preserved and untouched' : 'No V1 state found on this device'}<br>Malformed-state recovery copy: ${storage.recoveryAvailable?'Available':'Not needed'}<br>Vision photos stay offline in the browser media vault. Components use storage abstractions only.</div><div class="storage-note" id="mediaUsage">Checking photo-vault usage…</div><div class="button-row"><button class="secondary-button" data-action="install-app">Install app</button><button class="secondary-button" data-action="export-data">Export with images</button><button class="secondary-button" data-action="export-metadata">Export metadata only</button><button class="secondary-button" data-action="import-data">Import backup</button><input type="file" id="importFile" accept="application/json" hidden /></div><p class="metric-note">Metadata-only exports do not contain Vision Board image files.</p></section>
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

function goalLinkOptions(item) {
  const link=state.goalLinks.find(entry=>entry.id===item?.goalLinkId||entry.visionItemId===item?.id);
  const value=link?`${link.type}:${link.sourceId||'manual'}`:'none';
  const options=[['none','Unlinked inspiration'],...state.finance.allocations.map(entry=>[`allocation:${entry.id}`,`Allocation · ${entry.label}`]),[`boss:${state.finance.boss.id}`,`Boss Battle · ${state.finance.boss.title}`],['income-target:month','Monthly income target'],...state.finance.bills.map(entry=>[`bill:${entry.id}`,`Bill payoff · ${entry.title}`]),...state.missions.map(entry=>[`mission:${entry.id}`,`Mission · ${entry.title}`]),...state.rewards.map(entry=>[`reward:${entry.id}`,`Reward · ${entry.name}`]),['manual:manual','Manual saved amount']];
  return options.map(([key,label])=>`<option value="${key}" ${key===value?'selected':''}>${escapeHtml(label)}</option>`).join('');
}

function visionEditorSheet(item) {
  const isNew=!item; const board=state.visionBoards.find(entry=>entry.id===(item?.boardId||activeVisionBoardId))||state.visionBoards.find(entry=>entry.status==='active');
  const link=state.goalLinks.find(entry=>entry.id===item?.goalLinkId||entry.visionItemId===item?.id);
  return `<div class="sheet-wrap" data-action="close-overlay"><form class="sheet vision-sheet vision-editor-sheet" id="visionItemForm" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Vision foundry</p><h2>${isNew?'Add a Vision':'Edit Vision'}</h2></div><button type="button" class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header>${!board?`<div class="storage-note">Create a board before adding a vision.</div>`:`<input type="hidden" name="id" value="${item?.id||''}"/><input type="hidden" name="boardId" value="${board.id}"/><div class="vision-editor-preview">${visionImage(item)}</div><div class="field-grid vision-form-grid"><label class="field-label">Photo from library or camera<input class="field" name="image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" /></label><label class="field-label">Title<input class="field" name="title" required maxlength="70" value="${escapeHtml(item?.title||'')}" placeholder="The goal you can see" /></label><label class="field-label">Description<textarea class="field" name="description" rows="2" maxlength="220">${escapeHtml(item?.description||'')}</textarea></label><label class="field-label">Accessible image alt text<input class="field" name="altText" maxlength="140" value="${escapeHtml(item?.altText||'')}" placeholder="Describe the image meaningfully" /></label><label class="field-label">Category<select class="field" name="category">${VISION_CATEGORIES.map(value=>`<option ${value===(item?.category||'Custom')?'selected':''}>${value}</option>`).join('')}</select></label><label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions(item?.ownerId||board.ownerId)}</select></label><label class="field-label">Target cost<input class="field" name="targetCost" type="number" min="0" step="1" value="${item?.targetCost||''}" placeholder="Optional" /></label><label class="field-label">Target date<input class="field" name="targetDate" type="date" value="${item?.targetDate||''}" /></label><label class="field-label">Priority<select class="field" name="priority">${[5,4,3,2,1].map(value=>`<option value="${value}" ${value===(item?.priority||3)?'selected':''}>${value} · ${value===5?'Critical':value===1?'Someday':'Priority'}</option>`).join('')}</select></label><label class="field-label">Image shape<select class="field" name="shape">${IMAGE_SHAPES.map(value=>`<option value="${value}" ${value===(item?.shape||'auto')?'selected':''}>${value}</option>`).join('')}</select><label class="field-label">Motivational reason<textarea class="field" name="reason" rows="2" maxlength="180">${escapeHtml(item?.reason||'')}</textarea></label><label class="field-label">Financial connection<select class="field" name="goalSource">${goalLinkOptions(item)}</select></label><label class="field-label">Manual saved amount<input class="field" name="currentAmount" type="number" min="0" step="1" value="${link?.currentAmount||''}" placeholder="Only used for manual/bill links" /></label><label class="field-label">Planned weekly contribution<input class="field" name="contributionPerWeek" type="number" min="0" step="1" value="${link?.contributionPerWeek||''}" placeholder="Enables pace and projection" /></label><label class="field-label focal-control">Horizontal focus ${item?.focalX??50}%<input name="focalX" type="range" min="0" max="100" value="${item?.focalX??50}" /></label><label class="field-label focal-control">Vertical focus ${item?.focalY??50}%<input name="focalY" type="range" min="0" max="100" value="${item?.focalY??50}" /></label><label class="vision-check"><input type="checkbox" name="featured" ${item?.featured?'checked':''}/> Feature in daily motivation</label></div><button class="primary-button" type="submit">${isNew?'Create vision':'Save changes'}</button>`}</form></div>`;
}

function rewardSheet(reward) {
  if (!reward) return rewardEditorSheet();
  return rewardDetailSheet(reward);
  if (!reward) return `<div class="sheet-wrap" data-action="close-overlay"><form class="sheet vision-sheet" id="rewardForm" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Reward Vault</p><h2>Define a Reward</h2></div><button type="button" class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="field-grid vision-form-grid"><label class="field-label">Reward name<input class="field" name="name" required maxlength="70" placeholder="Dinner, day trip, new gear" /></label><label class="field-label">Description<textarea class="field" name="description" rows="2"></textarea></label><label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions()}</select></label><label class="field-label">Cost class<select class="field" name="costClass"><option value="free">Free</option><option value="low-cost">Low-cost</option><option value="purchase">Purchase</option></select></label><label class="field-label">Estimated cost<input class="field" name="estimatedCost" type="number" min="0" /></label><label class="field-label">Unlock condition<select class="field" name="conditionType"><option value="daily-target">Daily target completed</option><option value="weekly-target">Perfect earning week</option><option value="monthly-target">Monthly target completed</option><option value="streak">Savings streak reached</option><option value="vision-funded">Vision fully funded</option></select></label><label class="field-label">Condition value / streak<input class="field" name="conditionValue" type="number" min="0" /></label><label class="field-label">Related vision<select class="field" name="visionItemId"><option value="">None</option>${state.visionItems.map(item=>`<option value="${item.id}">${escapeHtml(item.title)}</option>`).join('')}</select></label><label class="field-label">Expiration date<input class="field" name="expiresAt" type="date" /></label></div><p class="storage-note">Unlocking grants permission to consider this reward. It never spends money or marks a purchase automatically.</p><button class="primary-button" type="submit">Lock reward in Vault</button></form></div>`;
  const related=state.visionItems.find(item=>item.id===reward.visionItemId);
  return `<div class="sheet-wrap" data-action="close-overlay"><section class="sheet vision-sheet reward-detail" role="dialog" aria-modal="true" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Reward Vault · ${escapeHtml(reward.status)}</p><h2>${escapeHtml(reward.name)}</h2></div><button class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="reward-detail-icon">${reward.status==='locked'?'⌾':'✦'}</div><p>${escapeHtml(reward.description||'A household-earned reward.')}</p><div class="detail-grid"><div class="detail-block"><small>Cost class</small><strong>${escapeHtml(reward.costClass)}</strong></div><div class="detail-block"><small>Estimated cost</small><strong>${reward.estimatedCost?money(reward.estimatedCost):'Free / not set'}</strong></div><div class="detail-block"><small>Ownership</small><strong>${escapeHtml(owner(reward.ownerId).label)}</strong></div><div class="detail-block"><small>Related vision</small><strong>${escapeHtml(related?.title||'None')}</strong></div></div><div class="button-row">${reward.status==='unlocked'?`<button class="primary-button" data-action="reward-transition" data-value="claim" data-id="${reward.id}">Claim reward</button>`:''}${reward.status==='claimed'?`<button class="primary-button" data-action="reward-transition" data-value="redeem" data-id="${reward.id}">Mark redeemed</button>`:''}${reward.status==='locked'?`<button class="secondary-button" data-action="reward-transition" data-value="skip" data-id="${reward.id}">Skip reward</button>`:''}<button class="secondary-button" data-route="vision">Return to Vault</button></div></section></div>`;
}

function rewardDetailSheet(reward) {
  const related=state.visionItems.find(item=>item.id===reward.visionItemId);
  const visual=reward.mediaId?`<div class="reward-detail-media">${visionImage({mediaId:reward.mediaId,altText:reward.altText||reward.name,title:reward.name,focalX:50,focalY:50})}</div>`:`<div class="reward-detail-icon">${reward.status==='locked'?'⌾':'✦'}</div>`;
  return `<div class="sheet-wrap" data-action="close-overlay"><section class="sheet vision-sheet reward-detail" role="dialog" aria-modal="true" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Reward Vault · ${escapeHtml(reward.status)}</p><h2>${escapeHtml(reward.name)}</h2></div><button class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header>${visual}<p>${escapeHtml(reward.description||'A household-earned reward.')}</p><div class="detail-grid"><div class="detail-block"><small>Cost class</small><strong>${escapeHtml(reward.costClass)}</strong></div><div class="detail-block"><small>Estimated cost</small><strong>${reward.estimatedCost?money(reward.estimatedCost):'Free / not set'}</strong></div><div class="detail-block"><small>Ownership</small><strong>${escapeHtml(owner(reward.ownerId).label)}</strong></div><div class="detail-block"><small>Related vision</small><strong>${escapeHtml(related?.title||'None')}</strong></div></div><div class="button-row">${reward.status==='unlocked'?`<button class="primary-button" data-action="reward-transition" data-value="claim" data-id="${reward.id}">Claim reward</button>`:''}${reward.status==='claimed'?`<button class="primary-button" data-action="reward-transition" data-value="redeem" data-id="${reward.id}">Mark redeemed</button>`:''}${['locked','unlocked'].includes(reward.status)?`<button class="secondary-button" data-action="reward-transition" data-value="skip" data-id="${reward.id}">Skip reward</button>`:''}<button class="secondary-button" data-route="vision">Return to Vault</button></div><p class="storage-note">Claiming or redeeming records a decision only. It never spends money or changes balances.</p></section></div>`;
}

function rewardEditorSheet() {
  return `<div class="sheet-wrap" data-action="close-overlay"><form class="sheet vision-sheet" id="rewardForm" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Reward Vault</p><h2>Define a Reward</h2></div><button type="button" class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="field-grid vision-form-grid"><label class="field-label">Reward picture<input class="field" name="image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" /></label><label class="field-label">Accessible image alt text<input class="field" name="altText" maxlength="140" placeholder="Describe the reward image" /></label><label class="field-label">Reward name<input class="field" name="name" required maxlength="70" placeholder="Dinner, day trip, new gear" /></label><label class="field-label">Description<textarea class="field" name="description" rows="2"></textarea></label><label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions()}</select></label><label class="field-label">Cost class<select class="field" name="costClass"><option value="free">Free</option><option value="low-cost">Low-cost</option><option value="purchase">Purchase</option></select></label><label class="field-label">Estimated cost<input class="field" name="estimatedCost" type="number" min="0" step="1" /></label><label class="field-label">Unlock condition<select class="field" name="conditionType"><option value="daily-target">Daily target completed</option><option value="weekly-target">Perfect earning week</option><option value="monthly-target">Monthly target completed</option><option value="streak">Savings streak reached</option><option value="vision-funded">Vision fully funded</option></select></label><label class="field-label">Condition value / streak<input class="field" name="conditionValue" type="number" min="0" /></label><label class="field-label">Related vision<select class="field" name="visionItemId"><option value="">None</option>${state.visionItems.map(item=>`<option value="${item.id}">${escapeHtml(item.title)}</option>`).join('')}</select></label><label class="field-label">Expiration date<input class="field" name="expiresAt" type="date" /></label></div><p class="storage-note">Unlocking grants permission to consider this reward. It never spends money or marks a purchase automatically.</p><button class="primary-button" type="submit">Lock reward in Vault</button></form></div>`;
}

function visionGoalSheet(item) {
  if (visionEditingId===item.id) return visionEditorSheet(item);
  const funding=calculateVisionProgress(item,state); const milestones=state.goalMilestones.filter(entry=>entry.visionItemId===item.id); const history=state.activity.filter(entry=>entry.entityId===item.id).slice(0,8); const relatedMissions=state.missions.filter(entry=>entry.ownerId===item.ownerId||entry.category===item.category.toLowerCase()).slice(0,3);
  return `<div class="sheet-wrap vision-full-wrap" data-action="close-overlay"><section class="sheet vision-sheet vision-goal-detail" role="dialog" aria-modal="true" data-sheet><header class="vision-detail-hero">${visionImage(item,'vision-detail-image')}<div class="vision-detail-overlay"><button class="sheet-close" data-action="close-overlay" aria-label="Close">×</button><div><p class="eyebrow">${escapeHtml(item.category)} · Priority ${item.priority}</p><h2>${escapeHtml(item.title)}</h2>${ownerChip(item.ownerId)}</div></div></header><div class="vision-detail-body"><p class="vision-reason">“${escapeHtml(item.reason||item.description||'A goal worth seeing every day.')}”</p><section class="goal-progress-panel ${funding.available?'':'unavailable'}"><div class="goal-progress-ring" style="--p:${funding.percent||0}"><strong>${funding.available?`${funding.percent}%`:'—'}</strong><span>${funding.pace}</span></div><div><h3>${funding.available?`${money(funding.remaining)} remaining`:'Progress unavailable'}</h3><p>${escapeHtml(funding.available?`Linked to ${funding.sourceLabel}`:funding.reason)}</p></div></section>${funding.available?`<div class="detail-grid"><div class="detail-block"><small>Saved / allocated</small><strong>${money(funding.saved)}</strong></div><div class="detail-block"><small>Target</small><strong>${money(funding.target)}</strong></div><div class="detail-block"><small>Required daily</small><strong>${funding.requiredDaily==null?'No target date':money(funding.requiredDaily)}</strong></div><div class="detail-block"><small>Required weekly</small><strong>${funding.requiredWeekly==null?'No target date':money(funding.requiredWeekly)}</strong></div><div class="detail-block"><small>Projected completion</small><strong>${funding.projectedDate?dayLabel(funding.projectedDate):'Contribution pace needed'}</strong></div><div class="detail-block"><small>Target date</small><strong>${item.targetDate?dayLabel(item.targetDate):'Not set'}</strong></div></div>`:''}<section class="vision-detail-section"><div class="section-head"><h3>Milestones</h3><span>${milestones.filter(entry=>entry.status==='reached').length}/${milestones.length}</span></div>${milestones.length?milestones.map(entry=>`<div class="milestone-row ${entry.status}"><i>${entry.status==='reached'?'✓':'◇'}</i><span>${escapeHtml(entry.label)}</span><b>${entry.status}</b></div>`).join(''):'<p class="metric-note">Milestones will appear after this vision is saved.</p>'}</section><section class="vision-detail-section"><div class="section-head"><h3>Related Missions</h3><span>${relatedMissions.length}</span></div>${relatedMissions.map(missionRow).join('')||'<p class="metric-note">No related missions yet.</p>'}</section><section class="vision-detail-section"><div class="section-head"><h3>Activity History</h3><span>${history.length}</span></div>${history.map(activityRow).join('')||'<p class="metric-note">No fabricated history. Real actions will appear here.</p>'}</section><div class="button-row"><button class="primary-button" data-action="edit-vision" data-id="${item.id}">Edit vision</button><button class="secondary-button" data-action="feature-vision" data-id="${item.id}">${item.featured?'Remove daily focus':'Make daily focus'}</button><button class="secondary-button" data-action="duplicate-vision" data-id="${item.id}">Duplicate</button><button class="secondary-button" data-action="complete-vision" data-id="${item.id}">${item.status==='completed'?'Reopen':'Mark completed'}</button><button class="danger-button" data-action="delete-vision" data-id="${item.id}">Delete</button></div></div></section></div>`;
}

function visionSheet(id) {
  if (id==='new') return visionEditorSheet(null);
  if (id==='reward-new') return rewardSheet(null);
  const reward=state.rewards.find(entry=>entry.id===id); if(reward)return rewardSheet(reward);
  const item=state.visionItems.find(entry=>entry.id===id); return item?visionGoalSheet(item):visionEditorSheet(null);
}

function detailSheet(base, id) {
  if (base==='vision') return visionSheet(id);
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
  if (!details.length) details.push(['System status', 'No records yet'], ['Purpose', 'This drill-down is ready for real household data.']);
  let action = '';
  if (base === 'money' && item?.dueDate) action = `<button class="primary-button" data-action="toggle-bill" data-id="${item.id}">${item.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}</button>`;
  if (base === 'missions' && item?.xp != null && 'completed' in item) action = `<button class="primary-button" data-action="toggle-mission" data-id="${item.id}">${item.completed ? 'Reopen mission' : `Complete +${item.xp} XP`}</button>`;
  if (base === 'streaming' && item?.stage) action = `<button class="primary-button" data-action="advance-pipeline" data-id="${item.id}">Advance pipeline stage</button>`;
  if (base === 'body' && item?.duration) action = `<button class="primary-button" data-action="toggle-workout" data-id="${item.id}">${item.completed ? 'Mark incomplete' : 'Complete workout'}</button>`;
  if (base === 'learning' && item?.xp != null) action = `<button class="primary-button" data-action="add-skill-xp" data-id="${item.id}">Add 25 skill XP</button>`;
  if (base === 'money') { const linked=state.goalLinks.find(link=>link.sourceId===item?.id);const vision=linked&&state.visionItems.find(entry=>entry.id===linked.visionItemId);action+=`<button class="secondary-button" data-route="vision${vision?`/${vision.id}`:''}">${vision?'Open linked vision':'Connect to Vision Board'}</button>`; }
  return `<div class="sheet-wrap" data-action="close-overlay"><section class="sheet" style="--system:${info.accent}" role="dialog" aria-modal="true" aria-labelledby="detailTitle" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow" style="color:${info.accent}">${info.eyebrow}</p><h2 id="detailTitle">${escapeHtml(title)}</h2></div><button class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="detail-grid">${details.map(([label,value]) => `<div class="detail-block"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}</div><div class="button-row">${action}<button class="secondary-button" data-route="${base}">Open full ${escapeHtml(info.label)} system</button></div></section></div>`;
}

function captureSheet() {
  const types = [
    ['note','⌁','Note'],['income','＋','Income'],['expense','−','Expense'],['bill','◇','Bill'],['mission','✦','Mission'],['event','◷','Event'],['workout','⬡','Workout'],['meal','◌','Meal'],['stream','◉','Stream'],['vision','◐','Vision item'],['vision-board','▦','Vision board'],['financial-goal','◈','Financial goal'],['reward','✧','Reward'],['milestone','◇','Milestone'],['motivation','★','Motivational note']
  ];
  const needsAmount = ['income','expense','bill'].includes(captureType);
  return `<div class="sheet-wrap" data-action="close-overlay"><form class="sheet" id="captureForm" data-sheet><div class="sheet-handle"></div><header class="sheet-header"><div><p class="eyebrow">Smart Quick Capture</p><h2>Route a new signal</h2></div><button type="button" class="sheet-close" data-action="close-overlay" aria-label="Close">×</button></header><div class="capture-types">${types.map(([type,icon,label]) => `<button type="button" class="capture-type ${captureType === type ? 'active' : ''}" data-action="capture-type" data-value="${type}"><i>${icon}</i><span>${label}</span></button>`).join('')}</div><div class="field-grid"><label class="field-label">Title<input class="field" name="title" required maxlength="80" placeholder="What happened or needs action?" autofocus /></label>${needsAmount ? '<label class="field-label">Amount<input class="field" name="amount" type="number" min="0" step="0.01" required placeholder="0.00" /></label>' : ''}<label class="field-label">Ownership<select class="field" name="ownerId">${memberOptions()}</select></label><label class="field-label">Details<textarea class="field" name="detail" rows="2" maxlength="180" placeholder="Optional context"></textarea></label></div><button class="primary-button" type="submit" style="width:100%;margin-top:14px">Add to Our Life OS</button></form></div>`;
}

function releaseVisionMedia() { visionMediaObserver?.disconnect(); visionMediaObserver=null; for(const url of visionMediaUrls.values())URL.revokeObjectURL(url); visionMediaUrls.clear(); }

function hydrateVisionMedia() {
  releaseVisionMedia(); const images=[...document.querySelectorAll('img[data-vision-media]')]; if(!images.length)return;
  const load=async image=>{ const id=image.dataset.visionMedia; try{const record=await store.getVisionMedia(id); if(!record?.blob){image.closest('.vision-photo,.vision-editor-preview,.vision-detail-hero,.home-vision-media')?.classList.add('media-missing');return;} const url=URL.createObjectURL(record.blob);visionMediaUrls.set(image,url);image.src=url;}catch{image.closest('.vision-photo,.vision-editor-preview,.vision-detail-hero,.home-vision-media')?.classList.add('media-missing');}};
  if('IntersectionObserver'in window){visionMediaObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){visionMediaObserver.unobserve(entry.target);load(entry.target);}}),{rootMargin:'180px'});images.forEach(image=>visionMediaObserver.observe(image));}else images.slice(0,20).forEach(load);
}

async function hydrateMediaUsage() {
  const target=document.querySelector('#mediaUsage'); if(!target)return;
  try { const usage=await store.mediaUsage(); target.textContent=`Photo vault: ${usage.count} image${usage.count===1?'':'s'} · ${(usage.bytes/1048576).toFixed(1)} MB${usage.quota?` · browser storage ${((usage.browserUsage||0)/1048576).toFixed(1)} of ${(usage.quota/1048576).toFixed(0)} MB`:''}`; }
  catch { target.textContent='Photo-vault usage is unavailable in this browser. Metadata remains accessible.'; }
}

function render() {
  const route = routeParts();
  if (route.base !== 'capture' && !route.detail) overlayReturn = null;
  const base = route.base === 'capture' ? 'home' : route.base;
  const views = { home: homeView, money: moneyView, missions: missionsView, streaming: streamingView, body: bodyView, learning: learningView, analytics: analyticsView, vision: visionBoardView, systems: systemsView, settings: settingsView };
  document.body.dataset.effects = state.settings.effects || 'balanced';
  document.body.dataset.motivationEffects = state.motivationSettings.effects === false ? 'off' : 'on';
  app.innerHTML = `${topbar()}${(views[base] || homeView)()}${bottomNav(base)}${route.base === 'capture' ? captureSheet() : route.detail ? detailSheet(base, route.detail) : ''}`;
  requestAnimationFrame(()=>{hydrateVisionMedia();hydrateMediaUsage();document.querySelectorAll('input[type="file"][capture]').forEach(input=>input.removeAttribute('capture'));const filterForm=document.querySelector('#visionFilterForm');if(filterForm)Object.entries(visionFilters).forEach(([key,value])=>{if(filterForm.elements[key])filterForm.elements[key].value=String(value);});});
}

function closeOverlay() {
  const route = routeParts();
  visionEditingId=null;
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

function celebrate(message) {
  toast(message);const reduced=state.settings.effects==='reduced'||state.motivationSettings.effects===false||matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced)return;
  const burst=document.createElement('div');burst.className=`vision-celebration effects-${state.settings.effects}`;burst.setAttribute('aria-hidden','true');burst.innerHTML=Array.from({length:state.settings.effects==='full'?18:8},(_,index)=>`<i style="--i:${index}"></i>`).join('');document.body.append(burst);setTimeout(()=>burst.remove(),1800);
}

function toggleMission(id) {
  let result;
  store.update(next => {
    const mission = next.missions.find(item => item.id === id);
    if (!mission) return;
    mission.completed = !mission.completed;
    const delta = mission.completed ? mission.xp : -mission.xp;
    next.game = applyXpDelta(next.game, delta);
    next.activity.unshift({ id: uid('activity'), title: `${mission.completed ? 'Completed' : 'Reopened'} ${mission.title}`, detail: `${delta > 0 ? '+' : ''}${delta} XP`, system: mission.category, ownerId: mission.ownerId, occurredAt: new Date().toISOString(), dataOrigin:'user' });
    result = mission.completed;
  });
  toast(result ? 'Mission complete. XP charged.' : 'Mission reopened. XP adjusted.');
}

function visionActivity(next,title,detail,ownerId='household',entityId=null) {
  next.activity.unshift({id:uid('activity'),title,detail,system:'vision',ownerId,entityId,occurredAt:new Date().toISOString(),dataOrigin:'user'});
}

function applyVisionRules(next) {
  next.visionItems.forEach(item=>{ const funding=calculateVisionProgress(item,next); const before=new Map(next.goalMilestones.map(entry=>[entry.id,entry.status])); next.goalMilestones=evaluateMilestones(item,funding,next.goalMilestones); next.goalMilestones.filter(entry=>entry.visionItemId===item.id&&entry.status==='reached'&&before.get(entry.id)!=='reached').forEach(entry=>{visionActivity(next,`Milestone reached: ${entry.label}`,item.title,item.ownerId,item.id);pendingCelebration=entry.threshold===100?`${item.title} is fully funded!`:`${entry.label} milestone reached`;}); });
  next.rewards=next.rewards.map(reward=>{ if(reward.status==='locked'&&rewardShouldUnlock(reward,next)){const unlocked=transitionReward(reward,'unlock');next.rewardUnlocks.push({id:uid('reward-unlock'),rewardId:reward.id,ownerId:reward.ownerId,status:'unlocked',category:'reward',createdAt:unlocked.unlockedAt,updatedAt:unlocked.unlockedAt,activityEventId:null});visionActivity(next,`Reward unlocked: ${reward.name}`,'Permission earned — no money was spent.',reward.ownerId,reward.id);pendingCelebration=`Reward unlocked: ${reward.name}`;return unlocked;}return reward; });
}

function submitCapture(form) {
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  const detail = String(data.get('detail') || '').trim();
  const ownerId = String(data.get('ownerId') || 'household');
  const amount = Math.max(0, Number(data.get('amount')) || 0);
  const targetsBefore=evaluateTargets(state);
  if (!title) return;
  store.update(next => {
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const localDay = toLocalDateKey(nowDate);
    next.captures.unshift({ id: uid('capture'), type: captureType, title, detail, amount, ownerId, createdAt: now });
    let systemKey = 'missions';
    let activityDetail = detail || captureType;
    if (captureType === 'income') {
      const entry = { id: uid('income'), source: title, amount, date: localDay, ownerId };
      next.finance.income.push(entry); next.finance.monthIncome += amount; next.finance.available += amount; next.finance.boss.current = next.finance.monthIncome; systemKey = 'money'; activityDetail = `+${money(amount)}`;
    } else if (captureType === 'expense') {
      next.finance.spent += amount; next.finance.available = Math.max(0, next.finance.available - amount); systemKey = 'money'; activityDetail = `-${money(amount)}`;
    } else if (captureType === 'bill') {
      const dueDate = new Date(nowDate); dueDate.setDate(dueDate.getDate() + 7);
      next.finance.bills.push({ id: uid('bill'), title, amount, dueDate: toLocalDateKey(dueDate), status: 'upcoming', ownerId, category: detail || 'Other' }); systemKey = 'money'; activityDetail = `${money(amount)} due in 7 days`;
    } else if (captureType === 'mission') {
      next.missions.push({ id: uid('mission'), title, detail: detail || 'Custom household mission', category: 'household', xp: 75, completed: false, recurring: 'once', ownerId });
    } else if (captureType === 'event') {
      next.calendar.push({ id: uid('event'), title, startsAt: new Date(Date.now()+3600000).toISOString(), system: 'missions', ownerId });
    } else if (captureType === 'workout') {
      next.body.workouts.unshift({ id: uid('workout'), title, date: localDay, duration: 30, completed: true, ownerId }); systemKey = 'body'; activityDetail = detail || '30 minute session';
    } else if (captureType === 'stream') systemKey = 'streaming';
    else if (captureType === 'meal') systemKey = 'body';
    else if (captureType === 'vision-board') { const board=createVisionBoard({id:uid('vision-board'),title,description:detail,ownerId,category:'Household'},now); next.visionBoards.push(board); activeVisionBoardId=board.id; systemKey='vision'; activityDetail='Vision board created'; }
    else if (captureType === 'vision') { let board=next.visionBoards.find(entry=>entry.status==='active'); if(!board){board=createVisionBoard({id:uid('vision-board'),title:'My Vision Board',ownerId},now);next.visionBoards.push(board);} const item=createVisionItem({id:uid('vision'),boardId:board.id,title,description:detail,reason:detail,ownerId,category:'Custom',order:next.visionItems.length},now);next.visionItems.push(item);activeVisionBoardId=board.id;systemKey='vision';activityDetail='Vision item created — add an image and funding link when ready'; }
    else if (captureType === 'financial-goal') { let board=next.visionBoards.find(entry=>entry.status==='active'); if(!board){board=createVisionBoard({id:uid('vision-board'),title:'Financial Visions',ownerId},now);next.visionBoards.push(board);} const item=createVisionItem({id:uid('vision'),boardId:board.id,title,description:detail,ownerId,targetCost:amount,category:'Financial Security',order:next.visionItems.length},now); const link={id:uid('goal-link'),visionItemId:item.id,type:'manual',sourceId:'manual',currentAmount:0,targetAmount:amount,contributionPerWeek:0,ownerId,status:'active',category:'financial-goal',createdAt:now,updatedAt:now};item.goalLinkId=link.id;next.visionItems.push(item);next.goalLinks.push(link);activeVisionBoardId=board.id;systemKey='vision';activityDetail='Financial goal created with $0 funded'; }
    else if (captureType === 'reward') { next.rewards.push({id:uid('reward'),name:title,description:detail,ownerId,status:'locked',category:'reward',costClass:'free',estimatedCost:0,unlockCondition:{type:'daily-target',label:'Daily target completed'},visionItemId:null,createdAt:now,updatedAt:now,unlockedAt:null,claimedAt:null,redeemedAt:null});systemKey='vision';activityDetail='Reward locked in Vault'; }
    else if (captureType === 'milestone') { const vision=next.visionItems.find(item=>item.status==='active'); if(vision)next.goalMilestones.push({id:uid('milestone'),visionItemId:vision.id,label:title,type:'custom',threshold:null,ownerId,status:'pending',category:'custom',createdAt:now,updatedAt:now,reachedAt:null});systemKey='vision';activityDetail=vision?'Milestone added to active vision':'Saved; choose a vision to connect it'; }
    else if (captureType === 'motivation') { next.motivationSettings.customStatements.push(title);systemKey='vision';activityDetail='Custom motivation saved'; }
    applyVisionRules(next);
    const targetsAfter=evaluateTargets(next);if(!targetsBefore.monthlyComplete&&targetsAfter.monthlyComplete)pendingCelebration='Monthly financial target complete!';else if(!targetsBefore.weeklyComplete&&targetsAfter.weeklyComplete)pendingCelebration='Weekly financial target complete!';else if(!targetsBefore.dailyComplete&&targetsAfter.dailyComplete)pendingCelebration='Today’s financial target complete!';
    next.activity.unshift({ id: uid('activity'), title: `Captured ${title}`, detail: activityDetail, system: systemKey, ownerId, occurredAt: now, dataOrigin:'user' });
  });
  captureType = 'note';
  toast('Captured and routed successfully.');
  go('home', true);
}

async function persistSelectedImage(file, altText, ownerId, category) {
  if (!file?.size) return null;
  const id=uid('vision-media');
  const meta=await store.saveVisionMedia({id,file,altText});
  return {...meta,ownerId,status:'active',category,updatedAt:meta.createdAt,activityEventId:null};
}

async function saveVisionItemForm(form) {
  const data=new FormData(form); const id=String(data.get('id')||'')||uid('vision'); const existing=state.visionItems.find(item=>item.id===id); const now=new Date().toISOString();
  const ownerId=String(data.get('ownerId')||'household'); const category=String(data.get('category')||'Custom'); const altText=String(data.get('altText')||'').trim();
  let mediaMeta=null;
  try { mediaMeta=await persistSelectedImage(data.get('image'),altText,ownerId,category); }
  catch(error){toast(`${error.message} The previous image, if any, was preserved.`);return;}
  const patch={boardId:String(data.get('boardId')),title:String(data.get('title')||'').trim(),description:String(data.get('description')||'').trim(),altText,category,ownerId,targetCost:Math.max(0,Number(data.get('targetCost'))||0),targetDate:String(data.get('targetDate')||''),priority:Number(data.get('priority'))||3,shape:String(data.get('shape')||'auto'),reason:String(data.get('reason')||'').trim(),focalX:Number(data.get('focalX'))||50,focalY:Number(data.get('focalY'))||50,featured:data.has('featured'),mediaId:mediaMeta?.id||existing?.mediaId||null};
  const goalSource=String(data.get('goalSource')||'none'); const [linkType,sourceId]=goalSource.split(':'); const oldMediaId=existing?.mediaId||null; const oldMediaShared=Boolean(oldMediaId&&state.visionItems.some(item=>item.id!==id&&item.mediaId===oldMediaId));
  store.update(next=>{
    if(existing)next.visionItems=updateVisionItem(next.visionItems,id,patch,now);else next.visionItems.push(createVisionItem({...patch,id,order:next.visionItems.filter(item=>item.boardId===patch.boardId).length},now));
    if(mediaMeta){next.visionMedia.push(mediaMeta);if(oldMediaId&&!oldMediaShared)next.visionMedia=next.visionMedia.filter(entry=>entry.id!==oldMediaId);}
    let item=next.visionItems.find(entry=>entry.id===id); const oldLink=next.goalLinks.find(entry=>entry.visionItemId===id);
    if(goalSource==='none'){next.goalLinks=next.goalLinks.filter(entry=>entry.visionItemId!==id);item.goalLinkId=null;}
    else { const link={id:oldLink?.id||uid('goal-link'),visionItemId:id,type:linkType,sourceId,currentAmount:Math.max(0,Number(data.get('currentAmount'))||0),targetAmount:patch.targetCost,contributionPerWeek:Math.max(0,Number(data.get('contributionPerWeek'))||0),ownerId,status:'active',category:'financial-goal',createdAt:oldLink?.createdAt||now,updatedAt:now,activityEventId:null}; next.goalLinks=next.goalLinks.filter(entry=>entry.visionItemId!==id);next.goalLinks.push(link);item.goalLinkId=link.id;}
    if(!existing)next.goalMilestones.push(...[25,50,75,100].map(value=>({id:uid('milestone'),visionItemId:id,label:value===100?'Fully funded':`${value}% funded`,type:'percent-funded',threshold:value,ownerId,status:'pending',category:'financial',createdAt:now,updatedAt:now,reachedAt:null,activityEventId:null})));
    const featuredIds=new Set(next.motivationSettings.featuredItemIds||[]);patch.featured?featuredIds.add(id):featuredIds.delete(id);next.motivationSettings.featuredItemIds=[...featuredIds];
    visionActivity(next,`${existing?'Vision updated':'Vision created'}: ${patch.title}`,goalSource==='none'?'Unlinked inspiration':`Linked to ${linkType}`,ownerId,id);applyVisionRules(next);
  });
  if(mediaMeta&&oldMediaId&&!oldMediaShared)await store.deleteVisionMedia(oldMediaId);
  visionEditingId=null;activeVisionBoardId=patch.boardId;toast(existing?'Vision updated.':'Vision added to the board.');go(`vision/${id}`,true);
}

async function saveRewardForm(form) {
  const data=new FormData(form); const now=new Date().toISOString(); const id=uid('reward'); const ownerId=String(data.get('ownerId')||'household'); const visionItemId=String(data.get('visionItemId')||'')||null; const altText=String(data.get('altText')||'').trim(); let mediaMeta=null;
  try { mediaMeta=await persistSelectedImage(data.get('image'),altText,ownerId,'Personal Reward'); } catch(error){toast(error.message);return;}
  const reward={id,name:String(data.get('name')||'').trim(),description:String(data.get('description')||'').trim(),ownerId,status:'locked',category:'reward',costClass:String(data.get('costClass')||'free'),estimatedCost:Math.max(0,Number(data.get('estimatedCost'))||0),unlockCondition:{type:String(data.get('conditionType')||'daily-target'),value:Math.max(0,Number(data.get('conditionValue'))||0),visionItemId,label:'Household achievement condition'},visionItemId,expiresAt:String(data.get('expiresAt')||''),mediaId:mediaMeta?.id||null,altText,createdAt:now,updatedAt:now,unlockedAt:null,claimedAt:null,redeemedAt:null,activityEventId:null};
  store.update(next=>{if(mediaMeta)next.visionMedia.push(mediaMeta);next.rewards.push(reward);visionActivity(next,`Reward created: ${reward.name}`,'Locked in the Reward Vault. No money was spent.',ownerId,id);applyVisionRules(next);});toast('Reward added. Unlocking will never change a balance.');go('vision',true);
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
  if (action === 'show-board-form') { document.querySelector('.vision-board-form')?.classList.remove('is-collapsed'); document.querySelector('.vision-board-form input')?.focus(); return; }
  if (action === 'select-vision-board') { activeVisionBoardId=id; return render(); }
  if (action === 'set-collage-template') { store.update(next=>{const board=next.visionBoards.find(entry=>entry.id===id);if(board){board.template=button.dataset.value;board.updatedAt=new Date().toISOString();}});return toast('Collage rearranged. Images and metadata preserved.'); }
  if (action === 'archive-board') { store.update(next=>{const board=next.visionBoards.find(entry=>entry.id===id);if(board){board.status='archived';board.archivedAt=new Date().toISOString();board.updatedAt=board.archivedAt;visionActivity(next,`Archived vision board: ${board.title}`,'History and images preserved.',board.ownerId,board.id);}});activeVisionBoardId=null;return toast('Board archived with history preserved.'); }
  if (action === 'restore-board') { store.update(next=>{const board=next.visionBoards.find(entry=>entry.id===id);if(board){board.status='active';board.archivedAt=null;board.updatedAt=new Date().toISOString();}});activeVisionBoardId=id;return toast('Vision board restored.'); }
  if (action === 'edit-vision') { visionEditingId=id; return render(); }
  if (action === 'feature-vision') { store.update(next=>{const item=next.visionItems.find(entry=>entry.id===id);if(!item)return;item.featured=!item.featured;item.updatedAt=new Date().toISOString();const ids=(next.motivationSettings.featuredItemIds||[]).filter(entry=>entry!==id);next.motivationSettings.featuredItemIds=item.featured?[id,...ids]:ids;});return toast('Daily focus updated.'); }
  if (action === 'favorite-vision') { store.update(next=>{const item=next.visionItems.find(entry=>entry.id===id);if(item){item.favorite=!item.favorite;item.updatedAt=new Date().toISOString();}});return toast('Vision favorite updated.'); }
  if (action === 'move-vision') { store.update(next=>{const boardItems=next.visionItems.filter(item=>item.boardId===activeVisionBoardId);const reordered=reorderVisionItems(boardItems,id,Number(button.dataset.direction));const map=new Map(reordered.map(item=>[item.id,item]));next.visionItems=next.visionItems.map(item=>map.get(item.id)||item);});return; }
  if (action === 'duplicate-vision') { const newId=uid('vision');store.update(next=>{next.visionItems=duplicateVisionItem(next.visionItems,id,newId);const copy=next.visionItems.find(item=>item.id===newId);const sourceLink=next.goalLinks.find(link=>link.visionItemId===id);if(copy&&sourceLink){const link={...sourceLink,id:uid('goal-link'),visionItemId:newId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};next.goalLinks.push(link);copy.goalLinkId=link.id;}next.goalMilestones.filter(milestone=>milestone.visionItemId===id).forEach(milestone=>next.goalMilestones.push({...milestone,id:uid('milestone'),visionItemId:newId,status:'pending',reachedAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));if(copy)visionActivity(next,`Duplicated vision: ${copy.title}`,'Image is shared until replaced.',copy.ownerId,copy.id);});toast('Vision duplicated.');return go(`vision/${newId}`,true); }
  if (action === 'complete-vision') { store.update(next=>{const item=next.visionItems.find(entry=>entry.id===id);if(!item)return;item.status=item.status==='completed'?'active':'completed';item.completedAt=item.status==='completed'?new Date().toISOString():null;item.updatedAt=new Date().toISOString();visionActivity(next,`${item.status==='completed'?'Vision completed':'Vision reopened'}: ${item.title}`,visionFundingLabel(calculateVisionProgress(item,next)),item.ownerId,item.id);applyVisionRules(next);});toast('Vision status updated.');return go('vision',true); }
  if (action === 'delete-vision') { if(!confirm('Delete this vision and its history link? This cannot be undone.'))return;const item=state.visionItems.find(entry=>entry.id===id);const mediaId=item?.mediaId;const shared=state.visionItems.some(entry=>entry.id!==id&&entry.mediaId===mediaId);store.update(next=>{next.visionItems=removeVisionItem(next.visionItems,id);next.goalLinks=next.goalLinks.filter(entry=>entry.visionItemId!==id);next.goalMilestones=next.goalMilestones.filter(entry=>entry.visionItemId!==id);if(mediaId&&!shared)next.visionMedia=next.visionMedia.filter(entry=>entry.id!==mediaId);});if(mediaId&&!shared)await store.deleteVisionMedia(mediaId);toast('Vision removed.');return go('vision',true); }
  if (action === 'refresh-motivation') { store.update(next=>{next.motivationSettings.rotationOffset=(Number(next.motivationSettings.rotationOffset)||0)+1;const result=motivationEngine.generate(next,new Date(),dailyFocusId(next));next.motivationHistory.unshift({id:uid('motivation'),...result,ownerId:'household',status:'shown',category:'motivation',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),activityEventId:null});});return toast('Motivation refreshed from current progress.'); }
  if (action === 'dismiss-motivation') { const result=motivationEngine.generate(state,new Date(),dailyFocusId());store.update(next=>{if(result.itemId){const item=next.visionItems.find(entry=>entry.id===result.itemId);if(item)item.dismissed=true;}next.motivationSettings.dismissedRules=[...new Set([...(next.motivationSettings.dismissedRules||[]),result.rule])];});return toast('Motivation dismissed.'); }
  if (action === 'save-motivation') { const result=motivationEngine.generate(state,new Date(),dailyFocusId());store.update(next=>{next.motivationSettings.customStatements=[...new Set([...(next.motivationSettings.customStatements||[]),result.message])];next.motivationHistory.unshift({id:uid('motivation'),...result,ownerId:'household',status:'saved',category:'motivation',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),activityEventId:null});});return toast('Motivational statement saved.'); }
  if (action === 'reward-transition') { const before=state.finance.available;store.update(next=>{const reward=next.rewards.find(entry=>entry.id===id);if(!reward)return;const changed=transitionReward(reward,button.dataset.value);Object.assign(reward,changed);visionActivity(next,`Reward ${reward.status}: ${reward.name}`,'No balance was changed.',reward.ownerId,reward.id);});if(state.finance.available!==before)console.error('Reward transition changed a balance unexpectedly.');toast(`Reward ${button.dataset.value} recorded. No money was spent.`);return go('vision',true); }
  if (action === 'set-effects') { store.update(next => { next.settings.effects=button.dataset.value; }); return toast(`Effects set to ${button.dataset.value}.`); }
  if (action === 'export-data') {
    try{const bundle=await store.exportBundle({includeMedia:true});const blob=new Blob([bundle],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`our-life-os-v3-with-images-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);return toast('Vision bundle exported with saved images.');}catch{const blob=new Blob([store.exportData()],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`our-life-os-v3-metadata-only.json`;link.click();URL.revokeObjectURL(url);return toast('Metadata-only export created. Warning: image files were not included.');}
  }
  if (action === 'export-metadata') { const blob=new Blob([store.exportData()],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='our-life-os-v3-metadata-only.json';link.click();URL.revokeObjectURL(url);return toast('Metadata exported. Vision image files are not included.'); }
  if (action === 'import-data') return document.querySelector('#importFile')?.click();
  if (action === 'reset-v2') {
    if (confirm('Reset V2 and delete its locally saved Vision photos? Your original V1 state will remain untouched.')) { await store.clearVisionMedia(); store.resetV2(); toast('V2 reset. V1 rollback preserved.'); go('home'); }
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

app.addEventListener('submit', async event => {
  event.preventDefault();
  if (event.target.id === 'captureForm') submitCapture(event.target);
  if (event.target.id === 'visionBoardForm') {
    const data=new FormData(event.target);const now=new Date().toISOString();const board=createVisionBoard({id:uid('vision-board'),title:data.get('title'),description:data.get('description'),ownerId:data.get('ownerId'),category:data.get('category')},now);
    store.update(next=>{next.visionBoards.push(board);visionActivity(next,`Vision board created: ${board.title}`,board.description||'A new space for real goals.',board.ownerId,board.id);});activeVisionBoardId=board.id;toast('Vision board created.');
  }
  if (event.target.id === 'visionFilterForm') { const data=new FormData(event.target);visionFilters={owner:String(data.get('owner')),category:String(data.get('category')),status:String(data.get('status')),affordability:String(data.get('affordability')),priority:String(data.get('priority'))};render(); }
  if (event.target.id === 'motivationSettingsForm') { const data=new FormData(event.target);store.update(next=>{next.motivationSettings={...next.motivationSettings,frequency:String(data.get('frequency')),intensity:String(data.get('intensity')),enabled:data.has('enabled'),autoRotate:data.has('autoRotate'),effects:data.has('effects')};});toast('Motivation controls saved.'); }
  if (event.target.id === 'visionItemForm') await saveVisionItemForm(event.target);
  if (event.target.id === 'rewardForm') await saveRewardForm(event.target);
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
  try { const text=await event.target.files[0].text();const parsed=JSON.parse(text);if(parsed?.format==='our-life-os-v3-bundle'){const result=await store.importBundle(parsed);toast(result.mediaIncluded?'Backup and Vision photos imported.':'Backup imported without image files.');}else{store.importData(parsed);toast('Metadata imported. Vision image files were not included in this backup.');}go('home'); }
  catch (error) { toast(error.message); }
});

window.addEventListener('hashchange', render);
window.addEventListener('online', render);
window.addEventListener('offline', render);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt=event; });
store.subscribe(next => { state=next; render(); if(pendingCelebration){const message=pendingCelebration;pendingCelebration=null;requestAnimationFrame(()=>celebrate(message));} });

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
