import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

/**
 * Local-only alarm state (not synced): which alerts this device snoozed.
 * Each device decides for itself what to silence; the alerts themselves are derived
 * from the shared kitchen + inventory data in `utils/kitchenForecast.ts`.
 */
type AlertState = {
  /** alert id -> timestamp until which it stays silent */
  snoozedUntil: Record<string, number>;
  snooze: (ids: string[], minutes: number) => void;
  prune: () => void;
};

export const useAlertStore = create<AlertState>()(
  persist(
    (set) => ({
      snoozedUntil: {},
      snooze: (ids, minutes) =>
        set((state) => {
          const until = Date.now() + minutes * 60000;
          const next = { ...state.snoozedUntil };
          ids.forEach((id) => {
            next[id] = until;
          });
          return { snoozedUntil: next };
        }),
      prune: () =>
        set((state) => {
          const now = Date.now();
          const next: Record<string, number> = {};
          let changed = false;
          Object.entries(state.snoozedUntil).forEach(([id, until]) => {
            if (until > now) next[id] = until;
            else changed = true;
          });
          return changed ? { snoozedUntil: next } : state;
        }),
    }),
    {
      name: 'alert-storage',
      storage: appStorage,
    }
  )
);
