import { createDefaultState, SCHEMA_VERSION, uid } from './data.js';
import { migrateLegacyState } from './migration.js';
import { upgradeVisionState } from './vision-migration.js';
import { exportMediaRecords, importMediaRecords, mediaStore, resizeVisionImage } from './media-store.js';

const V2_KEY = 'ourLifeOS:v2';
const LEGACY_KEY = 'tjLifeOS';
const RECOVERY_KEY = 'ourLifeOS:v2:recovery';
const listeners = new Set();
let migrationNotice = null;

const clone = value => JSON.parse(JSON.stringify(value));

function safeRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn(`Unable to read ${key}`, error);
    return null;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to write ${key}`, error);
    return false;
  }
}

function migrateLegacy(legacy) {
  const next = migrateLegacyState(legacy);
  migrationNotice = 'V1 data was safely copied into V2. Your original V1 state remains untouched.';
  return next;
}

function validV2(value) {
  return value && [2,SCHEMA_VERSION].includes(value.schemaVersion) && value.household && Array.isArray(value.household.members);
}

function loadInitialState() {
  const current = safeRead(V2_KEY);
  if (validV2(current)) {
    const upgraded=upgradeVisionState(current);
    safeWrite(V2_KEY,upgraded);
    return upgraded;
  }
  if (localStorage.getItem(V2_KEY) !== null) {
    try { localStorage.setItem(RECOVERY_KEY, JSON.stringify({capturedAt:new Date().toISOString(),raw:localStorage.getItem(V2_KEY)})); migrationNotice='A malformed V2 state was preserved in recovery storage before a clean state was loaded.'; }
    catch (error) { console.warn('Unable to preserve malformed V2 recovery data',error); }
  }
  const legacy = safeRead(LEGACY_KEY);
  const initial = upgradeVisionState(legacy ? migrateLegacy(legacy) : createDefaultState());
  safeWrite(V2_KEY, initial);
  return initial;
}

let state = loadInitialState();

function notify() {
  const snapshot = clone(state);
  listeners.forEach(listener => listener(snapshot));
}

function commit(next) {
  next.schemaVersion = SCHEMA_VERSION;
  next.meta = { ...next.meta, updatedAt: new Date().toISOString() };
  state = next;
  safeWrite(V2_KEY, state);
  notify();
}

export const store = {
  getState() { return clone(state); },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  update(mutator) {
    const next = clone(state);
    mutator(next);
    commit(next);
  },
  addActivity({ title, detail = '', system = 'missions', ownerId = 'household' }) {
    this.update(next => {
      next.activity.unshift({ id: uid('activity'), title, detail, system, ownerId, occurredAt: new Date().toISOString() });
      next.activity = next.activity.slice(0, 80);
    });
  },
  exportData() { return JSON.stringify(state, null, 2); },
  importData(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    if (!validV2(parsed)) throw new Error('This file is not a valid Our Life OS V2 export.');
    commit(upgradeVisionState(clone(parsed)));
  },
  async saveVisionMedia({ id, file, altText='' }) {
    const blob=await resizeVisionImage(file);
    const record={id,blob,altText,createdAt:new Date().toISOString()};
    try { await mediaStore.put(record); }
    catch(error){ if(error?.name==='QuotaExceededError')throw new Error('The local photo vault is full. Export a backup and remove unused images before trying again.'); throw error; }
    return {id,type:blob.type,size:blob.size,altText,createdAt:record.createdAt};
  },
  async getVisionMedia(id) { return mediaStore.get(id); },
  async deleteVisionMedia(id) { return mediaStore.delete(id); },
  async clearVisionMedia() { return mediaStore.clear(); },
  async mediaUsage() { return mediaStore.usage(); },
  async exportBundle({includeMedia=true}={}) { return JSON.stringify({format:'our-life-os-v3-bundle',metadata:state,media:includeMedia?await exportMediaRecords():[],mediaIncluded:includeMedia},null,2); },
  async importBundle(json) { const bundle=typeof json==='string'?JSON.parse(json):json; if(bundle?.format!=='our-life-os-v3-bundle'||!validV2(bundle.metadata))throw new Error('This is not a valid Our Life OS Vision bundle.'); commit(upgradeVisionState(clone(bundle.metadata))); if(bundle.mediaIncluded)await importMediaRecords(bundle.media); return {mediaIncluded:Boolean(bundle.mediaIncluded)}; },
  resetV2() { commit(upgradeVisionState(createDefaultState())); },
  consumeMigrationNotice() {
    const notice = migrationNotice;
    migrationNotice = null;
    return notice;
  },
  storageInfo() { return { activeKey: V2_KEY, legacyKey: LEGACY_KEY, legacyPreserved: localStorage.getItem(LEGACY_KEY) !== null, recoveryAvailable:localStorage.getItem(RECOVERY_KEY)!==null }; }
};
