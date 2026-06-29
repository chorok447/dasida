import { Suspense } from "react";
import SearchClient from "./search-client";

function SearchFallback() {
  return (
    <section className="min-h-screen bg-[#f9f7f2] px-6 pb-20 pt-32 text-center text-[#1c4044]/60 dark:bg-[#0f1f22] dark:text-white/60">
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
