import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Heart, MessageCircle, Share2, Bookmark, Image as ImageIcon, Sparkles, TrendingUp } from "lucide-react";
import { useTheme } from "../theme-context";
import { Avatar } from "../components/avatar";
import { posts, type Post } from "../data/posts";
import { campaigns, statusMeta } from "../data/campaigns";

const categories = ["전체", "패션", "도시텃밭", "공방", "기증", "음식", "가구"];

function PostCard({ p, onOpen }: { p: Post; onOpen: () => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-6, 6]);
  const rX = useTransform(sy, [-0.5, 0.5], [5, -5]);

  return (
    <div style={{ perspective: 1200 }}>
      <motion.article
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
        className="rounded-2xl border overflow-hidden shadow-[0_20px_50px_-25px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center gap-3 p-4">
          <Avatar name={p.author.name} verified={p.author.verified} />
          <div className="flex-1">
            <div style={{ color: dark ? "#f9f7f2" : "#0f1f22", fontSize: 14 }}>{p.author.name}</div>
            <div className="text-[11px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{p.time}</div>
          </div>
        </div>

        {p.images.length === 1 ? (
          <div className="aspect-[4/3] overflow-hidden cursor-pointer" onClick={onOpen}>
            <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0.5 aspect-[4/3] cursor-pointer" onClick={onOpen}>
            {p.images.map((src, i) => (
              <img key={i} src={src} alt="" className="w-full h-full object-cover" />
            ))}
          </div>
        )}

        <div className="p-4 space-y-3">
          <p style={{ color: dark ? "#f9f7f2" : "#0f1f22", fontSize: 14, lineHeight: 1.6 }}>{p.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: dark ? "rgba(125,211,163,0.12)" : "rgba(125,211,163,0.2)", color: dark ? "#7dd3a3" : "#1c4044" }}>
                {t}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
            <div className="flex gap-4 text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
              <button className="flex items-center gap-1 hover:text-[#ed5c48] transition-colors">
                <Heart size={14} /> {p.likes}
              </button>
              <button className="flex items-center gap-1">
                <MessageCircle size={14} /> {p.comments}
              </button>
              <button className="flex items-center gap-1">
                <Share2 size={14} />
              </button>
            </div>
            <button style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}>
              <Bookmark size={14} />
            </button>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

function SideHot() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const hot = campaigns.filter((c) => c.status === "open").slice(0, 3);
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} style={{ color: "#7dd3a3" }} />
        <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: dark ? "#f9f7f2" : "#0f1f22" }}>
          진행 중인 캠페인
        </h3>
      </div>
      <div className="space-y-3">
        {hot.map((c) => {
          const pct = Math.round((c.joined / c.capacity) * 100);
          return (
            <div key={c.id} className="flex gap-3 items-center">
              <img src={c.thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] truncate" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  {c.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusMeta[c.status].color }} />
                  </div>
                  <span className="text-[11px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SideRecommend() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const users = ["초록도시", "원두모음", "리메이크목공방", "보틀앤캔들"];
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} style={{ color: "#7dd3a3" }} />
        <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 18, color: dark ? "#f9f7f2" : "#0f1f22" }}>
          이런 분 어때요
        </h3>
      </div>
      <div className="space-y-3">
        {users.map((n) => (
          <div key={n} className="flex items-center gap-3">
            <Avatar name={n} />
            <div className="flex-1 text-[13px]" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              {n}
            </div>
            <button className="text-[12px] px-3 py-1 rounded-full" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
              팔로우
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeFeedPage({ openPost, openCreate }: { openPost: (id: string) => void; openCreate: () => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
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
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto relative grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-2">
            <p className="tracking-[0.3em] uppercase text-[11px] mb-3" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
              카테고리
            </p>
            {categories.map((c, i) => (
              <button
                key={c}
                className="block w-full text-left px-3 py-2 rounded-lg text-[13px]"
                style={{
                  background: i === 0 ? (dark ? "rgba(125,211,163,0.15)" : "rgba(125,211,163,0.25)") : "transparent",
                  color: i === 0 ? (dark ? "#7dd3a3" : "#1c4044") : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)",
                }}
              >
                # {c}
              </button>
            ))}
          </div>
        </aside>

        <main>
          <button
            onClick={openCreate}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border mb-6 hover:-translate-y-0.5 transition-transform text-left"
            style={{
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
            }}
          >
            <Avatar name="나" />
            <span className="flex-1 opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
              지금 어떤 업사이클을 하고 있나요?
            </span>
            <span className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full" style={{ background: "#7dd3a3", color: "#0f1f22" }}>
              <ImageIcon size={14} /> 새 글
            </span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {posts.map((p) => (
              <PostCard key={p.id} p={p} onOpen={() => openPost(p.id)} />
            ))}
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-5">
            <SideHot />
            <SideRecommend />
          </div>
        </aside>
      </div>
    </section>
  );
}
