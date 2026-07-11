"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state ? <ConfirmDialogUI state={state} onClose={close} /> : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialogUI({ state, onClose }: { state: OpenState; onClose: (result: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 네이티브 <dialog>.showModal()이 포커스 트랩·top-layer 렌더링을 기본 제공한다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      // 브라우저 기본 auto-close 대신 onClose(false)로 통일해 Promise resolve를 보장한다.
      e.preventDefault();
      onClose(false);
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-6 shadow-xl backdrop:bg-black/45"
      style={{
        background: "var(--panel)",
        borderColor: "rgba(var(--ink-rgb), 0.12)",
        color: "var(--foreground)",
      }}
      onClick={(e) => {
        // dialog 박스 바깥(= backdrop 영역) 클릭 시 닫는다.
        const rect = dialogRef.current?.getBoundingClientRect();
        if (!rect) return;
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.bottom && rect.left <= e.clientX && e.clientX <= rect.right;
        if (!inDialog) onClose(false);
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
          className="rounded-full px-4 py-2 text-[13px] transition-colors hover:bg-[rgba(var(--ink-rgb),0.06)]"
          style={{ color: "rgba(var(--ink-rgb), 0.8)" }}
        >
          {state.cancelLabel ?? "취소"}
        </button>
        <button
          type="button"
          onClick={() => onClose(true)}
          className="rounded-full px-4 py-2 text-[13px] font-medium"
          style={{
            background: state.destructive ? "var(--danger-solid)" : "var(--accent)",
            color: state.destructive ? "#ffffff" : "var(--surface-dark)",
          }}
        >
          {state.confirmLabel ?? "확인"}
        </button>
      </div>
    </dialog>
  );
}
