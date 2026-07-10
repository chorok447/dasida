"use client";

import { type CSSProperties, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * ui-control 스타일 비밀번호 입력 + 표시 토글. 마이페이지 계정 폼처럼 `<label>텍스트 <input/></label>`
 * 패턴 안에서 쓰인다 — label 내부 버튼 클릭이 라벨 기본동작(입력 포커스)으로 번지지 않게 preventDefault.
 * 토글 접근성 이름은 필드명을 포함하지 않는 고정 문구("비밀번호 표시/숨기기")로 둔다
 * (e2e 의 getByLabel 부분일치가 필드 라벨과 충돌하지 않도록).
 */
export function PasswordControl({
  value,
  onChange,
  autoComplete,
  disabled,
  minLength,
  maxLength,
  className,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative mt-2">
      <input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        minLength={minLength}
        maxLength={maxLength}
        className={`ui-control pr-11 ${className ?? ""}`}
        style={style}
      />
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          setRevealed((v) => !v);
        }}
        aria-label={revealed ? "비밀번호 숨기기" : "비밀번호 표시"}
        aria-pressed={revealed}
        disabled={disabled}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 disabled:opacity-40"
        style={{ color: "rgba(var(--ink-rgb), 0.5)" }}
      >
        {revealed ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
      </button>
    </div>
  );
}
