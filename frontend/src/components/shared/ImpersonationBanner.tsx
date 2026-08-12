import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, ArrowLeftCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

/** Shown while a superadmin is impersonating a school's admin — lets them
 * jump back to the superadmin panel without a fresh login. */
export function ImpersonationBanner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const impersonatorUser = useAuthStore((s) => s.impersonatorUser);
  const returnFromImpersonation = useAuthStore((s) => s.returnFromImpersonation);
  const user = useAuthStore((s) => s.user);

  if (!impersonatorUser) return null;

  const exit = () => {
    returnFromImpersonation();
    qc.clear();
    navigate('/superadmin/schools');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-900 px-6 py-2 text-sm text-indigo-50">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          Viewing as <span className="font-semibold">{user?.name}</span> —
          impersonated by superadmin <span className="font-semibold">{impersonatorUser.name}</span>.
        </span>
      </div>
      <button
        onClick={exit}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-600"
      >
        <ArrowLeftCircle className="h-3.5 w-3.5" />
        Return to superadmin
      </button>
    </div>
  );
}
