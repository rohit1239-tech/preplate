export const appConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://preplate.onrender.com/api/v1",
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? "wss://preplate.onrender.com/ws",
  appName: "Preplate",
} as const;
