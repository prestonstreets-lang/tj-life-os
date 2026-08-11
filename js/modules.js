export const MODULE_REGISTRY = Object.freeze([
  { id:'vision', version:'2.2', capability:'Offline image vault and goal links', adapter:'media' },
  { id:'calendar', version:'2.1', capability:'Month, week, and day timeline', adapter:'calendar' },
  { id:'career', version:'2.1', capability:'Job pipeline and resume prompts', adapter:'jobs' },
  { id:'streaming', version:'2.0', capability:'Creator pipeline and skill tree', adapter:'creator' },
  { id:'body', version:'2.3', capability:'Fitness, nutrition, hydration, and training', adapter:'fitness' },
  { id:'learning', version:'2.3', capability:'Custom paths, roadmaps, skills, and milestones', adapter:'mastery' },
  { id:'analytics', version:'2.0', capability:'Activity history and household signals', adapter:'analytics' }
]);

export const moduleById=id=>MODULE_REGISTRY.find(module=>module.id===id)||null;
