import { useEffect } from "react";

/** commentId 딥링크 시 해당 댓글로 스크롤한다. */
export function useCommentTargetScroll(
  targetCommentId: string | null,
  ready: boolean,
  hasTarget: boolean,
) {
  useEffect(() => {
    if (!targetCommentId || !ready || !hasTarget) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`comment-${targetCommentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [targetCommentId, ready, hasTarget]);
}
