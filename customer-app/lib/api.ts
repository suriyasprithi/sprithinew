import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { storage, STORAGE_KEYS } from "./storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = storage.get(STORAGE_KEYS.ACCESS);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
type Pending = { resolve: (token: string) => void; reject: (err: unknown) => void };
let queue: Pending[] = [];

const flushQueue = (err: unknown, token: string | null) => {
  queue.forEach((p) => (token ? p.resolve(token) : p.reject(err)));
  queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (status !== 401 || !original) return Promise.reject(error);

    const url = original.url || "";
    if (url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/register")) {
      return Promise.reject(error);
    }
    if (original._retry) return Promise.reject(error);
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({
          resolve: (token) => {
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}` };
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const refresh = storage.get(STORAGE_KEYS.REFRESH);
      if (!refresh) throw new Error("no_refresh_token");
      const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refresh_token: refresh });
      const newAccess = res.data?.data?.access_token as string;
      const newRefresh = res.data?.data?.refresh_token as string;
      storage.set(STORAGE_KEYS.ACCESS, newAccess);
      storage.set(STORAGE_KEYS.REFRESH, newRefresh);
      flushQueue(null, newAccess);
      original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
      return api(original);
    } catch (err) {
      flushQueue(err, null);
      storage.remove(STORAGE_KEYS.ACCESS);
      storage.remove(STORAGE_KEYS.REFRESH);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string> | null;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string | null;
  mobile_number: string;
  role: "customer" | "vendor" | "taluk" | "district" | "state" | "driver" | "admin";
  status: "active" | "inactive" | "blocked";
  pincode: string | null;
  address_line: string | null;
  landmark: string | null;
  city: string | null;
  wallet_balance: number;
  level_wallet: number;
  level_1_wallet: number;
  level_2_wallet: number;
  level_3_wallet: number;
  buyback_wallet: number;
  global_wallet: number;
  token_balance: number;
  level_1_count: number;
  level_2_count: number;
  level_3_count: number;
};

export type WalletKey = "wallet" | "level" | "level_1" | "level_2" | "level_3" | "buyback" | "global";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  access_expires_in: number;
  token_type: string;
  user: AuthUser;
};

export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const ax = err as AxiosError<{ message?: string; errors?: Record<string, string> }>;
  return ax.response?.data?.message || ax.message || fallback;
}
