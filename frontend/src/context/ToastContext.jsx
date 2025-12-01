import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOAST_EVENT } from '../utils/toast.js';
import ToastContext from './toastContext';

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timerRefs = useRef(new Map());
  const idRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timers = timerRefs.current;
    if (timers.has(id)) {
      clearTimeout(timers.get(id));
      timers.delete(id);
    }
  }, []);

  const addToast = useCallback((type, message, options = {}) => {
    const id = ++idRef.current;
    const duration = options.duration ?? DEFAULT_DURATION;
    const toast = { id, type, message, duration };
    setToasts((current) => [...current, toast]);

    if (duration !== null) {
      const timeoutId = setTimeout(() => removeToast(id), duration);
      timerRefs.current.set(id, timeoutId);
    }

    return id;
  }, [removeToast]);

  const contextValue = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handler = (event) => {
      const { type = 'info', message, options } = event.detail || {};
      if (!message) {
        return;
      }
      addToast(type, message, options);
    };

    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, [addToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-stack pointer-events-none">
        {toasts.map((toast) => {
          const typeClass = toast.type === 'success'
            ? 'toast-item--success'
            : toast.type === 'error'
              ? 'toast-item--error'
              : 'toast-item--info';
          const durationStyle = toast.duration !== null
            ? { '--toast-duration': `${toast.duration}ms` }
            : undefined;
          return (
            <div
              key={toast.id}
              className={`toast-item ${typeClass}`}
              style={durationStyle}
              role="status"
            >
              <span className="toast-message">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="toast-dismiss"
                aria-label="Dismiss notification"
              >
                ×
              </button>
              {toast.duration !== null && <span className="toast-progress" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
