import { useQuery } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';

/**
 * useReminders — React Query hook for active reminders list.
 *
 * Polls the server every 60s so the list stays fresh when
 * reminders are updated from Telegram (snooze/done buttons).
 */
export function useReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const response = await remindersApi.getAll();
      return response.data;
    },
    refetchInterval: 60_000, // auto-refresh every 60s
    refetchOnWindowFocus: true,
  });
}

/**
 * useCompletedReminders — React Query hook for the completed list.
 */
export function useCompletedReminders() {
  return useQuery({
    queryKey: ['reminders', 'completed'],
    queryFn: async () => {
      const response = await remindersApi.getCompleted();
      return response.data;
    },
  });
}
