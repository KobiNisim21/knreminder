import { useMutation, useQueryClient } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';

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

  // ── Complete ────────────────────────────────────────────────────────────────
  const completeMutation = useMutation({
    mutationFn: (id) => remindersApi.complete(id),
    onSuccess: refetchAll,
  });

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => remindersApi.delete(id),
    onSuccess: refetchActive,
  });

  // ── Update (text / time / recurrence) ──────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => remindersApi.update(id, data),
    onSuccess: refetchActive,
  });

  // ── Snooze ──────────────────────────────────────────────────────────────────
  // Accepts either { id, minutes } for a relative snooze or { id, until } with an
  // absolute ISO datetime for a custom "snooze to a specific moment".
  const snoozeMutation = useMutation({
    mutationFn: ({ id, minutes, until }) => remindersApi.snooze(id, { minutes, until }),
    onSuccess: refetchActive,
  });

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  // Apply one action to many reminders at once. Each fires its own request in
  // parallel (Promise.allSettled so one failure doesn't abort the rest), then we
  // refetch a single time after the whole batch settles instead of per-item.
  // The mutationFn resolves to { ok, failed } so the caller can report partial
  // failures. `action` is 'complete' | 'delete' | 'snooze'.
  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action, minutes, until }) => {
      const call = (id) => {
        if (action === 'complete') return remindersApi.complete(id);
        if (action === 'delete') return remindersApi.delete(id);
        if (action === 'snooze') return remindersApi.snooze(id, { minutes, until });
        throw new Error(`unknown bulk action: ${action}`);
      };
      const results = await Promise.allSettled((ids ?? []).map(call));
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { ok: results.length - failed, failed };
    },
    onSuccess: refetchAll,
  });

  return {
    completeMutation,
    deleteMutation,
    updateMutation,
    snoozeMutation,
    bulkMutation,
  };
}
