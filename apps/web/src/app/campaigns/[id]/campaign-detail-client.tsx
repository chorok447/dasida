"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Heart, Share2, MessageCircle, FileText, Pencil, Trash2, Users } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { progressPercent } from "@/lib/progress";
import { apiPost, apiPut, apiDelete, apiDeleteVoid, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { useAuthSession } from "@/lib/use-auth-session";
import { campaignRecruitMeta, type Campaign } from "@/data/campaigns";
import { Avatar } from "@/components/avatar";
import { CampaignComments } from "./campaign-comments";

type Tab = "content" | "comments";

function StatusBadge({ c }: { c: Campaign }) {
  const m = campaignRecruitMeta(c);
  return (
    <span
      className="text-[11px] tracking-[0.2em] px-3 py-1.5 rounded-full inline-block"
      style={{ background: m.color, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

function HeaderCard({ c }: { c: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 22 });
  const sy = useSpring(my, { stiffness: 150, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-6, 6]);
  const rX = useTransform(sy, [-0.5, 0.5], [5, -5]);
  const pct = progressPercent(c.joined, c.capacity);

  return (
    <div style={{ perspective: 1600 }}>
      <motion.div
        ref={ref}
        onMouseMove={(e) => {
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          mx.set((e.clientX - r.left) / r.width - 0.5);
          my.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onMouseLeave={() => {
          mx.set(0);
          my.set(0);
        }}
        style={{
          rotateX: rX,
          rotateY: rY,
          transformStyle: "preserve-3d",
          background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        }}
        className="rounded-3xl border overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr]">
          <div className="relative aspect-square md:aspect-auto overflow-hidden">
            <img src={c.thumb} alt={c.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0f1f22]/40 to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2" style={{ transform: "translateZ(50px)" }}>
              <StatusBadge c={c} />
              {c.ownedByMe ? (
                <span className="rounded-full bg-[#0f1f22]/80 px-3 py-1.5 text-[11px] text-[#7dd3a3]">
                  내가 개설
                </span>
              ) : null}
            </div>
          </div>
          <div className="p-8 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <h1
                style={{
                  fontFamily: "'Black Han Sans', sans-serif",
                  fontSize: "clamp(28px, 3vw, 40px)",
                  color: dark ? "#f9f7f2" : "#0f1f22",
                  lineHeight: 1.2,
                }}
              >
                {c.title}
              </h1>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: "#ed5c48" }}
                >
                  <Heart size={16} />
                </button>
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#1c4044" }}
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>

            <p className="text-[14px]" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
              {c.summary}
            </p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.85)" }}>
              <div>
                <div className="opacity-60 mb-0.5">모집 기간</div>
                <div>{c.recruitStart} ~ {c.recruitEnd}</div>
              </div>
              <div>
                <div className="opacity-60 mb-0.5">진행 기간</div>
                <div>{c.runStart} ~ {c.runEnd}</div>
              </div>
              <div>
                <div className="opacity-60 mb-0.5">모집 인원</div>
                <div>{c.capacity}명</div>
              </div>
              <div>
                <div className="opacity-60 mb-0.5">현재</div>
                <div>{c.joined}명 참여 중</div>
              </div>
            </div>

            <div>
              <div
                className="h-2 w-full rounded-full overflow-hidden"
                style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: campaignRecruitMeta(c).color }}
                />
              </div>
              <div className="flex justify-between text-[12px] mt-2" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                <span>{Math.round(pct)}% 달성</span>
                <span>{c.daysLeftLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
              <Avatar name={c.author.name} verified={c.author.verified} />
              <span style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{c.author.name}</span>
              <span className="text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>· 캠페인 주최자</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CampaignStatusManagement({
  c,
  ownershipConfirmed,
  updating,
  deleting,
  disabled,
  onChange,
  onDelete,
}: {
  c: Campaign;
  ownershipConfirmed: boolean;
  updating: boolean;
  deleting: boolean;
  // 상태 변경·삭제·재조회 중 하나라도 진행 중이면 true. 두 mutation 의 동시 실행을 막는다.
  disabled: boolean;
  onChange: (status: "open" | "closed") => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  if (!ownershipConfirmed) return null;

  const target = c.status === "upcoming" ? "open" : c.status === "open" ? "closed" : null;
  const label = target === "open" ? "모집 시작" : target === "closed" ? "모집 마감" : "모집 마감됨";

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        color: dark ? "#f9f7f2" : "#0f1f22",
      }}
    >
      <div>
        <p className="text-[13px] font-medium">모집 상태 관리</p>
        <p className="mt-0.5 text-[12px] opacity-60">캠페인 개설자만 모집을 시작하거나 마감할 수 있습니다.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/campaigns/${c.id}/participants`}
          aria-label="참가자 관리"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : undefined}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium ${
            disabled ? "pointer-events-none opacity-45" : ""
          }`}
          style={{
            background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            color: dark ? "#f9f7f2" : "#1c4044",
          }}
        >
          <Users size={14} /> 참가자 관리
        </Link>
        {c.status === "upcoming" ? (
          <Link
            href={`/campaigns/${c.id}/edit`}
            aria-label="캠페인 수정"
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium ${
              disabled ? "pointer-events-none opacity-45" : ""
            }`}
            style={{
              background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
              color: dark ? "#f9f7f2" : "#1c4044",
            }}
          >
            <Pencil size={14} /> 캠페인 수정
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => target && onChange(target)}
          disabled={disabled || target === null}
          aria-label={label}
          className="rounded-full px-5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45"
          style={{
            background: target === "closed" ? "rgba(237,92,72,0.16)" : "#7dd3a3",
            color: target === "closed" ? "#ed5c48" : "#0f1f22",
          }}
        >
          {updating ? "처리 중…" : label}
        </button>
        {c.status === "upcoming" ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label="캠페인 삭제"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: "rgba(237,92,72,0.16)", color: "#ed5c48" }}
          >
            <Trash2 size={14} /> {deleting ? "삭제 중…" : "캠페인 삭제"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CTABar({
  c,
  onJoin,
  onLeave,
  action,
  disabled,
  loggedIn,
}: {
  c: Campaign;
  onJoin: () => void;
  onLeave: () => void;
  action: "join" | "leave" | null;
  disabled: boolean;
  loggedIn: boolean;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const joinedStyle = { background: "rgba(125,211,163,0.18)", color: dark ? "#7dd3a3" : "#1c4044", fontSize: 16 };
  if (c.joinedByMe) {
    // open 일 때만 취소 가능. closed 는 마감되어 취소 불가, upcoming 은 비정상 데이터라 안내만 표시한다.
    if (c.status === "open") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="py-5 px-6 rounded-2xl text-center font-medium" style={joinedStyle}>
            참여 중인 캠페인입니다
          </div>
          <button
            onClick={onLeave}
            disabled={disabled}
            aria-label="참여 취소"
            className="py-5 px-6 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "rgba(237,92,72,0.16)", color: "#ed5c48" }}
          >
            {action === "leave" ? "취소 처리 중…" : "참여 취소"}
          </button>
        </div>
      );
    }
    return (
      <div className="w-full py-5 rounded-2xl text-center font-medium" style={joinedStyle}>
        {c.status === "closed" ? "참여한 캠페인입니다 (모집 마감)" : "참여 완료된 캠페인입니다"}
      </div>
    );
  }
  if (c.recruitable) {
    return (
      <button
        onClick={onJoin}
        disabled={disabled}
        className="w-full py-5 rounded-2xl font-medium hover:-translate-y-0.5 transition-transform shadow-[0_30px_60px_-20px_rgba(125,211,163,0.6)] disabled:opacity-50"
        style={{ background: "#7dd3a3", color: "#0f1f22", fontSize: 17 }}
      >
        {action === "join" ? "참여 처리 중…" : loggedIn ? "캠페인 참여하기" : "로그인 후 캠페인 참여"}
      </button>
    );
  }
  const unavailableMessage = c.recruitState === "before_recruit"
    ? "모집 시작 전입니다"
    : c.recruitState === "ended"
      ? "모집이 종료되었습니다"
      : c.recruitState === "closed"
        ? "모집이 마감되었습니다"
        : "정원이 마감되었습니다";
  return (
    <div
      className="w-full py-5 rounded-2xl text-center"
      style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.08)", color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}
    >
      {unavailableMessage}
    </div>
  );
}

function ContentTab({ c }: { c: Campaign }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div
      className="rounded-3xl border p-10 space-y-8"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <h2 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 26, color: dark ? "#f9f7f2" : "#0f1f22" }}>
        {c.body.heading}
      </h2>
      {c.body.paragraphs.map((p, i) => (
        <p key={i} style={{ color: dark ? "rgba(255,255,255,0.75)" : "rgba(28,64,68,0.8)", lineHeight: 1.8 }}>
          {p}
        </p>
      ))}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {c.body.images.map((src, i) => (
          <div key={i} className="aspect-[4/3] rounded-2xl overflow-hidden">
            <img src={src} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaignDetailClient({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetCommentId = searchParams.get("commentId")?.trim() || null;
  const { token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [tab, setTab] = useState<Tab>(() => targetCommentId ? "comments" : "content");
  const activeTab: Tab = targetCommentId ? "comments" : tab;
  const [c, setC] = useState(campaign);
  const [ownershipToken, setOwnershipToken] = useState<string | null>(null);
  // join/leave 는 하나의 participation mutation 으로 묶어 동시 실행을 막고, 진행 중 문구를 구분한다.
  const participationUpdatingRef = useRef(false);
  const [participationAction, setParticipationAction] = useState<"join" | "leave" | null>(null);
  const statusUpdatingRef = useRef(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next !== "content" || !targetCommentId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("commentId");
    const query = params.toString();
    router.replace(`/campaigns/${encodeURIComponent(campaign.id)}${query ? `?${query}` : ""}`, { scroll: false });
  };

  // 새로고침·로그인/로그아웃 시 참여·소유 상태를 함께 동기화한다.
  // identity 변경 시 사용자별 상태만 즉시 neutral(false), joined 숫자는 유지한다.
  const { refreshing, invalidatePending } = useAuthedRefresh<Campaign>(
    `/api/campaigns/${campaign.id}`,
    (updated) => {
      setC(updated);
      setOwnershipToken(updated.ownedByMe ? getToken() : null);
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
  // 어떤 mutation 이든 진행 중이거나 인증 재조회 중이면 다른 mutation 을 막는다(중복 UX 방어).
  const anyMutating = participationAction !== null || statusUpdating || deleting || refreshing;
  // ref 기준의 진행 여부. 핸들러 진입 즉시 동기적으로 검사해 연타 경합을 막는다.
  const mutationBusy = () =>
    participationUpdatingRef.current || statusUpdatingRef.current || deletingRef.current;

  const join = async () => {
    if (mutationBusy()) return;
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    const requestToken = getToken(); // 요청 identity 캡처
    if (!requestToken) return;
    participationUpdatingRef.current = true;
    setParticipationAction("join");
    invalidatePending(); // 진행 중 재조회 결과가 참여 성공 결과를 덮어쓰지 않게
    try {
      const updated = await apiPost<Campaign>(`/api/campaigns/${c.id}/join`, {});
      if (getToken() !== requestToken) return; // 응답 전 로그아웃/토큰교체 → 무시
      setC(updated);
    } catch (e) {
      if (getToken() !== requestToken) return; // 이미 로그아웃한 사용자 재이동 방지
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 409) {
        alert("모집 기간이 아니거나 정원이 마감되었습니다.");
      } else if (e instanceof ApiError && e.status === 400) {
        alert("현재 참여할 수 없는 캠페인입니다.");
      } else {
        alert("참여에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      participationUpdatingRef.current = false;
      setParticipationAction(null);
    }
  };

  const leave = async () => {
    if (mutationBusy()) return;
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (!confirm("캠페인 참여를 취소할까요?\n모집 마감 후에는 취소할 수 없습니다.")) return;

    const requestToken = getToken();
    if (!requestToken) return;
    participationUpdatingRef.current = true;
    setParticipationAction("leave");
    invalidatePending();
    try {
      const updated = await apiDelete<Campaign>(`/api/campaigns/${c.id}/join`);
      if (getToken() !== requestToken) return;
      setC(updated); // joined/progress/joinedByMe 즉시 갱신
      alert("참여가 취소되었습니다.");
    } catch (e) {
      if (getToken() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 404) {
        alert("존재하지 않는 캠페인입니다.");
        router.push("/campaigns");
      } else if (e instanceof ApiError && e.status === 409) {
        alert("모집이 마감되어 참여를 취소할 수 없습니다.");
      } else {
        alert("참여 취소에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      participationUpdatingRef.current = false;
      setParticipationAction(null);
    }
  };

  const updateStatus = async (target: "open" | "closed") => {
    if (mutationBusy()) return; // 참여/취소·삭제와 동시 실행 금지
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    const confirmed = target === "open"
      ? confirm("캠페인 모집을 시작할까요?")
      : confirm("모집을 마감할까요? 다시 시작할 수 없습니다.");
    if (!confirmed) return;

    const requestToken = getToken();
    if (!requestToken) return;
    statusUpdatingRef.current = true;
    setStatusUpdating(true);
    invalidatePending();
    try {
      const updated = await apiPut<Campaign>(`/api/campaigns/${c.id}/status`, { status: target });
      if (getToken() !== requestToken) return;
      setC(updated);
    } catch (e) {
      if (getToken() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        alert("캠페인 관리 권한이 없습니다.");
      } else if (e instanceof ApiError && e.status === 400) {
        alert("요청한 모집 상태가 올바르지 않습니다.");
      } else if (e instanceof ApiError && e.status === 409) {
        alert("현재 상태에서는 모집 상태를 변경할 수 없습니다.");
      } else {
        alert("캠페인 상태 변경에 실패했습니다.");
      }
    } finally {
      statusUpdatingRef.current = false;
      setStatusUpdating(false);
    }
  };

  const deleteCampaign = async () => {
    if (mutationBusy()) return; // 참여/취소·모집 시작과 동시 실행 금지
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (!confirm("이 캠페인을 삭제할까요?\n삭제한 캠페인은 복구할 수 없습니다.")) return;

    const requestToken = getToken();
    if (!requestToken) return;
    deletingRef.current = true;
    setDeleting(true);
    invalidatePending(); // 진행 중 재조회 결과가 삭제 동작과 경합하지 않게
    try {
      await apiDeleteVoid(`/api/campaigns/${c.id}`);
      if (getToken() !== requestToken) return; // 응답 전 로그아웃/토큰교체 → 무시
      // 삭제된 상세가 history 에 남지 않도록 replace 로 이동. 다른 state 는 갱신하지 않는다.
      router.replace("/mypage");
    } catch (e) {
      if (getToken() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        alert("캠페인 삭제 권한이 없습니다.");
      } else if (e instanceof ApiError && e.status === 404) {
        alert("이미 삭제되었거나 존재하지 않는 캠페인입니다.");
        router.push("/campaigns");
      } else if (e instanceof ApiError && e.status === 409) {
        alert("모집을 시작했거나 참여자 또는 연결 게시글이 있어 삭제할 수 없습니다.");
      } else {
        alert("캠페인 삭제에 실패했습니다.");
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <section
      className="relative min-h-screen pt-28 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto relative">
        <button
          onClick={() => router.push("/campaigns")}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} /> 캠페인 목록
        </button>

        <HeaderCard c={c} />

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
          <CTABar
            c={c}
            onJoin={join}
            onLeave={leave}
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
            <ContentTab c={c} />
          ) : (
            <CampaignComments campaignId={c.id} targetCommentId={targetCommentId} />
          )}
        </div>
      </div>
    </section>
  );
}
