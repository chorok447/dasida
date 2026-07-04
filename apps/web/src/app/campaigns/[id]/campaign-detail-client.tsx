"use client";

import { toast } from "sonner";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, MessageCircle, FileText } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiPost, apiPut, apiDelete, apiDeleteVoid, ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { useAuthSession } from "@/lib/use-auth-session";
import type { Campaign } from "@/data/campaigns";
import { PageShell } from "@/components/page-shell";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CampaignComments } from "./campaign-comments";
import {
  CampaignCTABar,
  CampaignContentTab,
  CampaignHeaderCard,
  CampaignStatusManagement,
} from "./campaign-detail-parts";

type Tab = "content" | "comments";

export default function CampaignDetailClient({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetCommentId = searchParams.get("commentId")?.trim() || null;
  const { sessionId: token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [tab, setTab] = useState<Tab>(() => targetCommentId ? "comments" : "content");
  const activeTab: Tab = targetCommentId ? "comments" : tab;
  const [c, setC] = useState(campaign);
  const [ownershipToken, setOwnershipToken] = useState<string | null>(null);
  const participationUpdatingRef = useRef(false);
  const [participationAction, setParticipationAction] = useState<"join" | "leave" | null>(null);
  const statusUpdatingRef = useRef(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next !== "content" || !targetCommentId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("commentId");
    const query = params.toString();
    router.replace(`/campaigns/${encodeURIComponent(campaign.id)}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const { refreshing, invalidatePending } = useAuthedRefresh<Campaign>(
    `/api/campaigns/${campaign.id}`,
    (updated) => {
      setC(updated);
      setOwnershipToken(updated.ownedByMe ? getSessionId() : null);
    },
    () => {
      setOwnershipToken(null);
      setC((cur) => (
        cur.joinedByMe || cur.ownedByMe
          ? { ...cur, joinedByMe: false, ownedByMe: false }
          : cur
      ));
    },
  );
  const ownershipConfirmed = !!token && ownershipToken === token && c.ownedByMe;
  const anyMutating = participationAction !== null || statusUpdating || deleting || refreshing;
  const mutationBusy = () =>
    participationUpdatingRef.current || statusUpdatingRef.current || deletingRef.current;

  const join = async () => {
    if (mutationBusy()) return;
    if (!getSessionId()) return;
    const requestToken = getSessionId();
    if (!requestToken) return;
    participationUpdatingRef.current = true;
    setParticipationAction("join");
    invalidatePending();
    try {
      const updated = await apiPost<Campaign>(`/api/campaigns/${c.id}/join`, {});
      if (getSessionId() !== requestToken) return;
      setC(updated);
      toast.success("캠페인에 참여했습니다.");
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인 후 캠페인에 참여할 수 있어요.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 409) {
        toast.error("모집 기간이 아니거나 정원이 마감되었습니다.");
      } else if (e instanceof ApiError && e.status === 400) {
        toast.error("현재 참여할 수 없는 캠페인입니다.");
      } else {
        toast.error("참여에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      participationUpdatingRef.current = false;
      setParticipationAction(null);
    }
  };

  const leave = async () => {
    if (mutationBusy()) return;
    if (!getSessionId()) {
      toast.error("로그인 후 캠페인에 참여할 수 있어요.");
      router.push("/login");
      return;
    }
    if (!(await confirm({ message: "캠페인 참여를 취소할까요?\n모집 마감 후에는 취소할 수 없습니다." }))) return;

    const requestToken = getSessionId();
    if (!requestToken) return;
    participationUpdatingRef.current = true;
    setParticipationAction("leave");
    invalidatePending();
    try {
      const updated = await apiDelete<Campaign>(`/api/campaigns/${c.id}/join`);
      if (getSessionId() !== requestToken) return;
      setC(updated);
      toast.success("참여가 취소되었습니다.");
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인 후 캠페인에 참여할 수 있어요.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 404) {
        toast.error("존재하지 않는 캠페인입니다.");
        router.push("/campaigns");
      } else if (e instanceof ApiError && e.status === 409) {
        toast.error("모집이 마감되어 참여를 취소할 수 없습니다.");
      } else {
        toast.error("참여 취소에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      participationUpdatingRef.current = false;
      setParticipationAction(null);
    }
  };

  const updateStatus = async (target: "open" | "closed") => {
    if (mutationBusy()) return;
    if (!getSessionId()) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    const confirmed = target === "open"
      ? await confirm({ message: "캠페인 모집을 시작할까요?" })
      : await confirm({ message: "모집을 마감할까요? 다시 시작할 수 없습니다.", destructive: true });
    if (!confirmed) return;

    const requestToken = getSessionId();
    if (!requestToken) return;
    statusUpdatingRef.current = true;
    setStatusUpdating(true);
    invalidatePending();
    try {
      const updated = await apiPut<Campaign>(`/api/campaigns/${c.id}/status`, { status: target });
      if (getSessionId() !== requestToken) return;
      setC(updated);
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        toast.error("캠페인 관리 권한이 없습니다.");
      } else if (e instanceof ApiError && e.status === 400) {
        toast.error("요청한 모집 상태가 올바르지 않습니다.");
      } else if (e instanceof ApiError && e.status === 409) {
        toast.error("현재 상태에서는 모집 상태를 변경할 수 없습니다.");
      } else {
        toast.error("캠페인 상태 변경에 실패했습니다.");
      }
    } finally {
      statusUpdatingRef.current = false;
      setStatusUpdating(false);
    }
  };

  const deleteCampaign = async () => {
    if (mutationBusy()) return;
    if (!getSessionId()) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (!(await confirm({ message: "이 캠페인을 삭제할까요?\n삭제한 캠페인은 복구할 수 없습니다.", destructive: true, confirmLabel: "삭제" }))) return;

    const requestToken = getSessionId();
    if (!requestToken) return;
    deletingRef.current = true;
    setDeleting(true);
    invalidatePending();
    try {
      await apiDeleteVoid(`/api/campaigns/${c.id}`);
      if (getSessionId() !== requestToken) return;
      router.replace("/mypage");
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        toast.error("캠페인 삭제 권한이 없습니다.");
      } else if (e instanceof ApiError && e.status === 404) {
        toast.error("이미 삭제되었거나 존재하지 않는 캠페인입니다.");
        router.push("/campaigns");
      } else if (e instanceof ApiError && e.status === 409) {
        toast.error("모집을 시작했거나 참여자 또는 연결 게시글이 있어 삭제할 수 없습니다.");
      } else {
        toast.error("캠페인 삭제에 실패했습니다.");
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <PageShell paddingClassName="relative min-h-screen pt-28 pb-20 px-6 overflow-hidden" orb="left">
      <div className="max-w-5xl mx-auto relative">
        <button
          onClick={() => router.push("/campaigns")}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} /> 캠페인 목록
        </button>

        <CampaignHeaderCard c={c} />

        <CampaignStatusManagement
          c={c}
          ownershipConfirmed={ownershipConfirmed}
          updating={statusUpdating}
          deleting={deleting}
          disabled={anyMutating}
          onChange={updateStatus}
          onDelete={deleteCampaign}
        />

        <div className="mt-8 sticky top-20 z-10">
          <CampaignCTABar
            c={c}
            onJoin={join}
            onLeave={leave}
            onLogin={() => router.push("/login")}
            action={participationAction}
            disabled={anyMutating}
            loggedIn={!!token}
          />
        </div>

        <div className="mt-10 flex gap-2 border-b" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)" }}>
          {([
            { id: "content", label: "캠페인 내용", icon: <FileText size={14} /> },
            { id: "comments", label: "댓글", icon: <MessageCircle size={14} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className="relative px-5 py-3 inline-flex items-center gap-2 text-[14px]"
                style={{ color: active ? (dark ? "#f9f7f2" : "#0f1f22") : dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}
              >
                {t.icon}
                {t.label}
                {active && (
                  <motion.div
                    layoutId="detail-tab"
                    className="absolute left-0 right-0 -bottom-px h-0.5"
                    style={{ background: "#7dd3a3" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          {activeTab === "content" ? (
            <CampaignContentTab c={c} />
          ) : (
            <CampaignComments campaignId={c.id} targetCommentId={targetCommentId} />
          )}
        </div>
      </div>
    </PageShell>
  );
}
