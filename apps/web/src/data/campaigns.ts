// 캠페인 데이터는 백엔드 API가 source of truth. 타입 + 프레젠테이션 메타만 유지.
import { apiDelete, apiGet } from "@/lib/api";

export type CampaignStatus = "open" | "upcoming" | "closed";
export type CampaignSearchSort = "latest" | "popular" | "deadline";
export type CampaignRecruitState = "before_recruit" | "recruiting" | "ended" | "closed";

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
  author: { name: string; verified: boolean };
  body: { heading: string; paragraphs: string[]; images: string[] };
  joinedByMe: boolean;
  ownedByMe: boolean;
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

export type CampaignParticipantRemovalResponse = {
  campaignId: string;
  participantId: string;
  removed: boolean;
  joined: number;
};

/** 개설자용 참가자 강제 퇴장. apiDelete 가 getToken() 으로 인증 헤더를 붙이며 갱신된 joined 를 반환한다. */
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
  author: { name: string; verified: boolean };
  text: string;
  createdAt: string;
  ownedByMe: boolean;
};

export type CampaignCommentsResponse = {
  content: CampaignComment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

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
