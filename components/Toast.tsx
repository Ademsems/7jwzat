"use client";
import { useEffect, useState } from "react";

export type ToastType = "success" | "error";
export interface Toast { id: number; type: ToastType; message: string; }

let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;
let _counter = 0;

export function showToast(message: string, type: ToastType = "success") {
  if (!_setToasts) return;
  const id = ++_counter;
  _setToasts(prev => [...prev, { id, type, message }]);
  setTimeout(() => _setToasts!(prev => prev.filter(t => t.id !== id)), 3500);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => { _setToasts = setToasts; return () => { _setToasts = null; }; }, []);
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs transition-all
            ${t.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {t.type === "success" ? "✓ " : "✕ "}{t.message}
        </div>
      ))}
    </div>
  );
}