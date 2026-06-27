"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { apiPost, apiDelete, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { Avatar } from "@/components/avatar";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";

const sampleComments = [
  { id: 1, name: "초록도시", time: "1시간", text: "이거 어떻게 만드신 거예요? 패턴 공유 가능하실까요?", verified: false },
  { id: 2, name: "보틀앤캔들", time: "3시간", text: "와 디테일 봐… 다음 작품도 기대하고 있겠습니다!", verified: true },
  { id: 3, name: "원두모음", time: "어제", text: "오프라인 클래스 같은 거 안 여시나요?", verified: false },
];

export default function PostDetailClient({ post, linkedCampaign }: { post: Post; linkedCampaign: Campaign | null }) {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const p = post;
  const [idx, setIdx] = useState(0);
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.likedByMe);
  const [liking, setLiking] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  // 새로고침 후 likedByMe·likes 사용자별 상태 복원.
  useAuthedRefresh<Post>(`/api/posts/${p.id}`, (u) => {
    setLikes(u.likes);
    setLiked(u.likedByMe);
  });

  const onLike = async () => {
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (liking) return; // 연타 방지
    setLiking(true);
    try {
      const updated = liked
        ? await apiDelete<Post>(`/api/posts/${p.id}/like`)
        : await apiPost<Post>(`/api/posts/${p.id}/like`, {});
      setLikes(updated.likes);
      setLiked(updated.likedByMe);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else {
        alert("좋아요 처리에 실패했습니다.");
      }
    } finally {
      setLiking(false);
    }
  };

  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 22 });
  const sy = useSpring(my, { stiffness: 150, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-5, 5]);
  const rX = useTransform(sy, [-0.5, 0.5], [4, -4]);

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
        <div className="absolute top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto relative">
        <button
          onClick={() => router.push("/feed")}
          className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          <ArrowLeft size={14} /> 피드로 돌아가기
        </button>

        <div style={{ perspective: 1400 }}>
          <motion.div
            ref={ref}
            onMouseMove={(e) => {
              const r = ref.current?.getBoundingClientRect();
              if (!r) return;
              mx.set((e.clientX - r.left) / r.width - 0.5);
              my.set((e.clientY - r.top) / r.height - 0.5);
            }}
            onMouseLeave={() => {
              mx.set(0);
              my.set(0);
            }}
            style={{
              rotateX: rX,
              rotateY: rY,
              transformStyle: "preserve-3d",
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            }}
            className="rounded-3xl border overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)] grid grid-cols-1 md:grid-cols-[1.2fr_1fr]"
          >
            <div className="relative aspect-square md:aspect-auto bg-black overflow-hidden">
              <motion.img
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={p.images[idx]}
                alt=""
                className="w-full h-full object-cover"
              />
              {p.images.length > 1 && (
                <>
                  <button
                    onClick={() => setIdx((i) => (i - 1 + p.images.length) % p.images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setIdx((i) => (i + 1) % p.images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {p.images.map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === idx ? "#7dd3a3" : "rgba(255,255,255,0.4)" }} />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-7 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Avatar name={p.author.name} verified={p.author.verified} size={40} />
                <div>
                  <div style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{p.author.name}</div>
                  <div className="text-[12px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{p.time}</div>
                </div>
              </div>

              <p style={{ color: dark ? "rgba(255,255,255,0.9)" : "rgba(28,64,68,0.9)", lineHeight: 1.7 }}>
                {p.text}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span key={t} className="text-[12px] px-2.5 py-0.5 rounded-full" style={{ background: dark ? "rgba(125,211,163,0.12)" : "rgba(125,211,163,0.2)", color: dark ? "#7dd3a3" : "#1c4044" }}>
                    {t}
                  </span>
                ))}
              </div>

              {linkedCampaign && (
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer"
                  onClick={() => router.push(`/campaigns/${linkedCampaign.id}`)}
                  style={{
                    background: dark ? "rgba(125,211,163,0.08)" : "rgba(125,211,163,0.15)",
                    border: `1px solid ${dark ? "rgba(125,211,163,0.2)" : "rgba(125,211,163,0.3)"}`,
                  }}
                >
                  <img src={linkedCampaign.thumb} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>연결된 캠페인</div>
                    <div className="text-[13px] truncate" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{linkedCampaign.title}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={onLike}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]"
                  style={{
                    background: liked ? "rgba(237,92,72,0.15)" : dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                    color: liked ? "#ed5c48" : dark ? "#f9f7f2" : "#0f1f22",
                  }}
                >
                  <Heart size={14} fill={liked ? "#ed5c48" : "transparent"} /> {likes}
                </motion.button>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  <MessageCircle size={14} /> {p.comments}
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  <Share2 size={14} />
                </button>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setBookmarked((v) => !v)}
                  className="ml-auto w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: bookmarked ? "#7dd3a3" : dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)",
                    color: bookmarked ? "#0f1f22" : dark ? "#f9f7f2" : "#0f1f22",
                  }}
                >
                  <Bookmark size={14} fill={bookmarked ? "#0f1f22" : "transparent"} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        <div
          className="mt-8 rounded-3xl border p-8"
          style={{
            background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
            borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
          }}
        >
          <h3 className="mb-6" style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: dark ? "#f9f7f2" : "#0f1f22" }}>
            댓글 {sampleComments.length}
          </h3>
          <div
            className="flex items-center gap-3 p-3 rounded-2xl mb-6"
            style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(28,64,68,0.04)" }}
          >
            <Avatar name="나" />
            <input
              placeholder="댓글 달기..."
              className="flex-1 bg-transparent outline-none placeholder:opacity-50"
              style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
            />
            <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
              <Send size={14} />
            </button>
          </div>
          <div className="space-y-5">
            {sampleComments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar name={c.name} verified={c.verified} />
                <div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <span style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{c.name}</span>
                    <span className="opacity-50" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>· {c.time}</span>
                  </div>
                  <p className="mt-0.5" style={{ color: dark ? "rgba(255,255,255,0.85)" : "rgba(28,64,68,0.85)" }}>
                    {c.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
