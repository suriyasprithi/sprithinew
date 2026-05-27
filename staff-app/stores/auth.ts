import { create } from "zustand";
import { api, AuthUser, AuthTokens, StaffRole } from "@/lib/api";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import { registerDeviceToken, unregisterDeviceToken } from "@/lib/push";

type AuthState = {
  user: AuthUser | null;
  isHydrated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  login: (mobile: string, password: string, role: StaffRole) => Promise<AuthUser>;
  staffLogin: (mobile: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
};

const persistTokens = (tokens: AuthTokens) => {
  storage.set(STORAGE_KEYS.ACCESS, tokens.access_token);
  storage.set(STORAGE_KEYS.REFRESH, tokens.refresh_token);
};

const clearTokens = () => {
  storage.remove(STORAGE_KEYS.ACCESS);
  storage.remove(STORAGE_KEYS.REFRESH);
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  isLoading: false,

  hydrate: async () => {
    const token = storage.get(STORAGE_KEYS.ACCESS);
    if (!token) {
      set({ isHydrated: true });
      return;
    }
    try {
      const res = await api.get("/auth/me");
      const user = res.data.data as AuthUser;
      if (user.role === "customer") {
        clearTokens();
        set({ user: null, isHydrated: true });
        return;
      }
      set({ user, isHydrated: true });
      void registerDeviceToken();
    } catch {
      clearTokens();
      set({ user: null, isHydrated: true });
    }
  },

  login: async (mobile, password, role) => {
    set({ isLoading: true });
    try {
      const res = await api.post("/auth/login", {
        mobile_number: mobile,
        password,
        role,
      });
      const tokens = res.data.data as AuthTokens;
      persistTokens(tokens);
      set({ user: tokens.user });
      void registerDeviceToken();
      return tokens.user;
    } finally {
      set({ isLoading: false });
    }
  },

  staffLogin: async (mobile, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post("/auth/staff-login", {
        mobile_number: mobile,
        password,
      });
      const tokens = res.data.data as AuthTokens;
      persistTokens(tokens);
      set({ user: tokens.user });
      void registerDeviceToken();
      return tokens.user;
    } finally {
      set({ isLoading: false });
    }
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    try {
      await unregisterDeviceToken();
    } catch {
      // ignore
    }
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    clearTokens();
    set({ user: null });
  },
}));
