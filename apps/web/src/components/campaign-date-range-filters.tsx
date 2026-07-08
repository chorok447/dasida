"use client";

import {
  campaignDateRangeError,
  hasCampaignDateRangeFilters,
  type CampaignDateRangeField,
  type CampaignDateRangeFilters,
} from "@/data/campaigns";

function DateRangeGroup({
  label,
  from,
  to,
  fromField,
  toField,
  disabled,
  dark,
  onChange,
}: {
  label: string;
  from: string;
  to: string;
  fromField: CampaignDateRangeField;
  toField: CampaignDateRangeField;
  disabled: boolean;
  dark: boolean;
  onChange: (field: CampaignDateRangeField, value: string) => void;
}) {
  const inputStyle = {
    color: "var(--foreground)",
    background: dark ? "#1c4044" : "#ffffff",
    borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(28,64,68,0.12)",
  };

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-[12px] font-medium opacity-70">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="min-w-0 text-[11px] opacity-70">
          시작일
          <input
            type="date"
            value={from}
            onChange={(event) => onChange(fromField, event.target.value)}
            disabled={disabled}
            className="ui-control mt-1 px-3 py-2 text-[13px]"
            style={inputStyle}
          />
        </label>
        <label className="min-w-0 text-[11px] opacity-70">
          종료일
          <input
            type="date"
            value={to}
            onChange={(event) => onChange(toField, event.target.value)}
            disabled={disabled}
            className="ui-control mt-1 px-3 py-2 text-[13px]"
            style={inputStyle}
          />
        </label>
      </div>
    </fieldset>
  );
}

export function CampaignDateRangeFilterControls({
  value,
  disabled = false,
  dark,
  onChange,
  onClear,
}: {
  value: CampaignDateRangeFilters;
  disabled?: boolean;
  dark: boolean;
  onChange: (field: CampaignDateRangeField, value: string) => void;
  onClear: () => void;
}) {
  const validationError = campaignDateRangeError(value);
  const hasFilters = hasCampaignDateRangeFilters(value);

  return (
    <div
      className="space-y-3 rounded-2xl border p-4"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium">기간 필터</p>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || !hasFilters}
          className="text-[12px] text-[#148a90] disabled:cursor-not-allowed disabled:opacity-40"
        >
          필터 초기화
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DateRangeGroup
          label="모집 마감일"
          from={value.recruitEndFrom}
          to={value.recruitEndTo}
          fromField="recruitEndFrom"
          toField="recruitEndTo"
          disabled={disabled}
          dark={dark}
          onChange={onChange}
        />
        <DateRangeGroup
          label="진행 시작일"
          from={value.runStartFrom}
          to={value.runStartTo}
          fromField="runStartFrom"
          toField="runStartTo"
          disabled={disabled}
          dark={dark}
          onChange={onChange}
        />
      </div>
      {validationError ? <p className="text-[12px] text-[#ed5c48]">{validationError}</p> : null}
    </div>
  );
}
