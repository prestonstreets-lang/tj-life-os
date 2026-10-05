const text=value=>String(value??'').trim();
const number=value=>Math.max(0,Number(value)||0);
const stamp=now=>new Date(now||Date.now()).toISOString();
const clone=value=>JSON.parse(JSON.stringify(value));

export const PRACTICE_CATEGORIES=Object.freeze([
  {id:'sleep-recovery',label:'Sleep & Recovery',icon:'◒',summary:'Protect sleep opportunity, consistency and recovery signals.'},
  {id:'movement-fitness',label:'Movement & Fitness',icon:'⬡',summary:'Build aerobic activity, strength, mobility and everyday movement.'},
  {id:'nutrition-hydration',label:'Nutrition & Hydration',icon:'◌',summary:'Use simple food-quality and hydration behaviors without rigid dieting.'},
  {id:'stress-mental',label:'Stress & Mental Skills',icon:'◎',summary:'Practice downshifting, attention control, reflection and coping skills.'},
  {id:'learning-cognition',label:'Learning & Cognition',icon:'⌁',summary:'Turn curiosity into deliberate practice, retrieval and useful output.'},
  {id:'relationships',label:'Relationships & Social',icon:'◇',summary:'Maintain meaningful contact, support and shared time.'},
  {id:'environment-digital',label:'Environment & Digital',icon:'▦',summary:'Shape physical and digital environments so good actions are easier.'},
  {id:'planning-review',label:'Planning & Review',icon:'✦',summary:'Choose priorities, define next actions and close feedback loops.'},
  {id:'finance-admin',label:'Finance & Admin',icon:'◈',summary:'Reduce avoidable friction with short money and life-admin routines.'},
  {id:'purpose-creativity',label:'Purpose & Creativity',icon:'◐',summary:'Make room for values, creative output, play and long-horizon direction.'}
]);

export const PRACTICE_LIBRARY=Object.freeze([
  {id:'sleep-opportunity',category:'sleep-recovery',kind:'habit',title:'Protect a 7+ hour sleep opportunity',summary:'Reserve enough time for sleep before the day fills up.',why:'Most adults need at least seven hours of sleep; individual needs vary.',example:'If my wind-down alarm fires, then I start closing the day.',evidence:'guideline',source:'CDC sleep guidance',frequency:'daily',target:7,unit:'hours',duration:5,difficulty:'starter'},
  {id:'sleep-consistency',category:'sleep-recovery',kind:'habit',title:'Keep a consistent wake time',summary:'Anchor the morning within a realistic range most days.',why:'Regular sleep timing is a standard sleep-health recommendation.',example:'Wake within the same 60-minute window, including most weekends.',evidence:'guideline',source:'CDC sleep guidance',frequency:'daily',target:1,unit:'check',duration:1,difficulty:'starter'},
  {id:'wind-down',category:'sleep-recovery',kind:'habit',title:'Short wind-down routine',summary:'Create a repeatable low-stimulation transition before bed.',why:'A consistent routine can make the sleep period easier to protect.',example:'Dim lights, prepare tomorrow, then read for 10 minutes.',evidence:'evidence-supported',source:'CDC sleep guidance',frequency:'daily',target:10,unit:'minutes',duration:10,difficulty:'starter'},
  {id:'weekly-aerobic',category:'movement-fitness',kind:'goal',title:'Build toward 150 minutes of weekly aerobic activity',summary:'Accumulate moderate-intensity movement across the week.',why:'Adults are advised to get at least 150 minutes of moderate-intensity aerobic activity weekly.',example:'Three 30-minute walks plus two 30-minute bike or brisk-walk sessions.',evidence:'guideline',source:'CDC Physical Activity Guidelines',frequency:'weekly',target:150,unit:'minutes',duration:30,difficulty:'standard'},
  {id:'strength-two',category:'movement-fitness',kind:'habit',title:'Strength train twice each week',summary:'Train major muscle groups with an appropriate resistance level.',why:'Adult activity guidelines include muscle-strengthening activity on at least two days each week.',example:'Two full-body sessions with bodyweight, bands or weights.',evidence:'guideline',source:'CDC Physical Activity Guidelines',frequency:'weekly',timesPerWeek:2,target:2,unit:'sessions',duration:35,difficulty:'standard'},
  {id:'walk-ten',category:'movement-fitness',kind:'habit',title:'10-minute movement break',summary:'Use a short walk or mobility block as the minimum viable movement dose.',why:'Some physical activity is better than none, and small blocks can accumulate.',example:'Walk after lunch or do a mobility circuit between work blocks.',evidence:'guideline',source:'CDC physical activity guidance',frequency:'daily',target:10,unit:'minutes',duration:10,difficulty:'starter'},
  {id:'mobility-reset',category:'movement-fitness',kind:'habit',title:'Mobility reset',summary:'Move joints through comfortable ranges and address stiffness.',why:'Useful as a low-friction movement practice; exact routines should match your needs.',example:'5–10 minutes for hips, shoulders, ankles and spine.',evidence:'starter',source:'Practical starter; individualize as needed',frequency:'daily',target:8,unit:'minutes',duration:8,difficulty:'starter'},
  {id:'produce-meal',category:'nutrition-hydration',kind:'habit',title:'Add produce to a main meal',summary:'Make fruit or vegetables an easy default rather than a perfect-diet rule.',why:'Dietary guidance emphasizes fruits and vegetables as part of a healthy eating pattern.',example:'Add frozen vegetables to dinner or fruit to breakfast.',evidence:'guideline',source:'USDA MyPlate',frequency:'daily',target:1,unit:'meal',duration:2,difficulty:'starter'},
  {id:'balanced-plate',category:'nutrition-hydration',kind:'focus',title:'Build a more balanced plate',summary:'Use food-group variety as a flexible meal-quality cue.',why:'MyPlate emphasizes fruits, vegetables, grains, protein foods and dairy or alternatives.',example:'At one meal, include produce, a protein source and a high-fiber carbohydrate.',evidence:'guideline',source:'USDA MyPlate',frequency:'daily',target:1,unit:'meal',duration:2,difficulty:'starter'},
  {id:'hydration-check',category:'nutrition-hydration',kind:'habit',title:'Hydration check',summary:'Use thirst, routine and personal needs to avoid drifting through the day under-hydrated.',why:'Water needs vary by body size, diet, activity, climate, pregnancy and health conditions; use a personal target rather than a universal cup count.',example:'Keep water accessible and check intake at lunch and dinner.',evidence:'guideline',source:'National Academies water DRIs',frequency:'daily',target:2,unit:'check-ins',duration:1,difficulty:'starter'},
  {id:'mindful-five',category:'stress-mental',kind:'habit',title:'5-minute mindfulness practice',summary:'Practice present-moment attention without treating it as a cure-all.',why:'Mindfulness programs may help with stress, anxiety or mood for some people, but effects vary and adverse experiences can occur.',example:'Five minutes attending to breathing or sounds; stop if it feels destabilizing.',evidence:'evidence-supported',source:'NIH NCCIH',frequency:'daily',target:5,unit:'minutes',duration:5,difficulty:'starter'},
  {id:'downshift-breath',category:'stress-mental',kind:'habit',title:'Two-minute downshift',summary:'Use a brief relaxation cue before a stressful transition.',why:'Relaxation techniques may help with stress symptoms for some people.',example:'Slow breathing, unclench jaw and shoulders, then name the next action.',evidence:'evidence-supported',source:'NIH NCCIH',frequency:'daily',target:2,unit:'minutes',duration:2,difficulty:'starter'},
  {id:'journal-check',category:'stress-mental',kind:'task',title:'Brief stress check-in',summary:'Name the pressure, what is controllable and the next useful response.',why:'Short reflection can make coping actions explicit without requiring a long journal session.',example:'What is pulling on me? What can I influence? What is the next 10-minute action?',evidence:'starter',source:'Practical reflection prompt',frequency:'daily',target:3,unit:'prompts',duration:5,difficulty:'starter'},
  {id:'learn-focus',category:'learning-cognition',kind:'habit',title:'Focused learning block',summary:'Study one defined skill without switching tasks.',why:'Deliberate, distraction-reduced practice makes progress easier to observe and review.',example:'25 minutes on one course lesson, chapter or coding exercise.',evidence:'evidence-supported',source:'Learning-science informed starter',frequency:'weekdays',target:25,unit:'minutes',duration:25,difficulty:'starter'},
  {id:'retrieval',category:'learning-cognition',kind:'habit',title:'Retrieve before rereading',summary:'Try to recall key ideas before looking back at notes.',why:'Retrieval practice is a well-supported learning strategy.',example:'Write three things you remember, then check the source and correct gaps.',evidence:'evidence-supported',source:'Learning-science consensus',frequency:'weekly',timesPerWeek:3,target:3,unit:'sessions',duration:10,difficulty:'standard'},
  {id:'ship-output',category:'learning-cognition',kind:'goal',title:'Ship one learning output each week',summary:'Convert study into an artifact you can inspect.',why:'A concrete output creates feedback and exposes gaps in understanding.',example:'Publish a note, solve a problem set, record a demo or teach the concept.',evidence:'starter',source:'Practical deliberate-practice pattern',frequency:'weekly',target:1,unit:'output',duration:45,difficulty:'standard'},
  {id:'meaningful-contact',category:'relationships',kind:'habit',title:'Meaningful connection',summary:'Create a small, intentional point of contact with someone who matters.',why:'High-quality social connection is associated with better health and well-being; there is no single evidence-based daily minute target.',example:'Call, message, share a meal, take a walk or ask a real follow-up question.',evidence:'evidence-supported',source:'CDC / WHO social connection guidance',frequency:'daily',target:1,unit:'connection',duration:10,difficulty:'starter'},
  {id:'relationship-time',category:'relationships',kind:'goal',title:'Protected relationship time',summary:'Reserve recurring time for a partner, family member, friend or community.',why:'Regular supportive relationships contribute to social connection and resilience.',example:'One device-light meal, walk, game night or community activity each week.',evidence:'evidence-supported',source:'CDC / WHO social connection guidance',frequency:'weekly',target:1,unit:'session',duration:60,difficulty:'standard'},
  {id:'desk-reset',category:'environment-digital',kind:'habit',title:'5-minute environment reset',summary:'Reset one physical zone so tomorrow starts with less friction.',why:'Environment design is a practical way to make desired actions easier to start.',example:'Clear desk, refill water, lay out training gear and plug in devices.',evidence:'starter',source:'Behavior-design starter',frequency:'daily',target:5,unit:'minutes',duration:5,difficulty:'starter'},
  {id:'digital-shutdown',category:'environment-digital',kind:'habit',title:'Digital shutdown cue',summary:'Create a clear end to reactive screen time or work.',why:'A boundary can protect attention and make sleep or relationship routines easier to execute.',example:'Close work tabs, capture loose tasks and put the phone on its charger.',evidence:'starter',source:'Practical environment design',frequency:'daily',target:1,unit:'shutdown',duration:5,difficulty:'starter'},
  {id:'top-three',category:'planning-review',kind:'task',title:'Choose today’s top three',summary:'Define a small set of outcomes before reactive work takes over.',why:'Explicit priorities reduce ambiguity and make review possible.',example:'One must-do, one progress task and one maintenance task.',evidence:'starter',source:'Practical planning pattern',frequency:'daily',target:3,unit:'priorities',duration:5,difficulty:'starter'},
  {id:'if-then-plan',category:'planning-review',kind:'habit',title:'Write one if–then plan',summary:'Link a likely cue to a specific response.',why:'Implementation intentions can improve goal attainment across many behavior-change contexts, though effects vary.',example:'If I finish lunch, then I will walk for 10 minutes.',evidence:'evidence-supported',source:'Implementation-intention research',frequency:'weekly',target:1,unit:'plan',duration:3,difficulty:'starter'},
  {id:'weekly-review',category:'planning-review',kind:'task',title:'Weekly review and reset',summary:'Review wins, misses, stale commitments and next-week priorities.',why:'A recurring review keeps the system adaptive instead of accumulating outdated obligations.',example:'Keep, change, pause or replace each active routine; choose one weekly focus.',evidence:'starter',source:'Practical feedback-loop design',frequency:'weekly',target:1,unit:'review',duration:20,difficulty:'standard'},
  {id:'money-check',category:'finance-admin',kind:'habit',title:'Two-minute money check',summary:'Look at available cash and the next obligation without turning it into a full budget session.',why:'Frequent lightweight awareness can surface problems before they become urgent.',example:'Check available funds, next bill and any unusual transaction.',evidence:'starter',source:'Practical financial-admin routine',frequency:'weekdays',target:1,unit:'check',duration:2,difficulty:'starter'},
  {id:'admin-sprint',category:'finance-admin',kind:'task',title:'Weekly admin sprint',summary:'Batch small life-admin tasks into one bounded session.',why:'Batching reduces the number of open loops competing for attention.',example:'Bills, forms, scheduling, inbox paperwork and household coordination.',evidence:'starter',source:'Practical batching pattern',frequency:'weekly',target:30,unit:'minutes',duration:30,difficulty:'standard'},
  {id:'creative-output',category:'purpose-creativity',kind:'habit',title:'Creative output block',summary:'Make something before optimizing or consuming more input.',why:'A recurring output practice protects creativity from being crowded out by maintenance work.',example:'Write, sketch, compose, edit, build or prototype for 20 minutes.',evidence:'starter',source:'Practical creative-practice pattern',frequency:'weekly',timesPerWeek:3,target:20,unit:'minutes',duration:20,difficulty:'starter'},
  {id:'values-review',category:'purpose-creativity',kind:'focus',title:'Values alignment check',summary:'Compare current commitments with what you want this season to stand for.',why:'A short values check can help decide what to continue, pause or replace.',example:'What matters now? What am I doing that no longer fits? What deserves more room?',evidence:'starter',source:'Reflective planning prompt',frequency:'weekly',target:3,unit:'prompts',duration:10,difficulty:'starter'}
]);

export function categoryById(id){return PRACTICE_CATEGORIES.find(item=>item.id===id)||PRACTICE_CATEGORIES[0];}
export function templateById(id){return PRACTICE_LIBRARY.find(item=>item.id===id)||null;}

export function createPractice(input={},now){
  const createdAt=stamp(now);
  const frequency=['daily','weekdays','weekly','custom'].includes(input.frequency)?input.frequency:'daily';
  const days=Array.isArray(input.days)?input.days.map(Number).filter(day=>day>=0&&day<=6):[];
  return {
    id:input.id||`practice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
    templateId:input.templateId||null,
    kind:['habit','task','goal','focus'].includes(input.kind)?input.kind:'habit',
    title:text(input.title)||'Custom practice',
    category:PRACTICE_CATEGORIES.some(item=>item.id===input.category)?input.category:'planning-review',
    description:text(input.description||input.summary),
    why:text(input.why),
    example:text(input.example),
    evidence:['guideline','evidence-supported','starter','experimental'].includes(input.evidence)?input.evidence:'starter',
    source:text(input.source),
    schedule:{frequency,days,timesPerWeek:Math.max(1,number(input.timesPerWeek)||1),reminderTime:text(input.reminderTime),cue:text(input.cue)},
    target:{value:number(input.target?.value??input.target)||1,unit:text(input.target?.unit??input.unit)||'check'},
    duration:number(input.duration)||5,
    difficulty:['starter','standard','stretch'].includes(input.difficulty)?input.difficulty:'starter',
    priority:Math.min(5,Math.max(1,Number(input.priority)||3)),
    order:number(input.order),
    status:['active','paused','archived','removed'].includes(input.status)?input.status:'active',
    createdAt,updatedAt:createdAt,archivedAt:null,removedAt:null,replacesId:input.replacesId||null,replacedById:null,version:1
  };
}

export function createPracticeFromTemplate(templateId,overrides={},now){
  const template=templateById(templateId);
  if(!template)throw new Error('Practice template not found.');
  return createPractice({...template,...overrides,templateId,target:{value:overrides.target?.value??template.target,unit:overrides.target?.unit??template.unit}},now);
}

export function updatePractice(items,id,patch={},now){
  return items.map(item=>{
    if(item.id!==id)return item;
    const next=clone(item);
    if(patch.title!=null)next.title=text(patch.title)||next.title;
    if(patch.kind!=null&&['habit','task','goal','focus'].includes(patch.kind))next.kind=patch.kind;
    if(patch.category!=null&&PRACTICE_CATEGORIES.some(entry=>entry.id===patch.category))next.category=patch.category;
    for(const key of ['description','why','example','source'])if(patch[key]!=null)next[key]=text(patch[key]);
    if(patch.evidence!=null&&['guideline','evidence-supported','starter','experimental'].includes(patch.evidence))next.evidence=patch.evidence;
    if(patch.schedule)next.schedule={...next.schedule,...patch.schedule,days:Array.isArray(patch.schedule.days)?patch.schedule.days.map(Number):next.schedule.days};
    if(patch.target)next.target={...next.target,value:number(patch.target.value),unit:text(patch.target.unit)||next.target.unit};
    if(patch.duration!=null)next.duration=number(patch.duration);
    if(patch.difficulty!=null&&['starter','standard','stretch'].includes(patch.difficulty))next.difficulty=patch.difficulty;
    if(patch.priority!=null)next.priority=Math.min(5,Math.max(1,Number(patch.priority)||3));
    if(patch.order!=null)next.order=number(patch.order);
    if(patch.status!=null&&['active','paused','archived','removed'].includes(patch.status))next.status=patch.status;
    next.updatedAt=stamp(now);next.version=(Number(next.version)||1)+1;
    return next;
  });
}

export function setPracticeStatus(items,id,status,now){
  if(!['active','paused','archived','removed'].includes(status))return items;
  return updatePractice(items,id,{status},now).map(item=>item.id===id?{...item,archivedAt:status==='archived'?stamp(now):item.archivedAt,removedAt:status==='removed'?stamp(now):item.removedAt}:item);
}

export function replacePractice(practiceState,id,replacement={},now){
  const source=practiceState.items.find(item=>item.id===id);
  if(!source)throw new Error('Practice to replace was not found.');
  const next=clone(practiceState);const replacementItem=createPractice({...source,...replacement,id:replacement.id,templateId:replacement.templateId??null,replacesId:source.id,status:'active',createdAt:undefined},now);
  next.items=next.items.map(item=>item.id===id?{...item,status:'archived',archivedAt:stamp(now),replacedById:replacementItem.id,updatedAt:stamp(now)}:item);
  next.items.push(replacementItem);
  next.weekPlans=(next.weekPlans||[]).map(plan=>({...plan,itemIds:(plan.itemIds||[]).map(itemId=>itemId===id?replacementItem.id:itemId),updatedAt:stamp(now)}));
  return next;
}

export function recordPractice(practiceState,id,input={},now){
  const item=practiceState.items.find(entry=>entry.id===id);
  if(!item)throw new Error('Practice not found.');
  const next=clone(practiceState);const occurredAt=stamp(now);const date=text(input.date)||occurredAt.slice(0,10);
  next.history.unshift({
    id:`practice-log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
    practiceId:id,date,occurredAt,value:number(input.value)||item.target.value||1,note:text(input.note),
    snapshot:{title:item.title,kind:item.kind,category:item.category,target:clone(item.target),difficulty:item.difficulty,version:item.version}
  });
  return next;
}

export function startOfWeekKey(value=new Date(),weekStartsOn=0){
  const date=value instanceof Date?new Date(value):new Date(value);
  const diff=(date.getDay()-Number(weekStartsOn)+7)%7;date.setDate(date.getDate()-diff);
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

export function upsertWeekPlan(practiceState,input={},now){
  const next=clone(practiceState);const weekStart=text(input.weekStart)||startOfWeekKey(new Date(now||Date.now()),input.weekStartsOn||0);
  const existing=next.weekPlans.find(plan=>plan.weekStart===weekStart);const updatedAt=stamp(now);
  const plan={id:existing?.id||`week-${weekStart}`,weekStart,itemIds:[...new Set((input.itemIds||[]).filter(id=>next.items.some(item=>item.id===id&&item.status==='active')))],focus:text(input.focus),categoryFocus:text(input.categoryFocus),createdAt:existing?.createdAt||updatedAt,updatedAt};
  next.weekPlans=next.weekPlans.filter(entry=>entry.weekStart!==weekStart);next.weekPlans.unshift(plan);next.currentWeekStart=weekStart;return next;
}

export function practiceDueOn(item,date=new Date()){
  if(item.status!=='active')return false;
  const day=(date instanceof Date?date:new Date(date)).getDay();const frequency=item.schedule?.frequency||'daily';
  if(frequency==='daily')return true;
  if(frequency==='weekdays')return day>=1&&day<=5;
  if(frequency==='weekly')return true;
  if(frequency==='custom')return (item.schedule?.days||[]).includes(day);
  return true;
}

export function completionForDate(practiceState,id,dateKey){
  const item=practiceState.items.find(entry=>entry.id===id);if(!item)return {value:0,target:1,percent:0,complete:false};
  const value=(practiceState.history||[]).filter(entry=>entry.practiceId===id&&entry.date===dateKey).reduce((sum,entry)=>sum+(Number(entry.value)||0),0);
  const target=Math.max(1,Number(item.target?.value)||1);return {value,target,percent:Math.min(100,Math.round(value/target*100)),complete:value>=target};
}

export function normalizePracticeState(value={}){
  return {
    libraryVersion:1,
    items:Array.isArray(value.items)?value.items:[],
    history:Array.isArray(value.history)?value.history:[],
    weekPlans:Array.isArray(value.weekPlans)?value.weekPlans:[],
    currentWeekStart:text(value.currentWeekStart)
  };
}
