export type PublicUser = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

/** Someone else's public profile: no email. */
export type UserProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};
