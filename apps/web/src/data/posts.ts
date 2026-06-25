import { peoplePhotos, naturePhotos, fashionPhotos, objectPhotos, workshopPhotos, marketPhotos } from "./photos";

export type Post = {
  id: string;
  author: { name: string; verified: boolean };
  time: string;
  text: string;
  tags: string[];
  images: string[];
  likes: number;
  comments: number;
  campaignId?: string;
};

export const posts: Post[] = [
  {
    id: "p1",
    author: { name: "김다시", verified: true },
    time: "2시간 전",
    text: "낡은 청바지 두 벌로 토트백 한 개. 박음질 시간은 두 시간, 만족감은 일주일.",
    tags: ["#청바지업사이클", "#손바느질"],
    images: [fashionPhotos[0], fashionPhotos[2]],
    likes: 142,
    comments: 18,
    campaignId: "c1",
  },
  {
    id: "p2",
    author: { name: "초록도시", verified: false },
    time: "5시간 전",
    text: "오늘은 옥상 텃밭에 토마토를 옮겨 심었어요. 페트병 화분이 의외로 잘 자랍니다.",
    tags: ["#도시텃밭", "#페트병"],
    images: [naturePhotos[1], naturePhotos[4]],
    likes: 89,
    comments: 7,
  },
  {
    id: "p3",
    author: { name: "보틀앤캔들", verified: true },
    time: "어제",
    text: "버려진 와인병에 향을 담아 캔들로. 다음 주 공방 클래스 모집 시작합니다.",
    tags: ["#캔들", "#유리병", "#클래스"],
    images: [objectPhotos[0], objectPhotos[3]],
    likes: 256,
    comments: 32,
    campaignId: "c7",
  },
  {
    id: "p4",
    author: { name: "한강러너스", verified: true },
    time: "2일 전",
    text: "토요일 플로깅 후기. 두 시간 동안 40L 쓰레기 봉투 6개. 함께 뛴 분들 감사합니다 🌱",
    tags: ["#플로깅", "#한강"],
    images: [peoplePhotos[0]],
    likes: 410,
    comments: 56,
    campaignId: "c2",
  },
  {
    id: "p5",
    author: { name: "리메이크목공방", verified: false },
    time: "3일 전",
    text: "버려진 책상 상판으로 작은 의자 두 개. 결을 살리는 데에 사흘.",
    tags: ["#목공", "#가구업사이클"],
    images: [workshopPhotos[2], workshopPhotos[5]],
    likes: 178,
    comments: 14,
    campaignId: "c8",
  },
  {
    id: "p6",
    author: { name: "리룸", verified: true },
    time: "4일 전",
    text: "지난 마켓에서 모인 옷 312벌. 다음 마켓은 8월 둘째 주, 자세한 일정 곧 공유드릴게요.",
    tags: ["#기증마켓", "#리룸"],
    images: [marketPhotos[1], marketPhotos[4]],
    likes: 134,
    comments: 9,
  },
  {
    id: "p7",
    author: { name: "이연두", verified: false },
    time: "5일 전",
    text: "엄마 옷장에서 꺼낸 80년대 셔츠를 크롭으로 줄였습니다. 30년 묵은 핏이 의외로 멋져요.",
    tags: ["#리폼", "#빈티지"],
    images: [fashionPhotos[5], fashionPhotos[6]],
    likes: 92,
    comments: 11,
  },
  {
    id: "p8",
    author: { name: "원두모음", verified: false },
    time: "1주 전",
    text: "커피박 비누 만들기 기록. 카페에서 받은 찌꺼기로 30개 비누 완성.",
    tags: ["#커피박", "#비누"],
    images: [objectPhotos[1], objectPhotos[4]],
    likes: 201,
    comments: 22,
    campaignId: "c6",
  },
  {
    id: "p9",
    author: { name: "서울도시농부", verified: false },
    time: "1주 전",
    text: "버려진 우유팩으로 모종 트레이를 만들어 봤어요. 봄에 옮길 모종 100개 준비 완료.",
    tags: ["#도시농부", "#우유팩"],
    images: [naturePhotos[2]],
    likes: 64,
    comments: 5,
  },
  {
    id: "p10",
    author: { name: "다시다시", verified: true },
    time: "2주 전",
    text: "댕댕이 교복 캠페인 작업 중간 점검. 39명이 함께 만들고 있습니다.",
    tags: ["#댕교복", "#함께만들기"],
    images: [peoplePhotos[3], peoplePhotos[5]],
    likes: 320,
    comments: 41,
    campaignId: "c1",
  },
];
