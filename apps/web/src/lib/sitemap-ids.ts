import { apiGet } from "@/lib/api";

export type SitemapIdsResponse = {
  ids: string[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/** sitemap 전용 id 목록을 전 페이지 수집한다. */
export async function fetchAllSitemapIds(path: string, pageSize = 500): Promise<string[]> {
  const ids: string[] = [];
  let page = 0;
  while (true) {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
    const res = await apiGet<SitemapIdsResponse>(`${path}?${params.toString()}`);
    ids.push(...res.ids);
    if (res.totalPages === 0 || page + 1 >= res.totalPages) break;
    page += 1;
  }
  return ids;
}
