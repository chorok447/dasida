"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiGet, apiPut, ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useTheme } from "@/lib/theme-context";
import { StatePanel } from "@/components/ui/state-panel";
import {
  CampaignComposeForm,
  CampaignComposeSubmitButton,
} from "@/components/campaign-compose-form";
import { FallbackImage } from "@/components/fallback-image";
import {
  campaignToComposeValues,
  statusMeta,
  type Campaign,
  type CampaignComposeField,
  type CampaignComposeValues,
  validateCampaignCompose,
} from "@/data/campaigns";
import { PageShell } from "@/components/page-shell";

type LoadState =
  | { identity: string; kind: "loading" }
  | { identity: string; kind: "ready"; campaign: Campaign; initialValues: CampaignComposeValues }
  | { identity: string; kind: "notfound" }
  | { identity: string; kind: "forbidden" }
  | { identity: string; kind: "started" }
  | { identity: string; kind: "error" };

function PageState({ children }: { children: React.ReactNode }) {
  return (
    <PageShell paddingClassName="relative min-h-screen px-6 pb-20 pt-28" orb="none">
      <StatePanel className="relative mx-auto min-h-72 max-w-2xl">
        {children}
      </StatePanel>
    </PageShell>
  );
}

function composeValuesChanged(a: CampaignComposeValues, b: CampaignComposeValues): boolean {
  return (
    a.title !== b.title ||
    a.summary !== b.summary ||
    a.body !== b.body ||
    a.thumb !== b.thumb ||
    a.recruitStart !== b.recruitStart ||
    a.recruitEnd !== b.recruitEnd ||
    a.runStart !== b.runStart ||
    a.runEnd !== b.runEnd ||
    a.capacity !== b.capacity
  );
}

export default function CampaignEditClient({ id }: { id: string }) {
  const router = useRouter();
  const { sessionId: token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const savingRef = useRef(false);
  const [retry, setRetry] = useState(0);
  const identity = `${id}:${token ?? "anonymous"}:${retry}`;
  const [loadState, setLoadState] = useState<LoadState>({ identity: "", kind: "loading" });
  const [values, setValues] = useState<CampaignComposeValues | null>(null);
  const [initialValues, setInitialValues] = useState<CampaignComposeValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CampaignComposeField, string>>>({});

  const currentLoad: LoadState = loadState.identity === identity
    ? loadState
    : { identity, kind: "loading" };

  useEffect(() => {
    const requestToken = getSessionId();
    if (!requestToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    const isCurrent = () => !cancelled && getSessionId() === requestToken;
    apiGet<Campaign>(`/api/campaigns/${id}`)
      .then((campaign) => {
        if (!isCurrent()) return;
        if (!campaign.ownedByMe) {
          setLoadState({ identity, kind: "forbidden" });
        } else if (campaign.status !== "upcoming") {
          setLoadState({ identity, kind: "started" });
        } else {
          const formValues = campaignToComposeValues(campaign);
          setValues(formValues);
          setInitialValues(formValues);
          setLoadState({ identity, kind: "ready", campaign, initialValues: formValues });
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

  useEffect(() => {
    if (currentLoad.kind !== "ready" || !values || !initialValues) return;
    if (!composeValuesChanged(values, initialValues)) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [currentLoad.kind, values, initialValues]);

  const clearFieldError = (field: CampaignComposeField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const save = async () => {
    if (savingRef.current || !values) return;

    const validation = validateCampaignCompose(values);
    if (!validation.ok) {
      toast.error(validation.message);
      if (validation.field) {
        setFieldErrors({ [validation.field]: validation.message });
      }
      return;
    }

    const requestToken = getSessionId();
    if (!requestToken) {
      clearSession();
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFieldErrors({});

    try {
      const updated = await apiPut<Campaign>(`/api/campaigns/${id}`, validation.payload);
      if (getSessionId() !== requestToken) return;
      toast.success("캠페인이 수정되었습니다.");
      router.replace(`/campaigns/${updated.id}`);
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("캠페인 수정 권한이 없습니다.");
      } else if (error instanceof ApiError && error.status === 409) {
        toast.error("모집을 시작한 캠페인은 수정할 수 없습니다.");
      } else if (error instanceof ApiError && error.status === 400) {
        toast.error("입력값을 확인해주세요.");
      } else {
        toast.error("캠페인 수정에 실패했습니다.");
      }
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

  if (!values) return null;

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden px-6 pb-20 pt-28" orb="right">
      <div className="relative mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push(`/campaigns/${id}`)}
          disabled={saving}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 disabled:opacity-40"
          style={{ color: "var(--foreground)" }}
        >
          <ArrowLeft size={14} aria-hidden />
          캠페인으로 돌아가기
        </button>

        <div className="mb-10 text-center">
          <p className="mb-3 uppercase tracking-[0.4em]" style={{ color: "var(--accent-secondary)", fontSize: 11 }}>
            Edit Campaign
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: "var(--foreground)" }}>
            캠페인 수정
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div
            className="space-y-6 rounded-3xl border p-5 sm:p-8"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <CampaignComposeForm
              values={values}
              onChange={setValues}
              dark={dark}
              fieldErrors={fieldErrors}
              onFieldErrorClear={clearFieldError}
              disabled={saving}
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push(`/campaigns/${id}`)}
                disabled={saving}
                className="flex-1 rounded-xl py-3 disabled:opacity-40"
                style={{
                  background: "rgba(var(--ink-rgb), 0.06)",
                  color: "var(--foreground)",
                }}
              >
                취소
              </button>
              <CampaignComposeSubmitButton
                submitting={saving}
                disabled={!values.title.trim()}
                onClick={save}
                idleLabel="변경사항 저장"
                pendingLabel="저장 중…"
              />
            </div>
          </div>

          <div className="self-start lg:sticky lg:top-24">
            <p className="mb-3 text-[12px] uppercase tracking-[0.3em]" style={{ color: "rgba(var(--ink-rgb), 0.5)" }}>
              미리보기
            </p>
            <div
              className="overflow-hidden rounded-2xl border shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {values.thumb ? (
                  <FallbackImage
                    src={values.thumb}
                    alt="캠페인 썸네일 미리보기"
                    dark={dark}
                    errorText="이미지를 불러올 수 없어요"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: "rgba(var(--ink-rgb), 0.04)" }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/60 via-transparent to-transparent" />
                <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] tracking-[0.2em]" style={{ background: statusMeta.upcoming.color, color: "#fff" }}>
                  모집예정
                </span>
              </div>
              <div className="space-y-3 p-5">
                <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: "var(--foreground)", lineHeight: 1.25 }}>
                  {values.title || "캠페인 제목"}
                </h3>
                <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
                  {values.summary || "캠페인 한 줄 소개가 여기에 표시됩니다."}
                </p>
                <div className="space-y-1 border-t pt-2 text-[12px]" style={{ color: "rgba(var(--ink-rgb), 0.7)", borderColor: "var(--border)" }}>
                  <div>모집 {values.recruitStart} ~ {values.recruitEnd}</div>
                  <div>진행 {values.runStart} ~ {values.runEnd}</div>
                  <div>모집 인원 {values.capacity || "—"}명</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
