import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TOAST_EVENT } from '../utils/toast.js';

const ToastContext = createContext(null);

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
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-3 max-w-sm">
        {toasts.map((toast) => {
          const colorClasses = toast.type === 'success'
            ? 'bg-green-600 text-white'
            : toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 text-white';
          return (
            <div
              key={toast.id}
              className={`${colorClasses} shadow-lg rounded-md px-4 py-3 flex items-start gap-3 animate-fade-in`}
              role="status"
            >
              <span className="text-sm leading-5 flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-sm font-semibold opacity-80 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
