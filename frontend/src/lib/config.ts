const deployedApiBaseUrl = "https://preplate.onrender.com/api/v1";
const deployedWsBaseUrl = "wss://preplate.onrender.com/ws";

function publicUrl(value: string | undefined, fallback: string) {
  if (!value || value.includes("127.0.0.1") || value.includes("localhost")) return fallback;
  return value;
}

export const appConfig = {
  apiBaseUrl: publicUrl(process.env.NEXT_PUBLIC_API_BASE_URL, deployedApiBaseUrl),
  wsBaseUrl: publicUrl(process.env.NEXT_PUBLIC_WS_BASE_URL, deployedWsBaseUrl),
  appName: "Preplate",
} as const;
