import { useCallback, useEffect, useState } from 'react';
import { pushApi } from '../api/reminders';
import { useSettings } from '../context/SettingsContext';

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

function getPreferences(settings) {
  return {
    ...settings.notifications,
    birthdayDaysBefore: Number(settings.birthdays.inAdvance || 0),
    birthdayNotificationTime: settings.birthdays.reminderTime || '10:00',
    calendarNotificationTime: '10:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
  };
}

export function usePushNotifications() {
  const { settings, updateNotifications } = useSettings();
  const [state, setState] = useState({
    supported: false,
    subscribed: false,
    permission: typeof Notification === 'undefined' ? 'default' : Notification.permission,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      let subscribed = false;
      if (supported) {
        const registration = await navigator.serviceWorker.ready;
        subscribed = Boolean(await registration.pushManager.getSubscription());
      }
      if (!cancelled) {
        setState({
          supported,
          subscribed,
          permission: supported ? Notification.permission : 'default',
          loading: false,
          error: null,
        });
        updateNotifications({ enabled: subscribed });
      }
    }
    detect().catch((error) => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: error.message }));
    });
    return () => { cancelled = true; };
  }, [updateNotifications]);

  // Keep server-side filters current whenever the user changes a preference.
  useEffect(() => {
    if (!state.subscribed || !settings.notifications.enabled) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription) {
          return pushApi.subscribe(subscription.toJSON(), {
            enabled: settings.notifications.enabled,
            importantReminders: settings.notifications.importantReminders,
            birthdays: settings.notifications.birthdays,
            holidays: settings.notifications.holidays,
            shabbat: settings.notifications.shabbat,
            birthdayDaysBefore: Number(settings.birthdays.inAdvance || 0),
            birthdayNotificationTime: settings.birthdays.reminderTime || '10:00',
            calendarNotificationTime: '10:00',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
          });
        }
      })
      .catch((error) => setState((prev) => ({ ...prev, error: error.message })));
  }, [
    state.subscribed,
    settings.notifications.enabled,
    settings.notifications.importantReminders,
    settings.notifications.birthdays,
    settings.notifications.holidays,
    settings.notifications.shabbat,
    settings.birthdays.inAdvance,
    settings.birthdays.reminderTime,
  ]);

  const enable = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('הדפדפן הזה אינו תומך בהתראות פוש');
      }
      if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandalone()) {
        throw new Error('ב-iPhone יש להתקין קודם את האפליקציה במסך הבית');
      }

      // Verify the server is configured before showing the operating-system
      // permission prompt. Otherwise Android can grant permission while device
      // registration still fails, leaving the switch off with no clear cause.
      const { publicKey } = await pushApi.getPublicKey();

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('הרשאת ההתראות לא אושרה. ניתן לאפשר אותה בהגדרות המכשיר.');
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await pushApi.subscribe(subscription.toJSON(), {
        ...getPreferences(settings),
        enabled: true,
      });
      updateNotifications({ enabled: true });
      setState({ supported: true, subscribed: true, permission, loading: false, error: null });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, [settings, updateNotifications]);

  const disable = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await pushApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      updateNotifications({ enabled: false });
      setState((prev) => ({ ...prev, subscribed: false, loading: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }
  }, [updateNotifications]);

  const sendTest = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) throw new Error('אין מנוי התראות פעיל במכשיר');
    return pushApi.sendTest(subscription.endpoint);
  }, []);

  return { ...state, enable, disable, sendTest };
}
