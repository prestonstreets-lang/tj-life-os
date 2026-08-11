import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SYSTEMS } from '../js/data.js';
import { createMasteryAsset, createMasteryMilestone, createMasteryPath, createMasteryResource, createMasterySkill, masteryPathProgress, removeMasteryPath, updateMasteryEntity } from '../js/mastery.js';
import { PLATFORM_SCHEMA_VERSION, upgradePlatformState } from '../js/platform-migration.js';
import { runAutomationChecks } from '../js/automation.js';

const now='2026-08-11T12:00:00.000Z';

test('platform migration preserves legacy learning records and adds clean customizable collections',()=>{
  const legacy={schemaVersion:3,settings:{effects:'balanced'},learning:{weeklyMinutes:45,weeklyTarget:120,milestone:'Keep learning',skills:[{id:'s1',title:'Existing',xp:20,level:1}],resources:[{id:'r1',title:'Saved note',type:'Note'}]}};
  const upgraded=upgradePlatformState(legacy);const twice=upgradePlatformState(upgraded);
  assert.equal(upgraded.schemaVersion,PLATFORM_SCHEMA_VERSION);
  assert.equal(upgraded.learning.skills[0].title,'Existing');
  assert.equal(upgraded.learning.resources[0].title,'Saved note');
  assert.deepEqual(upgraded.learning.paths,[]);assert.deepEqual(upgraded.learning.assets,[]);assert.deepEqual(upgraded.learning.milestones,[]);
  assert.deepEqual(twice,upgraded);assert.equal(legacy.schemaVersion,3);
});

test('Self Mastery entities are fully customizable and retain ownership',()=>{
  const path=createMasteryPath({id:'path-ai',title:'Practical AI',ownerId:'member-1',weeklyGoal:180,color:'#ff00aa'},now);
  const skill=createMasterySkill({id:'skill-agents',pathId:path.id,title:'Agent Design',ownerId:'member-1',level:2,targetLevel:4,xp:240},now);
  const asset=createMasteryAsset({id:'asset-map',pathId:path.id,title:'Agent Roadmap',type:'infographic',mediaId:'media-1',ownerId:'household'},now);
  const resource=createMasteryResource({id:'resource-course',pathId:path.id,title:'Course Notes',url:'https://example.com',ownerId:'member-2'},now);
  const milestone=createMasteryMilestone({id:'milestone-demo',pathId:path.id,title:'Ship a demo',status:'complete',ownerId:'member-1'},now);
  assert.equal(path.title,'Practical AI');assert.equal(skill.pathId,path.id);assert.equal(asset.mediaId,'media-1');assert.equal(resource.ownerId,'member-2');assert.equal(milestone.status,'complete');
  const edited=updateMasteryEntity([skill],skill.id,{title:'Production Agents',level:3},'2026-08-12T12:00:00Z');
  assert.equal(edited[0].title,'Production Agents');assert.equal(edited[0].createdAt,skill.createdAt);assert.notEqual(edited[0].updatedAt,skill.updatedAt);
});

test('path progress reflects real linked skills and milestones and path deletion only unassigns children',()=>{
  const path=createMasteryPath({id:'p',title:'Path'},now);const learning={paths:[path],skills:[createMasterySkill({id:'s',pathId:'p',level:3,targetLevel:5},now)],resources:[createMasteryResource({id:'r',pathId:'p'},now)],assets:[createMasteryAsset({id:'a',pathId:'p'},now)],milestones:[createMasteryMilestone({id:'m',pathId:'p',status:'complete'},now)]};
  const result=masteryPathProgress(path,learning);assert.equal(result.skills,1);assert.equal(result.completedMilestones,1);assert.equal(result.percent,80);
  const removed=removeMasteryPath(learning,'p');assert.deepEqual(removed.paths,[]);for(const key of ['skills','resources','assets','milestones'])assert.equal(removed[key][0].pathId,null);
});

test('Fitness and Self Mastery naming, upload UI, storage abstraction, and offline shell remain wired',async()=>{
  const [app,sw]=await Promise.all([readFile('js/app.js','utf8'),readFile('sw.js','utf8')]);
  assert.equal(SYSTEMS.body.label,'Fitness');assert.equal(SYSTEMS.learning.label,'Self Mastery');
  assert.match(app,/id="masteryForm"/);assert.match(app,/image\/jpeg,image\/png,image\/webp/);assert.match(app,/store\.saveMedia|persistSelectedImage/);assert.doesNotMatch(app,/localStorage/);
  for(const file of ['./js/mastery.js','./js/platform-migration.js','./js/automation.js','./js/modules.js'])assert.ok(sw.includes(file),`${file} must be cached offline`);
});

test('local automation rules generate new non-destructive signals once per day',()=>{
  const state={automationRules:[{id:'bill-window',enabled:true},{id:'perfect-day',enabled:true},{id:'mastery-next-step',enabled:true},{id:'interview-prep',enabled:true}],automationHistory:[],finance:{bills:[{title:'Phone',dueDate:'2026-08-13',status:'upcoming',ownerId:'member-1'}]},missions:[{recurring:'daily',completed:true}],learning:{paths:[{id:'p',title:'AI',status:'active',ownerId:'member-2'}],milestones:[]},career:{opportunities:[{title:'Support Lead',company:'Acme',status:'Interview',ownerId:'member-1'}]}};
  const now=new Date('2026-08-11T15:00:00Z');const signals=runAutomationChecks(state,now);assert.equal(signals.length,4);assert.equal(state.finance.bills[0].status,'upcoming');
  state.automationHistory=signals;assert.deepEqual(runAutomationChecks(state,now),[]);
});
