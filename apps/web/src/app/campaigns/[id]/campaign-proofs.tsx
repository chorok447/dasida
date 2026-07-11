"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CurrentUserAvatar } from "@/components/current-user-avatar";
import { FallbackImage } from "@/components/fallback-image";
import { ImageFileUploadButton } from "@/components/image-file-upload-button";
import { ReportButton } from "@/components/report-button";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  MAX_PROOF_IMAGES,
  MAX_PROOF_TEXT_LENGTH,
  createCampaignProof,
  deleteCampaignProof,
  fetchCampaignProofs,
  type Campaign,
  type CampaignProof,
  type CampaignProofsResponse,
} from "@/data/campaigns";
import { ApiError } from "@/lib/api";
import { clearSession, getSessionId } from "@/lib/auth";
import { beginAuthedRequest, clearSessionIfUnauthorized, staleByIdentity } from "@/lib/authed-request";
import { useAuthSession } from "@/lib/use-auth-session";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function ProofItem({
  proof,
  deleting,
  onDelete,
}: {
  proof: CampaignProof;
  deleting: boolean;
  onDelete: (proof: CampaignProof) => void;
}) {

  return (
    <article
      className="rounded-2xl border p-5"
      style={{
        background: "var(--glass)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            name={proof.author.name}
            verified={proof.author.verified}
            size={36}
            src={proof.author.profileImageUrl ?? undefined}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                {proof.author.name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] text-[#148a90]">
                <BadgeCheck size={11} aria-hidden /> 참여 인증
              </span>
            </div>
            <time
              dateTime={proof.createdAt}
              className="text-[11px] opacity-55"
              style={{ color: "var(--foreground)" }}
            >
              {formatCreatedAt(proof.createdAt)}
            </time>
          </div>
        </div>
        {proof.ownedByMe ? (
          <button
            type="button"
            aria-label="내 참여 인증 삭제"
            onClick={() => onDelete(proof)}
            disabled={deleting}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: "var(--danger-soft)" }}
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        ) : (
          <ReportButton
            targetType="CAMPAIGN_PROOF"
            targetId={proof.id}
            ownedByMe={false}
            className="shrink-0 !px-2.5 !py-1.5"
          />
        )}
      </div>

      {proof.images.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {proof.images.map((image) => (
            <div key={image} className="aspect-square overflow-hidden rounded-xl">
              <FallbackImage
                src={image}
                alt={`${proof.author.name}님의 참여 인증 사진`}
                thumbnail
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}

      <p
        className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-7"
        style={{ color: "var(--foreground-muted)" }}
      >
        {proof.text}
      </p>
    </article>
  );
}

export function CampaignProofs({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const { sessionId: token } = useAuthSession();
  const confirm = useConfirm();
  const generationRef = useRef(0);

  const [page, setPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const requestIdentity = JSON.stringify([token, campaign.id, page, retryTick]);
  const [listState, setListState] = useState<{
    identity: string;
    status: "loading" | "success" | "error";
    response: CampaignProofsResponse | null;
  }>({ identity: "", status: "loading", response: null });
  const currentList = staleByIdentity(listState, requestIdentity, {
    identity: requestIdentity,
    status: "loading",
    response: null,
  });
  const status = currentList.status;
  const response = currentList.response;

  const [composeText, setComposeText] = useState("");
  const [composeImages, setComposeImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");

  const reload = useCallback(() => setRetryTick((tick) => tick + 1), []);

  useEffect(() => {
    if (getSessionId() !== token) return;
    const guard = beginAuthedRequest(generationRef, token);

    fetchCampaignProofs(campaign.id, page)
      .then((next) => {
        if (!guard.isCurrent()) return;
        // 마지막 항목 삭제 등으로 현재 페이지가 비면 마지막 유효 페이지로 복귀.
        if (next.content.length === 0 && page > 0) {
          setPage(Math.max(0, Math.min(page - 1, next.totalPages - 1)));
          return;
        }
        setListState({ identity: requestIdentity, status: "success", response: next });
      })
      .catch((error) => {
        if (!guard.isCurrent()) return;
        if (clearSessionIfUnauthorized(error, token)) return;
        setListState({ identity: requestIdentity, status: "error", response: null });
      });

    return guard.cancel;
  }, [campaign.id, page, token, requestIdentity]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !composeText.trim()) return;
    const requestToken = getSessionId();
    if (!requestToken) return;
    setSubmitting(true);
    setMutationError("");
    try {
      await createCampaignProof(campaign.id, { text: composeText.trim(), images: composeImages });
      if (getSessionId() !== requestToken) return;
      setComposeText("");
      setComposeImages([]);
      setPage(0);
      reload();
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 403) {
        setMutationError("캠페인에 참여한 사람만 인증을 남길 수 있어요.");
      } else if (error instanceof ApiError && error.status === 409) {
        setMutationError("모집 시작 전이거나 이미 인증을 남긴 캠페인입니다.");
        reload();
      } else {
        setMutationError("참여 인증 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const removeProof = async (proof: CampaignProof) => {
    if (deletingId) return;
    if (!(await confirm({ message: "참여 인증을 삭제할까요?", destructive: true, confirmLabel: "삭제" }))) return;
    const requestToken = getSessionId();
    if (!requestToken) return;
    setDeletingId(proof.id);
    setMutationError("");
    try {
      await deleteCampaignProof(campaign.id, proof.id);
      if (getSessionId() !== requestToken) return;
      reload();
    } catch (error) {
      if (getSessionId() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        router.push("/login");
      } else {
        setMutationError("참여 인증 삭제에 실패했습니다.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const proofedByMe = response?.proofedByMe ?? false;
  const canCompose = !!token && campaign.joinedByMe && campaign.status !== "upcoming" && !proofedByMe;
  const composeHint = !token
    ? "로그인 후 참여한 캠페인의 인증을 남길 수 있어요."
    : campaign.status === "upcoming"
      ? "모집이 시작되면 참여 인증을 남길 수 있어요."
      : !campaign.joinedByMe
        ? "캠페인에 참여한 사람만 인증을 남길 수 있어요."
        : proofedByMe
          ? "이미 참여 인증을 남겼어요. 삭제 후 다시 작성할 수 있어요."
          : null;

  return (
    <div
      className="rounded-3xl border p-5 sm:p-8"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
            참여 인증 {status === "success" && response ? response.totalElements.toLocaleString() : ""}
          </h2>
          <p className="mt-1 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
            참여 {campaign.joined.toLocaleString()}명 · 캠페인에서 실천한 순간을 사진과 함께 남겨보세요.
          </p>
        </div>
        <button
          type="button"
          aria-label="참여 인증 새로고침"
          onClick={reload}
          disabled={status === "loading"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-45"
          style={{ background: "rgba(var(--ink-rgb), 0.07)", color: "var(--heading)" }}
        >
          <RefreshCw size={16} className={status === "loading" ? "animate-spin" : ""} />
        </button>
      </div>

      {canCompose ? (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-6 rounded-2xl border p-4"
          style={{ borderColor: "var(--border)" }}
        >
          <label htmlFor="campaign-proof" className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
            참여 인증 작성
          </label>
          <div className="mt-2 flex gap-3">
            <CurrentUserAvatar size={36} />
            <textarea
              id="campaign-proof"
              value={composeText}
              onChange={(event) => setComposeText(event.target.value)}
              maxLength={MAX_PROOF_TEXT_LENGTH}
              rows={4}
              placeholder="캠페인에서 어떤 실천을 했는지 들려주세요."
              className="ui-control min-w-0 flex-1 resize-none bg-transparent px-3 py-3"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </div>

          {composeImages.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {composeImages.map((image) => (
                <div key={image} className="relative h-20 w-20 overflow-hidden rounded-xl">
                  <FallbackImage src={image} alt="업로드한 인증 사진" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="인증 사진 제거"
                    onClick={() => setComposeImages((current) => current.filter((it) => it !== image))}
                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ImageFileUploadButton
                label="사진 추가"
                disabled={submitting || composeImages.length >= MAX_PROOF_IMAGES}
                onUploaded={(url) =>
                  setComposeImages((current) =>
                    current.includes(url) || current.length >= MAX_PROOF_IMAGES ? current : [...current, url],
                  )}
              />
              <span className="text-[11px] opacity-55" style={{ color: "var(--foreground)" }}>
                {composeImages.length} / {MAX_PROOF_IMAGES}장 · {composeText.length} / {MAX_PROOF_TEXT_LENGTH}
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting || composeText.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "var(--accent)", color: "var(--surface-dark)" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "등록 중…" : "인증 등록"}
            </button>
          </div>
        </form>
      ) : composeHint ? (
        <p className="mt-6 rounded-2xl border px-5 py-4 text-[13px]" style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}>
          {composeHint}
        </p>
      ) : null}
      {mutationError ? <p role="alert" className="mt-3 text-[12px] text-[var(--danger)]">{mutationError}</p> : null}

      <div className="mt-7 space-y-3">
        {status === "loading" ? (
          <StatePanel compact>
            <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
            <p style={{ color: "var(--foreground-muted)" }}>참여 인증을 불러오는 중입니다.</p>
          </StatePanel>
        ) : null}

        {status === "error" ? (
          <StatePanel compact role="alert">
            <p style={{ color: "var(--foreground-muted)" }}>참여 인증을 불러오지 못했습니다.</p>
            <button type="button" onClick={reload} className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] text-[#0f1f22]">
              다시 시도
            </button>
          </StatePanel>
        ) : null}

        {status === "success" && response?.content.length === 0 ? (
          <StatePanel compact>
            <BadgeCheck size={26} className="opacity-35" />
            <p style={{ color: "rgba(var(--ink-rgb), 0.6)" }}>
              아직 참여 인증이 없습니다. 첫 인증을 남겨보세요.
            </p>
          </StatePanel>
        ) : null}

        {status === "success" && response ? response.content.map((proof) => (
          <ProofItem
            key={proof.id}
            proof={proof}
            deleting={deletingId === proof.id}
            onDelete={(target) => void removeProof(target)}
          />
        )) : null}
      </div>

      {status === "success" && response && response.totalElements > 0 ? (
        <Pagination
          page={response.page}
          totalPages={response.totalPages}
          totalElements={response.totalElements}
          compact
          className="mt-7"
          onPageChange={(nextPage) => setPage(Math.max(0, nextPage))}
        />
      ) : null}
    </div>
  );
}
