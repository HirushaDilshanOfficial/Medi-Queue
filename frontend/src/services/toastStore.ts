export type ToastMessage = {
  type?: 'success' | 'error' | 'info' | 'warning';
  text1?: string;
  text2?: string;
  position?: 'top' | 'bottom';
  topOffset?: number;
  bottomOffset?: number;
  visibilityTime?: number;
  autoHide?: boolean;
};

let current: ToastMessage | null = null;
const listeners = new Set<() => void>();

export const toastStore = {
  getSnapshot: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  show(message: ToastMessage) {
    current = { ...message };
    listeners.forEach(listener => listener());
  },
  hide(message = current) {
    // An older dismiss timer must never hide a newer message.
    if (message !== current) return;
    current = null;
    listeners.forEach(listener => listener());
  },
};
