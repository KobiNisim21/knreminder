import { useQuery } from '@tanstack/react-query';
import { remindersApi } from '../api/reminders';
import { 
  saveReminders, loadReminders, 
  saveCompleted, loadCompleted, 
  saveBirthdays, loadBirthdays,
  setLastSyncTime
} from '../utils/offlineStore';

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
      try {
        const body = await remindersApi.getAll();
        const data = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
        await saveReminders(data);
        await setLastSyncTime(Date.now());
        return data;
      } catch (err) {
        const [cached, cachedYearlyEvents] = await Promise.all([
          loadReminders(),
          loadBirthdays(),
        ]);
        const merged = new Map();
        for (const item of [...cached, ...cachedYearlyEvents]) merged.set(item._id, item);
        if (merged.size > 0) return [...merged.values()];
        throw err;
      }
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
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
      try {
        const body = await remindersApi.getCompleted();
        const data = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
        await saveCompleted(data);
        return data;
      } catch (err) {
        const cached = await loadCompleted();
        if (cached && cached.length > 0) return cached;
        throw err;
      }
    },
    placeholderData: [],
  });
}

/**
 * useBirthdays — React Query hook for the birthdays and special-events feed.
 *
 * Polls every 60s like the main reminders list so the feed stays fresh
 * after a yearly event rolls over to next year via the recurrence engine.
 */
export function useBirthdays() {
  return useQuery({
    queryKey: ['reminders', 'birthdays'],
    queryFn: async () => {
      try {
        const body = await remindersApi.getBirthdays();
        const data = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
        await saveBirthdays(data);
        return data;
      } catch (err) {
        const cached = await loadBirthdays();
        if (cached && cached.length > 0) return cached;
        throw err;
      }
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: [],
  });
}
