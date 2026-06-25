import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useTheme } from "../theme-context";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 20 });
  const sy = useSpring(my, { stiffness: 150, damping: 20 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-10, 10]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [8, -8]);

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <section
      onMouseMove={onMove}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative min-h-screen flex items-center justify-center px-6 py-32 overflow-hidden transition-colors"
      style={{
        position: "relative",
        perspective: 1400,
        backgroundImage: dark
          ? "linear-gradient(135deg,#0f1f22,#1c4044 50%,#2a5a4a)"
          : "linear-gradient(135deg,#f9f7f2,#e7dfcb 50%,#cfe6d3)",
      }}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] rounded-full bg-[#e7dfcb] blur-[140px]" />
      </div>

      <motion.div
        ref={ref}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative w-full max-w-md"
      >
        <motion.div
          style={{ transform: "translateZ(60px)" }}
          className="rounded-3xl p-10 backdrop-blur-xl border shadow-[0_40px_80px_-30px_rgba(0,0,0,0.5)]"
          // eslint-disable-next-line react/forbid-dom-props
        >
          <div
            style={{
              background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)",
              borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)",
              borderWidth: 1,
              borderStyle: "solid",
            }}
            className="absolute inset-0 rounded-3xl -z-10"
          />
          <div style={{ transform: "translateZ(20px)" }} className="relative">
            <p
              className="tracking-[0.4em] uppercase mb-3"
              style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}
            >
              {subtitle}
            </p>
            <h1
              style={{
                fontFamily: "'Black Han Sans', sans-serif",
                fontSize: 44,
                color: dark ? "#f9f7f2" : "#0f1f22",
              }}
            >
              {title}
            </h1>
            <div className="mt-8 space-y-4">{children}</div>
            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </motion.div>

        <motion.div
          style={{ transform: "translateZ(120px)" }}
          className="absolute -top-6 -right-6 w-20 h-20 rounded-2xl flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)]"
        >
          <div className="absolute inset-0 rounded-2xl bg-[#7dd3a3]" />
          <span
            className="relative"
            style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: "#0f1f22" }}
          >
            다시,
            <br />다
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}

export function FieldInput({
  icon,
  type = "text",
  placeholder,
  error,
}: {
  icon: React.ReactNode;
  type?: string;
  placeholder: string;
  error?: string;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div>
      <div
        className="relative flex items-center gap-3 rounded-xl px-4 py-3.5 transition-colors"
        style={{
          background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
        }}
      >
        <span style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none placeholder:opacity-50"
          style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}
        />
      </div>
      {error && <p className="mt-1.5 text-[12px] text-[#ed5c48] pl-1">{error}</p>}
    </div>
  );
}
