import { Suspense } from "react";
import SearchClient from "./search-client";

function SearchFallback() {
  return (
    <section
      className="min-h-screen px-6 pb-20 pt-32 text-center"
      style={{ background: "var(--surface)", color: "rgba(var(--ink-rgb), 0.6)" }}
    >
      검색 조건을 불러오는 중입니다.
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchClient />
    </Suspense>
  );
}
