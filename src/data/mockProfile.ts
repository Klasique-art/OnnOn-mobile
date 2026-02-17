export type MockProfile = {
  displayName: string;
  email: string;
  bio: string;
  avatarUri: string | null;
  role: string;
  isVerified: boolean;
  planName: "free" | "basic" | "pro";
  preferences: {
    theme: "light" | "dark";
    notifications: boolean;
    audioDefault: boolean;
    videoDefault: boolean;
    showOnlineStatus: boolean;
  };
};

export const mockProfile: MockProfile = {
  displayName: "Klasique",
  email: "klassique@example.com",
  bio: "Building calm and reliable video collaboration experiences.",
  avatarUri: null,
  role: "Product Lead",
  isVerified: true,
  planName: "basic",
  preferences: {
    theme: "light",
    notifications: true,
    audioDefault: true,
    videoDefault: true,
    showOnlineStatus: true,
  },
};
