"use client";

import { forwardRef, type ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** pt-32 pb-20 px-6 등 페이지별 패딩 */
  paddingClassName?: string;
  /** blur orb 위치 variant */
  orb?: "left" | "right" | "center" | "none";
};

const orbClass: Record<NonNullable<PageShellProps["orb"]>, string> = {
  left: "absolute top-20 left-1/3 h-[500px] w-[500px] rounded-full bg-[var(--accent)] blur-[140px]",
  right: "absolute right-1/4 top-20 h-[500px] w-[500px] rounded-full bg-[var(--accent)] blur-[140px]",
  center: "absolute top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-[var(--accent)] blur-[140px]",
  none: "",
};

export const PageShell = forwardRef<HTMLElement, PageShellProps>(function PageShell(
  {
    children,
    className = "",
    paddingClassName = "px-6 pb-20 pt-32",
    orb = "left",
  },
  ref,
) {
  return (
    <section
      ref={ref}
      className={`relative min-h-screen overflow-hidden transition-colors ${paddingClassName} ${className}`}
      style={{ backgroundImage: "var(--page-gradient)" }}
    >
      {orb !== "none" ? (
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className={orbClass[orb]} />
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
});
