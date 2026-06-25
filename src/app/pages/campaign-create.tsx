import { useState } from "react";
import { motion } from "motion/react";
import { Calendar, Users, FileText, Layers, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useTheme } from "../theme-context";
import { workshopPhotos, naturePhotos, fashionPhotos, objectPhotos, marketPhotos } from "../data/photos";
import { statusMeta } from "../data/campaigns";

const steps = [
  { id: 0, label: "기본 정보", icon: <FileText size={14} /> },
  { id: 1, label: "일정", icon: <Calendar size={14} /> },
  { id: 2, label: "모집", icon: <Users size={14} /> },
  { id: 3, label: "내용", icon: <Layers size={14} /> },
];

const thumbChoices = [workshopPhotos[0], naturePhotos[1], fashionPhotos[0], objectPhotos[0], marketPhotos[1]];

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl outline-none placeholder:opacity-50"
      style={{
        background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
        border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
        color: dark ? "#f9f7f2" : "#0f1f22",
      }}
    />
  );
}

export function CampaignCreatePage({ goBack }: { goBack: () => void }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [thumb, setThumb] = useState(thumbChoices[0]);
  const [recruitStart, setRecruitStart] = useState("2026-07-01");
  const [recruitEnd, setRecruitEnd] = useState("2026-07-31");
  const [runStart, setRunStart] = useState("2026-08-05");
  const [runEnd, setRunEnd] = useState("2026-08-30");
  const [capacity, setCapacity] = useState("30");

  const next = () => setStep((s) => Math.min(3, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

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

      <div className="max-w-6xl mx-auto relative">
        <button onClick={goBack} className="mb-6 inline-flex items-center gap-2 text-[13px] opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
          <ArrowLeft size={14} /> 캠페인 목록
        </button>

        <div className="text-center mb-10">
          <p className="tracking-[0.4em] uppercase mb-3" style={{ color: dark ? "#7dd3a3" : "#1c4044", fontSize: 11 }}>
            Create Campaign
          </p>
          <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(36px, 4.5vw, 60px)", color: dark ? "#f9f7f2" : "#0f1f22" }}>
            새 캠페인 개설
          </h1>
        </div>

        <div className="flex justify-center mb-10">
          <div className="flex gap-1 p-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)" }}>
            {steps.map((s) => {
              const active = step === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className="relative px-5 py-2 text-[13px] rounded-full inline-flex items-center gap-2"
                  style={{ color: active ? "#0f1f22" : dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)" }}
                >
                  {active && <motion.div layoutId="step-pill" className="absolute inset-0 rounded-full" style={{ background: "#7dd3a3" }} />}
                  <span className="relative inline-flex items-center gap-2">
                    {s.icon} {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div
            className="rounded-3xl border p-8 space-y-5"
            style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
          >
            {step === 0 && (
              <>
                <div>
                  <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>제목</label>
                  <Input value={title} onChange={setTitle} placeholder="예) 한강공원 플로깅 데이" />
                </div>
                <div>
                  <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>한 줄 요약</label>
                  <Input value={summary} onChange={setSummary} placeholder="짧게 캠페인을 소개해 주세요" />
                </div>
                <div>
                  <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>썸네일</label>
                  <div className="grid grid-cols-5 gap-2">
                    {thumbChoices.map((src) => (
                      <button
                        key={src}
                        onClick={() => setThumb(src)}
                        className="aspect-square rounded-lg overflow-hidden border-2"
                        style={{ borderColor: thumb === src ? "#7dd3a3" : "transparent" }}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>모집 시작</label>
                    <Input value={recruitStart} onChange={setRecruitStart} type="date" />
                  </div>
                  <div>
                    <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>모집 종료</label>
                    <Input value={recruitEnd} onChange={setRecruitEnd} type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>진행 시작</label>
                    <Input value={runStart} onChange={setRunStart} type="date" />
                  </div>
                  <div>
                    <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>진행 종료</label>
                    <Input value={runEnd} onChange={setRunEnd} type="date" />
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div>
                  <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>모집 인원</label>
                  <Input value={capacity} onChange={setCapacity} placeholder="숫자" type="number" />
                </div>
                <p className="text-[13px] opacity-60" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>
                  모집 인원이 차면 자동으로 모집이 종료됩니다.
                </p>
              </>
            )}
            {step === 3 && (
              <div>
                <label className="text-[12px] tracking-[0.2em] uppercase mb-2 block opacity-70" style={{ color: dark ? "#f9f7f2" : "#0f1f22" }}>본문</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  placeholder="캠페인의 배경과 진행 방식, 참여자에게 제공되는 것 등을 자세히 적어주세요."
                  className="w-full px-4 py-3 rounded-xl outline-none resize-none placeholder:opacity-50"
                  style={{
                    background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
                    border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(28,64,68,0.1)"}`,
                    color: dark ? "#f9f7f2" : "#0f1f22",
                  }}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={prev}
                disabled={step === 0}
                className="px-5 py-3 rounded-xl inline-flex items-center gap-2 disabled:opacity-30"
                style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(28,64,68,0.06)", color: dark ? "#f9f7f2" : "#0f1f22" }}
              >
                <ArrowLeft size={14} /> 이전
              </button>
              {step < 3 ? (
                <button
                  onClick={next}
                  className="ml-auto px-5 py-3 rounded-xl font-medium inline-flex items-center gap-2"
                  style={{ background: "#7dd3a3", color: "#0f1f22" }}
                >
                  다음 <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={goBack}
                  className="ml-auto px-5 py-3 rounded-xl font-medium inline-flex items-center gap-2"
                  style={{ background: "#7dd3a3", color: "#0f1f22" }}
                >
                  <Send size={14} /> 캠페인 등록
                </button>
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-24 self-start">
            <p className="text-[12px] tracking-[0.3em] uppercase mb-3" style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(28,64,68,0.5)" }}>
              미리보기
            </p>
            <div
              className="rounded-2xl border overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)]"
              style={{ background: dark ? "rgba(255,255,255,0.04)" : "#ffffff", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={thumb} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f22]/60 via-transparent to-transparent" />
                <span className="absolute top-3 right-3 text-[11px] tracking-[0.2em] px-2.5 py-1 rounded-full" style={{ background: statusMeta.upcoming.color, color: "#fff" }}>
                  모집예정
                </span>
              </div>
              <div className="p-5 space-y-3">
                <h3 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: dark ? "#f9f7f2" : "#0f1f22", lineHeight: 1.25 }}>
                  {title || "캠페인 제목"}
                </h3>
                <p className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,0.65)" : "rgba(28,64,68,0.65)" }}>
                  {summary || "캠페인 한 줄 소개가 여기에 표시됩니다."}
                </p>
                <div className="text-[12px] space-y-1 pt-2 border-t" style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(28,64,68,0.7)", borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(28,64,68,0.08)" }}>
                  <div>모집 {recruitStart} ~ {recruitEnd}</div>
                  <div>진행 {runStart} ~ {runEnd}</div>
                  <div>모집 인원 {capacity}명</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
