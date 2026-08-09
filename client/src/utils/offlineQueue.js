import { remindersApi } from '../api/reminders';
import { getPendingActions, updatePendingAction, removePendingAction } from './offlineStore';

/**
 * offlineQueue.js
 * Processes the queue of pending offline actions.
 */

const MAX_RETRIES = 3;

// Global flag to prevent concurrent sync loops
let isSyncing = false;

// Event target to notify React of sync progress
export const queueEventTarget = new EventTarget();

function emitUpdate() {
  queueEventTarget.dispatchEvent(new Event('sync-update'));
}

export async function processQueue(queryClient) {
  if (isSyncing || !navigator.onLine) return;
  
  try {
    isSyncing = true;
    emitUpdate();
    
    const actions = await getPendingActions();
    const pending = actions.filter(a => a.status !== 'failed');
    
    if (pending.length === 0) {
      isSyncing = false;
      emitUpdate();
      return;
    }

    let hasSuccess = false;

    for (const action of pending) {
      // Skip if offline became false during loop
      if (!navigator.onLine) break;

      try {
        action.status = 'syncing';
        await updatePendingAction(action);
        emitUpdate();

        switch (action.type) {
          case 'create':
            await remindersApi.create(action.payload);
            break;
          case 'update':
            await remindersApi.update(action.payload.id, action.payload.data);
            break;
          case 'complete':
            await remindersApi.complete(action.payload.id);
            break;
          case 'snooze':
            await remindersApi.snooze(action.payload.id, action.payload.arg);
            break;
          case 'delete':
            await remindersApi.delete(action.payload.id);
            break;
          default:
            console.warn('Unknown offline action type:', action.type);
        }

        // Success - remove from queue
        await removePendingAction(action.id);
        hasSuccess = true;
        
      } catch (err) {
        console.error('Offline sync failed for action:', action, err);
        
        // If it's a 4xx error (validation, not found), it won't succeed on retry
        const isClientError = err.status && err.status >= 400 && err.status < 500;
        
        action.retries = (action.retries || 0) + 1;
        
        if (isClientError || action.retries >= MAX_RETRIES) {
          action.status = 'failed';
          action.error = err.serverMessage || err.message;
        } else {
          action.status = 'pending'; // will retry next time
        }
        await updatePendingAction(action);
      }
    }

    if (hasSuccess && queryClient) {
      // Invalidate queries so the UI fetches the real data from the server
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
    }

  } finally {
    isSyncing = false;
    emitUpdate();
  }
}
