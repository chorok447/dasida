"use client";
/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Calendar, FileText, Layers, Send, Users } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { fashionPhotos, marketPhotos, naturePhotos, objectPhotos, workshopPhotos } from "@/data/photos";
import { statusMeta, type Campaign } from "@/data/campaigns";

export const MAX_CAMPAIGN_CAPACITY = 10_000;

export type CampaignFormValues = {
  title: string;
  summary: string;
  body: string;
  thumb: string;
  recruitStart: string;
  recruitEnd: string;
  runStart: string;
  runEnd: string;
  capacity: string;
};

export type CampaignPayload = Omit<CampaignFormValues, "capacity"> & { capacity: number };

const defaultThumbChoices = [
  workshopPhotos[0],
  naturePhotos[1],
  fashionPhotos[0],
  objectPhotos[0],
  marketPhotos[1],
];

export const DEFAULT_CAMPAIGN_FORM_VALUES: CampaignFormValues = {
  title: "",
  summary: "",
  body: "",
  thumb: defaultThumbChoices[0],
  recruitStart: "2026-07-01",
  recruitEnd: "2026-07-31",
  runStart: "2026-08-05",
  runEnd: "2026-08-30",
  capacity: "30",
};

export function campaignToFormValues(campaign: Campaign): CampaignFormValues {
  return {
    title: campaign.title,
    summary: campaign.summary,
    body: campaign.body.paragraphs.join("\n\n"),
    thumb: campaign.thumb,
    recruitStart: campaign.recruitStart,
    recruitEnd: campaign.recruitEnd,
    runStart: campaign.runStart,
    runEnd: campaign.runEnd,
    capacity: String(campaign.capacity),
  };
}

type ValidationResult =
  | { ok: true; payload: CampaignPayload }
  | { ok: false; message: string };

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateCampaignForm(values: CampaignFormValues): ValidationResult {
  const title = values.title.trim();
  if (!title) return { ok: false, message: "캠페인 제목을 입력해주세요." };

  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { ok: false, message: "모집 인원은 1 이상의 정수여야 합니다." };
  }
  if (capacity > MAX_CAMPAIGN_CAPACITY) {
    return { ok: false, message: `모집 인원은 ${MAX_CAMPAIGN_CAPACITY.toLocaleString()}명 이하여야 합니다.` };
  }

  const dates = [values.recruitStart, values.recruitEnd, values.runStart, values.runEnd];
  if (!dates.every(isIsoDate)) {
    return { ok: false, message: "모든 날짜를 yyyy-MM-dd 형식으로 입력해주세요." };
  }
  if (values.recruitStart > values.recruitEnd) {
    return { ok: false, message: "모집 시작일은 모집 종료일보다 늦을 수 없습니다." };
  }
  if (values.runStart > values.runEnd) {
    return { ok: false, message: "진행 시작일은 진행 종료일보다 늦을 수 없습니다." };
  }

  return {
    ok: true,
    payload: {
      title,
      summary: values.summary.trim(),
      body: values.body.trim(),
      thumb: values.thumb.trim(),
      recruitStart: values.recruitStart,
      recruitEnd: values.recruitEnd,
      runStart: values.runStart,
      runEnd: values.runEnd,
      capacity,
    },
  };
}

const steps = [
  { id: 0, label: "기본 정보", icon: <FileText size={14} /> },
  { id: 1, label: "일정", icon: <Calendar size={14} /> },
  { id: 2, label: "모집", icon: <Users size={14} /> },
  { id: 3, label: "내용", icon: <Layers size={14} /> },
];

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled: boolean;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-xl px-4 py-3 outline-none placeholder:opacity-50 disabled:opacity-60"
      style={{
        background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
        border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
        color: dark ? "#f9f7f2" : "#0f1f22",
      }}
    />
  );
}

type CampaignFormProps = {
  initialValues: CampaignFormValues;
  eyebrow: string;
  heading: string;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  requestError?: string;
  backLabel: string;
  onBack: () => void;
  onSubmit: (payload: CampaignPayload) => void;
};

export function CampaignForm({
  initialValues,
  eyebrow,
  heading,
  submitLabel,
  submittingLabel,
  submitting,
  requestError,
  backLabel,
  onBack,
  onSubmit,
}: CampaignFormProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [validationError, setValidationError] = useState("");
  const thumbChoices = useMemo(
    () => Array.from(new Set([initialValues.thumb, ...defaultThumbChoices].filter(Boolean))),
    [initialValues.thumb],
  );
  const validation = validateCampaignForm(values);

  const setField = (field: keyof CampaignFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setValidationError("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const result = validateCampaignForm(values);
    if (!result.ok) {
      setValidationError(result.message);
      return;
    }
    setValidationError("");
    onSubmit(result.payload);
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
          onClick={onBack}
          disabled={submitting}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 disabled:opacity-40"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} /> {backLabel}
        </button>

        <div className="mb-10 text-center">
          <p className="mb-3 uppercase tracking-[0.4em]" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            {eyebrow}
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
            {heading}
          </h1>
        </div>

        <div className="mb-10 flex justify-center overflow-x-auto">
          <div className="flex gap-1 rounded-full p-1" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
            {steps.map((item) => {
              const active = step === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setStep(item.id)}
                  disabled={submitting}
                  className="relative inline-flex whitespace-nowrap rounded-full px-5 py-2 text-[13px] disabled:opacity-50"
                  style={{ color: active ? "#0f1f22" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
                >
                  {active ? <motion.div layoutId="campaign-form-step" className="absolute inset-0 rounded-full" style={{ background: "#7dd3a3" }} /> : null}
                  <span className="relative inline-flex items-center gap-2">{item.icon} {item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <form
            onSubmit={submit}
            className="space-y-5 rounded-3xl border p-8"
            style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
          >
            {step === 0 ? (
              <>
                <div>
                  <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>제목</label>
                  <Input value={values.title} onChange={(value) => setField("title", value)} placeholder="예) 한강공원 플로깅 데이" disabled={submitting} />
                </div>
                <div>
                  <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>한 줄 요약</label>
                  <Input value={values.summary} onChange={(value) => setField("summary", value)} placeholder="짧게 캠페인을 소개해 주세요" disabled={submitting} />
                </div>
                <div>
                  <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>썸네일</label>
                  <div className="grid grid-cols-5 gap-2">
                    {thumbChoices.map((src) => (
                      <button
                        type="button"
                        key={src}
                        onClick={() => setField("thumb", src)}
                        disabled={submitting}
                        className="aspect-square overflow-hidden rounded-lg border-2 disabled:opacity-60"
                        style={{ borderColor: values.thumb === src ? "#7dd3a3" : "transparent" }}
                        aria-label="캠페인 썸네일 선택"
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>모집 시작</label>
                    <Input value={values.recruitStart} onChange={(value) => setField("recruitStart", value)} type="date" disabled={submitting} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>모집 종료</label>
                    <Input value={values.recruitEnd} onChange={(value) => setField("recruitEnd", value)} type="date" disabled={submitting} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>진행 시작</label>
                    <Input value={values.runStart} onChange={(value) => setField("runStart", value)} type="date" disabled={submitting} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>진행 종료</label>
                    <Input value={values.runEnd} onChange={(value) => setField("runEnd", value)} type="date" disabled={submitting} />
                  </div>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div>
                  <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>모집 인원</label>
                  <Input value={values.capacity} onChange={(value) => setField("capacity", value)} placeholder="숫자" type="number" disabled={submitting} />
                  {values.capacity !== "" && (!validation.ok && validation.message.includes("모집 인원")) ? (
                    <p className="mt-1.5 text-[12px]" style={{ color: "#ed5c48" }}>{validation.message}</p>
                  ) : null}
                </div>
                <p className="text-[13px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  모집 인원이 차면 자동으로 모집이 종료됩니다.
                </p>
              </>
            ) : null}

            {step === 3 ? (
              <div>
                <label className="mb-2 block text-[12px] uppercase tracking-[0.2em] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>본문</label>
                <textarea
                  value={values.body}
                  onChange={(event) => setField("body", event.target.value)}
                  rows={10}
                  disabled={submitting}
                  placeholder="캠페인의 배경과 진행 방식, 참여자에게 제공되는 것 등을 자세히 적어주세요."
                  className="w-full resize-none rounded-xl px-4 py-3 outline-none placeholder:opacity-50 disabled:opacity-60"
                  style={{
                    background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
                    border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
                    color: dark ? "#f9f7f2" : "#0f1f22",
                  }}
                />
              </div>
            ) : null}

            {validationError || requestError ? (
              <p role="alert" className="text-[13px]" style={{ color: "#ed5c48" }}>
                {validationError || requestError}
              </p>
            ) : null}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0 || submitting}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 disabled:opacity-30"
                style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}
              >
                <ArrowLeft size={14} /> 이전
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.min(3, current + 1))}
                  disabled={submitting}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium disabled:opacity-40"
                  style={{ background: "#7dd3a3", color: "#0f1f22" }}
                >
                  다음 <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !validation.ok}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium disabled:opacity-40"
                  style={{ background: "#7dd3a3", color: "#0f1f22" }}
                >
                  <Send size={14} /> {submitting ? submittingLabel : submitLabel}
                </button>
              )}
            </div>
          </form>

          <div className="self-start lg:sticky lg:top-24">
            <p className="mb-3 text-[12px] uppercase tracking-[0.3em]" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
              미리보기
            </p>
            <div
              className="overflow-hidden rounded-2xl border shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]"
              style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {values.thumb ? <img src={values.thumb} alt="" className="h-full w-full object-cover" /> : null}
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
                  <div>모집 인원 {values.capacity}명</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
