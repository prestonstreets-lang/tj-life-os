import { parseLocalDate, toLocalDateKey } from './date.js';

export const VISION_CATEGORIES = ['Home','Vehicle','Travel','Technology','Streaming','Fitness','Fashion','Experiences','Financial Security','Debt Freedom','Household','Personal Reward','Custom'];
export const COLLAGE_TEMPLATES = [
  ['smart-auto','Smart Auto Collage'],['cinematic-hero','Cinematic Hero'],['luxury-editorial','Luxury Editorial'],['polaroid-wall','Polaroid Memory Wall'],
  ['holographic-honeycomb','Holographic Honeycomb'],['goal-orbit','Goal Orbit'],['progress-roadmap','Progress Roadmap'],['reward-vault','Reward Vault']
];
export const IMAGE_SHAPES = ['auto','widescreen','rounded','square','circle','hexagon','polaroid','reward-card'];

const clone = value => JSON.parse(JSON.stringify(value));
const amount = value => Math.max(0, Number(value) || 0);
const nowIso = now => new Date(now || Date.now()).toISOString();

export function createVisionBoard(input = {}, now) {
  const createdAt = nowIso(now);
  return { id: input.id || `vision-board-${Date.now().toString(36)}`, title: String(input.title || 'New Vision Board').trim(), description: String(input.description || '').trim(), ownerId: input.ownerId || 'household', status: input.status || 'active', category: input.category || 'Household', template: input.template || 'smart-auto', shape: input.shape || 'auto', createdAt, updatedAt: createdAt, archivedAt: null, activityEventId:input.activityEventId||null };
}

export function createVisionItem(input = {}, now) {
  const createdAt = nowIso(now);
  return { id: input.id || `vision-${Date.now().toString(36)}`, boardId: input.boardId || '', title: String(input.title || 'Untitled Vision').trim(), description: String(input.description || '').trim(), category: input.category || 'Custom', ownerId: input.ownerId || 'household', status: input.status || 'active', targetCost: amount(input.targetCost), targetDate: input.targetDate || '', priority: Math.min(5, Math.max(1, Number(input.priority) || 3)), reason: String(input.reason || '').trim(), altText: String(input.altText || input.title || 'Vision board image').trim(), mediaId: input.mediaId || null, featured: Boolean(input.featured), favorite: Boolean(input.favorite), dismissed: false, shape: input.shape || 'auto', focalX: Math.min(100, Math.max(0, Number(input.focalX ?? 50))), focalY: Math.min(100, Math.max(0, Number(input.focalY ?? 50))), order: Number(input.order) || 0, goalLinkId: input.goalLinkId || null, createdAt, updatedAt: createdAt, completedAt: null, activityEventId:input.activityEventId||null };
}

export function updateVisionItem(items, id, patch, now) {
  return items.map(item => item.id === id ? { ...item, ...clone(patch), id:item.id, createdAt:item.createdAt, updatedAt:nowIso(now) } : item);
}

export function reorderVisionItems(items, id, direction, now) {
  const ordered = [...items].sort((a,b)=>(a.order||0)-(b.order||0));
  const index = ordered.findIndex(item=>item.id===id);
  const target = Math.max(0, Math.min(ordered.length-1, index + direction));
  if (index < 0 || target === index) return items;
  [ordered[index],ordered[target]]=[ordered[target],ordered[index]];
  return ordered.map((item,order)=>({...item,order,updatedAt:item.id===id?nowIso(now):item.updatedAt}));
}

export function duplicateVisionItem(items, id, newId, now) {
  const source = items.find(item=>item.id===id);
  if (!source) return items;
  const createdAt=nowIso(now);
  return [...items,{...clone(source),id:newId||`vision-${Date.now().toString(36)}`,title:`${source.title} Copy`,featured:false,order:items.length,createdAt,updatedAt:createdAt,completedAt:null}];
}

export const removeVisionItem = (items,id) => items.filter(item=>item.id!==id);

export function autoSelectCollage(items, viewportWidth = 390) {
  const count = items.length;
  if (count <= 1) return 'cinematic-hero';
  if (items.some(item=>item.status==='completed' || item.rewardId)) return 'reward-vault';
  if (count <= 3) return 'luxury-editorial';
  if (items.filter(item=>item.featured).length === 1 && count <= 6) return 'cinematic-hero';
  if (viewportWidth < 390 && count >= 7) return 'progress-roadmap';
  if (count <= 6) return 'holographic-honeycomb';
  if (count <= 10) return 'polaroid-wall';
  return 'progress-roadmap';
}

export function resolveBoardTemplate(board, items, viewportWidth=390) {
  return board?.template === 'smart-auto' ? autoSelectCollage(items,viewportWidth) : board?.template || 'cinematic-hero';
}

function linkedSource(link, state, item) {
  if (!link) return null;
  if (link.type === 'allocation') {
    const source=state.finance?.allocations?.find(entry=>entry.id===link.sourceId);
    return source ? { saved:amount(source.amount), target:amount(link.targetAmount || item.targetCost || source.target), label:source.label, contributionPerWeek:amount(link.contributionPerWeek) } : null;
  }
  if (link.type === 'boss') {
    const source=state.finance?.boss?.id===link.sourceId ? state.finance.boss : null;
    return source ? { saved:amount(source.current),target:amount(link.targetAmount || item.targetCost || source.target),label:source.title,contributionPerWeek:amount(link.contributionPerWeek) } : null;
  }
  if (link.type === 'income-target') return { saved:amount(state.finance?.monthIncome),target:amount(link.targetAmount || item.targetCost || state.finance?.monthGoal),label:'Monthly income target',contributionPerWeek:amount(link.contributionPerWeek) };
  if (link.type === 'manual') return { saved:amount(link.currentAmount),target:amount(link.targetAmount || item.targetCost),label:'Manually tracked funding',contributionPerWeek:amount(link.contributionPerWeek) };
  if (link.type === 'bill') {
    const bill=state.finance?.bills?.find(entry=>entry.id===link.sourceId);
    return bill && link.currentAmount != null ? {saved:amount(link.currentAmount),target:amount(bill.amount),label:`${bill.title} payoff`,contributionPerWeek:amount(link.contributionPerWeek)} : null;
  }
  return null;
}

export function calculateVisionProgress(item, state, now = new Date()) {
  const link=state.goalLinks?.find(entry=>entry.id===item.goalLinkId || entry.visionItemId===item.id);
  const source=linkedSource(link,state,item);
  if (!source || !source.target) return { available:false, reason:'Link an allocation or enter a saved amount to calculate real progress.', target:amount(item.targetCost), saved:null, remaining:null, percent:null, requiredDaily:null, requiredWeekly:null, projectedDate:null, pace:'unavailable', sourceLabel:null };
  const saved=Math.min(source.target,source.saved); const remaining=Math.max(0,source.target-saved); const percent=Math.min(100,Math.round(saved/source.target*100));
  const targetDate=item.targetDate ? parseLocalDate(item.targetDate) : null;
  const days=targetDate && !Number.isNaN(targetDate.getTime()) ? Math.max(1,Math.ceil((targetDate-new Date(now))/(86400000))) : null;
  const requiredDaily=days ? remaining/days : null; const requiredWeekly=days ? requiredDaily*7 : null;
  const projectedDate=source.contributionPerWeek>0 && remaining>0 ? new Date(new Date(now).getTime()+Math.ceil(remaining/source.contributionPerWeek)*7*86400000).toISOString() : remaining===0 ? new Date(now).toISOString() : null;
  const pace=!requiredWeekly || !source.contributionPerWeek ? (remaining===0?'ahead':'unavailable') : source.contributionPerWeek >= requiredWeekly*1.08 ? 'ahead' : source.contributionPerWeek >= requiredWeekly*.92 ? 'on-track' : 'behind';
  return { available:true,target:source.target,saved,remaining,percent,requiredDaily,requiredWeekly,projectedDate,pace,sourceLabel:source.label };
}

export function evaluateTargets(state, today = new Date()) {
  const todayKey=toLocalDateKey(today); const current=new Date(today); const day=current.getDay(); const weekStart=new Date(current); weekStart.setDate(current.getDate()-day); weekStart.setHours(0,0,0,0);
  const monthStart=new Date(current.getFullYear(),current.getMonth(),1);
  const income=state.finance?.income || [];
  const dailyActual=income.filter(entry=>entry.date===todayKey).reduce((sum,entry)=>sum+amount(entry.amount),0);
  const weeklyActual=income.filter(entry=>parseLocalDate(entry.date)>=weekStart && parseLocalDate(entry.date)<=current).reduce((sum,entry)=>sum+amount(entry.amount),0);
  const monthlyActual=income.filter(entry=>parseLocalDate(entry.date)>=monthStart && parseLocalDate(entry.date)<=current).reduce((sum,entry)=>sum+amount(entry.amount),0);
  const dailyTarget=amount(state.finance?.dailyTarget); const monthlyTarget=amount(state.finance?.monthGoal); const weeklyTarget=dailyTarget*7;
  return {dailyActual,dailyTarget,dailyComplete:dailyTarget>0&&dailyActual>=dailyTarget,weeklyActual,weeklyTarget,weeklyComplete:weeklyTarget>0&&weeklyActual>=weeklyTarget,monthlyActual,monthlyTarget,monthlyComplete:monthlyTarget>0&&monthlyActual>=monthlyTarget};
}

export function createMotivationEngine() {
  return { generate(state, now=new Date(), requestedItemId=null) {
    const settings=state.motivationSettings||{};
    const finish=result=>{const intensity=settings.intensity||'balanced';const styled={...result,frequency:settings.frequency||'daily',intensity};if(intensity==='gentle')styled.nextAction=`Gentle next step · ${styled.nextAction}`;if(intensity==='intense'){styled.message=`${styled.message} Lock in the next move.`;styled.nextAction=`Priority action · ${styled.nextAction}`;}return styled;};
    if (settings.enabled===false) return finish({rule:'disabled',itemId:null,message:'Daily motivation is paused in Vision Board settings.',nextAction:'Turn it on whenever you want a progress signal'});
    const items=(state.visionItems||[]).filter(item=>item.status==='active'&&!item.dismissed);
    if (!items.length) return finish({rule:'onboarding',itemId:null,message:'Add one meaningful vision, then link real funding to turn it into a daily progress signal.',nextAction:'Create your first vision'});
    const item=items.find(entry=>entry.id===requestedItemId) || items.find(entry=>entry.featured) || [...items].sort((a,b)=>b.priority-a.priority)[0];
    const progress=calculateVisionProgress(item,state,now); const targets=evaluateTargets(state,now);
    const unlocked=(state.rewards||[]).find(reward=>reward.status==='unlocked'&&(!reward.expiresAt||parseLocalDate(reward.expiresAt)>=new Date(now)));
    const closeReward=(state.rewards||[]).find(reward=>reward.status==='locked'&&reward.unlockCondition?.type==='streak'&&amount(reward.unlockCondition.value)-amount(state.game?.streak)===1);
    const recentMission=(state.activity||[]).find(event=>event.dataOrigin==='user'&&event.title?.startsWith('Completed ')&&new Date(now)-new Date(event.occurredAt)<172800000);
    if (unlocked) return finish({rule:'reward-ready',itemId:item.id,message:`${unlocked.name} is unlocked and ready for an explicit claim. No money has been spent.`,nextAction:'Review the Reward Vault'});
    if (closeReward) return finish({rule:'reward-close',itemId:item.id,message:`One more streak day unlocks ${closeReward.name}.`,nextAction:'Complete today’s target'});
    if (targets.monthlyComplete) return finish({rule:'monthly-complete',itemId:item.id,message:`This month’s income target is complete. ${progress.available?`${item.title} is ${progress.percent}% funded.`:'Connect the next vision to decide where progress goes.'}`,nextAction:'Review the next household priority'});
    if (targets.weeklyComplete) return finish({rule:'weekly-complete',itemId:item.id,message:`This week’s income target is complete. ${progress.available?`${item.title} has $${Math.ceil(progress.remaining)} remaining.`:'The next reward can now be reviewed.'}`,nextAction:'Protect the weekly win'});
    if (targets.dailyComplete) return finish({rule:'daily-complete',itemId:item.id,message:`Today’s earning target is complete. ${progress.available ? `${item.title} is now ${progress.percent}% funded.` : `Link ${item.title} to a funding source to see the impact.`}`,nextAction:'Protect the win'});
    if (progress.available && progress.remaining===0) return finish({rule:'fully-funded',itemId:item.id,message:`${item.title} is fully funded. Review its reward before claiming it.`,nextAction:'Open Reward Vault'});
    if (progress.available && progress.percent>=90) return finish({rule:'near-complete',itemId:item.id,message:`You are only $${Math.ceil(progress.remaining)} away from completing ${item.title}.`,nextAction:'Make the final contribution'});
    if (progress.available && progress.pace==='behind') return finish({rule:'behind',itemId:item.id,message:`Two focused earning days can move ${item.title} back toward schedule.`,nextAction:`Aim for $${Math.ceil(progress.requiredDaily||targets.dailyTarget||0)} today`});
    if (recentMission) return finish({rule:'recent-win',itemId:item.id,message:`${recentMission.title} added real momentum toward ${item.title}.`,nextAction:'Build on the completed mission'});
    if ((state.game?.streak||0)>=3) return finish({rule:'streak',itemId:item.id,message:`Your ${state.game.streak}-day streak is building momentum toward ${item.title}.`,nextAction:'Complete today’s financial target'});
    if (progress.available) return finish({rule:'progress',itemId:item.id,message:`Today’s next $${Math.ceil(targets.dailyTarget||progress.requiredDaily||25)} moves ${item.title} beyond ${progress.percent}%.`,nextAction:`Contribute $${Math.ceil(progress.requiredDaily||targets.dailyTarget||25)}`});
    return finish({rule:'setup',itemId:item.id,message:`${item.title} is ready for a real progress link. No household balance has been counted toward it.`,nextAction:'Link an allocation'});
  }};
}

export function rewardShouldUnlock(reward,state,now=new Date()) {
  const targets=evaluateTargets(state,now); const condition=reward.unlockCondition || {};
  if (condition.type==='daily-target') return targets.dailyComplete;
  if (condition.type==='weekly-target') return targets.weeklyComplete;
  if (condition.type==='monthly-target') return targets.monthlyComplete;
  if (condition.type==='streak') return amount(state.game?.streak)>=amount(condition.value);
  if (condition.type==='vision-funded') { const item=state.visionItems?.find(entry=>entry.id===condition.visionItemId); return item ? calculateVisionProgress(item,state,now).percent===100 : false; }
  if (condition.type==='milestone') return Boolean(state.goalMilestones?.find(entry=>entry.id===condition.milestoneId&&entry.status==='reached'));
  return false;
}

export function transitionReward(reward,action,now=new Date()) {
  if(action==='skip'&&['locked','unlocked'].includes(reward.status)){const stamp=nowIso(now);return {...reward,status:'skipped',updatedAt:stamp,skippedAt:stamp};}
  const transitions={claim:['unlocked','claimed'],redeem:['claimed','redeemed'],skip:['locked','skipped'],unlock:['locked','unlocked']}; const [from,to]=transitions[action]||[];
  if (reward.status!==from) return reward;
  const stamp=nowIso(now); return {...reward,status:to,updatedAt:stamp,...(action==='unlock'?{unlockedAt:stamp}:{}),...(action==='claim'?{claimedAt:stamp}:{}),...(action==='redeem'?{redeemedAt:stamp}:{})};
}

export function evaluateMilestones(item,progress,milestones,now=new Date()) {
  return milestones.map(milestone => { if(milestone.visionItemId!==item.id||milestone.status==='reached')return milestone; const reached=milestone.type==='percent-funded'&&progress.available&&progress.percent>=amount(milestone.threshold); return reached?{...milestone,status:'reached',reachedAt:nowIso(now),updatedAt:nowIso(now)}:milestone; });
}
