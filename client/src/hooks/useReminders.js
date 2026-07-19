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
      // The axios interceptor already returns response.data (the full body).
      // The server responds: { success: true, count: N, data: [...] }
      // So we extract .data here to get the reminders array.
      const body = await remindersApi.getAll();
      // body is the full parsed JSON: { success, count, data: [...] }
      // If the interceptor already unwrapped to body.data, handle both cases safely:
      return Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // Return empty array while loading to avoid undefined spread errors
    placeholderData: [],
  });
}

/**
 * useCompletedReminders — React Query hook for the completed list.
 */
export function useCompletedReminders() {
  return useQuery({
    queryKey: ['reminders', 'completed'],
    queryFn: async () => {
      const body = await remindersApi.getCompleted();
      return Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
    },
    placeholderData: [],
  });
}
