import { apiPut } from "@/lib/api";

export type UserProfile = {
  id: number;
  email: string;
  name: string;
  verified: boolean;
  profileImageUrl?: string | null;
};

export type UpdateProfileRequest = {
  name: string;
  profileImageUrl: string | null;
};

export type UpdateProfileResponse = {
  token: string;
  profile: UserProfile;
};

export const MAX_NAME_LENGTH = 30;
export const MAX_PROFILE_IMAGE_URL_LENGTH = 500;

export function isValidProfileImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function validateProfileUpdate(input: { name: string; profileImageUrl: string }):
  | { ok: true; name: string; profileImageUrl: string | null }
  | { ok: false; message: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "표시 이름을 입력해주세요." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, message: `표시 이름은 ${MAX_NAME_LENGTH}자 이하여야 합니다.` };
  }
  const imageUrl = input.profileImageUrl.trim();
  if (imageUrl.length > MAX_PROFILE_IMAGE_URL_LENGTH) {
    return { ok: false, message: `프로필 이미지 URL은 ${MAX_PROFILE_IMAGE_URL_LENGTH}자 이하여야 합니다.` };
  }
  if (imageUrl && !isValidProfileImageUrl(imageUrl)) {
    return { ok: false, message: "프로필 이미지 URL은 http:// 또는 https:// 로 시작해야 합니다." };
  }
  return { ok: true, name, profileImageUrl: imageUrl || null };
}

export function updateProfile(
  body: UpdateProfileRequest,
  token: string,
): Promise<UpdateProfileResponse> {
  return apiPut<UpdateProfileResponse>("/api/auth/me", body, token);
}
