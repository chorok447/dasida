"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

/** SSR/hydration 중에는 온라인으로 간주해 배너 깜빡임을 막는다. */
function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/**
 * 네트워크 단절 안내 배너. API 실패 토스트만으로는 "왜 안 되는지" 알 수 없어
 * 오프라인 동안 화면 상단에 원인을 고정 노출한다(복구 시 자동 제거).
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium"
      style={{ background: "var(--danger-solid)", color: "#ffffff" }}
    >
      <WifiOff size={14} aria-hidden />
      오프라인 상태예요. 네트워크 연결을 확인해주세요.
    </div>
  );
}
