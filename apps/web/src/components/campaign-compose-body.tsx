"use client";

import { useId } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { CAMPAIGN_MAX_BODY_LENGTH } from "@/data/campaigns";

export function CampaignComposeBody({
  body,
  fieldError,
  disabled = false,
  onFieldErrorClear,
  onBodyChange,
}: {
  body: string;
  fieldError?: string;
  disabled?: boolean;
  onFieldErrorClear?: () => void;
  onBodyChange: (body: string) => void;
}) {
  const bodyInputId = useId();
  const bodyErrorId = `${bodyInputId}-error`;
  const labelStyle = { color: "var(--foreground-muted)" };

  return (
    <div>
      <label htmlFor={bodyInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
        본문 <span className="normal-case tracking-normal opacity-70">(선택)</span>
      </label>
      <RichTextEditor
        id={bodyInputId}
        value={body}
        onChange={(next) => {
          onBodyChange(next);
          onFieldErrorClear?.();
        }}
        placeholder="캠페인의 배경과 진행 방식, 참여자에게 제공되는 것 등을 자세히 적어주세요."
        minHeight={200}
        disabled={disabled}
        aria-invalid={Boolean(fieldError)}
        aria-describedby={fieldError ? bodyErrorId : undefined}
        maxLength={CAMPAIGN_MAX_BODY_LENGTH}
      />
      {fieldError ? (
        <p id={bodyErrorId} className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}
