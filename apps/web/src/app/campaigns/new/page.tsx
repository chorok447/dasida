"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiPost, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import {
  CampaignComposeForm,
  CampaignComposeSubmitButton,
  useCampaignComposeDraft,
} from "@/components/campaign-compose-form";
import { FallbackImage } from "@/components/fallback-image";
import {
  DEFAULT_CAMPAIGN_COMPOSE_VALUES,
  statusMeta,
  type Campaign,
  type CampaignComposeField,
  type CampaignComposeValues,
  validateCampaignCompose,
} from "@/data/campaigns";

function draftHasContent(values: CampaignComposeValues): boolean {
  return (
    values.title.trim().length > 0 ||
    values.summary.trim().length > 0 ||
    values.body.trim().length > 0 ||
    values.thumb.trim().length > 0 ||
    values.capacity !== DEFAULT_CAMPAIGN_COMPOSE_VALUES.capacity ||
    values.recruitStart !== DEFAULT_CAMPAIGN_COMPOSE_VALUES.recruitStart ||
    values.recruitEnd !== DEFAULT_CAMPAIGN_COMPOSE_VALUES.recruitEnd ||
    values.runStart !== DEFAULT_CAMPAIGN_COMPOSE_VALUES.runStart ||
    values.runEnd !== DEFAULT_CAMPAIGN_COMPOSE_VALUES.runEnd
  );
}

export default function CampaignCreatePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const submittingRef = useRef(false);
  const restoredRef = useRef(false);

  const [values, setValues] = useState<CampaignComposeValues>(DEFAULT_CAMPAIGN_COMPOSE_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CampaignComposeField, string>>>({});

  const { draftSaved, clearDraft } = useCampaignComposeDraft(values, (draft) => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    setValues(draft);
  });

  useEffect(() => {
    if (!getToken()) {
      toast.error("로그인이 필요합니다.");
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!draftHasContent(values)) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [values]);

  const clearFieldError = (field: CampaignComposeField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async () => {
    if (submittingRef.current) return;

    const validation = validateCampaignCompose(values);
    if (!validation.ok) {
      toast.error(validation.message);
      if (validation.field) {
        setFieldErrors({ [validation.field]: validation.message });
      }
      return;
    }

    const requestToken = getToken();
    if (!requestToken) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFieldErrors({});

    try {
      const created = await apiPost<Campaign>("/api/campaigns", validation.payload);
      if (getToken() !== requestToken) return;
      clearDraft();
      toast.success("캠페인이 등록되었습니다.");
      router.replace(`/campaigns/${created.id}`);
    } catch (error) {
      if (getToken() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 400) {
        toast.error("입력값을 확인해주세요.");
      } else {
        toast.error("등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section
      className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 transition-colors"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute right-1/4 top-40 h-[500px] w-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/campaigns")}
          disabled={submitting}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 disabled:opacity-40"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} aria-hidden />
          캠페인 목록
        </button>

        <div className="mb-10 text-center">
          <p className="mb-3 uppercase tracking-[0.4em]" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            Create Campaign
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
            새 캠페인 개설
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div
            className="space-y-6 rounded-3xl border p-5 sm:p-8"
            style={{
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            }}
          >
            <CampaignComposeForm
              values={values}
              onChange={setValues}
              dark={dark}
              fieldErrors={fieldErrors}
              onFieldErrorClear={clearFieldError}
              showDraftSaved={draftSaved}
              disabled={submitting}
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push("/campaigns")}
                disabled={submitting}
                className="flex-1 rounded-xl py-3 disabled:opacity-40"
                style={{
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                  color: dark ? "#f9f7f2" : "#0f1f22",
                }}
              >
                취소
              </button>
              <CampaignComposeSubmitButton
                submitting={submitting}
                disabled={!values.title.trim()}
                onClick={submit}
                idleLabel="캠페인 등록"
                pendingLabel="캠페인 만드는 중…"
              />
            </div>
          </div>

          <div className="self-start lg:sticky lg:top-24">
            <p className="mb-3 text-[12px] uppercase tracking-[0.3em]" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
              미리보기
            </p>
            <div
              className="overflow-hidden rounded-2xl border shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]"
              style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
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
                    style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)" }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/60 via-transparent to-transparent" />
                <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] tracking-[0.2em]" style={{ background: statusMeta.upcoming.color, color: "#fff" }}>
                  모집예정
                </span>
              </div>
              <div className="space-y-3 p-5">
                <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: dark ? "#f9f7f2" : "#0f1f22", lineHeight: 1.25 }}>
                  {values.title || "캠페인 제목"}
                </h3>
                <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
                  {values.summary || "캠페인 한 줄 소개가 여기에 표시됩니다."}
                </p>
                <div className="space-y-1 border-t pt-2 text-[12px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
                  <div>모집 {values.recruitStart} ~ {values.recruitEnd}</div>
                  <div>진행 {values.runStart} ~ {values.runEnd}</div>
                  <div>모집 인원 {values.capacity || "—"}명</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
