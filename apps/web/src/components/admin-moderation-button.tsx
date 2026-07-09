"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EyeOff, Eye, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { setAdminContentVisibility } from "@/data/admin";
import type { ReportTargetType } from "@/data/reports";
import { REPORT_TARGET_LABELS } from "@/data/reports";

/**
 * 관리자 전용 콘텐츠 숨김/복구 버튼(상세 페이지용). 관리자가 아니면 아무것도 렌더링하지 않는다.
 * 신고 큐를 거치지 않는 직접 제재 수단 — 조치는 감사 로그에 기록되고 작성자에게 알림이 간다.
 * 숨긴 뒤 페이지를 벗어나면 상세가 404 가 되므로, 복구는 이 자리(이탈 전) 또는 감사 로그에서 한다.
 */
export function AdminModerationButton({
  targetType,
  targetId,
}: {
  targetType: ReportTargetType;
  targetId: string;
}) {
  const { profile } = useCurrentUserProfile();
  const confirm = useConfirm();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (profile?.role !== "ADMIN") return null;
  const label = REPORT_TARGET_LABELS[targetType] ?? "콘텐츠";

  const toggle = async () => {
    if (busy) return;
    if (!hidden) {
      const ok = await confirm({
        title: `이 ${label}을(를) 숨길까요?`,
        message: "공개 목록·검색에서 제외되고 작성자에게 알림이 갑니다. 복구는 지금 이 자리 또는 감사 로그에서 할 수 있습니다.",
        confirmLabel: "숨김",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await setAdminContentVisibility(targetType, targetId, { hidden: !hidden });
      setHidden(!hidden);
      toast.success(!hidden ? `${label}을(를) 숨겼습니다.` : `${label}을(를) 복구했습니다.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? apiErrorMessage(e, "처리에 실패했습니다.") : "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] disabled:opacity-50"
      style={
        hidden
          ? { background: "var(--accent-soft)", color: "var(--accent-secondary)" }
          : { background: "var(--danger-soft)", color: "var(--danger)" }
      }
      aria-label={hidden ? "관리자: 콘텐츠 복구" : "관리자: 콘텐츠 숨김"}
    >
      {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : hidden ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
      {hidden ? "복구" : "숨김"}
    </button>
  );
}
