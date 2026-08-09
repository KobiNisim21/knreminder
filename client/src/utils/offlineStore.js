/**
 * offlineStore.js
 * Native IndexedDB wrapper for KN Reminder offline capabilities.
 */

const DB_NAME = 'kn-reminder-offline';
const DB_VERSION = 1;

const STORES = {
  REMINDERS: 'reminders',
  COMPLETED: 'completed',
  BIRTHDAYS: 'birthdays',
  META: 'meta',
  PENDING_ACTIONS: 'pendingActions'
};

let dbPromise = null;

function initDB() {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store lists: We just store the whole array under a single key for simplicity
      if (!db.objectStoreNames.contains(STORES.REMINDERS)) {
        db.createObjectStore(STORES.REMINDERS);
      }
      if (!db.objectStoreNames.contains(STORES.COMPLETED)) {
        db.createObjectStore(STORES.COMPLETED);
      }
      if (!db.objectStoreNames.contains(STORES.BIRTHDAYS)) {
        db.createObjectStore(STORES.BIRTHDAYS);
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META);
      }
      
      // Pending actions need to be queryable by ID
      if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
        db.createObjectStore(STORES.PENDING_ACTIONS, { keyPath: 'id' });
      }
    };
  });
  
  return dbPromise;
}

// Generic get/set for single-key stores (arrays)
async function getList(storeName) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get('data');
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`[OfflineStore] getList ${storeName} error:`, e);
    return [];
  }
}

async function setList(storeName, data) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data, 'data');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`[OfflineStore] setList ${storeName} error:`, e);
  }
}

// Reminders
export const loadReminders = () => getList(STORES.REMINDERS);
export const saveReminders = (data) => setList(STORES.REMINDERS, data);

// Completed
export const loadCompleted = () => getList(STORES.COMPLETED);
export const saveCompleted = (data) => setList(STORES.COMPLETED, data);

// Birthdays
export const loadBirthdays = () => getList(STORES.BIRTHDAYS);
export const saveBirthdays = (data) => setList(STORES.BIRTHDAYS, data);

// Meta
export async function getLastSyncTime() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.META, 'readonly');
      const store = tx.objectStore(STORES.META);
      const request = store.get('lastSync');
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return 0;
  }
}

export async function setLastSyncTime(timestamp = Date.now()) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.META, 'readwrite');
      const store = tx.objectStore(STORES.META);
      const request = store.put(timestamp, 'lastSync');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    // ignore
  }
}

// Pending Actions (Queue)
export async function addPendingAction(action) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PENDING_ACTIONS, 'readwrite');
      const store = tx.objectStore(STORES.PENDING_ACTIONS);
      const request = store.put(action);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[OfflineStore] addPendingAction error:', e);
  }
}

export async function getPendingActions() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PENDING_ACTIONS, 'readonly');
      const store = tx.objectStore(STORES.PENDING_ACTIONS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return [];
  }
}

export async function removePendingAction(id) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PENDING_ACTIONS, 'readwrite');
      const store = tx.objectStore(STORES.PENDING_ACTIONS);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    // ignore
  }
}

export async function updatePendingAction(action) {
  return addPendingAction(action); // put acts as upsert
}

export async function clearFailedActions() {
  try {
    const actions = await getPendingActions();
    const failed = actions.filter(a => a.status === 'failed');
    for (const a of failed) {
      await removePendingAction(a.id);
    }
  } catch (e) {
    // ignore
  }
}
