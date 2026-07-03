"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useState } from "react";
import { Image as ImageIcon, Link2, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  isValidPostImageUrl,
  normalizePostTags,
  POST_MAX_IMAGES,
  POST_MAX_TAG_LENGTH,
  POST_MAX_TAGS,
  POST_MAX_TEXT_LENGTH,
  type PostComposeField,
  type PostComposeValues,
} from "@/data/posts";

export const POST_COMPOSE_DRAFT_KEY = "dasida:post-compose-draft";

type PostComposeFormProps = {
  values: PostComposeValues;
  onChange: (values: PostComposeValues) => void;
  campaigns: { id: string; title: string }[];
  dark: boolean;
  fieldErrors?: Partial<Record<PostComposeField, string>>;
  onFieldErrorClear?: (field: PostComposeField) => void;
  textInputId?: string;
  campaignInputId?: string;
  showDraftSaved?: boolean;
};

function ImagePreview({ src, dark }: { src: string; dark: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}
      >
        <ImageIcon size={20} style={{ color: dark ? "rgba(255,255,255,0.35)" : "rgba(28,64,68,0.35)" }} aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function PostComposeForm({
  values,
  onChange,
  campaigns,
  dark,
  fieldErrors = {},
  onFieldErrorClear,
  textInputId = "post-text",
  campaignInputId = "post-campaign",
  showDraftSaved = false,
}: PostComposeFormProps) {
  const tagInputId = useId();
  const imageInputId = useId();
  const [tagInput, setTagInput] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [imageInputError, setImageInputError] = useState("");

  const labelStyle = { color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" };
  const controlStyle = {
    background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
    border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
    color: dark ? "#f9f7f2" : "#0f1f22",
  };

  const patch = (partial: Partial<PostComposeValues>) => onChange({ ...values, ...partial });

  const addTag = () => {
    const raw = tagInput.trim();
    if (!raw) return;

    const next = raw.startsWith("#") ? raw : `#${raw}`;
    if (next.length > POST_MAX_TAG_LENGTH) {
      toast.error(`태그는 ${POST_MAX_TAG_LENGTH}자 이하여야 합니다.`);
      return;
    }
    const normalized = normalizePostTags([...values.tags, next]);
    if (normalized.length > POST_MAX_TAGS) {
      toast.error(`태그는 최대 ${POST_MAX_TAGS}개까지 가능합니다.`);
      return;
    }
    if (normalized.length === values.tags.length) {
      toast.error("이미 추가된 태그입니다.");
      return;
    }

    patch({ tags: normalized });
    setTagInput("");
    onFieldErrorClear?.("tags");
  };

  const addImage = () => {
    const raw = imageInput.trim();
    if (!raw) return;

    if (!isValidPostImageUrl(raw)) {
      const message = "http:// 또는 https:// 로 시작하는 URL을 입력해주세요.";
      setImageInputError(message);
      toast.error(message);
      return;
    }

    const normalized = Array.from(new Set([...values.images, raw]));
    if (normalized.length > POST_MAX_IMAGES) {
      toast.error(`이미지는 최대 ${POST_MAX_IMAGES}개까지 가능합니다.`);
      return;
    }
    if (normalized.length === values.images.length) {
      toast.error("이미 추가된 이미지 URL입니다.");
      return;
    }

    patch({ images: normalized });
    setImageInput("");
    setImageInputError("");
    onFieldErrorClear?.("images");
  };

  const textErrorId = `${textInputId}-error`;
  const imageErrorId = `${imageInputId}-error`;
  const tagErrorId = `${tagInputId}-error`;

  return (
    <div className="space-y-6">
      {showDraftSaved ? (
        <p className="text-[12px]" style={{ color: dark ? "#7dd3a3" : "#1c4044" }} role="status" aria-live="polite">
          임시 저장됨
        </p>
      ) : null}

      <div>
        <label htmlFor={textInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          내용 <span className="sr-only">(필수)</span>
        </label>
        <textarea
          id={textInputId}
          value={values.text}
          onChange={(e) => {
            patch({ text: e.target.value });
            onFieldErrorClear?.("text");
          }}
          rows={5}
          placeholder="어떤 업사이클을 하고 계신가요?"
          required
          aria-invalid={Boolean(fieldErrors.text)}
          aria-describedby={fieldErrors.text ? textErrorId : undefined}
          maxLength={POST_MAX_TEXT_LENGTH}
          className="ui-control resize-none rounded-2xl p-4 placeholder:opacity-50"
          style={controlStyle}
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          {fieldErrors.text ? (
            <p id={textErrorId} className="text-[12px] text-red-500" role="alert">
              {fieldErrors.text}
            </p>
          ) : (
            <span className="text-[12px] opacity-0" aria-hidden>
              .
            </span>
          )}
          <p className="shrink-0 text-[11px] tabular-nums opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }} aria-live="polite">
            {values.text.length}/{POST_MAX_TEXT_LENGTH}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor={imageInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          이미지 URL <span className="normal-case tracking-normal opacity-70">(선택, 최대 {POST_MAX_IMAGES}개)</span>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Link2
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
              aria-hidden
            />
            <input
              id={imageInputId}
              type="url"
              inputMode="url"
              value={imageInput}
              onChange={(e) => {
                setImageInput(e.target.value);
                if (imageInputError) setImageInputError("");
                onFieldErrorClear?.("images");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addImage();
                }
              }}
              placeholder="https://example.com/image.jpg"
              aria-invalid={Boolean(fieldErrors.images || imageInputError)}
              aria-describedby={fieldErrors.images || imageInputError ? imageErrorId : undefined}
              className="ui-control w-full rounded-xl py-2.5 pl-9 pr-3 text-[13px] placeholder:opacity-50"
              style={controlStyle}
            />
          </div>
          <button
            type="button"
            onClick={addImage}
            disabled={values.images.length >= POST_MAX_IMAGES}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium disabled:opacity-40"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
            aria-label="이미지 URL 추가"
          >
            <Plus size={14} aria-hidden />
            추가
          </button>
        </div>
        {(fieldErrors.images || imageInputError) ? (
          <p id={imageErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
            {fieldErrors.images ?? imageInputError}
          </p>
        ) : null}

        {values.images.length > 0 ? (
          <ul className="mt-3 space-y-2" aria-label="추가된 이미지 목록">
            {values.images.map((url) => (
              <li
                key={url}
                className="flex items-center gap-3 rounded-xl p-2"
                style={{
                  background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)",
                  border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)"}`,
                }}
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <ImagePreview src={url} dark={dark} />
                </div>
                <p className="min-w-0 flex-1 truncate text-[12px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }} title={url}>
                  {url}
                </p>
                <button
                  type="button"
                  onClick={() => patch({ images: values.images.filter((item) => item !== url) })}
                  className="shrink-0 rounded-lg p-2 opacity-70 transition-opacity hover:opacity-100"
                  aria-label={`이미지 URL 제거: ${url}`}
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <label htmlFor={campaignInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          캠페인 연결
        </label>
        <select
          id={campaignInputId}
          value={values.campaign}
          onChange={(e) => patch({ campaign: e.target.value })}
          className="ui-control px-3 py-2.5"
          style={controlStyle}
        >
          <option value="">없음</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={tagInputId} className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={labelStyle}>
          태그 <span className="normal-case tracking-normal opacity-70">(선택, 최대 {POST_MAX_TAGS}개)</span>
        </label>
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl p-2"
          style={controlStyle}
          aria-describedby={fieldErrors.tags ? tagErrorId : undefined}
        >
          {values.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
              style={{
                background: dark ? "rgba(125,211,163,0.15)" : "rgba(125,211,163,0.25)",
                color: dark ? "#7dd3a3" : "#1c4044",
              }}
            >
              {tag}
              <button
                type="button"
                onClick={() => patch({ tags: values.tags.filter((item) => item !== tag) })}
                aria-label={`${tag} 태그 제거`}
              >
                <X size={10} aria-hidden />
              </button>
            </span>
          ))}
          <input
            id={tagInputId}
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              onFieldErrorClear?.("tags");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="태그 입력 후 Enter"
            disabled={values.tags.length >= POST_MAX_TAGS}
            aria-invalid={Boolean(fieldErrors.tags)}
            className="min-w-[120px] flex-1 bg-transparent px-2 text-[13px] outline-none placeholder:opacity-50"
            style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
          />
        </div>
        {fieldErrors.tags ? (
          <p id={tagErrorId} className="mt-1.5 text-[12px] text-red-500" role="alert">
            {fieldErrors.tags}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function usePostComposeDraft(
  values: PostComposeValues & { category?: string },
  onRestore: (draft: PostComposeValues & { category?: string }) => void,
) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POST_COMPOSE_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<PostComposeValues & { category?: string }>;
      if (!draft || typeof draft !== "object") return;
      onRestore({
        text: typeof draft.text === "string" ? draft.text : "",
        images: Array.isArray(draft.images) ? draft.images.filter((item) => typeof item === "string") : [],
        tags: Array.isArray(draft.tags) ? draft.tags.filter((item) => typeof item === "string") : [],
        campaign: typeof draft.campaign === "string" ? draft.campaign : "",
        category: typeof draft.category === "string" ? draft.category : undefined,
      });
    } catch {
      // ignore corrupt draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, []);

  useEffect(() => {
    const hasContent =
      values.text.trim().length > 0 ||
      values.images.length > 0 ||
      values.tags.length > 0 ||
      values.campaign.trim().length > 0;

    if (!hasContent) {
      localStorage.removeItem(POST_COMPOSE_DRAFT_KEY);
      return;
    }

    localStorage.setItem(POST_COMPOSE_DRAFT_KEY, JSON.stringify(values));
  }, [values]);

  const draftSaved =
    values.text.trim().length > 0 ||
    values.images.length > 0 ||
    values.tags.length > 0 ||
    values.campaign.trim().length > 0;

  const clearDraft = () => {
    localStorage.removeItem(POST_COMPOSE_DRAFT_KEY);
  };

  return { draftSaved, clearDraft };
}

type SubmitButtonProps = {
  submitting: boolean;
  disabled: boolean;
  onClick: () => void;
  idleLabel: string;
  pendingLabel: string;
};

export function PostComposeSubmitButton({
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
