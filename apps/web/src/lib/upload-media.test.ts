import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  UploadValidationError,
  uploadMedia,
  uploadMediaErrorMessage,
} from "./upload-media";

const fetchMock = vi.fn();

describe("uploadMedia", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("5MB 초과 파일은 서버 호출 없이 즉시 거절한다", async () => {
    const file = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: MAX_UPLOAD_BYTES + 1 });

    await expect(uploadMedia(file)).rejects.toBeInstanceOf(UploadValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("사전 검증 실패 메시지는 그대로 사용자에게 보여준다", () => {
    const error = new UploadValidationError("이미지는 5MB 이하여야 합니다.");
    expect(uploadMediaErrorMessage(error, "fallback")).toBe("이미지는 5MB 이하여야 합니다.");
  });

  it("알 수 없는 오류는 fallback 메시지를 쓴다", () => {
    expect(uploadMediaErrorMessage(new Error("boom"), "이미지 업로드에 실패했습니다.")).toBe(
      "이미지 업로드에 실패했습니다.",
    );
  });
});
