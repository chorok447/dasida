import { portraitPhotos } from "./photos";

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

// 현재 사용자는 img=1(pravatar index 0)로 고정.
export const ME_AVATAR = portraitPhotos[0];

export function avatarFor(name: string): string {
  if (name === "나" || name === "다시다시") return ME_AVATAR;
  // 1~69 인덱스로 69개의 고유한 얼굴 보장.
  return portraitPhotos[1 + (hash(name) % (portraitPhotos.length - 1))];
}
