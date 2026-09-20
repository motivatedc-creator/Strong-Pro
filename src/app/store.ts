import { create } from 'zustand';
import { uuid } from '@/domain/ids';

/**
 * Transient application state.
 *
 * Nothing durable lives here — workouts, sets and settings are always read from the
 * repository. `dataVersion` is a cheap invalidation signal: any write bumps it and every
 * `useRepositoryData` hook refetches, which keeps screens consistent without a cache layer.
 */

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  action?: { label: string; onAction: () => void };
  durationMs: number;
}

interface AppState {
  dataVersion: number;
  toasts: Toast[];
  /** True while a blocking write is in flight, used to disable double taps. */
  busy: boolean;
  bumpData: () => void;
  pushToast: (toast: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => string;
  dismissToast: (id: string) => void;
  setBusy: (busy: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  dataVersion: 0,
  toasts: [],
  busy: false,
  bumpData: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),
  pushToast: (toast) => {
    const id = uuid();
    set((state) => ({
      toasts: [...state.toasts, { id, durationMs: toast.action ? 8_000 : 4_000, ...toast }],
    }));
    return id;
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  setBusy: (busy) => set({ busy }),
}));

export const toast = {
  info: (message: string) => useAppStore.getState().pushToast({ message, tone: 'info' }),
  success: (message: string) => useAppStore.getState().pushToast({ message, tone: 'success' }),
  warning: (message: string) => useAppStore.getState().pushToast({ message, tone: 'warning' }),
  error: (message: string) => useAppStore.getState().pushToast({ message, tone: 'danger' }),
  undo: (message: string, onAction: () => void) =>
    useAppStore
      .getState()
      .pushToast({ message, tone: 'info', action: { label: 'Undo', onAction } }),
  action: (message: string, label: string, onAction: () => void) =>
    useAppStore.getState().pushToast({ message, tone: 'info', action: { label, onAction } }),
};

export function bumpData(): void {
  useAppStore.getState().bumpData();
}
