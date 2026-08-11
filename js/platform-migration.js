export const PLATFORM_SCHEMA_VERSION = 4;
const list=value=>Array.isArray(value)?value:[];

export function upgradePlatformState(value) {
  const state=value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):{};
  state.schemaVersion=PLATFORM_SCHEMA_VERSION;
  state.learning={weeklyMinutes:0,weeklyTarget:0,milestone:'',...state.learning};
  state.learning.paths=list(state.learning.paths);
  state.learning.skills=list(state.learning.skills).map((item,index)=>({pathId:null,status:'active',targetLevel:5,order:index,...item}));
  state.learning.resources=list(state.learning.resources).map(item=>({pathId:null,url:'',notes:'',...item}));
  state.learning.assets=list(state.learning.assets);
  state.learning.milestones=list(state.learning.milestones);
  state.automationRules=list(state.automationRules);
  state.automationHistory=list(state.automationHistory);
  state.settings={dashboardModules:[],...state.settings};
  return state;
}
