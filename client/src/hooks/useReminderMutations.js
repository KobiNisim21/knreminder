import { useMutation, useQueryClient } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';
import { addPendingAction, loadReminders, saveReminders } from '../utils/offlineStore';
import { queueEventTarget } from '../utils/offlineQueue';

/**
 * useReminderMutations — Centralised mutations hook.
 *
 * Returns ready-to-use mutation objects for every write operation.
 * All mutations auto-invalidate the relevant React Query caches on success.
 *
 * Usage:
 *   const { completeMutation, deleteMutation, updateMutation, snoozeMutation } =
 *     useReminderMutations();
 */
export function useReminderMutations() {
  const queryClient = useQueryClient();

  // refetchQueries (not invalidateQueries) triggers an IMMEDIATE network request.
  // invalidateQueries only marks the cache stale — it won't refetch until the next
  // interval fires (60s) or the user focuses the window. This was causing the
  // "I have to background the app to see changes" bug.
  const refetchActive = () =>
    queryClient.refetchQueries({ queryKey: ['reminders'], type: 'active' });

  const refetchAll = () => {
    queryClient.refetchQueries({ queryKey: ['reminders'], type: 'active' });
    queryClient.refetchQueries({ queryKey: ['reminders', 'completed'], type: 'active' });
  };

  const executeWithQueue = async (type, payload, apiCall) => {
    if (navigator.onLine) {
      return apiCall();
    }
    
    // Offline mode - add to queue
    const actionId = crypto.randomUUID();
    const action = {
      id: actionId,
      type,
      payload,
      createdAt: Date.now(),
      status: 'pending',
      retries: 0
    };
    
    await addPendingAction(action);
    queueEventTarget.dispatchEvent(new Event('sync-update'));
    
    // Register background sync if supported
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-pending-actions');
      }
    } catch (e) {
      console.warn('Background sync not supported/failed', e);
    }
    
    // Optimistic update
    try {
      const current = queryClient.getQueryData(['reminders']) || await loadReminders();
      let next = [...current];
      
      if (type === 'create') {
        next.unshift({
          _id: actionId, // temp id
          text: payload.text || payload.personName,
          reminderAt: payload.reminderAt,
          type: payload.type || 'reminder',
          isImportant: payload.isImportant || false,
          isRecurring: payload.isRecurring || false,
          recurrence: payload.recurrence || null,
          _pendingSync: true
        });
      } else if (type === 'update') {
        next = next.map(r => r._id === payload.id ? { ...r, ...payload.data, _pendingSync: true } : r);
      } else if (type === 'snooze') {
        // Minimal optimistic snooze handling
        next = next.map(r => r._id === payload.id ? { ...r, _pendingSync: true } : r);
      } else if (type === 'complete' || type === 'delete') {
        next = next.filter(r => r._id !== payload.id);
      }
      
      queryClient.setQueryData(['reminders'], next);
      await saveReminders(next);
    } catch(e) {
      console.error('Optimistic update failed', e);
    }
    
    return { success: true, offline: true, _id: actionId };
  };

  const createMutation = useMutation({
    mutationFn: (data) => executeWithQueue('create', data, () => remindersApi.create(data)),
    onSuccess: refetchActive,
  });

  const completeMutation = useMutation({
    mutationFn: (id) => executeWithQueue('complete', { id }, () => remindersApi.complete(id)),
    onSuccess: refetchAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => executeWithQueue('delete', { id }, () => remindersApi.delete(id)),
    onSuccess: refetchActive,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => executeWithQueue('update', { id, data }, () => remindersApi.update(id, data)),
    onSuccess: refetchActive,
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, minutes, until }) => executeWithQueue('snooze', { id, arg: { minutes, until } }, () => remindersApi.snooze(id, { minutes, until })),
    onSuccess: refetchActive,
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action, minutes, until }) => {
      const call = (id) => {
        if (action === 'complete') return executeWithQueue('complete', { id }, () => remindersApi.complete(id));
        if (action === 'delete') return executeWithQueue('delete', { id }, () => remindersApi.delete(id));
        if (action === 'snooze') return executeWithQueue('snooze', { id, arg: { minutes, until } }, () => remindersApi.snooze(id, { minutes, until }));
        throw new Error(`unknown bulk action: ${action}`);
      };
      const results = await Promise.allSettled((ids ?? []).map(call));
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { ok: results.length - failed, failed };
    },
    onSuccess: refetchAll,
  });

  return {
    createMutation,
    completeMutation,
    deleteMutation,
    updateMutation,
    snoozeMutation,
    bulkMutation,
  };
}
