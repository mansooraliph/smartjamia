import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId?: string;
  schoolSlug?: string;
  /** Set for organization-admin sessions. */
  organizationId?: string;
  /** Auth scope: 'superadmin' | 'tenant' | 'organization' | 'account'. */
  scope?: string;
}

/** A school a multi-school account may enter (drives the in-app switcher). */
export interface AccountSchool {
  schoolId: string;
  code: string;
  slug: string;
  name: string;
  role: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  schoolSlug: string | null;

  /** Multi-school context — kept alongside the active tenant session so the
   * switcher can re-select another school without a fresh login. */
  accountToken: string | null;
  accountSchools: AccountSchool[] | null;

  /** Organization-admin origin context — kept when an org admin enters a
   * school, so they can switch schools and return to the org portal. */
  orgToken: string | null;
  orgRefreshToken: string | null;
  orgAdmin: AuthUser | null;
  orgSchools: AccountSchool[] | null;

  login: (params: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    schoolSlug?: string;
  }) => void;

  /** Enter a school WITHOUT clearing the multi-school / org origin context. */
  enterSchoolSession: (params: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    schoolSlug: string;
  }) => void;

  setAccountContext: (
    accountToken: string | null,
    accountSchools: AccountSchool[] | null,
  ) => void;

  setOrgContext: (params: {
    orgToken: string;
    orgRefreshToken: string;
    orgAdmin: AuthUser;
    orgSchools: AccountSchool[];
  }) => void;

  /** Keep the org switcher's school list current (e.g. after create/attach). */
  setOrgSchools: (orgSchools: AccountSchool[]) => void;

  /** Restore the org-admin session (return from a school to the org portal). */
  returnToOrg: () => void;

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
      accountToken: null,
      accountSchools: null,
      orgToken: null,
      orgRefreshToken: null,
      orgAdmin: null,
      orgSchools: null,

      // A plain login (school / superadmin / org) clears any origin context so
      // a stale switcher can't leak between sessions.
      login: ({ user, accessToken, refreshToken, schoolSlug }) =>
        set({
          user,
          accessToken,
          refreshToken,
          schoolSlug: schoolSlug ?? user.schoolSlug ?? get().schoolSlug,
          accountToken: null,
          accountSchools: null,
          orgToken: null,
          orgRefreshToken: null,
          orgAdmin: null,
          orgSchools: null,
        }),

      enterSchoolSession: ({ user, accessToken, refreshToken, schoolSlug }) =>
        set({ user, accessToken, refreshToken, schoolSlug }),

      setAccountContext: (accountToken, accountSchools) =>
        set({ accountToken, accountSchools }),

      setOrgContext: ({ orgToken, orgRefreshToken, orgAdmin, orgSchools }) =>
        set({ orgToken, orgRefreshToken, orgAdmin, orgSchools }),

      setOrgSchools: (orgSchools) => {
        if (get().orgToken) set({ orgSchools });
      },

      returnToOrg: () => {
        const { orgAdmin, orgToken, orgRefreshToken } = get();
        if (!orgAdmin || !orgToken) return;
        set({
          user: orgAdmin,
          accessToken: orgToken,
          refreshToken: orgRefreshToken,
          schoolSlug: null,
        });
      },

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
          accountToken: null,
          accountSchools: null,
          orgToken: null,
          orgRefreshToken: null,
          orgAdmin: null,
          orgSchools: null,
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
        accountToken: state.accountToken,
        accountSchools: state.accountSchools,
        orgToken: state.orgToken,
        orgRefreshToken: state.orgRefreshToken,
        orgAdmin: state.orgAdmin,
        orgSchools: state.orgSchools,
      }),
    },
  ),
);
