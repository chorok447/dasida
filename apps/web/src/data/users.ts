import { apiDeleteVoid, apiGet, apiPostVoid, apiPut } from "@/lib/api";
import type { PostPageResponse } from "@/data/posts";

export type UserProfile = {
  id: number;
  email: string;
  name: string;
  verified: boolean;
  profileImageUrl?: string | null;
  notifyCampaignUpdates?: boolean;
  notifyMessages?: boolean;
  role?: "USER" | "ADMIN";
};

export type PublicUser = {
  id: number;
  name: string;
  verified: boolean;
  profileImageUrl?: string | null;
  postCount: number;
  followerCount: number;
  followingCount: number;
  followedByMe?: boolean | null;
  blockedByMe?: boolean | null;
};

export type RecommendedUsersResponse = {
  items: PublicUser[];
};

export type PublicUserPageResponse = {
  content: PublicUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function fetchPublicUser(id: number): Promise<PublicUser> {
  return apiGet<PublicUser>(`/api/users/${id}`);
}

export function fetchRecommendedUsers(size = 4): Promise<RecommendedUsersResponse> {
  return apiGet<RecommendedUsersResponse>(`/api/users/recommended?size=${size}`);
}

export async function followUser(id: number): Promise<void> {
  await apiPostVoid(`/api/users/${id}/follow`);
}

export async function unfollowUser(id: number): Promise<void> {
  await apiDeleteVoid(`/api/users/${id}/follow`);
}

export async function blockUser(id: number): Promise<void> {
  await apiPostVoid(`/api/users/${id}/block`);
}

export async function unblockUser(id: number): Promise<void> {
  await apiDeleteVoid(`/api/users/${id}/block`);
}

export function fetchMyFollowingPage(page: number, size = 10): Promise<PublicUserPageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiGet<PublicUserPageResponse>(`/api/users/me/following?${params.toString()}`);
}

export function fetchMyFollowersPage(page: number, size = 10): Promise<PublicUserPageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiGet<PublicUserPageResponse>(`/api/users/me/followers?${params.toString()}`);
}

export function searchUsersPage(q: string, page: number, size = 12): Promise<PublicUserPageResponse> {
  const params = new URLSearchParams({ q, page: String(page), size: String(size) });
  return apiGet<PublicUserPageResponse>(`/api/users/search?${params.toString()}`);
}

export function fetchUserPostsPage(userId: number, page: number, size = 10): Promise<PostPageResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiGet<PostPageResponse>(`/api/users/${userId}/posts?${params.toString()}`);
}

export type UpdateProfileRequest = {
  name: string;
  profileImageUrl: string | null;
  notifyCampaignUpdates?: boolean;
  notifyMessages?: boolean;
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
): Promise<UpdateProfileResponse> {
  return apiPut<UpdateProfileResponse>("/api/auth/me", body);
}
