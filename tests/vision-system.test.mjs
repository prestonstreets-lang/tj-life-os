import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMemoryMediaStore, exportMediaRecords, importMediaRecords } from '../js/media-store.js';
import { upgradeVisionState } from '../js/vision-migration.js';
import { autoSelectCollage, calculateVisionProgress, createMotivationEngine, createVisionBoard, createVisionItem, duplicateVisionItem, evaluateMilestones, evaluateTargets, removeVisionItem, reorderVisionItems, rewardShouldUnlock, transitionReward, updateVisionItem } from '../js/vision.js';

const now='2026-08-11T14:00:00.000Z';
const state=()=>({
  schemaVersion:2,household:{members:[{id:'member-1',name:'Alex'},{id:'member-2',name:'Sam'}]},settings:{effects:'balanced'},
  finance:{available:9999,dailyTarget:50,monthGoal:1000,monthIncome:300,income:[],allocations:[{id:'travel',label:'Trip fund',amount:300,target:1000}],bills:[],boss:{id:'boss',title:'Income Battle',current:400,target:2000}},
  game:{streak:3},missions:[],activity:[]
});

test('V2 schema migration initializes only empty Vision collections and is idempotent',()=>{
  const original=state(); const once=upgradeVisionState(original); const twice=upgradeVisionState(once);
  assert.equal(once.schemaVersion,3);
  for(const key of ['visionBoards','visionItems','visionMedia','goalLinks','goalMilestones','rewards','rewardUnlocks','motivationHistory'])assert.deepEqual(once[key],[]);
  assert.equal(once.finance.available,9999); assert.deepEqual(twice,once); assert.equal(original.schemaVersion,2);
  const malformed=upgradeVisionState({...original,motivationSettings:{featuredItemIds:'bad'},visionBoards:{fake:true}});
  assert.deepEqual(malformed.visionBoards,[]);assert.deepEqual(malformed.motivationSettings.featuredItemIds,[]);
});

test('boards and items create, edit, duplicate, reorder, and remove without losing metadata',()=>{
  const board=createVisionBoard({id:'b1',title:'Shared Future',ownerId:'household'},now);
  const a=createVisionItem({id:'a',boardId:board.id,title:'A',ownerId:'member-1',mediaId:'m1',order:0},now);
  const b=createVisionItem({id:'b',boardId:board.id,title:'B',ownerId:'member-2',order:1},now);
  const edited=updateVisionItem([a,b],'a',{title:'A+',focalX:72},'2026-08-12T00:00:00Z');
  assert.equal(edited[0].title,'A+');assert.equal(edited[0].mediaId,'m1');assert.equal(edited[0].ownerId,'member-1');
  const moved=reorderVisionItems(edited,'b',-1,now);assert.deepEqual(moved.map(item=>item.id),['b','a']);
  const copied=duplicateVisionItem(moved,'a','a-copy',now);assert.equal(copied.at(-1).mediaId,'m1');assert.equal(copied.at(-1).featured,false);
  assert.equal(removeVisionItem(copied,'b').some(item=>item.id==='b'),false);
});

test('media adapter supports add, replace, removal and image-inclusive export/import',async()=>{
  const media=createMemoryMediaStore();
  await media.put({id:'m1',blob:new Blob(['first'],{type:'image/webp'}),altText:'First'});
  await media.put({id:'m1',blob:new Blob(['replacement'],{type:'image/webp'}),altText:'Replacement'});
  assert.equal((await media.get('m1')).altText,'Replacement');assert.equal((await media.usage()).count,1);
  const bundle=await exportMediaRecords(media);const restored=createMemoryMediaStore();await importMediaRecords(bundle,restored);
  assert.equal((await restored.get('m1')).blob.size,11);
  await restored.delete('m1');assert.equal((await restored.usage()).count,0);
});

test('automatic collage selection and template changes never alter board content',()=>{
  const items=Array.from({length:8},(_,index)=>createVisionItem({id:`v${index}`,title:`Goal ${index}`,priority:index===0?5:3},now));
  assert.equal(autoSelectCollage(items,375),'progress-roadmap');assert.equal(autoSelectCollage(items,390),'polaroid-wall');assert.equal(autoSelectCollage(items,430),'polaroid-wall');
  assert.equal(autoSelectCollage(items.slice(0,3),430),'luxury-editorial');
  const before=JSON.stringify(items);const board={...createVisionBoard({id:'b'},now),template:'goal-orbit'};board.template='reward-vault';assert.equal(JSON.stringify(items),before);
});

test('financial progress uses only an explicit link and never available household money',()=>{
  const base=upgradeVisionState(state());const item=createVisionItem({id:'v',boardId:'b',title:'Vacation',targetCost:1000,targetDate:'2026-09-30',goalLinkId:'g'},now);
  base.visionItems=[item];base.goalLinks=[{id:'g',visionItemId:'v',type:'allocation',sourceId:'travel',contributionPerWeek:100}];
  const progress=calculateVisionProgress(item,base,new Date('2026-08-11T12:00:00'));
  assert.equal(progress.saved,300);assert.equal(progress.remaining,700);assert.equal(progress.percent,30);assert.notEqual(progress.saved,base.finance.available);assert.ok(progress.requiredDaily>0);assert.ok(progress.projectedDate);
  const unlinked=calculateVisionProgress({...item,goalLinkId:null},{...base,goalLinks:[]});assert.equal(unlinked.available,false);assert.equal(unlinked.saved,null);
});

test('daily, weekly, and monthly targets evaluate recorded income only',()=>{
  const base=state();base.finance.income=[{date:'2026-08-11',amount:60},{date:'2026-08-10',amount:300},{date:'2026-08-01',amount:700}];
  const result=evaluateTargets(base,new Date('2026-08-11T16:00:00'));
  assert.deepEqual([result.dailyActual,result.weeklyActual,result.monthlyActual],[60,360,1060]);assert.equal(result.dailyComplete,true);assert.equal(result.weeklyComplete,true);assert.equal(result.monthlyComplete,true);
});

test('milestones and rewards advance explicitly without changing financial balances',()=>{
  const base=upgradeVisionState(state());const item=createVisionItem({id:'v',goalLinkId:'g',targetCost:100},now);base.visionItems=[item];base.goalLinks=[{id:'g',visionItemId:'v',type:'manual',sourceId:'manual',currentAmount:75,targetAmount:100}];
  const milestones=[{id:'m',visionItemId:'v',type:'percent-funded',threshold:75,status:'pending'}];
  assert.equal(evaluateMilestones(item,calculateVisionProgress(item,base),milestones,now)[0].status,'reached');
  base.finance.income=[{date:'2026-08-11',amount:50}];const reward={id:'r',status:'locked',unlockCondition:{type:'daily-target'}};const balance=base.finance.available;
  assert.equal(rewardShouldUnlock(reward,base,new Date('2026-08-11T12:00:00')),true);
  const unlocked=transitionReward(reward,'unlock',now);const claimed=transitionReward(unlocked,'claim',now);const redeemed=transitionReward(claimed,'redeem',now);assert.equal(redeemed.status,'redeemed');assert.equal(base.finance.available,balance);
  assert.equal(transitionReward({...reward,status:'locked'},'skip',now).status,'skipped');
});

test('motivation engine is data-aware and provides honest onboarding',()=>{
  const engine=createMotivationEngine();const base=upgradeVisionState(state());
  assert.equal(engine.generate(base).rule,'onboarding');
  const item=createVisionItem({id:'v',title:'Streaming setup',goalLinkId:'g',featured:true,targetCost:500},now);base.visionItems=[item];base.goalLinks=[{id:'g',visionItemId:'v',type:'manual',sourceId:'manual',currentAmount:450,targetAmount:500}];
  const result=engine.generate(base,new Date('2026-08-11T12:00:00'));assert.equal(result.rule,'near-complete');assert.match(result.message,/\$50/);
  base.motivationSettings.intensity='intense';assert.match(engine.generate(base,new Date('2026-08-11T12:00:00')).nextAction,/Priority action/);
  base.motivationSettings.enabled=false;assert.equal(engine.generate(base).rule,'disabled');
});

test('Vision UI keeps ownership, Quick Add, effect modes, offline media modules, and responsive guards',async()=>{
  const [app,css,sw]=await Promise.all([readFile('js/app.js','utf8'),readFile('styles.css','utf8'),readFile('sw.js','utf8')]);
  for(const type of ['vision','vision-board','financial-goal','reward','milestone','motivation'])assert.match(app,new RegExp(`'${type}'`));
  assert.match(app,/memberOptions/);assert.match(css,/data-effects='full'/);assert.match(css,/data-effects='balanced'/);assert.match(css,/data-effects='reduced'/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/overflow:clip/);
  for(const file of ['./js/vision.js','./js/vision-migration.js','./js/media-store.js'])assert.ok(sw.includes(file),`${file} must be cached offline`);
  assert.match(app,/history\.back\(\)/);assert.match(sw,/SKIP_WAITING/);assert.doesNotMatch(sw,/cache\.addAll\(APP_SHELL\)\)\s*\.then\(\(\) => self\.skipWaiting/);
  assert.match(await readFile('js/media-store.js','utf8'),/indexedDB\.open\(DB_NAME,DB_VERSION\)/);
});
