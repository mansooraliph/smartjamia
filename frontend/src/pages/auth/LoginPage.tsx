import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  schoolCode: z
    .string()
    .min(1, 'School code is required')
    .max(50, 'Too long'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
});
type Form = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { schoolCode: '', email: '', password: '' },
  });

  const onSubmit = async (values: Form) => {
    setErr(null);
    try {
      const { data } = await axios.post('/api/v1/auth/login', {
        schoolCode: values.schoolCode.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      const payload = data?.data ?? data;
      login({
        user: payload.user,
        accessToken: payload.tokens.accessToken,
        refreshToken: payload.tokens.refreshToken,
        schoolSlug: values.schoolCode.trim(),
      });
      navigate('/dashboard');
    } catch (e: any) {
      setErr(
        e?.response?.data?.error?.message ??
          e?.response?.data?.message ??
          'Login failed',
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-brand-600 p-2 text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">EduPro</h1>
            <p className="text-xs text-slate-500">School sign-in</p>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            School Code
          </span>
          <input
            {...register('schoolCode')}
            placeholder="DEMO"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono uppercase tracking-wider"
          />
          <span className="mt-1 block text-xs text-slate-500">
            The short code given by your school admin (e.g. <code>DEMO</code>).
          </span>
          {errors.schoolCode && (
            <span className="mt-1 block text-xs text-red-600">
              {errors.schoolCode.message}
            </span>
          )}
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </span>
          <input
            type="email"
            {...register('email')}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            autoComplete="email"
          />
          {errors.email && (
            <span className="text-xs text-red-600">{errors.email.message}</span>
          )}
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </span>
          <input
            type="password"
            {...register('password')}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            autoComplete="current-password"
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
          Platform admin?{' '}
          <a
            href="/superadmin/login"
            className="text-brand-600 hover:underline"
          >
            Superadmin login
          </a>
        </p>
      </form>
    </div>
  );
}
