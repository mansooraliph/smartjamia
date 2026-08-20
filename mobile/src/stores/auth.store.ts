import { create } from 'zustand';
import { secureStorage } from '../lib/secure-storage';

export type Role = 'teacher' | 'student';

export interface TeacherUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  schoolId: string;
  schoolSlug: string;
}

export interface StudentUser {
  id: string;
  name: string;
  role: 'student';
  schoolSlug: string;
}

interface PersistedSession {
  roleKind: Role | null;
  token: string | null;
  schoolSlug: string | null;
  teacherUser: TeacherUser | null;
  studentUser: StudentUser | null;
}

interface AuthState extends PersistedSession {
  /** True once the persisted session has been read back from secure storage — index.tsx waits on this before deciding where to redirect, to avoid a flash to /login before a real session loads. */
  hasHydrated: boolean;

  loginAsTeacher: (params: { token: string; user: TeacherUser }) => void;
  loginAsStudent: (params: { token: string; user: StudentUser }) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const STORAGE_KEY = 'edupro-mobile-auth';

function persistSession(state: PersistedSession) {
  secureStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Session persisted via a hand-rolled read/write pair, NOT zustand's own
 * `persist`/`createJSONStorage` middleware — that middleware lives in
 * `zustand/middleware.js`, one shared file covering persist/devtools/immer/
 * etc together. Metro (unlike a real ES-module bundler) can't tree-shake
 * unused named exports out of a single file, so importing `persist` alone
 * still pulls in `devtools`'s top-level `import.meta.env` reference — a
 * hard SyntaxError on web (a plain, non-`type="module"` `<script>` tag
 * can't parse `import.meta` at all; confirmed live, reproduced fresh after
 * a full node_modules reinstall, traced to this exact line in
 * zustand/middleware.js). Native/Hermes tolerated it fine — this is a
 * web-bundle-only failure. Reimplementing the ~15 lines this actually
 * needs avoids importing that file at all, and avoids the same class of
 * bug from zustand's other middleware exports in the future.
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  roleKind: null,
  token: null,
  schoolSlug: null,
  teacherUser: null,
  studentUser: null,
  hasHydrated: false,

  loginAsTeacher: ({ token, user }) => {
    const next = { roleKind: 'teacher' as const, token, schoolSlug: user.schoolSlug, teacherUser: user, studentUser: null };
    set(next);
    persistSession(next);
  },

  loginAsStudent: ({ token, user }) => {
    const next = { roleKind: 'student' as const, token, schoolSlug: user.schoolSlug, studentUser: user, teacherUser: null };
    set(next);
    persistSession(next);
  },

  logout: () => {
    const next = { roleKind: null, token: null, schoolSlug: null, teacherUser: null, studentUser: null };
    set(next);
    persistSession(next);
  },

  isAuthenticated: () => !!get().token,
}));

secureStorage
  .getItem(STORAGE_KEY)
  .then((raw) => {
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSession;
      useAuthStore.setState({ ...parsed, hasHydrated: true });
    } else {
      useAuthStore.setState({ hasHydrated: true });
    }
  })
  .catch(() => {
    useAuthStore.setState({ hasHydrated: true });
  });
