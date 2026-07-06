"use client";

import { useEffect, useId } from "react";
import { Loader2 } from "lucide-react";
import { CampaignComposeBody } from "@/components/campaign-compose-body";
import { CampaignComposeSchedule } from "@/components/campaign-compose-schedule";
import { CampaignComposeThumb } from "@/components/campaign-compose-thumb";
import {
  CAMPAIGN_COMPOSE_DRAFT_KEY,
  DEFAULT_CAMPAIGN_COMPOSE_VALUES,
  type CampaignComposeField,
  type CampaignComposeValues,
} from "@/data/campaigns";

export { CAMPAIGN_COMPOSE_DRAFT_KEY };

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

  const labelStyle = { color: "var(--foreground-muted)" };
  const controlStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  };

  const patch = (partial: Partial<CampaignComposeValues>) => onChange({ ...values, ...partial });

  const titleErrorId = `${titleInputId}-error`;
  const summaryErrorId = `${summaryInputId}-error`;

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

      <CampaignComposeThumb
        thumb={values.thumb}
        disabled={disabled}
        fieldError={fieldErrors.thumb}
        onFieldErrorClear={() => onFieldErrorClear?.("thumb")}
        onThumbChange={(thumb) => patch({ thumb })}
      />

      <CampaignComposeSchedule
        recruitStart={values.recruitStart}
        recruitEnd={values.recruitEnd}
        runStart={values.runStart}
        runEnd={values.runEnd}
        capacity={values.capacity}
        fieldErrors={fieldErrors}
        disabled={disabled}
        onFieldErrorClear={onFieldErrorClear}
        onChange={(partial) => patch(partial)}
      />

      <CampaignComposeBody
        body={values.body}
        fieldError={fieldErrors.body}
        disabled={disabled}
        onFieldErrorClear={() => onFieldErrorClear?.("body")}
        onBodyChange={(body) => patch({ body })}
      />
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
