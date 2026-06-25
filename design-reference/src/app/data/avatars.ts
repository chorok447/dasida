import { portraitPhotos } from "./photos";

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

// Current user fixed to img=1 (pravatar index 0)
export const ME_AVATAR = portraitPhotos[0];

export function avatarFor(name: string): string {
  if (name === "나" || name === "다시다시") return ME_AVATAR;
  // Use indices 1–69 for other users — guarantees 69 distinct faces
  return portraitPhotos[1 + (hash(name) % (portraitPhotos.length - 1))];
}
