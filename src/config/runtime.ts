export const runtimeConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000",
  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:3000",
};

export const hasRealtimeConfig = Boolean(
  process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_BASE_URL
);
