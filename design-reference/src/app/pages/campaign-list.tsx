import { useRef, useState } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { Search, Users, Calendar } from "lucide-react";
import { useTheme } from "../theme-context";
import { campaigns, statusMeta, type Campaign, type CampaignStatus } from "../data/campaigns";

type Filter = "all" | CampaignStatus;

function StatusBadge({ status }: { status: CampaignStatus }) {
  const m = statusMeta[status];
  return (
    <span
      className="text-[11px] tracking-[0.2em] px-2.5 py-1 rounded-full"
      style={{ background: m.color, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

function ProgressBar({ joined, capacity, status }: { joined: number; capacity: number; status: CampaignStatus }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const pct = Math.min(100, (joined / capacity) * 100);
  return (
    <div className="w-full">
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: statusMeta[status].color }}
        />
      </div>
      <div
        className="flex justify-between text-[11px] mt-1.5"
        style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}
      >
        <span>
          <b style={{ color: statusMeta[status].color }}>{joined}</b> / {capacity}명
        </span>
        <span>{statusMeta[status].label === "모집중" ? "참여 중" : statusMeta[status].label}</span>
      </div>
    </div>
  );
}

function CampaignCard({ c, onOpen }: { c: Campaign; onOpen: () => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 22 });
  const sy = useSpring(my, { stiffness: 200, damping: 22 });
  const rY = useTransform(sx, [-0.5, 0.5], [-12, 12]);
  const rX = useTransform(sy, [-0.5, 0.5], [10, -10]);

  return (
    <div style={{ perspective: 1000 }}>
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
        onClick={onOpen}
        style={{ rotateX: rX, rotateY: rY, transformStyle: "preserve-3d" }}
        className="cursor-pointer rounded-2xl overflow-hidden border shadow-[0_20px_50px_-25px_rgba(0,0,0,0.5)]"
      >
        <div
          style={{
            background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
            borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)",
          }}
          className="border-0"
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <img src={c.thumb} alt={c.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/70 via-transparent to-transparent" />
            <div className="absolute top-3 right-3" style={{ transform: "translateZ(40px)" }}>
              <StatusBadge status={c.status} />
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-white/90 text-[12px]">
              <Calendar size={12} />
              <span>{c.recruitStart} ~ {c.recruitEnd}</span>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <h3
              style={{
                fontFamily: "'Black Han Sans', sans-serif",
                fontSize: 22,
                color: dark ? "#f9f7f2" : "#0f1f22",
                lineHeight: 1.25,
              }}
            >
              {c.title}
            </h3>
            <p
              className="text-[13px] line-clamp-2"
              style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}
            >
              {c.summary}
            </p>
            <ProgressBar joined={c.joined} capacity={c.capacity} status={c.status} />
            <div
              className="flex items-center justify-between text-[12px] pt-1"
              style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}
            >
              <span className="flex items-center gap-1.5">
                <Users size={12} /> 모집 {c.capacity}명
              </span>
              <span>{c.daysLeftLabel}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FilterBar({ filter, setFilter, query, setQuery }: { filter: Filter; setFilter: (f: Filter) => void; query: string; setQuery: (q: string) => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const items: { id: Filter; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "open", label: "모집중" },
    { id: "upcoming", label: "모집예정" },
    { id: "closed", label: "모집마감" },
  ];
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-10">
      <div className="flex gap-1 p-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
        {items.map((it) => {
          const active = filter === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setFilter(it.id)}
              className="relative px-5 py-2 text-[13px] rounded-full"
              style={{ color: active ? "#0f1f22" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
            >
              {active && (
                <motion.div
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "#7dd3a3" }}
                />
              )}
              <span className="relative">{it.label}</span>
            </button>
          );
        })}
      </div>
      <div
        className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-full"
        style={{
          background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
          border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)"}`,
        }}
      >
        <Search size={16} style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="캠페인 검색..."
          className="flex-1 bg-transparent outline-none text-[13px] placeholder:opacity-50"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        />
      </div>
    </div>
  );
}

export function CampaignListPage({ openCampaign, openCreate }: { openCampaign: (id: string) => void; openCreate: () => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const titleY = useTransform(scrollY, [0, 600], [0, -80]);

  const filtered = campaigns.filter(
    (c) => (filter === "all" || c.status === filter) && (query === "" || c.title.includes(query) || c.summary.includes(query)),
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen pt-32 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        <motion.div className="text-center mb-12" style={{ y: titleY }}>
          <p className="tracking-[0.4em] uppercase mb-3" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            Campaigns
          </p>
          <h1
            style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(48px, 6vw, 96px)", color: dark ? "#f9f7f2" : "#0f1f22" }}
          >
            함께 만드는 작은 변화
          </h1>
          <p className="mt-4 max-w-xl mx-auto" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
            모집중인 캠페인에 참여하거나, 다가올 캠페인을 미리 둘러보세요.
          </p>
        </motion.div>

        <div className="flex items-center justify-end mb-4">
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-full text-[13px] font-medium hover:-translate-y-0.5 transition-transform"
            style={{ background: "#7dd3a3", color: "#0f1f22" }}
          >
            + 캠페인 만들기
          </button>
        </div>

        <FilterBar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} />

        {filtered.length === 0 ? (
          <p className="text-center py-20" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
            조건에 맞는 캠페인이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((c) => (
              <CampaignCard key={c.id} c={c} onOpen={() => openCampaign(c.id)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
