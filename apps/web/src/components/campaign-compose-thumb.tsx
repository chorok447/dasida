"use client";
/* eslint-disable @next/next/no-img-element */

import { useId, useState } from "react";
import { Image as ImageIcon, Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ImageFileUploadButton } from "@/components/image-file-upload-button";
import { fashionPhotos, marketPhotos, naturePhotos, objectPhotos, workshopPhotos } from "@/data/photos";
import { isValidCampaignImageUrl } from "@/data/campaigns";

const thumbPresets = [
  workshopPhotos[0],
  naturePhotos[1],
  fashionPhotos[0],
  objectPhotos[0],
  marketPhotos[1],
];

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

export function CampaignComposeThumb({
  thumb,
  disabled = false,
  fieldError,
  onFieldErrorClear,
  onThumbChange,
}: {
  thumb: string;
  disabled?: boolean;
  fieldError?: string;
  onFieldErrorClear?: () => void;
  onThumbChange: (thumb: string) => void;
}) {
  const thumbInputId = useId();
  const thumbErrorId = `${thumbInputId}-error`;
  const [thumbInput, setThumbInput] = useState("");
  const [thumbInputError, setThumbInputError] = useState("");

  const labelStyle = { color: "var(--foreground-muted)" };
  const controlStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  };

  const addThumbUrl = () => {
    const raw = thumbInput.trim();
    if (!raw) return;

    if (!isValidCampaignImageUrl(raw)) {
      const message = "http:// 또는 https:// 로 시작하는 URL을 입력해주세요.";
      setThumbInputError(message);
      toast.error(message);
      return;
    }

    if (thumb.trim() === raw) {
      toast.error("이미 추가된 썸네일 URL입니다.");
      return;
    }

    onThumbChange(raw);
    setThumbInput("");
    setThumbInputError("");
    onFieldErrorClear?.();
  };

  const addUploadedThumb = (url: string) => {
    if (thumb.trim() === url) {
      toast.error("이미 추가된 썸네일입니다.");
      return;
    }
    onThumbChange(url);
    setThumbInput("");
    setThumbInputError("");
    onFieldErrorClear?.();
  };

  const thumbChoices = Array.from(new Set([thumb, ...thumbPresets].filter(Boolean)));

  return (
    <div>
      <label htmlFor={thumbInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
        썸네일 <span className="normal-case tracking-normal opacity-70">(URL 또는 파일, 선택)</span>
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
              onFieldErrorClear?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addThumbUrl();
              }
            }}
            placeholder="https://example.com/image.jpg"
            disabled={disabled || Boolean(thumb.trim())}
            aria-invalid={Boolean(fieldError || thumbInputError)}
            aria-describedby={fieldError || thumbInputError ? thumbErrorId : undefined}
            className="ui-control w-full rounded-xl py-2.5 pl-9 pr-3 text-[13px] placeholder:opacity-50"
            style={controlStyle}
          />
        </div>
        <button
          type="button"
          onClick={addThumbUrl}
          disabled={disabled || Boolean(thumb.trim())}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium disabled:opacity-40"
          style={{ background: "#7dd3a3", color: "#0f1f22" }}
          aria-label="썸네일 URL 추가"
        >
          <Plus size={14} aria-hidden />
          추가
        </button>
        <ImageFileUploadButton
          disabled={disabled || Boolean(thumb.trim())}
          onUploaded={addUploadedThumb}
        />
      </div>
      {(fieldError || thumbInputError) ? (
        <p id={thumbErrorId} className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">
          {fieldError ?? thumbInputError}
        </p>
      ) : null}

      {thumb.trim() ? (
        <ul className="mt-3 space-y-2" aria-label="추가된 썸네일 목록">
          <li
            className="flex items-center gap-3 rounded-xl p-2"
            style={{
              background: "var(--border)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
              <ImagePreview src={thumb} />
            </div>
            <p className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--foreground)" }} title={thumb}>
              {thumb}
            </p>
            <button
              type="button"
              onClick={() => {
                onThumbChange("");
                onFieldErrorClear?.();
              }}
              disabled={disabled}
              className="shrink-0 rounded-lg p-2 opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
              aria-label={`썸네일 URL 제거: ${thumb}`}
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
                onThumbChange(src);
                onFieldErrorClear?.();
              }}
              disabled={disabled}
              className="aspect-square overflow-hidden rounded-lg border-2 disabled:opacity-60"
              style={{ borderColor: thumb === src ? "#7dd3a3" : "transparent" }}
              aria-label={thumb === src ? "선택된 썸네일" : "썸네일 이미지 선택"}
              aria-pressed={thumb === src}
            >
              <img src={src} alt="" aria-hidden className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
