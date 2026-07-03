export type UserProfile = {
  id: number;
  email: string;
  name: string;
  verified: boolean;
  profileImageUrl?: string | null;
};

export type UpdateProfileResponse = {
  token: string;
  profile: UserProfile;
};
