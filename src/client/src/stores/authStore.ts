import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '@/types';
import { SESSION_CONFIG } from '@/config/constants';

interface AuthActions {
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  checkSession: () => boolean;
}

type AuthStore = AuthState & AuthActions;

const STORAGE_KEY = 'bodainsure-auth';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      setUser: (user) => set({ user }),

      setToken: (token) => set({ token }),

      login: (user, token) => {
        const expiresAt = Date.now() + SESSION_CONFIG.WEB_TIMEOUT_MINUTES * 60 * 1000;
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        // Store expiry separately for session checking
        localStorage.setItem(`${STORAGE_KEY}-expires`, expiresAt.toString());
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        localStorage.removeItem(`${STORAGE_KEY}-expires`);
      },

      setLoading: (isLoading) => set({ isLoading }),

      checkSession: () => {
        const state = get();
        if (!state.token) {
          set({ isLoading: false });
          return false;
        }

        const expiresAt = localStorage.getItem(`${STORAGE_KEY}-expires`);
        if (!expiresAt) {
          get().logout();
          return false;
        }

        const expiry = parseInt(expiresAt, 10);
        if (Date.now() > expiry) {
          get().logout();
          return false;
        }

        set({ isLoading: false });
        return true;
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Check session validity after rehydration
        if (state) {
          state.checkSession();
        }
      },
    }
  )
);
