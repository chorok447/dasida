export type MypageTab = "posts" | "commented" | "campaigns" | "created" | "saved" | "account" | "access" | "reports";

export const MYPAGE_TAB_GROUPS: { label: string; tabs: { id: MypageTab; label: string }[] }[] = [
  {
    label: "활동",
    tabs: [
      { id: "posts", label: "내 게시글" },
      { id: "commented", label: "댓글 단 글" },
      { id: "campaigns", label: "참여 캠페인" },
      { id: "created", label: "개설 캠페인" },
      { id: "saved", label: "저장됨" },
    ],
  },
  {
    label: "계정",
    tabs: [
      { id: "account", label: "보안" },
      { id: "access", label: "접속 기록" },
      { id: "reports", label: "신고 내역" },
    ],
  },
];

export const DEFAULT_MYPAGE_TAB: MypageTab = "posts";

export function parseMypageTab(value: string | null): MypageTab {
  if (value === "security") return "account";
  for (const group of MYPAGE_TAB_GROUPS) {
    if (group.tabs.some((tab) => tab.id === value)) return value as MypageTab;
  }
  return DEFAULT_MYPAGE_TAB;
}
