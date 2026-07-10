"use client";


export function Footer() {
  return (
    <footer
      className="py-10 px-8 transition-colors"
      style={{ background: "var(--surface-deep)", color: "rgba(255,255,255,0.6)" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p style={{ fontFamily: "var(--font-black-han), sans-serif", fontSize: 22, color: "#7dd3a3" }}>다시, 다</p>
        <p className="text-[12px] tracking-[0.3em] uppercase">© 2026 Upcycle Project · 서비스 소개 · 팀 소개</p>
      </div>
    </footer>
  );
}
