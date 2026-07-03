"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { Avatar } from "@/components/avatar";
import { FallbackImage } from "@/components/fallback-image";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
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

const EMPTY_VALUES: PostComposeValues = {
  text: "",
  images: [],
  tags: [],
  campaign: "",
};

export default function PostCreatePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const submittingRef = useRef(false);
  const restoredRef = useRef(false);

  const [values, setValues] = useState<PostComposeValues>(EMPTY_VALUES);
  const [category, setCategory] = useState("패션");
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PostComposeField, string>>>({});

  const { name } = useAuthSession();
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
    if (!getToken()) {
      toast.error("로그인 후 글을 작성할 수 있어요.");
      router.replace("/login?next=/posts/new");
    }
  }, [router]);

  useEffect(() => {
    const hasContent =
      values.text.trim().length > 0 ||
      values.images.length > 0 ||
      values.tags.length > 0 ||
      values.campaign.trim().length > 0;
    if (!hasContent) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [values]);

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

    const requestToken = getToken();
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
      if (getToken() !== requestToken) return;
      clearDraft();
      toast.success("게시글이 등록되었습니다.");
      router.push("/feed");
    } catch (error) {
      if (getToken() !== requestToken) return;
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
    <section
      className="relative min-h-screen overflow-hidden px-6 pt-28 pb-20 transition-colors"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="mb-3 tracking-[0.4em] uppercase" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            New Post
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
            새 글 쓰기
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
            <div>
              <label htmlFor="post-category" className="mb-2 block text-[12px] tracking-[0.2em] uppercase" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                카테고리
              </label>
              <select
                id="post-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ui-control px-3 py-2.5"
                style={{
                  background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
                  border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
                  color: dark ? "#f9f7f2" : "#0f1f22",
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
              dark={dark}
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
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                  color: dark ? "#f9f7f2" : "#0f1f22",
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
            <p className="mb-3 text-[12px] tracking-[0.3em] uppercase" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
              미리보기
            </p>
            <article
              className="overflow-hidden rounded-2xl border shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]"
              style={{
                background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
                borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
              }}
            >
              <div className="flex items-center gap-3 p-4">
                <Avatar name="나" />
                <div>
                  <div className="text-[14px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                    {authorName}
                  </div>
                  <div className="text-[11px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
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
                      dark={dark}
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
                        dark={dark}
                        errorText="이미지를 불러올 수 없어요"
                        className="h-full w-full object-cover"
                      />
                    ))}
                  </div>
                )
              ) : (
                <div
                  className="flex aspect-[4/3] items-center justify-center"
                  style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)" }}
                >
                  <ImageIcon size={32} style={{ color: dark ? "rgba(255,255,255,0.3)" : "rgba(28,64,68,0.3)" }} aria-hidden />
                </div>
              )}
              <div className="space-y-3 p-4">
                <p style={{ color: dark ? "#f9f7f2" : "#0f1f22", fontSize: 14, lineHeight: 1.6 }}>
                  {values.text || <span className="opacity-40">내용이 여기에 표시됩니다…</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {values.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        background: dark ? "rgba(125,211,163,0.12)" : "rgba(125,211,163,0.2)",
                        color: dark ? "#7dd3a3" : "#1c4044",
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
    </section>
  );
}
