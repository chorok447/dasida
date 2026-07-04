"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** URL 쿼리를 canonical href로 정규화한다. */
export function useCanonicalUrl(canonicalHref: string, currentHref: string) {
  const router = useRouter();

  useEffect(() => {
    if (currentHref !== canonicalHref) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, currentHref, router]);
}

export function parsePageParam(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}
