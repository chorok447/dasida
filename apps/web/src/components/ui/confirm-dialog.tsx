"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme-context";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type OpenState = ConfirmOptions & { open: true };

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OpenState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, ...options });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }, []);

  useEffect(() => {
    if (!state) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state ? <ConfirmDialogUI state={state} cancelRef={cancelRef} onClose={close} /> : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialogUI({
  state,
  cancelRef,
  onClose,
}: {
  state: OpenState;
  cancelRef: React.RefObject<HTMLButtonElement | null>;
  onClose: (result: boolean) => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="닫기"
        onClick={() => onClose(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="relative w-full max-w-sm rounded-2xl border p-6 shadow-xl"
        style={{
          background: dark ? "#1c4044" : "#ffffff",
          borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
          color: dark ? "#f9f7f2" : "#0f1f22",
        }}
      >
        <h2 id="confirm-dialog-title" className="text-[16px] font-semibold">
          {state.title ?? "확인"}
        </h2>
        <p id="confirm-dialog-desc" className="mt-2 whitespace-pre-line text-[14px] opacity-80">
          {state.message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="rounded-full px-4 py-2 text-[13px] transition-colors hover:bg-white/10"
            style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)" }}
          >
            {state.cancelLabel ?? "취소"}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className="rounded-full px-4 py-2 text-[13px] font-medium"
            style={{
              background: state.destructive ? "#ed5c48" : "#7dd3a3",
              color: state.destructive ? "#ffffff" : "#0f1f22",
            }}
          >
            {state.confirmLabel ?? "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
