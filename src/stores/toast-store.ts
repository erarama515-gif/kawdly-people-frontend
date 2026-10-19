import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  /** Auto-dismiss delay in ms. Default 4000. */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: number) => void;
}

let _nextId = 1;
const MAX_QUEUE = 5;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (type, message, duration = 4000) =>
    set((state) => {
      const id = _nextId++;
      const newToast: ToastItem = { id, type, message, duration };
      const toasts = [...state.toasts, newToast].slice(-MAX_QUEUE);
      return { toasts };
    }),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
