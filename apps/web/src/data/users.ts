export type UserProfile = {
  id: number;
  email: string;
  name: string;
  verified: boolean;
};

export type UpdateProfileResponse = {
  token: string;
  profile: UserProfile;
};
