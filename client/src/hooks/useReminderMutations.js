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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['reminders'] });
    queryClient.invalidateQueries({ queryKey: ['reminders', 'completed'] });
  };

  const invalidateActive = () =>
    queryClient.invalidateQueries({ queryKey: ['reminders'] });

  // ── Complete ────────────────────────────────────────────────────────────────
  const completeMutation = useMutation({
    mutationFn: (id) => remindersApi.complete(id),
    onSuccess: invalidateAll,
  });

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => remindersApi.delete(id),
    onSuccess: invalidateActive,
  });

  // ── Update (text / time / recurrence) ──────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => remindersApi.update(id, data),
    onSuccess: invalidateActive,
  });

  // ── Snooze ──────────────────────────────────────────────────────────────────
  const snoozeMutation = useMutation({
    mutationFn: ({ id, minutes }) => remindersApi.snooze(id, minutes),
    onSuccess: invalidateActive,
  });

  return {
    completeMutation,
    deleteMutation,
    updateMutation,
    snoozeMutation,
  };
}
