export const TOAST_EVENT = 'vitahub-toast';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastDetail {
  message: string;
  kind?: 'success' | 'error' | 'info' | 'connection' | 'permission';
  title?: string;
  action?: ToastAction;
}

export function triggerToast(message: string, kind: ToastDetail['kind'] = 'success') {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, kind } }));
}
