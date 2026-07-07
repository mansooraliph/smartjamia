import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LayoutGrid, School as SchoolIcon, Loader2, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import {
  AccountApi,
  AccountLoginResult,
  AccountSchoolDTO,
} from '@/services/account.api';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
});
type Form = z.infer<typeof schema>;

export function AccountLoginPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const setAccountContext = useAuthStore((s) => s.setAccountContext);
  const enterSchoolSession = useAuthStore((s) => s.enterSchoolSession);
  const [result, setResult] = useState<AccountLoginResult | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const enter = async (school: AccountSchoolDTO, res: AccountLoginResult) => {
    setSelecting(school.schoolId);
    setErr(null);
    try {
      const session = await AccountApi.selectSchool(
        school.schoolId,
        res.tokens.accessToken,
      );
      // Keep the account context so the in-app switcher works.
      setAccountContext(res.tokens.accessToken, res.schools);
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
      navigate('/dashboard');
    } catch (e: any) {
      setSelecting(null);
      setErr(errMsg(e) ?? 'Could not enter school');
    }
  };

  const onSubmit = async (values: Form) => {
    setErr(null);
    try {
      logout(); // clear any prior session first
      const res = await AccountApi.login(values.email, values.password);
      if (res.schools.length === 0) {
        setErr('This account has no school access yet. Contact your admin.');
        return;
      }
      setResult(res);
      // A single school → skip the picker.
      if (res.schools.length === 1) await enter(res.schools[0], res);
    } catch (e: any) {
      setErr(
        e?.response?.data?.error?.message ??
          e?.response?.data?.message ??
          'Login failed',
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-slate-800">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-brand-600 p-2 text-white">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Your schools</h1>
            <p className="text-xs text-slate-500">
              {result ? 'Choose a school to enter' : 'Sign in once, access many'}
            </p>
          </div>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium">Email</span>
              <input
                type="email"
                {...register('email')}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                autoFocus
              />
              {errors.email && (
                <span className="text-xs text-red-600">{errors.email.message}</span>
              )}
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium">Password</span>
              <input
                type="password"
                {...register('password')}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
              {errors.password && (
                <span className="text-xs text-red-600">
                  {errors.password.message}
                </span>
              )}
            </label>
            {err && (
              <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="mt-4 text-center text-xs text-slate-500">
              Single-school login?{' '}
              <a href="/login" className="text-brand-600 hover:underline">
                Use your School Code
              </a>
            </p>
          </form>
        ) : (
          <div>
            <div className="space-y-2">
              {result.schools.map((s) => (
                <button
                  key={s.schoolId}
                  onClick={() => enter(s, result)}
                  disabled={!!selecting}
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-left hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60"
                >
                  <span className="flex items-center gap-2.5">
                    <SchoolIcon className="h-4 w-4 text-slate-400" />
                    <span className="leading-tight">
                      <span className="block text-sm font-medium text-slate-900">
                        {s.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {s.code} · {s.role}
                      </span>
                    </span>
                  </span>
                  {selecting === s.schoolId && (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                  )}
                </button>
              ))}
            </div>
            {err && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
            <button
              onClick={() => {
                setResult(null);
                setErr(null);
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Use a different account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function errMsg(e: unknown): string | undefined {
  if (!e) return undefined;
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}
