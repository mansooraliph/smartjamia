import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Network } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { OrgAuthApi } from '@/services/org.api';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
});
type Form = z.infer<typeof schema>;

export function OrgLoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const setOrgContext = useAuthStore((s) => s.setOrgContext);
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: Form) => {
    setErr(null);
    try {
      const res = await OrgAuthApi.login(values.email, values.password);
      // Clear any prior (school/superadmin) session so no stale tenant header
      // leaks into org-scoped requests.
      logout();
      const orgAdmin = {
        id: res.admin.id,
        name: res.admin.name,
        email: res.admin.email,
        role: 'organization_admin',
        organizationId: res.admin.organizationId,
        scope: 'organization',
      };
      login({
        user: orgAdmin,
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
      });
      // Stash org origin context so the school app can offer switch + go-back.
      setOrgContext({
        orgToken: res.tokens.accessToken,
        orgRefreshToken: res.tokens.refreshToken,
        orgAdmin,
        orgSchools: res.schools.map((s) => ({
          schoolId: s.schoolId,
          code: s.code,
          slug: s.slug,
          name: s.name,
          role: 'admin',
          status: s.status,
        })),
      });
      navigate('/org');
    } catch (e: any) {
      setErr(
        e?.response?.data?.error?.message ??
          e?.response?.data?.message ??
          'Login failed',
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-700">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-indigo-600 p-2 text-white">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Organization</h1>
            <p className="text-xs text-slate-500">Admin sign-in</p>
          </div>
        </div>

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

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Not an organization admin?{' '}
          <a href="/login" className="text-brand-600 hover:underline">
            School login
          </a>
        </p>
      </form>
    </div>
  );
}
