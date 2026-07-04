"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useState } from "react";
import { Image as ImageIcon, Link2, Loader2, Plus, X } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { toast } from "sonner";
import { fashionPhotos, marketPhotos, naturePhotos, objectPhotos, workshopPhotos } from "@/data/photos";
import {
  CAMPAIGN_COMPOSE_DRAFT_KEY,
  CAMPAIGN_MAX_BODY_LENGTH,
  CAMPAIGN_MAX_CAPACITY,
  DEFAULT_CAMPAIGN_COMPOSE_VALUES,
  isValidCampaignImageUrl,
  type CampaignComposeField,
  type CampaignComposeValues,
} from "@/data/campaigns";

export { CAMPAIGN_COMPOSE_DRAFT_KEY };

const thumbPresets = [
  workshopPhotos[0],
  naturePhotos[1],
  fashionPhotos[0],
  objectPhotos[0],
  marketPhotos[1],
];

type CampaignComposeFormProps = {
  values: CampaignComposeValues;
  onChange: (values: CampaignComposeValues) => void;
  /** @deprecated 색상이 CSS 토큰으로 바뀌어 사용하지 않는다. 호출부 정리 후 제거 예정. */
  dark?: boolean;
  fieldErrors?: Partial<Record<CampaignComposeField, string>>;
  onFieldErrorClear?: (field: CampaignComposeField) => void;
  showDraftSaved?: boolean;
  disabled?: boolean;
  titleInputId?: string;
};

function ImagePreview({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-[10px]"
        style={{ background: "var(--border)" }}
        role="img"
        aria-label="이미지를 불러올 수 없어요"
      >
        <ImageIcon size={18} style={{ color: "var(--foreground-muted)" }} aria-hidden />
        <span style={{ color: "var(--foreground-muted)" }}>이미지를 불러올 수 없어요</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="캠페인 썸네일 미리보기"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function CampaignComposeForm({
  values,
  onChange,
  fieldErrors = {},
  onFieldErrorClear,
  showDraftSaved = false,
  disabled = false,
  titleInputId = "campaign-title",
}: CampaignComposeFormProps) {
  const summaryInputId = useId();
  const bodyInputId = useId();
  const thumbInputId = useId();
  const recruitStartInputId = useId();
  const recruitEndInputId = useId();
  const runStartInputId = useId();
  const runEndInputId = useId();
  const capacityInputId = useId();

  const [thumbInput, setThumbInput] = useState("");
  const [thumbInputError, setThumbInputError] = useState("");

  const labelStyle = { color: "var(--foreground-muted)" };
  const controlStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  };

  const patch = (partial: Partial<CampaignComposeValues>) => onChange({ ...values, ...partial });

  const addThumbUrl = () => {
    const raw = thumbInput.trim();
    if (!raw) return;

    if (!isValidCampaignImageUrl(raw)) {
      const message = "http:// 또는 https:// 로 시작하는 URL을 입력해주세요.";
      setThumbInputError(message);
      toast.error(message);
      return;
    }

    if (values.thumb.trim() === raw) {
      toast.error("이미 추가된 썸네일 URL입니다.");
      return;
    }

    patch({ thumb: raw });
    setThumbInput("");
    setThumbInputError("");
    onFieldErrorClear?.("thumb");
  };

  const removeThumb = () => {
    patch({ thumb: "" });
    onFieldErrorClear?.("thumb");
  };

  const titleErrorId = `${titleInputId}-error`;
  const summaryErrorId = `${summaryInputId}-error`;
  const bodyErrorId = `${bodyInputId}-error`;
  const thumbErrorId = `${thumbInputId}-error`;
  const recruitStartErrorId = `${recruitStartInputId}-error`;
  const recruitEndErrorId = `${recruitEndInputId}-error`;
  const runStartErrorId = `${runStartInputId}-error`;
  const runEndErrorId = `${runEndInputId}-error`;
  const capacityErrorId = `${capacityInputId}-error`;
  const dateHelperId = `${recruitStartInputId}-helper`;

  const thumbChoices = Array.from(new Set([values.thumb, ...thumbPresets].filter(Boolean)));

  return (
    <div className="space-y-6">
      {showDraftSaved ? (
        <p className="text-[12px]" style={{ color: "var(--accent-secondary)" }} role="status" aria-live="polite">
          임시 저장됨
        </p>
      ) : null}

      <div>
        <label htmlFor={titleInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          제목 <span className="sr-only">(필수)</span>
        </label>
        <input
          id={titleInputId}
          type="text"
          value={values.title}
          onChange={(e) => {
            patch({ title: e.target.value });
            onFieldErrorClear?.("title");
          }}
          placeholder="예) 한강공원 플로깅 데이"
          required
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? titleErrorId : undefined}
          className="ui-control w-full placeholder:opacity-50"
          style={controlStyle}
        />
        {fieldErrors.title ? (
          <p id={titleErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={summaryInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          한 줄 요약 <span className="normal-case tracking-normal opacity-70">(선택)</span>
        </label>
        <input
          id={summaryInputId}
          type="text"
          value={values.summary}
          onChange={(e) => {
            patch({ summary: e.target.value });
            onFieldErrorClear?.("summary");
          }}
          placeholder="짧게 캠페인을 소개해 주세요"
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.summary)}
          aria-describedby={fieldErrors.summary ? summaryErrorId : undefined}
          className="ui-control w-full placeholder:opacity-50"
          style={controlStyle}
        />
        {fieldErrors.summary ? (
          <p id={summaryErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
            {fieldErrors.summary}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={thumbInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          썸네일 URL <span className="normal-case tracking-normal opacity-70">(선택)</span>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Link2
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
              aria-hidden
            />
            <input
              id={thumbInputId}
              type="url"
              inputMode="url"
              value={thumbInput}
              onChange={(e) => {
                setThumbInput(e.target.value);
                if (thumbInputError) setThumbInputError("");
                onFieldErrorClear?.("thumb");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addThumbUrl();
                }
              }}
              placeholder="https://example.com/image.jpg"
              disabled={disabled || Boolean(values.thumb.trim())}
              aria-invalid={Boolean(fieldErrors.thumb || thumbInputError)}
              aria-describedby={fieldErrors.thumb || thumbInputError ? thumbErrorId : undefined}
              className="ui-control w-full rounded-xl py-2.5 pl-9 pr-3 text-[13px] placeholder:opacity-50"
              style={controlStyle}
            />
          </div>
          <button
            type="button"
            onClick={addThumbUrl}
            disabled={disabled || Boolean(values.thumb.trim())}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium disabled:opacity-40"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
            aria-label="썸네일 URL 추가"
          >
            <Plus size={14} aria-hidden />
            추가
          </button>
        </div>
        {(fieldErrors.thumb || thumbInputError) ? (
          <p id={thumbErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
            {fieldErrors.thumb ?? thumbInputError}
          </p>
        ) : null}

        {values.thumb.trim() ? (
          <ul className="mt-3 space-y-2" aria-label="추가된 썸네일 목록">
            <li
              className="flex items-center gap-3 rounded-xl p-2"
              style={{
                background: "var(--border)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                <ImagePreview src={values.thumb} />
              </div>
              <p className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--foreground)" }} title={values.thumb}>
                {values.thumb}
              </p>
              <button
                type="button"
                onClick={removeThumb}
                disabled={disabled}
                className="shrink-0 rounded-lg p-2 opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
                aria-label={`썸네일 URL 제거: ${values.thumb}`}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          </ul>
        ) : null}

        <div className="mt-3">
          <p className="mb-2 text-[11px] opacity-70" style={{ color: "var(--foreground)" }}>
            또는 추천 이미지 선택
          </p>
          <div className="grid grid-cols-5 gap-2">
            {thumbChoices.map((src) => (
              <button
                type="button"
                key={src}
                onClick={() => {
                  patch({ thumb: src });
                  onFieldErrorClear?.("thumb");
                }}
                disabled={disabled}
                className="aspect-square overflow-hidden rounded-lg border-2 disabled:opacity-60"
                style={{ borderColor: values.thumb === src ? "#7dd3a3" : "transparent" }}
                aria-label={values.thumb === src ? "선택된 썸네일" : "썸네일 이미지 선택"}
                aria-pressed={values.thumb === src}
              >
                <img src={src} alt="" aria-hidden className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          일정
        </p>
        <p id={dateHelperId} className="mb-3 text-[12px] opacity-70" style={{ color: "var(--foreground)" }}>
          모집 기간은 진행 시작일 이전에 끝나야 하며, 진행 기간은 모집 종료 이후에 시작합니다.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={recruitStartInputId} className="mb-2 block text-[12px] opacity-80" style={{ color: "var(--foreground)" }}>
              모집 시작일
            </label>
            <input
              id={recruitStartInputId}
              type="date"
              value={values.recruitStart}
              onChange={(e) => {
                patch({ recruitStart: e.target.value });
                onFieldErrorClear?.("recruitStart");
                onFieldErrorClear?.("recruitEnd");
              }}
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.recruitStart)}
              aria-describedby={
                fieldErrors.recruitStart ? recruitStartErrorId : dateHelperId
              }
              className="ui-control w-full"
              style={controlStyle}
            />
            {fieldErrors.recruitStart ? (
              <p id={recruitStartErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
                {fieldErrors.recruitStart}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={recruitEndInputId} className="mb-2 block text-[12px] opacity-80" style={{ color: "var(--foreground)" }}>
              모집 종료일
            </label>
            <input
              id={recruitEndInputId}
              type="date"
              value={values.recruitEnd}
              onChange={(e) => {
                patch({ recruitEnd: e.target.value });
                onFieldErrorClear?.("recruitEnd");
              }}
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.recruitEnd)}
              aria-describedby={fieldErrors.recruitEnd ? recruitEndErrorId : dateHelperId}
              className="ui-control w-full"
              style={controlStyle}
            />
            {fieldErrors.recruitEnd ? (
              <p id={recruitEndErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
                {fieldErrors.recruitEnd}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={runStartInputId} className="mb-2 block text-[12px] opacity-80" style={{ color: "var(--foreground)" }}>
              진행 시작일
            </label>
            <input
              id={runStartInputId}
              type="date"
              value={values.runStart}
              onChange={(e) => {
                patch({ runStart: e.target.value });
                onFieldErrorClear?.("runStart");
                onFieldErrorClear?.("recruitEnd");
              }}
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.runStart)}
              aria-describedby={fieldErrors.runStart ? runStartErrorId : dateHelperId}
              className="ui-control w-full"
              style={controlStyle}
            />
            {fieldErrors.runStart ? (
              <p id={runStartErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
                {fieldErrors.runStart}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={runEndInputId} className="mb-2 block text-[12px] opacity-80" style={{ color: "var(--foreground)" }}>
              진행 종료일
            </label>
            <input
              id={runEndInputId}
              type="date"
              value={values.runEnd}
              onChange={(e) => {
                patch({ runEnd: e.target.value });
                onFieldErrorClear?.("runEnd");
                onFieldErrorClear?.("recruitEnd");
              }}
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.runEnd)}
              aria-describedby={fieldErrors.runEnd ? runEndErrorId : dateHelperId}
              className="ui-control w-full"
              style={controlStyle}
            />
            {fieldErrors.runEnd ? (
              <p id={runEndErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
                {fieldErrors.runEnd}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={capacityInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          모집 인원 <span className="sr-only">(필수)</span>
        </label>
        <input
          id={capacityInputId}
          type="number"
          min={1}
          max={CAMPAIGN_MAX_CAPACITY}
          value={values.capacity}
          onChange={(e) => {
            patch({ capacity: e.target.value });
            onFieldErrorClear?.("capacity");
          }}
          placeholder="숫자"
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.capacity)}
          aria-describedby={fieldErrors.capacity ? capacityErrorId : undefined}
          className="ui-control w-full placeholder:opacity-50"
          style={controlStyle}
        />
        {fieldErrors.capacity ? (
          <p id={capacityErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
            {fieldErrors.capacity}
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
            모집 인원이 차면 자동으로 모집이 종료됩니다.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={bodyInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          본문 <span className="normal-case tracking-normal opacity-70">(선택)</span>
        </label>
        <RichTextEditor
          id={bodyInputId}
          value={values.body}
          onChange={(body) => {
            patch({ body });
            onFieldErrorClear?.("body");
          }}
          placeholder="캠페인의 배경과 진행 방식, 참여자에게 제공되는 것 등을 자세히 적어주세요."
          minHeight={200}
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.body)}
          aria-describedby={fieldErrors.body ? bodyErrorId : undefined}
          maxLength={CAMPAIGN_MAX_BODY_LENGTH}
        />
        {fieldErrors.body ? (
          <p id={bodyErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
            {fieldErrors.body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function useCampaignComposeDraft(
  values: CampaignComposeValues,
  onRestore: (draft: CampaignComposeValues) => void,
) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CAMPAIGN_COMPOSE_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<CampaignComposeValues>;
      if (!draft || typeof draft !== "object") return;
      onRestore({
        title: typeof draft.title === "string" ? draft.title : "",
        summary: typeof draft.summary === "string" ? draft.summary : "",
        body: typeof draft.body === "string" ? draft.body : "",
        thumb: typeof draft.thumb === "string" ? draft.thumb : "",
        recruitStart: typeof draft.recruitStart === "string" ? draft.recruitStart : DEFAULT_CAMPAIGN_COMPOSE_VALUES.recruitStart,
        recruitEnd: typeof draft.recruitEnd === "string" ? draft.recruitEnd : DEFAULT_CAMPAIGN_COMPOSE_VALUES.recruitEnd,
        runStart: typeof draft.runStart === "string" ? draft.runStart : DEFAULT_CAMPAIGN_COMPOSE_VALUES.runStart,
        runEnd: typeof draft.runEnd === "string" ? draft.runEnd : DEFAULT_CAMPAIGN_COMPOSE_VALUES.runEnd,
        capacity: typeof draft.capacity === "string" ? draft.capacity : DEFAULT_CAMPAIGN_COMPOSE_VALUES.capacity,
      });
    } catch {
      // ignore corrupt draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, []);

  useEffect(() => {
    if (!campaignComposeDraftHasContent(values)) {
      localStorage.removeItem(CAMPAIGN_COMPOSE_DRAFT_KEY);
      return;
    }
    localStorage.setItem(CAMPAIGN_COMPOSE_DRAFT_KEY, JSON.stringify(values));
  }, [values]);

  const draftSaved = campaignComposeDraftHasContent(values);

  const clearDraft = () => {
    localStorage.removeItem(CAMPAIGN_COMPOSE_DRAFT_KEY);
  };

  return { draftSaved, clearDraft };
}

function campaignComposeDraftHasContent(values: CampaignComposeValues): boolean {
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

type SubmitButtonProps = {
  submitting: boolean;
  disabled: boolean;
  onClick: () => void;
  idleLabel: string;
  pendingLabel: string;
};

export function CampaignComposeSubmitButton({
  submitting,
  disabled,
  onClick,
  idleLabel,
  pendingLabel,
}: SubmitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || submitting}
      aria-busy={submitting}
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-medium disabled:opacity-40"
      style={{ background: "#7dd3a3", color: "#0f1f22" }}
    >
      {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
      {submitting ? pendingLabel : idleLabel}
    </button>
  );
}
