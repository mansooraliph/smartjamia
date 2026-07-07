import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Check, Loader2, Building2, Network } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { AccountApi } from '@/services/account.api';
import { OrgAuthApi } from '@/services/org.api';
import { toast } from '@/stores/toast.store';

/**
 * In-app school switcher. Works for two "origins":
 *  - multi-school account sessions (accountToken + >1 granted schools)
 *  - organization-admin sessions (orgToken) — also offers "Back to organization"
 * Switching re-selects the school (new tenant token) and clears cached data.
 */
export function SchoolSwitcher() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const schoolSlug = useAuthStore((s) => s.schoolSlug);
  const enterSchoolSession = useAuthStore((s) => s.enterSchoolSession);
  const returnToOrg = useAuthStore((s) => s.returnToOrg);
  const accountToken = useAuthStore((s) => s.accountToken);
  const accountSchools = useAuthStore((s) => s.accountSchools);
  const orgToken = useAuthStore((s) => s.orgToken);
  const orgSchools = useAuthStore((s) => s.orgSchools);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const isOrg = !!orgToken && !!orgSchools;
  const isAccount = !isOrg && !!accountToken && (accountSchools?.length ?? 0) >= 2;
  if (!isOrg && !isAccount) return null;

  const schools = (isOrg ? orgSchools : accountSchools) ?? [];
  const current = schools.find((s) => s.slug === schoolSlug);

  const switchTo = async (schoolId: string, slug: string) => {
    if (slug === schoolSlug) {
      setOpen(false);
      return;
    }
    setBusy(schoolId);
    try {
      const session = isOrg
        ? await OrgAuthApi.selectSchool(schoolId, orgToken!)
        : await AccountApi.selectSchool(schoolId, accountToken!);
      enterSchoolSession({
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          schoolId: session.user.schoolId,
          schoolSlug: session.user.schoolSlug,
          scope: 'tenant',
        },
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken,
        schoolSlug: session.school.slug,
      });
      qc.clear();
      setOpen(false);
      navigate('/dashboard');
      toast.success(`Switched to ${session.school.slug}`);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error?.message ?? e?.message ?? 'Could not switch',
      );
    } finally {
      setBusy(null);
    }
  };

  const goToOrg = () => {
    returnToOrg();
    qc.clear();
    setOpen(false);
    navigate('/org');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:border-brand-400"
        title="Switch school"
      >
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="max-w-[10rem] truncate font-medium">
          {current?.name ?? 'Select school'}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {isOrg && (
              <>
                <button
                  onClick={goToOrg}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  <Network className="h-4 w-4" /> Back to organization
                </button>
                <div className="my-1 border-t border-slate-100" />
              </>
            )}
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Switch school
            </div>
            {schools.map((s) => {
              const active = s.slug === schoolSlug;
              return (
                <button
                  key={s.schoolId}
                  onClick={() => switchTo(s.schoolId, s.slug)}
                  disabled={!!busy}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className="leading-tight">
                    <span className="block font-medium text-slate-900">
                      {s.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {s.code} · {s.role}
                    </span>
                  </span>
                  {busy === s.schoolId ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                  ) : active ? (
                    <Check className="h-4 w-4 text-brand-600" />
                  ) : null}
                </button>
              );
            })}
            {schools.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">
                No schools yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
