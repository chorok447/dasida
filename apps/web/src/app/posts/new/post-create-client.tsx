"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon } from "lucide-react";
import { CurrentUserAvatar } from "@/components/current-user-avatar";
import { FallbackImage } from "@/components/fallback-image";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  PostComposeForm,
  PostComposeSubmitButton,
  usePostComposeDraft,
} from "@/components/post-compose-form";
import {
  type PostComposeField,
  type PostComposeValues,
  validatePostCompose,
} from "@/data/posts";
import { POST_TEMPLATES, type PostTemplate } from "@/data/post-templates";
import { PageShell } from "@/components/page-shell";

const EMPTY_VALUES: PostComposeValues = {
  text: "",
  images: [],
  tags: [],
  campaign: "",
};

function composeHasContent(values: PostComposeValues): boolean {
  return (
    values.text.trim().length > 0 ||
    values.images.length > 0 ||
    values.tags.length > 0 ||
    values.campaign.trim().length > 0
  );
}

export default function PostCreateClient() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const restoredRef = useRef(false);

  const [values, setValues] = useState<PostComposeValues>(EMPTY_VALUES);
  const [category, setCategory] = useState("패션");
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PostComposeField, string>>>({});

  const { name } = useAuthSession();
  const confirm = useConfirm();
  const authorName = name ?? "사용자";

  const { draftSaved, clearDraft } = usePostComposeDraft(
    { ...values, category },
    (draft) => {
      if (restoredRef.current) return;
      restoredRef.current = true;
      setValues({
        text: draft.text,
        images: draft.images,
        tags: draft.tags,
        campaign: draft.campaign,
      });
      if (draft.category) setCategory(draft.category);
    },
  );

  useEffect(() => {
    apiGet<{ id: string; title: string }[]>("/api/campaigns")
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    if (!getSessionId()) {
      toast.error("로그인 후 글을 작성할 수 있어요.");
      router.replace("/login?next=/posts/new");
    }
  }, [router]);

  useEffect(() => {
    if (!composeHasContent(values)) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [values]);

  const applyTemplate = async (template: PostTemplate) => {
    if (
      composeHasContent(values) &&
      !(await confirm({ message: "작성 중인 내용이 있습니다. 예시로 덮어쓸까요? (사진과 캠페인 연결은 유지됩니다)" }))
    ) {
      return;
    }
    setValues((current) => ({ ...current, ...template.values }));
    setCategory(template.category);
    setFieldErrors({});
    toast.success("기록 예시를 적용했어요. 괄호 안 내용을 채워주세요.");
  };

  const clearFieldError = (field: PostComposeField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async () => {
    if (submittingRef.current) return;

    const validation = validatePostCompose(values);
    if (!validation.ok) {
      toast.error(validation.message);
      if (validation.field) {
        setFieldErrors({ [validation.field]: validation.message });
      }
      return;
    }

    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인 후 글을 작성할 수 있어요.");
      router.push("/login?next=/posts/new");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFieldErrors({});

    try {
      await apiPost("/api/posts", validation.payload);
      if (getSessionId() !== requestToken) return;
      clearDraft();
      toast.success("게시글이 등록되었습니다.");
      router.push("/feed");
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인 후 글을 작성할 수 있어요.");
        router.push("/login?next=/posts/new");
      } else {
        toast.error("게시에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <PageShell paddingClassName="relative min-h-screen overflow-hidden px-6 pt-28 pb-20" orb="left">
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="mb-3 tracking-[0.4em] uppercase" style={{ color: "var(--accent-secondary)", fontSize: 11 }}>
            New Post
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: "var(--foreground)" }}>
            새 글 쓰기
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
            <div>
              <p className="mb-2 text-[12px] tracking-[0.2em] uppercase" style={{ color: "var(--foreground-muted)" }}>
                기록 예시로 시작하기 <span className="normal-case tracking-normal opacity-70">(선택)</span>
              </p>
              <ul className="flex flex-wrap gap-2" aria-label="기록 예시 목록">
                {POST_TEMPLATES.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => applyTemplate(template)}
                      disabled={submitting}
                      className="rounded-full px-3.5 py-2 text-[13px] transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{
                        background: "var(--border)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                      aria-label={`${template.label} 예시 적용`}
                    >
                      {template.label}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
                내용·태그·카테고리가 초안으로 채워집니다. 자유롭게 수정하세요.
              </p>
            </div>

            <div>
              <label htmlFor="post-category" className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={{ color: "var(--foreground-muted)" }}>
                카테고리
              </label>
              <select
                id="post-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ui-control px-3 py-2.5"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                {["패션", "도시텃밭", "공방", "기증", "음식", "가구"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <PostComposeForm
              values={values}
              onChange={setValues}
              campaigns={campaigns}
              fieldErrors={fieldErrors}
              onFieldErrorClear={clearFieldError}
              showDraftSaved={draftSaved}
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push("/feed")}
                className="flex-1 rounded-xl py-3"
                style={{
                  background: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                취소
              </button>
              <PostComposeSubmitButton
                submitting={submitting}
                disabled={!values.text.trim()}
                onClick={submit}
                idleLabel="게시하기"
                pendingLabel="게시 중…"
              />
            </div>
          </div>

          <div className="self-start lg:sticky lg:top-24">
            <p className="mb-3 text-[12px] tracking-[0.3em] uppercase" style={{ color: "var(--foreground-muted)" }}>
              미리보기
            </p>
            <article
              className="overflow-hidden rounded-2xl border shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-center gap-3 p-4">
                <CurrentUserAvatar />
                <div>
                  <div className="text-[14px]" style={{ color: "var(--foreground)" }}>
                    {authorName}
                  </div>
                  <div className="text-[11px] opacity-60" style={{ color: "var(--foreground)" }}>
                    방금 전 · {category}
                  </div>
                </div>
              </div>
              {values.images.length > 0 ? (
                values.images.length === 1 ? (
                  <div className="aspect-[4/3] overflow-hidden">
                    <FallbackImage
                      src={values.images[0]}
                      alt="첨부 이미지 미리보기 1"
                      errorText="이미지를 불러올 수 없어요"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="grid aspect-[4/3] grid-cols-2 gap-0.5">
                    {values.images.map((src, index) => (
                      <FallbackImage
                        key={src}
                        src={src}
                        alt={`첨부 이미지 미리보기 ${index + 1}`}
                        errorText="이미지를 불러올 수 없어요"
                        className="h-full w-full object-cover"
                      />
                    ))}
                  </div>
                )
              ) : (
                <div
                  className="flex aspect-[4/3] items-center justify-center"
                  style={{ background: "var(--border)" }}
                >
                  <ImageIcon size={32} style={{ color: "var(--foreground-muted)" }} aria-hidden />
                </div>
              )}
              <div className="space-y-3 p-4">
                <p style={{ color: "var(--foreground)", fontSize: 14, lineHeight: 1.6 }}>
                  {values.text || <span className="opacity-40">내용이 여기에 표시됩니다…</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {values.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent-secondary)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
