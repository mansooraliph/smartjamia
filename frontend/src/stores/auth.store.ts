import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId?: string;
  schoolSlug?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  schoolSlug: string | null;

  login: (params: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    schoolSlug?: string;
  }) => void;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setSchool: (slug: string) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;

  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      schoolSlug: null,

      login: ({ user, accessToken, refreshToken, schoolSlug }) =>
        set({
          user,
          accessToken,
          refreshToken,
          schoolSlug: schoolSlug ?? user.schoolSlug ?? get().schoolSlug,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setSchool: (slug) => set({ schoolSlug: slug }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          schoolSlug: null,
        }),

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'edupro-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        schoolSlug: state.schoolSlug,
      }),
    },
  ),
);
