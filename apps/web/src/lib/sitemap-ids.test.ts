import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchAllSitemapIds } from "./sitemap-ids";

vi.mock("./api", () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from "./api";

const apiGetMock = vi.mocked(apiGet);

describe("fetchAllSitemapIds", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("totalPages 만큼 페이지를 순회한다", async () => {
    apiGetMock
      .mockResolvedValueOnce({ ids: ["a"], page: 0, size: 500, totalElements: 2, totalPages: 2 })
      .mockResolvedValueOnce({ ids: ["b"], page: 1, size: 500, totalElements: 2, totalPages: 2 });

    await expect(fetchAllSitemapIds("/api/posts/sitemap-ids", 500)).resolves.toEqual(["a", "b"]);
    expect(apiGetMock).toHaveBeenCalledTimes(2);
  });
});
