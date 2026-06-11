import { useNavigate } from 'react-router-dom';
import { LogOut, Shield, Building2, CreditCard, Users } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function SuperadminDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/superadmin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-900 p-2 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">
                EduPro Platform Console
              </h1>
              <p className="text-xs text-slate-500">
                {user?.email} · {user?.role}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-secondary">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="mb-1 text-2xl font-semibold text-slate-900">
          Welcome back, {user?.name ?? 'Admin'}
        </h2>
        <p className="mb-8 text-slate-600">
          You are signed in as a platform superadmin.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Building2} label="Schools" value="0" />
          <StatCard icon={Users} label="Users" value="1" hint="1 superadmin" />
          <StatCard icon={CreditCard} label="Plans" value="4" />
        </div>

        <div className="card mt-8 p-6">
          <h3 className="mb-2 font-semibold text-slate-900">Next steps</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>
              School onboarding endpoint (<code>POST /superadmin/schools</code>)
              — Day 2
            </li>
            <li>Plan management UI — Day 2</li>
            <li>Subscription + billing dashboard — Day 3</li>
            <li>Schema provisioning workflow — Day 3</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
