import { describe, expect, it } from "vitest";
import { staleByIdentity } from "./authed-request";

type TestState = { identity: string; status: "loading" | "success" };

describe("staleByIdentity", () => {
  it("identity가 다르면 loading 상태를 반환한다", () => {
    const loading: TestState = { identity: "b", status: "loading" };
    expect(staleByIdentity<TestState>({ identity: "a", status: "success" }, "b", loading)).toEqual(loading);
  });

  it("identity가 같으면 저장된 상태를 유지한다", () => {
    const stored: TestState = { identity: "a", status: "success" };
    expect(staleByIdentity<TestState>(stored, "a", { identity: "a", status: "loading" })).toBe(stored);
  });
});
