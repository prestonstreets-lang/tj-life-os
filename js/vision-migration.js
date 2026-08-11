export const VISION_SCHEMA_VERSION = 3;

const list = value => Array.isArray(value) ? value : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function upgradeVisionState(value) {
  const state = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {};
  state.schemaVersion = Math.max(Number(state.schemaVersion)||0,VISION_SCHEMA_VERSION);
  state.visionBoards = list(state.visionBoards);
  state.visionItems = list(state.visionItems);
  state.visionMedia = list(state.visionMedia);
  state.goalLinks = list(state.goalLinks);
  state.goalMilestones = list(state.goalMilestones);
  state.rewards = list(state.rewards);
  state.rewardUnlocks = list(state.rewardUnlocks);
  state.motivationHistory = list(state.motivationHistory);
  const settings=object(state.motivationSettings);
  state.motivationSettings = { enabled:true,frequency:'daily',intensity:'balanced',autoRotate:true,effects:true,rotationOffset:0,...settings,featuredItemIds:list(settings.featuredItemIds),customStatements:list(settings.customStatements),dismissedRules:list(settings.dismissedRules) };
  return state;
}
