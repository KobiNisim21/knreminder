import { useCallback, useEffect, useState } from 'react';
import { settingsApi } from '../api/reminders';

export function useWeeklyBackup() {
  const [state, setState] = useState({
    enabled: false,
    loading: true,
    error: null,
    lastSentAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    settingsApi.getWeeklyBackup()
      .then(({ weeklyBackup }) => {
        if (!cancelled) {
          setState({
            enabled: weeklyBackup.enabled,
            loading: false,
            error: null,
            lastSentAt: weeklyBackup.lastSentAt,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: error.message }));
      });
    return () => { cancelled = true; };
  }, []);

  const setEnabled = useCallback(async (enabled) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { weeklyBackup } = await settingsApi.updateWeeklyBackup(enabled);
      setState((prev) => ({
        ...prev,
        enabled: weeklyBackup.enabled,
        lastSentAt: weeklyBackup.lastSentAt,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, []);

  const sendNow = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await settingsApi.sendWeeklyBackupNow();
      setState((prev) => ({ ...prev, loading: false, lastSentAt: result.sentAt }));
      return result;
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, []);

  return { ...state, setEnabled, sendNow };
}
