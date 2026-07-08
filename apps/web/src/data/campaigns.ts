// 캠페인 데이터는 백엔드 API가 source of truth. 타입 + 프레젠테이션 메타만 유지.
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { mergeCampaignBodyForEditor } from "@/lib/rich-body-html";
import { richTextPlainLength } from "@/lib/rich-text-length";
import type { CommentPageLocationResponse } from "@/data/comments";

export type CampaignStatus = "open" | "upcoming" | "closed";
export type CampaignSearchSort = "latest" | "popular" | "deadline";
export type CampaignRecruitState = "before_recruit" | "recruiting" | "ended" | "closed";

export type CampaignDateRangeFilters = {
  recruitEndFrom: string;
  recruitEndTo: string;
  runStartFrom: string;
  runStartTo: string;
};

export type CampaignSearchParams = {
  q?: string;
  status?: CampaignStatus;
  recruitState?: CampaignRecruitState;
  availableOnly?: boolean;
  sort?: CampaignSearchSort;
  page?: number;
  size?: number;
  recruitEndFrom?: string;
  recruitEndTo?: string;
  runStartFrom?: string;
  runStartTo?: string;
};

export type CampaignDateRangeField = keyof CampaignDateRangeFilters;

export const EMPTY_CAMPAIGN_DATE_RANGE_FILTERS: CampaignDateRangeFilters = {
  recruitEndFrom: "",
  recruitEndTo: "",
  runStartFrom: "",
  runStartTo: "",
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function readIsoDate(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  return isIsoDate(trimmed) ? trimmed : "";
}

export function readCampaignDateRangeFilters(params: { get(name: string): string | null }): CampaignDateRangeFilters {
  return {
    recruitEndFrom: readIsoDate(params.get("recruitEndFrom")),
    recruitEndTo: readIsoDate(params.get("recruitEndTo")),
    runStartFrom: readIsoDate(params.get("runStartFrom")),
    runStartTo: readIsoDate(params.get("runStartTo")),
  };
}

export function appendCampaignDateRangeFilters(
  params: URLSearchParams,
  filters: CampaignDateRangeFilters,
): void {
  (Object.keys(filters) as CampaignDateRangeField[]).forEach((field) => {
    if (filters[field]) params.set(field, filters[field]);
  });
}

export function campaignDateRangeError(filters: CampaignDateRangeFilters): string | null {
  if (filters.recruitEndFrom && filters.recruitEndTo && filters.recruitEndFrom > filters.recruitEndTo) {
    return "모집 마감일의 시작일은 종료일보다 늦을 수 없습니다.";
  }
  if (filters.runStartFrom && filters.runStartTo && filters.runStartFrom > filters.runStartTo) {
    return "진행 시작일의 시작일은 종료일보다 늦을 수 없습니다.";
  }
  return null;
}

export function hasCampaignDateRangeFilters(filters: CampaignDateRangeFilters): boolean {
  return Object.values(filters).some(Boolean);
}

export type Campaign = {
  id: string;
  status: CampaignStatus;
  title: string;
  summary: string;
  thumb: string;
  recruitStart: string;
  recruitEnd: string;
  runStart: string;
  runEnd: string;
  capacity: number;
  joined: number;
  daysLeftLabel: string;
  recruitable: boolean;
  recruitState: CampaignRecruitState;
  author: { name: string; verified: boolean; profileImageUrl?: string | null };
  body: { heading: string; paragraphs: string[]; images: string[] };
  joinedByMe: boolean;
  bookmarkedByMe: boolean;
  ownedByMe: boolean;
  /** 관리자 숨김 여부. 개설자 본인 경로(mine/상세)에서만 true 로 내려온다. */
  hidden?: boolean;
};

export type CampaignParticipant = {
  participantId: string;
  name: string;
  verified: boolean;
};

export type CampaignParticipantsResponse = {
  campaignId: string;
  title: string;
  status: CampaignStatus;
  capacity: number;
  joined: number;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  participants: CampaignParticipant[];
};

export type CampaignSearchResponse = {
  content: Campaign[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

// 마이페이지 캠페인 pagination 응답(참여/개설). 백엔드 CampaignPageResponse 와 1:1.
export type CampaignPageResponse = {
  content: Campaign[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

const MY_CAMPAIGNS_PAGE_SIZE = 9;

function campaignsPage(path: string, page: number): Promise<CampaignPageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(MY_CAMPAIGNS_PAGE_SIZE) });
  return apiGet<CampaignPageResponse>(`${path}?${params.toString()}`);
}

export const fetchJoinedCampaignsPage = (page: number) => campaignsPage("/api/campaigns/joined/page", page);
export const fetchMyCampaignsPage = (page: number) => campaignsPage("/api/campaigns/mine/page", page);
export const fetchBookmarkedCampaignsPage = (page: number) => campaignsPage("/api/campaigns/bookmarks/page", page);

export function bookmarkCampaign(campaignId: string): Promise<Campaign> {
  return apiPost<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}/bookmark`, {});
}

export function unbookmarkCampaign(campaignId: string): Promise<Campaign> {
  return apiDelete<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}/bookmark`);
}

export type CampaignParticipantRemovalResponse = {
  campaignId: string;
  participantId: string;
  removed: boolean;
  joined: number;
};

/** 개설자용 참가자 강제 퇴장. apiDelete 가 getSessionId() 으로 인증 헤더를 붙이며 갱신된 joined 를 반환한다. */
export function removeCampaignParticipant(
  campaignId: string,
  participantId: string,
): Promise<CampaignParticipantRemovalResponse> {
  return apiDelete<CampaignParticipantRemovalResponse>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/participants/${encodeURIComponent(participantId)}`,
  );
}

export type CampaignComment = {
  id: string;
  campaignId: string;
  author: { name: string; verified: boolean; profileImageUrl?: string | null };
  text: string;
  createdAt: string;
  ownedByMe: boolean;
  edited: boolean;
  updatedAt: string | null;
};

export type UpdateCampaignCommentRequest = { text: string };

export type CampaignCommentsResponse = {
  content: CampaignComment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function fetchCampaignCommentPageLocation(
  campaignId: string,
  commentId: string,
  size = 20,
): Promise<CommentPageLocationResponse> {
  const query = new URLSearchParams({ size: String(size) });
  return apiGet<CommentPageLocationResponse>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/comments/${encodeURIComponent(commentId)}/page?${query.toString()}`,
  );
}

export function updateCampaignComment(
  campaignId: string,
  commentId: string,
  body: UpdateCampaignCommentRequest,
): Promise<CampaignComment> {
  return apiPut<CampaignComment>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/comments/${encodeURIComponent(commentId)}`,
    body,
  );
}

export const statusMeta: Record<CampaignStatus, { label: string; color: string; fg: string }> = {
  open: { label: "모집중", color: "#7dd3a3", fg: "#0f1f22" },
  upcoming: { label: "모집예정", color: "#148a90", fg: "#ffffff" },
  closed: { label: "모집마감", color: "rgba(120,120,130,0.7)", fg: "#ffffff" },
};

const recruitStateMeta: Record<CampaignRecruitState, { label: string; color: string; fg: string }> = {
  before_recruit: { label: "모집예정", color: "#148a90", fg: "#ffffff" },
  recruiting: { label: "모집중", color: "#7dd3a3", fg: "#0f1f22" },
  ended: { label: "모집종료", color: "rgba(120,120,130,0.7)", fg: "#ffffff" },
  closed: { label: "모집마감", color: "rgba(120,120,130,0.7)", fg: "#ffffff" },
};

export function campaignRecruitMeta(campaign: Campaign) {
  if (campaign.recruitState === "recruiting" && !campaign.recruitable && campaign.joined >= campaign.capacity) {
    return { label: "정원마감", color: "rgba(237,92,72,0.82)", fg: "#ffffff" };
  }
  return recruitStateMeta[campaign.recruitState];
}

/** 백엔드 CampaignValidators 와 동일한 제한. */
export const CAMPAIGN_MAX_CAPACITY = 10_000;
export const CAMPAIGN_MAX_BODY_LENGTH = 8000;

export const CAMPAIGN_COMPOSE_DRAFT_KEY = "dasida:campaign-compose-draft";

export type CampaignComposeValues = {
  title: string;
  summary: string;
  body: string;
  thumb: string;
  recruitStart: string;
  recruitEnd: string;
  runStart: string;
  runEnd: string;
  capacity: string;
};

export type CampaignComposePayload = Omit<CampaignComposeValues, "capacity"> & { capacity: number };

export type CampaignComposeField =
  | "title"
  | "summary"
  | "body"
  | "thumb"
  | "recruitStart"
  | "recruitEnd"
  | "runStart"
  | "runEnd"
  | "capacity";

export type CampaignComposeValidationResult =
  | { ok: true; payload: CampaignComposePayload }
  | { ok: false; message: string; field?: CampaignComposeField };

export function isValidCampaignImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export const DEFAULT_CAMPAIGN_COMPOSE_VALUES: CampaignComposeValues = {
  title: "",
  summary: "",
  body: "",
  thumb: "",
  recruitStart: "2026-07-01",
  recruitEnd: "2026-07-31",
  runStart: "2026-08-05",
  runEnd: "2026-08-30",
  capacity: "30",
};

export function campaignToComposeValues(campaign: Campaign): CampaignComposeValues {
  return {
    title: campaign.title,
    summary: campaign.summary,
    body: mergeCampaignBodyForEditor(campaign.body.paragraphs, campaign.body.images),
    thumb: campaign.thumb,
    recruitStart: campaign.recruitStart,
    recruitEnd: campaign.recruitEnd,
    runStart: campaign.runStart,
    runEnd: campaign.runEnd,
    capacity: String(campaign.capacity),
  };
}

export function validateCampaignCompose(values: CampaignComposeValues): CampaignComposeValidationResult {
  const title = values.title.trim();
  if (!title) {
    return { ok: false, message: "캠페인 제목을 입력해주세요.", field: "title" };
  }

  const thumb = values.thumb.trim();
  if (thumb && !isValidCampaignImageUrl(thumb)) {
    return {
      ok: false,
      message: "썸네일 URL은 http:// 또는 https:// 로 시작해야 합니다.",
      field: "thumb",
    };
  }

  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { ok: false, message: "모집 인원은 1 이상의 정수여야 합니다.", field: "capacity" };
  }
  if (capacity > CAMPAIGN_MAX_CAPACITY) {
    return {
      ok: false,
      message: `모집 인원은 ${CAMPAIGN_MAX_CAPACITY.toLocaleString()}명 이하여야 합니다.`,
      field: "capacity",
    };
  }

  const dateFields: { key: CampaignComposeField; value: string; label: string }[] = [
    { key: "recruitStart", value: values.recruitStart, label: "모집 시작일" },
    { key: "recruitEnd", value: values.recruitEnd, label: "모집 종료일" },
    { key: "runStart", value: values.runStart, label: "진행 시작일" },
    { key: "runEnd", value: values.runEnd, label: "진행 종료일" },
  ];

  for (const field of dateFields) {
    if (!field.value.trim()) {
      return { ok: false, message: `${field.label}을(를) 입력해주세요.`, field: field.key };
    }
    if (!isIsoDate(field.value)) {
      return { ok: false, message: `${field.label}은(는) yyyy-MM-dd 형식이어야 합니다.`, field: field.key };
    }
  }

  const { recruitStart, recruitEnd, runStart, runEnd } = values;
  if (recruitStart > recruitEnd) {
    return {
      ok: false,
      message: "모집 시작일은 모집 종료일보다 늦을 수 없습니다.",
      field: "recruitEnd",
    };
  }
  if (recruitEnd > runStart) {
    return {
      ok: false,
      message: "모집 종료일은 진행 시작일보다 늦을 수 없습니다.",
      field: "recruitEnd",
    };
  }
  if (recruitEnd > runEnd) {
    return {
      ok: false,
      message: "모집 종료일은 진행 종료일보다 늦을 수 없습니다.",
      field: "recruitEnd",
    };
  }
  if (runStart > runEnd) {
    return {
      ok: false,
      message: "진행 시작일은 진행 종료일보다 늦을 수 없습니다.",
      field: "runEnd",
    };
  }

  const bodyPlainLength = richTextPlainLength(values.body);
  if (bodyPlainLength > CAMPAIGN_MAX_BODY_LENGTH) {
    return {
      ok: false,
      message: `본문은 ${CAMPAIGN_MAX_BODY_LENGTH.toLocaleString()}자 이하여야 합니다.`,
      field: "body",
    };
  }

  return {
    ok: true,
    payload: {
      title,
      summary: values.summary.trim(),
      body: values.body.trim(),
      thumb,
      recruitStart,
      recruitEnd,
      runStart,
      runEnd,
      capacity,
    },
  };
}
