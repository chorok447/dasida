import { fashionPhotos, naturePhotos, workshopPhotos, marketPhotos, objectPhotos, peoplePhotos } from "./photos";

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
};

const longBody = [
  "버려진 폐자전거의 부품을 업사이클링하여 디자인 소품을 만듭니다. 수익금은 자전거 기부에 사용됩니다.",
  "참여자에게는 작업 도구와 재료가 제공되며, 워크숍은 총 4주간 진행됩니다.",
  "함께 만든 결과물은 지역 도서관과 청소년 센터에 기부되어 다시 새로운 이야기를 만들어 갑니다.",
];

export const campaigns: Campaign[] = [
  {
    id: "c1",
    status: "open",
    title: "강아지를 위한 업사이클링 댕교복",
    summary: "버려진 의류를 활용해 반려견용 의류를 제작하고 보호소에 기부합니다.",
    thumb: fashionPhotos[1],
    recruitStart: "2026.06.18",
    recruitEnd: "2026.07.18",
    runStart: "2026.07.22",
    runEnd: "2026.08.20",
    capacity: 40,
    joined: 39,
    daysLeftLabel: "21일 남음",
    author: { name: "김다시", verified: true },
    body: {
      heading: "캠페인 소개",
      paragraphs: longBody,
      images: [fashionPhotos[0], fashionPhotos[2]],
    },
  },
  {
    id: "c2",
    status: "open",
    title: "한강공원 플로깅 데이",
    summary: "달리면서 줍는 환경 캠페인. 토요일 오전 두 시간.",
    thumb: peoplePhotos[0],
    recruitStart: "2026.06.10",
    recruitEnd: "2026.06.30",
    runStart: "2026.07.05",
    runEnd: "2026.07.05",
    capacity: 60,
    joined: 47,
    daysLeftLabel: "5일 남음",
    author: { name: "한강러너스", verified: true },
    body: {
      heading: "캠페인 소개",
      paragraphs: longBody,
      images: [peoplePhotos[2], peoplePhotos[4]],
    },
  },
  {
    id: "c3",
    status: "upcoming",
    title: "도시 텃밭 워크숍",
    summary: "재활용 화분으로 시작하는 작은 텃밭 클래스.",
    thumb: naturePhotos[1],
    recruitStart: "2026.07.01",
    recruitEnd: "2026.07.20",
    runStart: "2026.07.25",
    runEnd: "2026.08.25",
    capacity: 30,
    joined: 0,
    daysLeftLabel: "3일 후 모집 시작",
    author: { name: "서울도시농부", verified: false },
    body: {
      heading: "캠페인 소개",
      paragraphs: longBody,
      images: [naturePhotos[3], naturePhotos[5]],
    },
  },
  {
    id: "c4",
    status: "upcoming",
    title: "헌 옷 기증 마켓",
    summary: "잠든 옷장을 깨워 다시 입을 곳으로.",
    thumb: marketPhotos[1],
    recruitStart: "2026.07.15",
    recruitEnd: "2026.08.05",
    runStart: "2026.08.10",
    runEnd: "2026.08.11",
    capacity: 100,
    joined: 0,
    daysLeftLabel: "12일 후 모집 시작",
    author: { name: "리룸", verified: true },
    body: {
      heading: "캠페인 소개",
      paragraphs: longBody,
      images: [marketPhotos[3], marketPhotos[5]],
    },
  },
  {
    id: "c5",
    status: "closed",
    title: "폐현수막으로 만드는 에코백",
    summary: "선거철 현수막의 두 번째 인생.",
    thumb: workshopPhotos[0],
    recruitStart: "2026.04.01",
    recruitEnd: "2026.04.30",
    runStart: "2026.05.10",
    runEnd: "2026.05.30",
    capacity: 40,
    joined: 40,
    daysLeftLabel: "모집완료",
    author: { name: "김다시", verified: true },
    body: {
      heading: "캠페인 결과",
      paragraphs: longBody,
      images: [workshopPhotos[3], workshopPhotos[5]],
    },
  },
  {
    id: "c6",
    status: "closed",
    title: "커피박 비누 만들기",
    summary: "버려지는 커피 찌꺼기로 만드는 친환경 비누.",
    thumb: objectPhotos[1],
    recruitStart: "2026.03.10",
    recruitEnd: "2026.03.30",
    runStart: "2026.04.05",
    runEnd: "2026.04.20",
    capacity: 25,
    joined: 25,
    daysLeftLabel: "모집완료",
    author: { name: "원두모음", verified: false },
    body: {
      heading: "캠페인 결과",
      paragraphs: longBody,
      images: [objectPhotos[2], objectPhotos[4]],
    },
  },
  {
    id: "c7",
    status: "open",
    title: "유리병 캔들 메이킹",
    summary: "다 쓴 유리병에 향을 담아 다시.",
    thumb: objectPhotos[0],
    recruitStart: "2026.06.20",
    recruitEnd: "2026.07.10",
    runStart: "2026.07.15",
    runEnd: "2026.07.30",
    capacity: 20,
    joined: 12,
    daysLeftLabel: "14일 남음",
    author: { name: "보틀앤캔들", verified: true },
    body: {
      heading: "캠페인 소개",
      paragraphs: longBody,
      images: [objectPhotos[3], objectPhotos[5]],
    },
  },
  {
    id: "c8",
    status: "open",
    title: "버려진 가구로 만드는 작은 의자",
    summary: "친구와 함께하는 목공 업사이클.",
    thumb: workshopPhotos[2],
    recruitStart: "2026.06.01",
    recruitEnd: "2026.07.01",
    runStart: "2026.07.10",
    runEnd: "2026.07.31",
    capacity: 16,
    joined: 9,
    daysLeftLabel: "8일 남음",
    author: { name: "리메이크목공방", verified: false },
    body: {
      heading: "캠페인 소개",
      paragraphs: longBody,
      images: [workshopPhotos[4], workshopPhotos[6]],
    },
  },
];

export const statusMeta: Record<CampaignStatus, { label: string; color: string; fg: string }> = {
  open: { label: "모집중", color: "#7dd3a3", fg: "#0f1f22" },
  upcoming: { label: "모집예정", color: "#148a90", fg: "#ffffff" },
  closed: { label: "모집마감", color: "rgba(120,120,130,0.7)", fg: "#ffffff" },
};
