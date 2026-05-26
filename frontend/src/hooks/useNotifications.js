// frontend/src/hooks/useNotifications.js
// Manages browser Notification permission and schedules daily watering reminders.
// Reminder times are stored in localStorage so they survive page reloads.

import { useCallback, useEffect, useState } from 'react';
import { getCareStatus } from '../utils/careStatus';

const STORAGE_KEY = 'pch_notifications_enabled';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // re-check every hour

function isSupported() {
  return 'Notification' in window;
}

export function useNotifications(plants = []) {
  const [permission, setPermission] = useState(
    isSupported() ? Notification.permission : 'unsupported'
  );
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );

  // Request permission from the browser
  const requestPermission = useCallback(async () => {
    if (!isSupported()) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      localStorage.setItem(STORAGE_KEY, 'true');
      setEnabled(true);
    }
  }, []);

  // Disable and clear preference
  const disableNotifications = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'false');
    setEnabled(false);
  }, []);

  // Fire a browser notification for each plant that needs attention today
  const checkAndNotify = useCallback(() => {
    if (!isSupported() || Notification.permission !== 'granted' || !enabled) return;
    if (!plants || plants.length === 0) return;

    const urgent = plants.filter((p) => {
      const w = getCareStatus(p.lastWatered, p.wateringFrequencyDays);
      const f = getCareStatus(p.lastFertilized, p.fertilizingFrequencyDays);
      return w.status === 'overdue' || w.status === 'today' || f.status === 'overdue' || f.status === 'today';
    });

    if (urgent.length === 0) return;

    const body =
      urgent.length === 1
        ? `${urgent[0].name} precisa de atenção hoje.`
        : `${urgent.length} plantas precisam de atenção hoje: ${urgent.map((p) => p.name).join(', ')}.`;

    // Collapse multiple notifications into one using a tag
    new Notification('Plant Care Hub 🌿', {
      body,
      icon: '/logo192.png',
      tag: 'daily-care-reminder',
      requireInteraction: false,
    });
  }, [plants, enabled]);

  // Run check on mount and then every hour
  useEffect(() => {
    if (!enabled || Notification.permission !== 'granted') return;
    checkAndNotify();
    const id = setInterval(checkAndNotify, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkAndNotify, enabled]);

  return { permission, enabled, requestPermission, disableNotifications };
}
