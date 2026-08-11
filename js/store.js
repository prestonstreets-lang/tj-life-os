import { createDefaultState, SCHEMA_VERSION, uid } from './data.js';
import { migrateLegacyState } from './migration.js';

const V2_KEY = 'ourLifeOS:v2';
const LEGACY_KEY = 'tjLifeOS';
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
  return value && value.schemaVersion === SCHEMA_VERSION && value.household && Array.isArray(value.household.members);
}

function loadInitialState() {
  const current = safeRead(V2_KEY);
  if (validV2(current)) return current;
  const legacy = safeRead(LEGACY_KEY);
  const initial = legacy ? migrateLegacy(legacy) : createDefaultState();
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
    commit(clone(parsed));
  },
  resetV2() { commit(createDefaultState()); },
  consumeMigrationNotice() {
    const notice = migrationNotice;
    migrationNotice = null;
    return notice;
  },
  storageInfo() { return { activeKey: V2_KEY, legacyKey: LEGACY_KEY, legacyPreserved: localStorage.getItem(LEGACY_KEY) !== null }; }
};
