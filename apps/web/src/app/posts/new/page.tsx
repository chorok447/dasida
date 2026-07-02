"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Send, Image as ImageIcon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { Avatar } from "@/components/avatar";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/use-auth-session";
import { fashionPhotos, naturePhotos, objectPhotos, workshopPhotos } from "@/data/photos";

const sampleImages = [fashionPhotos[0], naturePhotos[1], objectPhotos[0], workshopPhotos[2]];

// 서버 제한과 동일하게 맞춤.
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

export default function PostCreatePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([fashionPhotos[0]]);
  const [tags, setTags] = useState<string[]>(["#업사이클"]);
  const [tagInput, setTagInput] = useState("");
  const [campaign, setCampaign] = useState<string>("");
  const [category, setCategory] = useState("패션");
  // ponytail: 선택용 드롭다운이라 클라이언트 fetch로 충분(폼 전체 서버분리 불필요).
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    apiGet<{ id: string; title: string }[]>("/api/campaigns")
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  // 미리보기 작성자명을 내 이름으로. 로그인하지 않았으면 작성 페이지 진입 차단.
  const { name } = useAuthSession();
  const authorName = name ?? "사용자";
  useEffect(() => {
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
    }
  }, [router]);

  const [submitting, setSubmitting] = useState(false);
  const goBack = () => router.push("/feed");
  const submit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || submitting) return;
    const normalizedTags = normalizeTags(tags);
    const normalizedImages = Array.from(new Set(images.map((i) => i.trim()).filter(Boolean)));
    if (trimmedText.length > MAX_TEXT_LENGTH) return alert(`내용은 ${MAX_TEXT_LENGTH}자 이하여야 합니다.`);
    if (normalizedTags.length > MAX_TAGS) return alert(`태그는 최대 ${MAX_TAGS}개까지 가능합니다.`);
    if (normalizedImages.length > MAX_IMAGES) return alert(`이미지는 최대 ${MAX_IMAGES}개까지 가능합니다.`);
    setSubmitting(true);
    try {
      await apiPost("/api/posts", {
        text: trimmedText,
        images: normalizedImages,
        tags: normalizedTags,
        campaignId: campaign.trim() || null,
      });
      router.push("/feed");
    } catch (e) {
      setSubmitting(false);
      alert(e instanceof ApiError && e.status === 401 ? "로그인이 필요합니다." : "게시에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };
  const addTag = () => {
    if (!tagInput.trim()) return;
    const t = tagInput.startsWith("#") ? tagInput : `#${tagInput}`;
    setTags([...tags, t]);
    setTagInput("");
  };

  return (
    <section
      className="relative min-h-screen pt-28 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-10">
          <p className="tracking-[0.4em] uppercase mb-3" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            New Post
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
            새 글 쓰기
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div
            className="space-y-6 rounded-3xl border p-5 sm:p-8"
            style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
          >
            <div>
              <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                사진
              </label>
              <div
                className="border-2 border-dashed rounded-2xl p-6 text-center"
                style={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(28,64,68,0.15)" }}
              >
                <Upload size={28} className="mx-auto mb-2" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }} />
                <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                  드래그하거나 클릭해 업로드
                </p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {sampleImages.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setImages(images.includes(src) ? images.filter((s) => s !== src) : [...images, src])}
                    className="aspect-square rounded-lg overflow-hidden border-2 relative"
                    style={{ borderColor: images.includes(src) ? "#7dd3a3" : "transparent" }}
                    aria-label={images.includes(src) ? "선택한 이미지 해제" : "이미지 선택"}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    {images.includes(src) && (
                      <div className="absolute inset-0 bg-[#7dd3a3]/20" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="post-text" className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                내용
              </label>
              <textarea
                id="post-text"
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="post-category" className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
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
                  {["패션", "도시텃밭", "공방", "기증", "음식", "가구"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="post-campaign" className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                  캠페인 연결
                </label>
                <select
                  id="post-campaign"
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
            </div>

            <div>
              <label htmlFor="post-tag" className="text-[12px] tracking-[0.2em] uppercase mb-2 block" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                태그
              </label>
              <div
                className="flex flex-wrap items-center gap-2 p-2 rounded-xl"
                style={{
                  background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
                  border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
                }}
              >
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full" style={{ background: dark ? "rgba(125,211,163,0.15)" : "rgba(125,211,163,0.25)", color: dark ? "#7dd3a3" : "#1c4044" }}>
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`${t} 태그 제거`}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  id="post-tag"
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
                onClick={goBack}
                className="flex-1 py-3 rounded-xl"
                style={{
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                  color: dark ? "#f9f7f2" : "#0f1f22",
                }}
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !text.trim()}
                className="flex-1 py-3 rounded-xl font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: "#7dd3a3", color: "#0f1f22" }}
              >
                <Send size={14} /> {submitting ? "게시 중…" : "게시하기"}
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 self-start">
            <p className="text-[12px] tracking-[0.3em] uppercase mb-3" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
              미리보기
            </p>
            <article
              className="rounded-2xl border overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]"
              style={{
                background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
                borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
              }}
            >
              <div className="flex items-center gap-3 p-4">
                <Avatar name="나" />
                <div>
                  <div className="text-[14px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{authorName}</div>
                  <div className="text-[11px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>방금 전 · {category}</div>
                </div>
              </div>
              {images.length > 0 ? (
                images.length === 1 ? (
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={images[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-0.5 aspect-[4/3]">
                    {images.map((src, i) => (
                      <img key={i} src={src} alt="" className="w-full h-full object-cover" />
                    ))}
                  </div>
                )
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)" }}>
                  <ImageIcon size={32} style={{ color: dark ? "rgba(255,255,255,0.3)" : "rgba(28,64,68,0.3)" }} />
                </div>
              )}
              <div className="p-4 space-y-3">
                <p style={{ color: dark ? "#f9f7f2" : "#0f1f22", fontSize: 14, lineHeight: 1.6 }}>
                  {text || <span className="opacity-40">내용이 여기에 표시됩니다…</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: dark ? "rgba(125,211,163,0.12)" : "rgba(125,211,163,0.2)", color: dark ? "#7dd3a3" : "#1c4044" }}>
                      {t}
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
