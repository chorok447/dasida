"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, ShieldCheck, UserMinus, Users } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { apiGet, ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  removeCampaignParticipant,
  statusMeta,
  type CampaignParticipantsResponse,
} from "@/data/campaigns";

const PAGE_SIZE = 20;

type LoadState =
  | { identity: string; kind: "loading" }
  | { identity: string; kind: "ready"; data: CampaignParticipantsResponse }
  | { identity: string; kind: "forbidden" }
  | { identity: string; kind: "notfound" }
  | { identity: string; kind: "error" };

function StateShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <section
      className="relative min-h-screen px-4 pb-20 pt-28 transition-colors sm:px-6"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <StatePanel className="mx-auto min-h-72 max-w-2xl">
        {children}
      </StatePanel>
    </section>
  );
}

export default function ParticipantsClient({ id }: { id: string }) {
  const router = useRouter();
  const { sessionId: token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const requestGenerationRef = useRef(0);
  const requestInFlightRef = useRef(false);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();
  const identity = `${id}:${token ?? "anonymous"}:${page}:${retry}`;
  const [loadState, setLoadState] = useState<LoadState>({ identity: "", kind: "loading" });
  const currentLoad: LoadState = loadState.identity === identity
    ? loadState
    : { identity, kind: "loading" };

  useEffect(() => {
    // hydration 중 useAuthSession의 server snapshot은 null일 수 있어 실제 localStorage 값을 확인한다.
    const requestToken = getSessionId();
    if (!requestToken) {
      requestInFlightRef.current = false;
      router.replace("/login");
      return;
    }

    let cancelled = false;
    const generation = ++requestGenerationRef.current;
    requestInFlightRef.current = true;
    const isCurrent = () =>
      !cancelled
      && generation === requestGenerationRef.current
      && getSessionId() === requestToken;

    apiGet<CampaignParticipantsResponse>(
      `/api/campaigns/${encodeURIComponent(id)}/participants?page=${page}&size=${PAGE_SIZE}`,
    )
      .then((response) => {
        if (!isCurrent()) return;
        // 마지막 참가자가 취소돼 현재 page가 비면 직전 page를 다시 조회한다.
        if (response.participants.length === 0 && page > 0) {
          setPage((current) => Math.max(0, current - 1));
          return;
        }
        setLoadState({ identity, kind: "ready", data: response });
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          router.replace("/login");
        } else if (error instanceof ApiError && error.status === 403) {
          setLoadState({ identity, kind: "forbidden" });
        } else if (error instanceof ApiError && error.status === 404) {
          setLoadState({ identity, kind: "notfound" });
        } else {
          setLoadState({ identity, kind: "error" });
        }
      })
      .finally(() => {
        if (isCurrent()) requestInFlightRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [id, identity, page, router]);

  const movePage = (nextPage: number) => {
    if (requestInFlightRef.current || currentLoad.kind !== "ready") return;
    requestInFlightRef.current = true;
    setPage(nextPage);
  };

  const refresh = () => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setRetry((current) => current + 1);
  };

  // 개설자 강제 퇴장. 성공 시 현재 page 를 재조회한다(load effect 가 빈 page 면 이전 page 로 이동).
  // 오류 시 목록은 유지하고 inline 메시지만 갱신한다.
  const removeParticipant = async (participantId: string) => {
    if (requestInFlightRef.current || removingId) return;
    if (
      !(await confirm({
        message: "이 참가자를 캠페인에서 제외할까요?\n제외된 사용자는 다시 참여할 수 있습니다.",
        destructive: true,
        confirmLabel: "제외",
      }))
    ) {
      return;
    }
    setRemovingId(participantId);
    setActionError(null);
    requestInFlightRef.current = true;
    try {
      await removeCampaignParticipant(id, participantId);
      requestInFlightRef.current = false;
      setRetry((current) => current + 1); // 현재 page 재조회 → joined/목록 갱신
    } catch (error) {
      requestInFlightRef.current = false;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setActionError("참가자를 제외할 권한이 없습니다.");
      } else if (error instanceof ApiError && error.status === 404) {
        setActionError("이미 제외되었거나 찾을 수 없는 참가자입니다.");
      } else if (error instanceof ApiError && error.status === 409) {
        setActionError("모집 중인 캠페인에서만 참가자를 제외할 수 있습니다.");
      } else {
        setActionError("참가자 제외에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setRemovingId(null);
    }
  };

  if (currentLoad.kind === "loading") {
    return <StateShell><p>참가자 목록을 불러오는 중입니다.</p></StateShell>;
  }
  if (currentLoad.kind === "forbidden") {
    return (
      <StateShell>
        <p>참가자 목록을 볼 권한이 없습니다.</p>
        <button type="button" onClick={() => router.push(`/campaigns/${id}`)} className="rounded-xl bg-[#7dd3a3] px-4 py-2 text-[13px] text-[#0f1f22]">
          캠페인으로 돌아가기
        </button>
      </StateShell>
    );
  }
  if (currentLoad.kind === "notfound") {
    return (
      <StateShell>
        <p>캠페인을 찾을 수 없습니다.</p>
        <button type="button" onClick={() => router.push("/campaigns")} className="rounded-xl bg-[#7dd3a3] px-4 py-2 text-[13px] text-[#0f1f22]">
          캠페인 목록
        </button>
      </StateShell>
    );
  }
  if (currentLoad.kind === "error") {
    return (
      <StateShell>
        <p>참가자 목록을 불러오지 못했습니다.</p>
        <button type="button" onClick={refresh} className="rounded-xl bg-[#7dd3a3] px-4 py-2 text-[13px] text-[#0f1f22]">
          다시 시도
        </button>
      </StateShell>
    );
  }

  const { data } = currentLoad;
  const status = statusMeta[data.status];
  return (
    <section
      className="relative min-h-screen px-4 pb-20 pt-28 transition-colors sm:px-6"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="relative mx-auto max-w-4xl">
        <Link
          href={`/campaigns/${id}`}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 transition-opacity hover:opacity-100"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} /> 캠페인 상세로 돌아가기
        </Link>

        <div
          className="overflow-hidden rounded-3xl border"
          style={{
            background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
            borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            color: dark ? "#f9f7f2" : "#0f1f22",
          }}
        >
          <header className="border-b px-5 py-6 sm:px-8" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-3 py-1 text-[11px] tracking-[0.16em]" style={{ background: status.color, color: status.fg }}>
                    {status.label}
                  </span>
                  <span className="text-[12px] opacity-55">참가자 관리</span>
                </div>
                <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{data.title}</h1>
                <p className="mt-2 text-[13px] opacity-60">현재 참여 인원 {data.joined}명 / 정원 {data.capacity}명</p>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2 text-[13px] disabled:opacity-45"
                style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.07)" }}
              >
                <RefreshCw size={14} /> 새로고침
              </button>
            </div>
          </header>

          <div className="px-5 py-5 sm:px-8">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[14px] font-medium">
                <Users size={16} /> 참가자 {data.totalElements}명
              </div>
              <span className="text-[12px] opacity-55">사용자 ID 순</span>
            </div>

            {actionError ? (
              <div
                className="mb-3 rounded-xl px-4 py-3 text-[13px]"
                style={{ background: "rgba(237,92,72,0.12)", color: dark ? "#f3b4ab" : "#b3402f" }}
              >
                {actionError}
              </div>
            ) : null}

            {data.participants.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-5 py-14 text-center text-[14px] opacity-65" style={{ borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.14)" }}>
                아직 참여자가 없습니다.
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
                {data.participants.map((participant) => (
                  <li key={participant.participantId} className="flex min-h-14 flex-col items-start justify-between gap-3 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <span className="min-w-0 truncate text-[14px] font-medium">{participant.name}</span>
                    <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
                      {participant.verified ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#7dd3a3]/20 px-2.5 py-1 text-[11px] text-[#2f9c68]">
                          <ShieldCheck size={12} /> 인증 사용자
                        </span>
                      ) : null}
                      {/* 퇴장은 모집 중(open)인 캠페인에서만. 처리 중인 행은 disabled. */}
                      {data.status === "open" ? (
                        <button
                          type="button"
                          onClick={() => removeParticipant(participant.participantId)}
                          disabled={removingId !== null}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                          style={{ background: "rgba(237,92,72,0.12)", color: dark ? "#f3b4ab" : "#b3402f" }}
                        >
                          <UserMinus size={13} /> {removingId === participant.participantId ? "처리 중…" : "퇴장"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Pagination
              page={data.page}
              totalPages={Math.max(1, data.totalPages)}
              totalElements={data.totalElements}
              className="mt-6 border-t pt-5"
              onPageChange={movePage}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
