import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { appConfig } from "@/lib/config";
import { useAuthStore } from "@/store";
import { normalizeApiError } from "./errors";

interface TokenRefreshResponse {
  access: string;
  refresh?: string;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshRequest: Promise<TokenRefreshResponse> | null = null;

function requestAccessToken(refreshToken: string) {
  refreshRequest ??= axios
    .post<TokenRefreshResponse>(
      `${appConfig.apiBaseUrl}/auth/refresh/`,
      { refresh: refreshToken },
      { headers: { "Content-Type": "application/json" }, timeout: 15_000 },
    )
    .then(({ data }) => data)
    .finally(() => {
      refreshRequest = null;
    });

  return refreshRequest;
}

export const apiClient = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error instanceof AxiosError && error.response?.status === 401) {
      const originalRequest = error.config as RetriableRequestConfig | undefined;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (originalRequest && !originalRequest._retry && refreshToken && !originalRequest.url?.includes("/auth/refresh/")) {
        originalRequest._retry = true;

        try {
          const tokens = await requestAccessToken(refreshToken);
          useAuthStore.getState().setTokens(tokens);
          originalRequest.headers.Authorization = `Bearer ${tokens.access}`;
          return apiClient.request(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().clearSession();
          return Promise.reject(normalizeApiError(refreshError));
        }
      }

      if (!refreshToken) useAuthStore.getState().clearSession();
    }

    return Promise.reject(normalizeApiError(error));
  },
);
