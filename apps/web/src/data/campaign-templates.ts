// 캠페인 작성 화면의 유형별 템플릿. static data로만 관리한다.
import { fashionPhotos, marketPhotos, naturePhotos, objectPhotos, workshopPhotos } from "@/data/photos";
import type { CampaignComposeValues } from "@/data/campaigns";

export type CampaignTemplate = {
  id: string;
  /** 칩 버튼에 표시되는 이름 */
  label: string;
  /** 적용되는 필드. 일정은 사용자별로 달라 채우지 않는다. */
  values: Pick<CampaignComposeValues, "title" | "summary" | "body" | "thumb" | "capacity">;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "upcycling-workshop",
    label: "♻️ 업사이클링 워크숍",
    values: {
      title: "우리 동네 업사이클링 워크숍",
      summary: "버려지는 물건에 새 쓸모를 만드는 원데이 워크숍",
      body: `🌱 왜 이 워크숍을 여나요
(워크숍을 열게 된 계기와 목표를 적어주세요)

📋 진행 방식
- 모임 장소: (예: ○○동 주민센터 2층)
- 만들 것: (예: 버려진 청바지로 파우치 만들기)
- 준비물: (예: 안 입는 옷 1벌, 나머지 재료는 제공)

🎁 참여하면 좋은 점
- (예: 직접 만든 업사이클링 소품을 가져갈 수 있어요)`,
      thumb: workshopPhotos[0],
      capacity: "15",
    },
  },
  {
    id: "sharing",
    label: "🎁 중고 물품 나눔",
    values: {
      title: "안 쓰는 물건 나눔 데이",
      summary: "쓸모를 다한 물건이 새 주인을 만나는 나눔 모임",
      body: `🌱 어떤 나눔인가요
(나눔을 열게 된 배경을 적어주세요)

📋 진행 방식
- 나눔 장소: (예: ○○공원 정자 앞)
- 나눔 물품: (예: 의류, 도서, 주방용품 등)
- 참여 방법: (예: 나눌 물건 1개 이상 가져오기)

🙌 함께 지켜요
- (예: 깨끗하게 손질한 물건만 가져와 주세요)`,
      thumb: marketPhotos[1],
      capacity: "50",
    },
  },
  {
    id: "plogging",
    label: "🏃 지역 플로깅",
    values: {
      title: "주말 아침 동네 플로깅",
      summary: "가볍게 뛰며 우리 동네를 깨끗하게 만드는 플로깅",
      body: `🌱 왜 함께 뛰나요
(플로깅을 시작하게 된 이유를 적어주세요)

📋 진행 방식
- 집결 장소: (예: ○○역 2번 출구)
- 코스: (예: 하천 산책로 왕복 3km)
- 준비물: (예: 편한 운동화, 집게와 봉투는 제공)

🎁 참여하면 좋은 점
- (예: 참여 인증과 함께 소소한 기념품을 드려요)`,
      thumb: naturePhotos[1],
      capacity: "30",
    },
  },
  {
    id: "repair-class",
    label: "🔧 수리·리폼 클래스",
    values: {
      title: "고쳐 쓰는 수리·리폼 클래스",
      summary: "버리기 전에 고쳐 쓰는 법을 배우는 소규모 클래스",
      body: `🌱 왜 고쳐 쓰나요
(클래스를 열게 된 계기를 적어주세요)

📋 진행 방식
- 모임 장소: (예: ○○ 공방)
- 배울 내용: (예: 의류 수선 기초, 가구 보수)
- 준비물: (예: 고치고 싶은 물건 1점)

🎁 참여하면 좋은 점
- (예: 내 물건을 직접 고쳐서 가져갈 수 있어요)`,
      thumb: objectPhotos[0],
      capacity: "10",
    },
  },
  {
    id: "zero-waste",
    label: "🌿 제로웨이스트 챌린지",
    values: {
      title: "일주일 제로웨이스트 챌린지",
      summary: "일상 속 쓰레기를 줄이는 습관을 함께 만드는 챌린지",
      body: `🌱 어떤 챌린지인가요
(챌린지의 목표와 규칙을 적어주세요)

📋 진행 방식
- 기간: (예: 진행 기간 동안 매일 실천 인증)
- 인증 방법: (예: 실천 사진을 댓글로 공유)
- 실천 예시: (예: 텀블러 사용, 장바구니 들기)

🎁 참여하면 좋은 점
- (예: 완주자에게 소정의 리워드를 드려요)`,
      thumb: fashionPhotos[0],
      capacity: "30",
    },
  },
];
