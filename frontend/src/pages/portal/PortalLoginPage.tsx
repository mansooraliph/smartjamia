import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Users, KeyRound } from 'lucide-react';
import { PortalApi, setPortalToken } from '@/lib/portal-api';

type Role = 'student' | 'parent';

export function PortalLoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('student');
  const [schoolCode, setSchoolCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session =
        role === 'student'
          ? await PortalApi.studentLogin(schoolCode.trim(), identifier.trim(), pin)
          : await PortalApi.parentLogin(schoolCode.trim(), identifier.trim(), pin);
      setPortalToken(session.token);
      navigate('/portal');
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
          err?.message ??
          'Login failed — check your details',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Student &amp; Parent Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your PIN</p>
        </div>

        {/* Role toggle */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(['student', 'parent'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r);
                setIdentifier('');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium capitalize transition ${
                role === r
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {r === 'student' ? (
                <GraduationCap className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              School code
            </span>
            <input
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="e.g. CTP"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {role === 'student' ? 'Admission number' : 'Mobile number'}
            </span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={role === 'student' ? 'ADM2026001' : '9876543210'}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="••••"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em]"
              required
            />
          </label>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={busy || pin.length < 4}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          PIN not working? Ask your school office to (re)set it.
        </p>
      </div>
    </div>
  );
}
