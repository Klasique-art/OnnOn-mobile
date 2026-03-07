import axios from "axios";
import Constants from "expo-constants";

import { API_BASE_URL } from "@/config/settings";
import { authStorage } from "@/lib/auth";

const getMetroHost = (): string | null => {
  const constantsAny = Constants as any;
  const hostUri =
    constantsAny?.expoConfig?.hostUri ||
    constantsAny?.manifest2?.extra?.expoGo?.debuggerHost ||
    constantsAny?.manifest?.debuggerHost ||
    constantsAny?.manifest?.hostUri;

  if (!hostUri || typeof hostUri !== "string") return null;
  return hostUri.split(":")[0] || null;
};

const resolveApiBaseUrl = (rawBaseUrl: string): string => {
  if (!__DEV__) return rawBaseUrl;

  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.hostname !== "10.0.2.2") return rawBaseUrl;

    const metroHost = getMetroHost();
    if (!metroHost) return rawBaseUrl;

    parsed.hostname = metroHost;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return rawBaseUrl;
  }
};

const RESOLVED_API_BASE_URL = resolveApiBaseUrl(API_BASE_URL);

const client = axios.create({
  baseURL: RESOLVED_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

client.interceptors.request.use(async (config) => {
  if (__DEV__ && config.url) {
    const requestBase = config.baseURL || RESOLVED_API_BASE_URL;
    console.log("[API] Request", {
      method: config.method?.toUpperCase?.() || "GET",
      url: config.url,
      baseURL: requestBase,
      fullUrl: `${requestBase}${config.url}`,
    });
  }

  const token = await authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const method = error.config?.method?.toUpperCase?.() || "UNKNOWN";
    const url = error.config?.url || "UNKNOWN_URL";

    console.error("[API] Request failed", {
      method,
      url,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    return Promise.reject(error);
  }
);

export default client;
