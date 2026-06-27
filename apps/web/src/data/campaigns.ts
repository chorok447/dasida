// 캠페인 데이터는 백엔드(GET /api/campaigns)가 source of truth. 타입 + 프레젠테이션 메타만 유지.
export type CampaignStatus = "open" | "upcoming" | "closed";

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
  author: { name: string; verified: boolean };
  body: { heading: string; paragraphs: string[]; images: string[] };
  joinedByMe: boolean;
};

export const statusMeta: Record<CampaignStatus, { label: string; color: string; fg: string }> = {
  open: { label: "모집중", color: "#7dd3a3", fg: "#0f1f22" },
  upcoming: { label: "모집예정", color: "#148a90", fg: "#ffffff" },
  closed: { label: "모집마감", color: "rgba(120,120,130,0.7)", fg: "#ffffff" },
};
