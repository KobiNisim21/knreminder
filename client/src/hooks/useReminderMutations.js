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
  const snoozeMutation = useMutation({
    mutationFn: ({ id, minutes }) => remindersApi.snooze(id, minutes),
    onSuccess: refetchActive,
  });


  return {
    completeMutation,
    deleteMutation,
    updateMutation,
    snoozeMutation,
  };
}
