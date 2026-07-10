"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { apiPost, apiDelete, apiDeleteVoid, ApiError } from "@/lib/api";
import { getSessionId, clearSession } from "@/lib/auth";
import { useAuthedRefresh } from "@/lib/use-authed-refresh";
import { ReportButton } from "@/components/report-button";
import { AdminModerationButton } from "@/components/admin-moderation-button";
import { PageShell } from "@/components/page-shell";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { recordPostView, type Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";
import { PostDetailComments } from "./post-detail-comments";
import { PostDetailHero } from "./post-detail-hero";

export default function PostDetailClient({ post, linkedCampaign }: { post: Post; linkedCampaign: Campaign | null }) {
  const router = useRouter();
  const p = post;
  const [idx, setIdx] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [likes, setLikes] = useState(p.likes);
  const [liked, setLiked] = useState(p.likedByMe);
  const [liking, setLiking] = useState(false);
  const [bookmarked, setBookmarked] = useState(p.bookmarkedByMe);
  const [bookmarking, setBookmarking] = useState(false);
  const [owned, setOwned] = useState(p.ownedByMe);
  const [deleting, setDeleting] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments);
  const commentSectionRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  // 상세 진입 1회당 조회수 기록. StrictMode 이중 실행은 개발 모드 한정이라 그대로 둔다.
  useEffect(() => {
    recordPostView(p.id);
  }, [p.id]);

  const { refreshing, invalidatePending } = useAuthedRefresh<Post>(
    `/api/posts/${p.id}`,
    (u) => {
      setLikes(u.likes);
      setLiked(u.likedByMe);
      setBookmarked(u.bookmarkedByMe);
      setOwned(u.ownedByMe);
    },
    () => {
      setLiked(false);
      setBookmarked(false);
      setOwned(false);
    },
  );

  const onDelete = async () => {
    if (deleting) return;
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (!(await confirm({ message: "이 게시글을 삭제할까요? 되돌릴 수 없습니다.", destructive: true, confirmLabel: "삭제" }))) return;
    setDeleting(true);
    try {
      await apiDeleteVoid(`/api/posts/${p.id}`);
      if (getSessionId() !== requestToken) return;
      router.push("/mypage");
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인이 필요합니다.");
        router.push("/login");
      } else if (e instanceof ApiError && e.status === 403) {
        toast.error("삭제 권한이 없습니다.");
      } else {
        toast.error("게시글 삭제에 실패했습니다.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const onLike = async () => {
    if (!getSessionId()) {
      toast.error("로그인 후 이용할 수 있어요.");
      router.push("/login");
      return;
    }
    if (liking || refreshing) return;
    setLiking(true);
    invalidatePending();
    const requestToken = getSessionId();
    try {
      const updated = liked
        ? await apiDelete<Post>(`/api/posts/${p.id}/like`)
        : await apiPost<Post>(`/api/posts/${p.id}/like`, {});
      if (getSessionId() !== requestToken) return;
      setLikes(updated.likes);
      setLiked(updated.likedByMe);
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인 후 이용할 수 있어요.");
        router.push("/login");
      } else {
        toast.error("좋아요 처리에 실패했습니다.");
      }
    } finally {
      setLiking(false);
    }
  };

  const onBookmark = async () => {
    const requestToken = getSessionId();
    if (!requestToken) {
      toast.error("로그인 후 이용할 수 있어요.");
      router.push("/login");
      return;
    }
    if (bookmarking || refreshing) return;
    setBookmarking(true);
    invalidatePending();
    try {
      const updated = bookmarked
        ? await apiDelete<Post>(`/api/posts/${p.id}/bookmark`)
        : await apiPost<Post>(`/api/posts/${p.id}/bookmark`, {});
      if (getSessionId() !== requestToken) return;
      setBookmarked(updated.bookmarkedByMe);
    } catch (e) {
      if (getSessionId() !== requestToken) return;
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        toast.error("로그인 후 이용할 수 있어요.");
        router.push("/login");
      } else {
        toast.error("북마크 처리에 실패했습니다.");
      }
    } finally {
      setBookmarking(false);
    }
  };

  return (
    <PageShell paddingClassName="relative min-h-screen pt-28 pb-20 px-6 overflow-hidden" orb="right">
      <div className="max-w-5xl mx-auto relative">
        <h1 className="sr-only">게시글 상세</h1>
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/feed")}
            className="inline-flex items-center gap-2 text-[13px] opacity-70 hover:opacity-100"
            style={{ color: "var(--foreground)" }}
          >
            <ArrowLeft size={14} /> 피드로 돌아가기
          </button>

          {owned ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/posts/${p.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px]"
                style={{ background: "var(--border)", color: "var(--foreground)" }}
              >
                <Pencil size={13} /> 수정
              </Link>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] disabled:opacity-50"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                <Trash2 size={13} /> {deleting ? "삭제 중…" : "삭제"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AdminModerationButton targetType="POST" targetId={p.id} />
              <ReportButton targetType="POST" targetId={p.id} ownedByMe={false} />
            </div>
          )}
        </div>

        <PostDetailHero
          post={p}
          linkedCampaign={linkedCampaign}
          idx={idx}
          imageFailed={imageFailed}
          likes={likes}
          liked={liked}
          liking={liking}
          bookmarked={bookmarked}
          bookmarking={bookmarking}
          refreshing={refreshing}
          commentCount={commentCount}
          onImageError={() => setImageFailed(true)}
          onPrevImage={() => {
            setImageFailed(false);
            setIdx((i) => (i - 1 + p.images.length) % p.images.length);
          }}
          onNextImage={() => {
            setImageFailed(false);
            setIdx((i) => (i + 1) % p.images.length);
          }}
          onLike={() => void onLike()}
          onBookmark={() => void onBookmark()}
          onOpenCampaign={(id) => router.push(`/campaigns/${id}`)}
          onScrollToComments={() => commentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />

        <PostDetailComments
          postId={p.id}
          count={commentCount}
          onCountChange={setCommentCount}
          sectionRef={commentSectionRef}
        />
      </div>
    </PageShell>
  );
}
