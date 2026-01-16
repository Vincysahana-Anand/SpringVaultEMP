export type MessageType = 'success' | 'error' | 'info' | 'warning';

export interface MessagePayload {
  type: MessageType;
  message: string;
  title?: string;
  durationMs?: number;
}

type MessageHandler = (payload: MessagePayload) => void;

let handler: MessageHandler | null = null;

export function registerMessageHandler(next: MessageHandler | null) {
  handler = next;
}

export function showMessage(payload: MessagePayload) {
  handler?.(payload);
}

export function showSuccess(message: string, opts?: Omit<MessagePayload, 'type' | 'message'>) {
  showMessage({ type: 'success', message, ...opts });
}

export function showError(message: string, opts?: Omit<MessagePayload, 'type' | 'message'>) {
  showMessage({ type: 'error', message, ...opts });
}

export function showInfo(message: string, opts?: Omit<MessagePayload, 'type' | 'message'>) {
  showMessage({ type: 'info', message, ...opts });
}

export function showWarning(message: string, opts?: Omit<MessagePayload, 'type' | 'message'>) {
  showMessage({ type: 'warning', message, ...opts });
}
