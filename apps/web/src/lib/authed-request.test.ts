import { describe, expect, it } from "vitest";
import { staleByIdentity } from "./authed-request";

describe("staleByIdentity", () => {
  it("identity가 다르면 loading 상태를 반환한다", () => {
    const loading = { identity: "b", status: "loading" as const };
    expect(staleByIdentity({ identity: "a", status: "success" as const }, "b", loading)).toEqual(loading);
  });

  it("identity가 같으면 저장된 상태를 유지한다", () => {
    const stored = { identity: "a", status: "success" as const };
    expect(staleByIdentity(stored, "a", { identity: "a", status: "loading" as const })).toBe(stored);
  });
});
