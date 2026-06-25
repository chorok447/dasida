export type NotifKind = "like" | "comment" | "campaign" | "system";

export type Notification = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  thumb?: string;
};

import { peoplePhotos, naturePhotos, objectPhotos, fashionPhotos } from "./photos";

export const notifications: Notification[] = [
  { id: "n1", kind: "like", title: "금잔디님이 좋아합니다", body: "낡은 청바지 두 벌로 토트백 한 개...", time: "5분 전", unread: true, thumb: fashionPhotos[0] },
  { id: "n2", kind: "comment", title: "익명의 고슴도치님이 댓글을 남겼습니다", body: "혹시 판매하실 의향도 있으신가요?", time: "1시간 전", unread: true, thumb: objectPhotos[0] },
  { id: "n3", kind: "campaign", title: "캠페인이 시작되었습니다", body: "한강공원 플로깅 데이가 곧 시작됩니다.", time: "3시간 전", unread: true, thumb: peoplePhotos[0] },
  { id: "n4", kind: "like", title: "초록도시님이 좋아합니다", body: "오늘은 옥상 텃밭에 토마토를 옮겨...", time: "어제", unread: false, thumb: naturePhotos[1] },
  { id: "n5", kind: "comment", title: "리룸님이 댓글을 남겼습니다", body: "다음 마켓에서도 함께해요!", time: "2일 전", unread: false, thumb: fashionPhotos[2] },
  { id: "n6", kind: "campaign", title: "관심 캠페인이 마감됩니다", body: "유리병 캔들 메이킹 D-1", time: "3일 전", unread: false, thumb: objectPhotos[3] },
  { id: "n7", kind: "system", title: "비밀번호 변경 완료", body: "보안을 위해 정기적으로 변경해주세요.", time: "1주 전", unread: false },
  { id: "n8", kind: "system", title: "다시,다 v1.2 업데이트", body: "캠페인 알림 기능이 개선되었습니다.", time: "2주 전", unread: false },
];
