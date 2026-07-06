import { create } from "zustand";
import { api, AuthUser, AuthTokens } from "@/lib/api";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import { registerDeviceToken, unregisterDeviceToken } from "@/lib/push";
import { clearPageCache } from "@/lib/page-cache";
import { wishlist } from "@/lib/wishlist";

type AuthState = {
  user: AuthUser | null;
  isHydrated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  login: (mobile: string, password: string) => Promise<AuthUser>;
  register: (input: { name: string; mobile: string; password: string; email?: string }) => Promise<AuthUser>;
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
      set({ user: res.data.data as AuthUser, isHydrated: true });
      void registerDeviceToken();
      void wishlist.hydrate();   // reconcile the wishlist with this account's server list
    } catch {
      clearTokens();
      set({ user: null, isHydrated: true });
    }
  },

  login: async (mobile, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post("/auth/login", {
        mobile_number: mobile,
        password,
        role: "customer",
      });
      const tokens = res.data.data as AuthTokens;
      persistTokens(tokens);
      clearPageCache();   // a new account must not see the previous user's cached pages
      wishlist.resetLocal();   // drop the guest cache; hydrate pulls this account's list
      set({ user: tokens.user });
      void registerDeviceToken();
      void wishlist.hydrate();
      return tokens.user;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async ({ name, mobile, password, email }) => {
    set({ isLoading: true });
    try {
      const res = await api.post("/auth/register", {
        name,
        mobile_number: mobile,
        password,
        email: email || undefined,
      });
      const tokens = res.data.data as AuthTokens;
      persistTokens(tokens);
      set({ user: tokens.user });
      void registerDeviceToken();
      void wishlist.hydrate();
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
      // ignore — local clear is what matters
    }
    clearTokens();
    clearPageCache();
    wishlist.resetLocal();   // clear this device's cache (server keeps the account's list)
    set({ user: null });
  },
}));
