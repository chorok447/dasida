"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiGet, apiPut, ApiError } from "@/lib/api";
import { getToken, clearSession } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { fashionPhotos, naturePhotos, objectPhotos, workshopPhotos } from "@/data/photos";
import type { Post } from "@/data/posts";

const sampleImages = [fashionPhotos[0], naturePhotos[1], objectPhotos[0], workshopPhotos[2]];

// 서버 제한과 동일하게 맞춤. (작성 페이지와 같은 규칙)
const MAX_TEXT_LENGTH = 1000;
const MAX_TAGS = 10;
const MAX_IMAGES = 4;

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`)),
    ),
  );
}

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

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [campaign, setCampaign] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    apiGet<{ id: string; title: string }[]>("/api/campaigns")
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  // 인증된 ownedByMe 값을 받기 위해 client-side 로 조회. 토큰 변경 시 재조회하고,
  // cancelled 플래그로 늦게 도착한 응답이 현재 상태를 덮지 않게 한다.
  // loading 초기화는 초기 상태값과 retry 핸들러에서 처리(effect 내 동기 setState 회피, lint).
  useEffect(() => {
    // 게시글 GET 은 public 이라 비로그인도 200(ownedByMe=false)이 온다.
    // 권한 없음이 아니라 로그인이 필요한 상황이므로 조회 전에 로그인으로 보낸다.
    // useAuthSession 의 token 은 hydration 시 서버 스냅샷(null)을 먼저 주므로,
    // 로그인 사용자가 잘못 리다이렉트되지 않도록 실제 저장소(getToken)를 직접 확인한다.
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
        setText(post.text);
        setImages(post.images);
        setTags(post.tags);
        setCampaign(post.campaignId ?? "");
        setLoad({ kind: "ready" });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          // 만료/깨진 토큰 → 세션 정리 후 로그인으로.
          clearSession();
          router.replace("/login");
        } else if (e instanceof ApiError && e.status === 404) {
          setLoad({ kind: "notfound" });
        } else if (e instanceof ApiError && e.status === 403) {
          setLoad({ kind: "forbidden" });
        } else {
          setLoad({ kind: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, token, retry, router]);

  const addTag = () => {
    if (!tagInput.trim()) return;
    const t = tagInput.startsWith("#") ? tagInput : `#${tagInput}`;
    setTags([...tags, t]);
    setTagInput("");
  };

  const save = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || saving) return;
    const normalizedTags = normalizeTags(tags);
    const normalizedImages = Array.from(new Set(images.map((i) => i.trim()).filter(Boolean)));
    if (trimmedText.length > MAX_TEXT_LENGTH) return alert(`내용은 ${MAX_TEXT_LENGTH}자 이하여야 합니다.`);
    if (normalizedTags.length > MAX_TAGS) return alert(`태그는 최대 ${MAX_TAGS}개까지 가능합니다.`);
    if (normalizedImages.length > MAX_IMAGES) return alert(`이미지는 최대 ${MAX_IMAGES}개까지 가능합니다.`);

    const requestToken = getToken();
    if (!requestToken) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    setSaving(true);
    try {
      await apiPut(`/api/posts/${id}`, {
        text: trimmedText,
        images: normalizedImages,
        tags: normalizedTags,
        campaignId: campaign.trim() || null,
      });
      if (getToken() !== requestToken) return; // 요청 중 토큰 변경 → 이동 취소
      router.replace(`/posts/${id}`);
    } catch (e) {
      if (getToken() !== requestToken) return; // 오래된 결과를 반영하지 않음
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        alert("수정 권한이 없습니다.");
      } else {
        alert("게시글 수정에 실패했습니다.");
      }
    } finally {
      // 토큰 변경으로 무시한 경우에도 버튼이 영구 비활성화되지 않게 정리.
      setSaving(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <section
      className="relative min-h-screen pt-28 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="max-w-2xl mx-auto relative">{children}</div>
    </section>
  );

  const centerNote = (title: string, action?: React.ReactNode) =>
    shell(
      <div className="text-center pt-20" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
        <p className="text-[15px] mb-4">{title}</p>
        {action}
      </div>,
    );

  if (load.kind === "loading") return centerNote("불러오는 중…");
  if (load.kind === "notfound")
    return centerNote(
      "게시글을 찾을 수 없습니다.",
      <button onClick={() => router.push("/feed")} className="px-4 py-2 rounded-xl text-[13px]" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
        피드로
      </button>,
    );
  if (load.kind === "forbidden")
    return centerNote(
      "이 게시글을 수정할 권한이 없습니다.",
      <button onClick={() => router.push(`/posts/${id}`)} className="px-4 py-2 rounded-xl text-[13px]" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
        게시글로
      </button>,
    );
  if (load.kind === "error")
    return centerNote(
      "게시글을 불러오지 못했습니다.",
      <button onClick={() => { setLoad({ kind: "loading" }); setRetry((r) => r + 1); }} className="px-4 py-2 rounded-xl text-[13px]" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
        다시 시도
      </button>,
    );

  const selectableImages = Array.from(new Set([...images, ...sampleImages]));

  return shell(
    <>
      <div className="text-center mb-10">
        <p className="tracking-[0.4em] uppercase mb-3" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
          Edit Post
        </p>
        <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
          글 수정
        </h1>
      </div>

      <div
        className="space-y-6 rounded-3xl border p-5 sm:p-8"
        style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
      >
        <div>
          <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            사진
          </label>
          <div className="grid grid-cols-4 gap-2">
            {selectableImages.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setImages(images.includes(src) ? images.filter((s) => s !== src) : [...images, src])}
                className="aspect-square rounded-lg overflow-hidden border-2 relative"
                style={{ borderColor: images.includes(src) ? "#7dd3a3" : "transparent" }}
                aria-label={images.includes(src) ? "선택한 이미지 해제" : "이미지 선택"}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
                {images.includes(src) && <div className="absolute inset-0 bg-[#7dd3a3]/20" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="edit-post-text" className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            내용
          </label>
          <textarea
            id="edit-post-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="어떤 업사이클을 하고 계신가요?"
            className="ui-control resize-none rounded-2xl p-4 placeholder:opacity-50"
            style={{
              background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
              border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
              color: dark ? "#f9f7f2" : "#0f1f22",
            }}
          />
        </div>

        <div>
          <label htmlFor="edit-post-campaign" className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            캠페인 연결
          </label>
          <select
            id="edit-post-campaign"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="ui-control px-3 py-2.5"
            style={{
              background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
              border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
              color: dark ? "#f9f7f2" : "#0f1f22",
            }}
          >
            <option value="">없음</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="edit-post-tag" className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            태그
          </label>
          <div
            className="flex flex-wrap items-center gap-2 p-2 rounded-xl"
            style={{ background: dark ? "rgba(255,255,255,0.06)" : "#ffffff", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}` }}
          >
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full" style={{ background: dark ? "rgba(125,211,163,0.15)" : "rgba(125,211,163,0.25)", color: dark ? "#7dd3a3" : "#1c4044" }}>
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`${t} 제거`}>
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              id="edit-post-tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="태그 추가"
              className="flex-1 min-w-[100px] bg-transparent outline-none text-[13px] placeholder:opacity-50 px-2"
              style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push(`/posts/${id}`)}
            className="flex-1 py-3 rounded-xl"
            style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !text.trim()}
            className="flex-1 py-3 rounded-xl font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
          >
            <Send size={14} /> {saving ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>
    </>,
  );
}
