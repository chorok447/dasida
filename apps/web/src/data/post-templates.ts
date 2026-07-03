// 게시글 작성 화면의 기록 예시 템플릿. static data로만 관리한다.
// 카테고리 6종과 1:1로 대응한다. 이미지/캠페인 연결은 사용자 고유 값이라 채우지 않는다.
import type { PostComposeValues } from "@/data/posts";

export type PostTemplate = {
  id: string;
  /** 칩 버튼에 표시되는 이름 */
  label: string;
  /** 적용 시 함께 선택되는 카테고리 */
  category: string;
  values: Pick<PostComposeValues, "text" | "tags">;
};

export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: "fashion-reform",
    label: "👕 옷 리폼 기록",
    category: "패션",
    values: {
      text: `안 입던 (예: 청바지)를 (예: 에코백)으로 리폼했어요.

✂️ 이렇게 만들었어요
1. (준비물과 과정을 적어주세요)
2.

💡 해보니 알게 된 팁
- (예: 밑단은 손바느질이 더 깔끔해요)`,
      tags: ["리폼", "옷수선"],
    },
  },
  {
    id: "garden-diary",
    label: "🌱 텃밭 일지",
    category: "도시텃밭",
    values: {
      text: `(예: 옥상 텃밭) (예: 32)일차 기록이에요.

🌱 오늘의 텃밭
- 키우는 작물: (예: 상추, 방울토마토)
- 오늘 한 일: (예: 물주기, 곁순 정리)

💡 같이 키우는 분들께
- (예: 요즘 같은 날씨엔 저녁에 물을 주는 게 좋아요)`,
      tags: ["도시텃밭", "텃밭일지"],
    },
  },
  {
    id: "workshop-craft",
    label: "🔨 공방 작업 기록",
    category: "공방",
    values: {
      text: `(예: 버려진 목재)로 (예: 소품 선반)을 만들었어요.

🔨 작업 과정
1. (재료를 어디서 구했는지, 어떻게 만들었는지 적어주세요)
2.

💡 다음에 만들 분들께
- (예: 사포질은 결 방향대로 해야 깔끔해요)`,
      tags: ["공방", "핸드메이드"],
    },
  },
  {
    id: "donation-review",
    label: "🎁 나눔·기증 후기",
    category: "기증",
    values: {
      text: `(예: 안 읽는 책 20권)을 (예: 동네 작은도서관)에 기증했어요.

🎁 나눔 이야기
- 나눈 물건: (무엇을, 왜 나누게 됐는지 적어주세요)
- 나눈 곳: (기증처나 나눔 방법을 알려주세요)

💡 나눔을 고민하는 분들께
- (예: 상태 좋은 물건은 사진을 찍어 올리면 금방 나눔돼요)`,
      tags: ["나눔", "기증"],
    },
  },
  {
    id: "leftover-cooking",
    label: "🍳 남은 재료 요리",
    category: "음식",
    values: {
      text: `버리기 아까운 (예: 자투리 채소)로 (예: 채소전)을 만들었어요.

🍳 레시피
1. (재료와 만드는 과정을 적어주세요)
2.

💡 음식물 쓰레기 줄이는 팁
- (예: 채소 껍질은 모아서 육수를 내면 좋아요)`,
      tags: ["제로웨이스트", "요리"],
    },
  },
  {
    id: "furniture-repair",
    label: "🪑 가구 수리 기록",
    category: "가구",
    values: {
      text: `버리려던 (예: 흔들리는 의자)를 고쳐서 다시 쓰게 됐어요.

🪑 수리 과정
1. (어디가 문제였고 어떻게 고쳤는지 적어주세요)
2.

💡 고쳐 쓰고 싶은 분들께
- (예: 나사 구멍이 헐거우면 이쑤시개와 목공풀로 메울 수 있어요)`,
      tags: ["가구리폼", "수리"],
    },
  },
];
