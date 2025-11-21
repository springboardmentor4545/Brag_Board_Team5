export const TOAST_EVENT = 'app:toast';

export function emitToast(type, message, options = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const detail = {
    type: type || 'info',
    message,
    options,
  };

  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}
