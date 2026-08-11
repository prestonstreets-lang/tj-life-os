import { compareDateOnly, toLocalDateKey } from './date.js';

export const AUTOMATION_RULES=Object.freeze([
  {id:'bill-window',title:'Bill-window alert',detail:'Flag an unpaid bill due within three days.'},
  {id:'perfect-day',title:'Perfect Day detector',detail:'Celebrate when every active daily mission is complete.'},
  {id:'mastery-next-step',title:'Self Mastery next step',detail:'Flag an active path that has no milestone yet.'},
  {id:'interview-prep',title:'Interview preparation',detail:'Flag tracked jobs that reach the Interview stage.'}
]);

const dayDistance=(from,to)=>Math.round((Date.parse(`${to}T12:00:00`)-Date.parse(`${from}T12:00:00`))/86400000);

export function runAutomationChecks(state, now=new Date()) {
  const today=toLocalDateKey(now);const enabled=new Set((state.automationRules||[]).filter(rule=>rule.enabled).map(rule=>rule.id));const signals=[];
  const add=(ruleId,title,detail,system,ownerId='household')=>signals.push({ruleId,key:`${ruleId}:${today}:${title}`,title,detail,system,ownerId,occurredAt:now.toISOString()});
  if(enabled.has('bill-window'))(state.finance?.bills||[]).filter(bill=>bill.status!=='paid'&&compareDateOnly(bill.dueDate,today)>=0&&dayDistance(today,bill.dueDate)<=3).forEach(bill=>add('bill-window',`Bill window: ${bill.title}`,`Due in ${dayDistance(today,bill.dueDate)} day${dayDistance(today,bill.dueDate)===1?'':'s'}`,'money',bill.ownerId));
  const daily=(state.missions||[]).filter(mission=>mission.recurring==='daily');if(enabled.has('perfect-day')&&daily.length&&daily.every(mission=>mission.completed))add('perfect-day','Perfect Day achieved',`${daily.length} daily missions complete`,'missions');
  if(enabled.has('mastery-next-step'))(state.learning?.paths||[]).filter(path=>path.status==='active'&&!(state.learning.milestones||[]).some(item=>item.pathId===path.id)).forEach(path=>add('mastery-next-step',`Choose the next step for ${path.title}`,'This active path has no milestone yet.','learning',path.ownerId));
  if(enabled.has('interview-prep'))(state.career?.opportunities||[]).filter(job=>job.status==='Interview').forEach(job=>add('interview-prep',`Prepare for ${job.title}`,`${job.company||'Interview'} is ready for a preparation mission.`,'career',job.ownerId));
  const seen=new Set((state.automationHistory||[]).map(item=>item.key));return signals.filter(signal=>!seen.has(signal.key));
}
