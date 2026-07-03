"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { apiGet, apiPut, ApiError } from "@/lib/api";
import { getToken, clearSession } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { PostComposeForm, PostComposeSubmitButton } from "@/components/post-compose-form";
import {
  type Post,
  type PostComposeField,
  type PostComposeValues,
  validatePostCompose,
} from "@/data/posts";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "notfound" }
  | { kind: "forbidden" }
  | { kind: "error" };

export default function PostEditPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { token } = useAuthSession();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const submittingRef = useRef(false);

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [values, setValues] = useState<PostComposeValues>({
    text: "",
    images: [],
    tags: [],
    campaign: "",
  });
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PostComposeField, string>>>({});
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    apiGet<{ id: string; title: string }[]>("/api/campaigns")
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    apiGet<Post>(`/api/posts/${id}`)
      .then((post) => {
        if (cancelled) return;
        if (!post.ownedByMe) {
          setLoad({ kind: "forbidden" });
          return;
        }
        setValues({
          text: post.text,
          images: post.images,
          tags: post.tags,
          campaign: post.campaignId ?? "",
        });
        setLoad({ kind: "ready" });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          router.replace("/login");
        } else if (error instanceof ApiError && error.status === 404) {
          setLoad({ kind: "notfound" });
        } else if (error instanceof ApiError && error.status === 403) {
          setLoad({ kind: "forbidden" });
        } else {
          setLoad({ kind: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, token, retry, router]);

  useEffect(() => {
    if (load.kind !== "ready") return;
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
  }, [load.kind, values]);

  const clearFieldError = (field: PostComposeField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const save = async () => {
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
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setFieldErrors({});

    try {
      await apiPut(`/api/posts/${id}`, validation.payload);
      if (getToken() !== requestToken) return;
      toast.success("게시글이 수정되었습니다.");
      router.replace(`/posts/${id}`);
    } catch (error) {
      if (getToken() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("수정 권한이 없습니다.");
      } else {
        toast.error("게시글 수정에 실패했습니다.");
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <section
      className="relative min-h-screen overflow-hidden px-6 pt-28 pb-20 transition-colors"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="relative mx-auto max-w-2xl">{children}</div>
    </section>
  );

  const centerNote = (title: string, action?: React.ReactNode) =>
    shell(
      <div className="pt-20 text-center" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
        <p className="mb-4 text-[15px]">{title}</p>
        {action}
      </div>,
    );

  if (load.kind === "loading") return centerNote("불러오는 중…");
  if (load.kind === "notfound") {
    return centerNote(
      "게시글을 찾을 수 없습니다.",
      <button onClick={() => router.push("/feed")} className="rounded-xl px-4 py-2 text-[13px]" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
        피드로
      </button>,
    );
  }
  if (load.kind === "forbidden") {
    return centerNote(
      "이 게시글을 수정할 권한이 없습니다.",
      <button onClick={() => router.push(`/posts/${id}`)} className="rounded-xl px-4 py-2 text-[13px]" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
        게시글로
      </button>,
    );
  }
  if (load.kind === "error") {
    return centerNote(
      "게시글을 불러오지 못했습니다.",
      <button
        onClick={() => {
          setLoad({ kind: "loading" });
          setRetry((count) => count + 1);
        }}
        className="rounded-xl px-4 py-2 text-[13px]"
        style={{ background: "#7dd3a3", color: "#0f1f22" }}
      >
        다시 시도
      </button>,
    );
  }

  return shell(
    <>
      <div className="mb-10 text-center">
        <p className="mb-3 tracking-[0.4em] uppercase" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
          Edit Post
        </p>
        <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
          글 수정
        </h1>
      </div>

      <div
        className="space-y-6 rounded-3xl border p-5 sm:p-8"
        style={{
          background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
          borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
        }}
      >
        <PostComposeForm
          values={values}
          onChange={setValues}
          campaigns={campaigns}
          dark={dark}
          fieldErrors={fieldErrors}
          onFieldErrorClear={clearFieldError}
          textInputId="edit-post-text"
          campaignInputId="edit-post-campaign"
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push(`/posts/${id}`)}
            className="flex-1 rounded-xl py-3"
            style={{
              background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
              color: dark ? "#f9f7f2" : "#0f1f22",
            }}
          >
            취소
          </button>
          <PostComposeSubmitButton
            submitting={saving}
            disabled={!values.text.trim()}
            onClick={save}
            idleLabel="저장하기"
            pendingLabel="저장 중…"
          />
        </div>
      </div>
    </>,
  );
}
