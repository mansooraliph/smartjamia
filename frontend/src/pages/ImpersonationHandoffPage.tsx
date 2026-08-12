import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, AuthUser } from '@/stores/auth.store';

interface EnterState {
  action: 'enter';
  session: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    schoolSlug: string;
  };
}
interface ReturnState {
  action: 'return';
}
type HandoffState = EnterState | ReturnState;

/**
 * Neutral, unguarded stop between a superadmin session and an impersonated
 * tenant session (in either direction). Swapping auth-store state while still
 * rendering under a guarded route (SuperadminRoute / ProtectedRoute) races
 * that guard's own re-render against the navigate() call — the guard can see
 * the new user with the old URL for one tick and redirect to a login page.
 * Landing here first means the store swap happens on a route neither guard
 * watches, so there's nothing to race.
 */
export function ImpersonationHandoffPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enterImpersonation = useAuthStore((s) => s.enterImpersonation);
  const returnFromImpersonation = useAuthStore((s) => s.returnFromImpersonation);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const state = location.state as HandoffState | null;
    qc.clear();

    if (state?.action === 'enter') {
      enterImpersonation(state.session);
      navigate('/dashboard', { replace: true });
    } else if (state?.action === 'return') {
      returnFromImpersonation();
      navigate('/superadmin/schools', { replace: true });
    } else {
      // Landed here directly (refresh, bookmark) — nothing to hand off.
      navigate('/superadmin/login', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-slate-400">
      Switching session…
    </div>
  );
}
