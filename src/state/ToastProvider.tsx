'use client';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms
};

// Actions
type AddToastAction = { type: 'ADD_TOAST'; payload: Toast };
type RemoveToastAction = { type: 'REMOVE_TOAST'; payload: { id: string } };

type ToastAction = AddToastAction | RemoveToastAction;

type ToastState = {
  toasts: Toast[];
};

const initialState: ToastState = { toasts: [] };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload.id),
      };
    default:
      return state;
  }
}

// Context
const ToastStateContext = createContext<ToastState | undefined>(undefined);
const ToastDispatchContext = createContext<
  React.Dispatch<ToastAction> | undefined
>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, initialState);

  const value = useMemo(() => state, [state]);

  return (
    <ToastStateContext.Provider value={value}>
      <ToastDispatchContext.Provider value={dispatch}>
        {children}
      </ToastDispatchContext.Provider>
    </ToastStateContext.Provider>
  );
}

export function useToastState() {
  const ctx = useContext(ToastStateContext);
  if (!ctx) throw new Error('useToastState must be used within ToastProvider');
  return ctx;
}

export function useToastDispatch() {
  const ctx = useContext(ToastDispatchContext);
  if (!ctx)
    throw new Error('useToastDispatch must be used within ToastProvider');
  return ctx;
}

// setToast hook as requested
export type SetToastOptions = {
  type?: ToastType;
  duration?: number; // ms; default 3000
};

function uid() {
  // Simple unique id generator for client-side usage
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useSetToast() {
  const dispatch = useToastDispatch();

  return useCallback(
    (message: string, opts: SetToastOptions = {}) => {
      const id = uid();
      const type: ToastType = opts.type ?? 'info';
      const duration = opts.duration ?? 3000;
      dispatch({ type: 'ADD_TOAST', payload: { id, type, message, duration } });

      if (duration && duration > 0) {
        // schedule removal
        setTimeout(() => {
          dispatch({ type: 'REMOVE_TOAST', payload: { id } });
        }, duration);
      }

      // Return a function to manually dismiss
      return () => dispatch({ type: 'REMOVE_TOAST', payload: { id } });
    },
    [dispatch],
  );
}

// Simple Toast UI container. Users can replace with their own styling.
export function ToastContainer() {
  const { toasts } = useToastState();
  const dispatch = useToastDispatch();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            'pointer-events-auto w-full max-w-md rounded-md border p-3 font-medium text-white shadow-lg ' +
            (t.type === 'success'
              ? 'border-green-600 bg-green-700'
              : t.type === 'error'
                ? 'border-red-600 bg-red-700'
                : t.type === 'warning'
                  ? 'border-yellow-600 bg-yellow-700'
                  : 'border-sky-600 bg-sky-700')
          }
          role="status"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">{t.message}</div>
            <button
              onClick={() =>
                dispatch({ type: 'REMOVE_TOAST', payload: { id: t.id } })
              }
              className="cursor-pointer rounded p-1 text-xs opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
