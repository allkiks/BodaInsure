import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, AuthState, Language } from '@/types';
import { SESSION_CONFIG } from '@/config/constants';
import i18n from '@/i18n';

const TOKEN_KEY = 'bodainsure_token';
const USER_KEY = 'bodainsure_user';
const EXPIRY_KEY = 'bodainsure_expiry';

interface AuthActions {
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  checkSession: () => Promise<boolean>;
  updateLanguage: (language: Language) => void;
  updateUser: (updatedUser: Partial<User>) => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  // Actions
  setUser: (user) => set({ user }),

  setToken: (token) => set({ token }),

  login: async (user, token) => {
    const expiresAt = Date.now() + SESSION_CONFIG.MOBILE_TIMEOUT_DAYS * 24 * 60 * 60 * 1000;

    // Store securely
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    await SecureStore.setItemAsync(EXPIRY_KEY, expiresAt.toString());

    // Update language based on user preference
    if (user.language) {
      i18n.changeLanguage(user.language);
    }

    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    // Clear secure storage
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(EXPIRY_KEY);

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  checkSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      const expiryStr = await SecureStore.getItemAsync(EXPIRY_KEY);

      if (!token || !userJson || !expiryStr) {
        set({ isLoading: false });
        return false;
      }

      const expiry = parseInt(expiryStr, 10);
      if (Date.now() > expiry) {
        await get().logout();
        return false;
      }

      const user = JSON.parse(userJson) as User;

      // Update language based on user preference
      if (user.language) {
        i18n.changeLanguage(user.language);
      }

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  updateLanguage: (language) => {
    const { user } = get();
    if (user) {
      i18n.changeLanguage(language);
      set({ user: { ...user, language } });
      // Persist user update
      SecureStore.setItemAsync(USER_KEY, JSON.stringify({ ...user, language }));
    }
  },

  updateUser: async (updatedUser) => {
    const { user } = get();
    if (user) {
      const newUser = { ...user, ...updatedUser };
      set({ user: newUser });
      // Persist user update
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
    }
  },
}));
