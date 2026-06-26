import { appConfig } from "@/lib/config";

const apiOrigin = (() => {
  try {
    return new URL(appConfig.apiBaseUrl).origin;
  } catch {
    return "";
  }
})();

export function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return "";
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (!apiOrigin) return url;
  return new URL(url, apiOrigin).toString();
}
