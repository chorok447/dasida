"use client";

import { useId } from "react";
import { CAMPAIGN_MAX_CAPACITY, type CampaignComposeField } from "@/data/campaigns";

const controlStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
};

export function CampaignComposeSchedule({
  recruitStart,
  recruitEnd,
  runStart,
  runEnd,
  capacity,
  fieldErrors = {},
  disabled = false,
  onFieldErrorClear,
  onChange,
}: {
  recruitStart: string;
  recruitEnd: string;
  runStart: string;
  runEnd: string;
  capacity: string;
  fieldErrors?: Partial<Record<CampaignComposeField, string>>;
  disabled?: boolean;
  onFieldErrorClear?: (field: CampaignComposeField) => void;
  onChange: (partial: {
    recruitStart?: string;
    recruitEnd?: string;
    runStart?: string;
    runEnd?: string;
    capacity?: string;
  }) => void;
}) {
  const recruitStartInputId = useId();
  const recruitEndInputId = useId();
  const runStartInputId = useId();
  const runEndInputId = useId();
  const capacityInputId = useId();
  const labelStyle = { color: "var(--foreground-muted)" };

  const recruitStartErrorId = `${recruitStartInputId}-error`;
  const recruitEndErrorId = `${recruitEndInputId}-error`;
  const runStartErrorId = `${runStartInputId}-error`;
  const runEndErrorId = `${runEndInputId}-error`;
  const capacityErrorId = `${capacityInputId}-error`;
  const dateHelperId = `${recruitStartInputId}-helper`;

  return (
    <>
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
              value={recruitStart}
              onChange={(e) => {
                onChange({ recruitStart: e.target.value });
                onFieldErrorClear?.("recruitStart");
                onFieldErrorClear?.("recruitEnd");
              }}
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.recruitStart)}
              aria-describedby={fieldErrors.recruitStart ? recruitStartErrorId : dateHelperId}
              className="ui-control w-full"
              style={controlStyle}
            />
            {fieldErrors.recruitStart ? (
              <p id={recruitStartErrorId} className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">
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
              value={recruitEnd}
              onChange={(e) => {
                onChange({ recruitEnd: e.target.value });
                onFieldErrorClear?.("recruitEnd");
              }}
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.recruitEnd)}
              aria-describedby={fieldErrors.recruitEnd ? recruitEndErrorId : dateHelperId}
              className="ui-control w-full"
              style={controlStyle}
            />
            {fieldErrors.recruitEnd ? (
              <p id={recruitEndErrorId} className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">
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
              value={runStart}
              onChange={(e) => {
                onChange({ runStart: e.target.value });
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
              <p id={runStartErrorId} className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">
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
              value={runEnd}
              onChange={(e) => {
                onChange({ runEnd: e.target.value });
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
              <p id={runEndErrorId} className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">
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
          value={capacity}
          onChange={(e) => {
            onChange({ capacity: e.target.value });
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
          <p id={capacityErrorId} className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">
            {fieldErrors.capacity}
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
            모집 인원이 차면 자동으로 모집이 종료됩니다.
          </p>
        )}
      </div>
    </>
  );
}
