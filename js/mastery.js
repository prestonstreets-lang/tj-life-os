const text = value => String(value || '').trim();
const amount = value => Math.max(0, Number(value) || 0);
const stamp = now => new Date(now || Date.now()).toISOString();

export function createMasteryPath(input = {}, now) {
  const createdAt=stamp(now);
  return { id:input.id || `mastery-path-${Date.now().toString(36)}`, title:text(input.title)||'New Learning Path', description:text(input.description), category:text(input.category)||'Personal Growth', ownerId:input.ownerId||'household', status:input.status||'active', color:input.color||'#63e6ff', targetDate:input.targetDate||'', weeklyGoal:amount(input.weeklyGoal)||60, createdAt, updatedAt:createdAt };
}

export function createMasterySkill(input = {}, now) {
  const createdAt=stamp(now);
  return { id:input.id || `mastery-skill-${Date.now().toString(36)}`, pathId:input.pathId||null, title:text(input.title)||'New Skill', description:text(input.description), ownerId:input.ownerId||'household', status:input.status||'active', xp:amount(input.xp), level:Math.max(1,amount(input.level)||1), targetLevel:Math.max(1,amount(input.targetLevel)||5), order:amount(input.order), createdAt, updatedAt:createdAt };
}

export function createMasteryAsset(input = {}, now) {
  const createdAt=stamp(now);
  return { id:input.id || `mastery-asset-${Date.now().toString(36)}`, pathId:input.pathId||null, title:text(input.title)||'Learning Roadmap', type:['infographic','roadmap','reference'].includes(input.type)?input.type:'roadmap', mediaId:input.mediaId||null, altText:text(input.altText||input.title)||'Uploaded learning roadmap', notes:text(input.notes), ownerId:input.ownerId||'household', createdAt, updatedAt:createdAt };
}

export function createMasteryResource(input = {}, now) {
  const createdAt=stamp(now);
  return { id:input.id || `mastery-resource-${Date.now().toString(36)}`, pathId:input.pathId||null, title:text(input.title)||'New Resource', type:text(input.type)||'Resource', url:text(input.url), notes:text(input.notes), ownerId:input.ownerId||'household', createdAt, updatedAt:createdAt };
}

export function createMasteryMilestone(input = {}, now) {
  const createdAt=stamp(now);
  return { id:input.id || `mastery-milestone-${Date.now().toString(36)}`, pathId:input.pathId||null, title:text(input.title)||'New Milestone', targetDate:input.targetDate||'', status:input.status||'planned', ownerId:input.ownerId||'household', createdAt, updatedAt:createdAt, completedAt:null };
}

export function updateMasteryEntity(items, id, patch, now) {
  return items.map(item=>item.id===id?{...item,...patch,id:item.id,createdAt:item.createdAt,updatedAt:stamp(now)}:item);
}

export function masteryPathProgress(path, learning) {
  const skills=(learning.skills||[]).filter(item=>item.pathId===path.id);
  const milestones=(learning.milestones||[]).filter(item=>item.pathId===path.id);
  const skillCharge=skills.length?skills.reduce((sum,item)=>sum+Math.min(100,(Number(item.level)||1)/Math.max(1,Number(item.targetLevel)||5)*100),0)/skills.length:0;
  const milestoneCharge=milestones.length?milestones.filter(item=>item.status==='complete').length/milestones.length*100:null;
  const percent=Math.round(milestoneCharge==null?skillCharge:skills.length?(skillCharge+milestoneCharge)/2:milestoneCharge);
  return { percent, skills:skills.length, milestones:milestones.length, completedMilestones:milestones.filter(item=>item.status==='complete').length };
}

export function removeMasteryPath(learning, id) {
  return { ...learning, paths:(learning.paths||[]).filter(item=>item.id!==id), skills:(learning.skills||[]).map(item=>item.pathId===id?{...item,pathId:null}:item), resources:(learning.resources||[]).map(item=>item.pathId===id?{...item,pathId:null}:item), assets:(learning.assets||[]).map(item=>item.pathId===id?{...item,pathId:null}:item), milestones:(learning.milestones||[]).map(item=>item.pathId===id?{...item,pathId:null}:item) };
}
