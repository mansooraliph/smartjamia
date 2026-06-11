import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
});
type Form = z.infer<typeof schema>;

export function SuperadminLoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@edupro.app', password: '' },
  });

  const onSubmit = async (values: Form) => {
    setErr(null);
    try {
      // Direct axios (no tenant header on superadmin login)
      const { data } = await axios.post(
        '/api/v1/auth/superadmin/login',
        values,
      );
      const payload = data?.data ?? data;
      login({
        user: payload.user,
        accessToken: payload.tokens.accessToken,
        refreshToken: payload.tokens.refreshToken,
      });
      navigate('/superadmin');
    } catch (e: any) {
      setErr(
        e?.response?.data?.error?.message ??
          e?.response?.data?.message ??
          'Login failed',
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-slate-900 p-2 text-white">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">EduPro Platform</h1>
            <p className="text-xs text-slate-500">Superadmin sign-in</p>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            type="email"
            {...register('email')}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
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
            autoFocus
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
          Not a superadmin?{' '}
          <a href="/login" className="text-brand-600 hover:underline">
            School login
          </a>
        </p>
      </form>
    </div>
  );
}
