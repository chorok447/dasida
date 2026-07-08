"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";

export function ListEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const fg = "var(--foreground)";

  return (
    <StatePanel>
      <Search size={32} className="opacity-35" aria-hidden />
      <p className="font-medium" style={{ color: fg }}>
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-[13px] leading-6 opacity-60" style={{ color: fg }}>
          {description}
        </p>
      ) : null}
      {action}
    </StatePanel>
  );
}
