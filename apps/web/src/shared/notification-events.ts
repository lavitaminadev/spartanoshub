export const NOTIFICATION_EVENT = 'vitahub-notification';

export interface NotificationDetail {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function notify(message: string, type: NotificationDetail['type'] = 'info', duration = 4000) {
  window.dispatchEvent(new CustomEvent<NotificationDetail>(NOTIFICATION_EVENT, { detail: { message, type, duration } }));
}

export function notifyAdvanced(detail: NotificationDetail) {
  window.dispatchEvent(new CustomEvent<NotificationDetail>(NOTIFICATION_EVENT, { detail }));
}
