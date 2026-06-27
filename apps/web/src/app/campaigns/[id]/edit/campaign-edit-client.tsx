"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPut, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import type { Campaign } from "@/data/campaigns";
import {
  CampaignForm,
  campaignToFormValues,
  type CampaignPayload,
} from "../../campaign-form";

type LoadState =
  | { identity: string; kind: "loading" }
  | { identity: string; kind: "ready"; campaign: Campaign }
  | { identity: string; kind: "notfound" }
  | { identity: string; kind: "forbidden" }
  | { identity: string; kind: "started" }
  | { identity: string; kind: "error" };

function PageState({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <section
      className="relative min-h-screen px-6 pb-20 pt-28 transition-colors"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div
        className="relative mx-auto flex min-h-72 max-w-2xl flex-col items-center justify-center gap-4 rounded-3xl border px-6 text-center"
        style={{
          background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
          color: dark ? "#f9f7f2" : "#0f1f22",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function CampaignEditClient({ id }: { id: string }) {
  const router = useRouter();
  const { token } = useAuthSession();
  const savingRef = useRef(false);
  const [retry, setRetry] = useState(0);
  const identity = `${id}:${token ?? "anonymous"}:${retry}`;
  const [loadState, setLoadState] = useState<LoadState>({ identity: "", kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const currentLoad: LoadState = loadState.identity === identity
    ? loadState
    : { identity, kind: "loading" };

  useEffect(() => {
    // hydration 시 useAuthSession의 server snapshot은 null일 수 있으므로 실제 저장소를 확인한다.
    const requestToken = getToken();
    if (!requestToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    const isCurrent = () => !cancelled && getToken() === requestToken;
    apiGet<Campaign>(`/api/campaigns/${id}`)
      .then((campaign) => {
        if (!isCurrent()) return;
        if (!campaign.ownedByMe) {
          setLoadState({ identity, kind: "forbidden" });
        } else if (campaign.status !== "upcoming") {
          setLoadState({ identity, kind: "started" });
        } else {
          setLoadState({ identity, kind: "ready", campaign });
        }
      })
      .catch((error) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          router.replace("/login");
        } else if (error instanceof ApiError && error.status === 404) {
          setLoadState({ identity, kind: "notfound" });
        } else if (error instanceof ApiError && error.status === 403) {
          setLoadState({ identity, kind: "forbidden" });
        } else {
          setLoadState({ identity, kind: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, identity, router]);

  const save = async (payload: CampaignPayload) => {
    if (savingRef.current) return;
    const requestToken = getToken();
    if (!requestToken) {
      clearSession();
      router.push("/login");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setRequestError("");
    try {
      const updated = await apiPut<Campaign>(`/api/campaigns/${id}`, payload);
      if (getToken() !== requestToken) return;
      router.replace(`/campaigns/${updated.id}`);
    } catch (error) {
      if (getToken() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        setRequestError("캠페인 수정 권한이 없습니다.");
      } else if (error instanceof ApiError && error.status === 409) {
        setRequestError("모집을 시작한 캠페인은 수정할 수 없습니다.");
      } else if (error instanceof ApiError && error.status === 400) {
        setRequestError("입력값을 확인해주세요.");
      } else {
        setRequestError("캠페인 수정에 실패했습니다.");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (currentLoad.kind === "loading") {
    return <PageState><p>캠페인을 불러오는 중입니다.</p></PageState>;
  }
  if (currentLoad.kind === "notfound") {
    return (
      <PageState>
        <p>캠페인을 찾을 수 없습니다.</p>
        <button type="button" onClick={() => router.push("/campaigns")} className="rounded-xl bg-[#7dd3a3] px-4 py-2 text-[13px] text-[#0f1f22]">
          캠페인 목록
        </button>
      </PageState>
    );
  }
  if (currentLoad.kind === "forbidden") {
    return (
      <PageState>
        <p>캠페인 수정 권한이 없습니다.</p>
        <button type="button" onClick={() => router.push(`/campaigns/${id}`)} className="rounded-xl bg-[#7dd3a3] px-4 py-2 text-[13px] text-[#0f1f22]">
          캠페인으로 돌아가기
        </button>
      </PageState>
    );
  }
  if (currentLoad.kind === "started") {
    return (
      <PageState>
        <p>모집 시작 전 캠페인만 수정할 수 있습니다.</p>
        <button type="button" onClick={() => router.push(`/campaigns/${id}`)} className="rounded-xl bg-[#7dd3a3] px-4 py-2 text-[13px] text-[#0f1f22]">
          캠페인으로 돌아가기
        </button>
      </PageState>
    );
  }
  if (currentLoad.kind === "error") {
    return (
      <PageState>
        <p>캠페인을 불러오지 못했습니다.</p>
        <button type="button" onClick={() => setRetry((current) => current + 1)} className="rounded-xl bg-[#7dd3a3] px-4 py-2 text-[13px] text-[#0f1f22]">
          다시 시도
        </button>
      </PageState>
    );
  }

  return (
    <CampaignForm
      initialValues={campaignToFormValues(currentLoad.campaign)}
      eyebrow="Edit Campaign"
      heading="캠페인 수정"
      submitLabel="변경사항 저장"
      submittingLabel="저장 중…"
      submitting={saving}
      requestError={requestError}
      backLabel="캠페인으로 돌아가기"
      onBack={() => router.push(`/campaigns/${id}`)}
      onSubmit={save}
    />
  );
}
