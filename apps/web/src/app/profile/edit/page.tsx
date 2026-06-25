"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Camera, Trash2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { ME_AVATAR } from "@/data/avatars";

function Field({ label, placeholder, locked, value }: { label: string; placeholder?: string; locked?: boolean; value?: string }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
      <label style={{ color: dark ? "rgba(255,255,255,0.8)" : "rgba(28,64,68,0.8)" }}>{label}</label>
      <div
        className="rounded-xl px-4 py-3 transition-colors"
        style={{
          background: locked
            ? dark
              ? "rgba(255,255,255,0.03)"
              : "rgba(28,64,68,0.04)"
            : dark
            ? "rgba(255,255,255,0.06)"
            : "#ffffff",
          border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)"}`,
          color: dark ? "#f9f7f2" : "#0f1f22",
          opacity: locked ? 0.7 : 1,
        }}
      >
        {value ? value : <input placeholder={placeholder} className="w-full bg-transparent outline-none placeholder:opacity-50" />}
      </div>
    </div>
  );
}

export default function ProfileEditPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 20 });
  const sy = useSpring(my, { stiffness: 150, damping: 20 });
  const rY = useTransform(sx, [-0.5, 0.5], [-8, 8]);
  const rX = useTransform(sy, [-0.5, 0.5], [6, -6]);

  return (
    <section
      className="relative min-h-screen pt-32 pb-20 px-6 transition-colors overflow-hidden"
      style={{
        position: "relative",
        backgroundImage: dark
          ? "linear-gradient(180deg,#0f1f22,#1c4044)"
          : "linear-gradient(180deg,#f9f7f2,#e7dfcb)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-32 right-1/4 w-[500px] h-[500px] rounded-full bg-[#7dd3a3] blur-[140px]" />
      </div>

      <div className="max-w-3xl mx-auto relative" style={{ perspective: 1400 }}>
        <p className="tracking-[0.4em] uppercase mb-3 text-center" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
          Settings
        </p>
        <h1
          className="text-center mb-12"
          style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 56, color: dark ? "#f9f7f2" : "#0f1f22" }}
        >
          개인정보 수정
        </h1>

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
          style={{ rotateX: rX, rotateY: rY, transformStyle: "preserve-3d" }}
          className="rounded-3xl p-10 border backdrop-blur-xl shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)]"
        >
          <div
            className="absolute inset-0 rounded-3xl -z-10"
            style={{
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
              borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.08)",
            }}
          />
          <div style={{ transform: "translateZ(40px)" }} className="relative">
            <div className="flex items-center gap-6 mb-10">
              <div className="relative">
                <img
                  src={ME_AVATAR}
                  alt="프로필"
                  className="w-24 h-24 rounded-full object-cover"
                />
                <button
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
                  style={{ background: "#7dd3a3", color: "#0f1f22" }}
                >
                  <Camera size={16} />
                </button>
              </div>
              <div>
                <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 24, color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  다시다시
                </h3>
                <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : "rgba(28,64,68,0.6)" }}>
                  프로필 사진을 클릭해 변경하세요
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="닉네임" placeholder="다시다시" />
              <Field label="이메일" value="dasikim@gmail.com" locked />
              <Field label="이름" value="김다시" locked />
              <Field label="현재 비밀번호" placeholder="현재 비밀번호" />
              <Field label="새 비밀번호" placeholder="새 비밀번호" />
              <Field label="새 비밀번호 확인" placeholder="새 비밀번호 확인" />
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button className="text-[13px] flex items-center gap-2" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
                <Trash2 size={14} /> 회원 탈퇴
              </button>
              <button
                className="px-8 py-3 rounded-xl font-medium hover:-translate-y-0.5 transition-transform"
                style={{ background: "#7dd3a3", color: "#0f1f22" }}
              >
                저장하기
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
