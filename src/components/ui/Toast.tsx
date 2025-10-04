"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
export type ToastOptions = { type?: ToastType; duration?: number };

type ToastItem = { id: number; type: ToastType; message: string; duration: number };
type ToastCtx = { show: (message: string, opts?: ToastOptions) => void };

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const show = (message: string, opts?: ToastOptions) => {
    const id = idRef.current++;
    const item: ToastItem = {
      id,
      type: opts?.type ?? "info",
      message,
      duration: Math.max(1200, Math.min(opts?.duration ?? 2600, 10000)),
    };
    setItems((prev) => [...prev, item]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, item.duration);
  };

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));
  const value = useMemo<ToastCtx>(() => ({ show }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap" aria-live="polite" aria-atomic="true">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast ${t.type}`}
            onClick={() => dismiss(t.id)}
            title="Dismiss"
          >
            <span className="dot" />
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
