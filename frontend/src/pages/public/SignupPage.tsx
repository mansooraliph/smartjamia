import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Loader2 } from 'lucide-react';
import { PublicApi, rupees } from '@/lib/public-api';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  schoolName: z.string().min(2, 'Required'),
  ownerName: z.string().min(2, 'Required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'At least 8 characters'),
  planId: z.string().uuid('Choose a plan'),
  billingCycle: z.enum(['monthly', 'yearly']),
});
type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const { data: plans = [] } = useQuery({
    queryKey: ['public-plans'],
    queryFn: PublicApi.plans,
  });
  const selectable = plans.filter((p) => !p.isCustom);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      schoolName: '',
      ownerName: '',
      email: '',
      phone: '',
      password: '',
      planId: '',
      billingCycle:
        params.get('cycle') === 'yearly' ? 'yearly' : 'monthly',
    },
  });

  // Preselect plan from the query string (or default to the featured plan).
  useEffect(() => {
    if (!selectable.length || watch('planId')) return;
    const fromQuery = params.get('plan');
    const valid = selectable.find((p) => p.id === fromQuery);
    setValue('planId', (valid ?? selectable.find((p) => p.isFeatured) ?? selectable[0]).id);
  }, [selectable, params, setValue, watch]);

  const planId = watch('planId');
  const cycle = watch('billingCycle');
  const chosen = plans.find((p) => p.id === planId);

  const signup = useMutation({
    mutationFn: (v: FormValues) =>
      PublicApi.signup({
        schoolName: v.schoolName,
        ownerName: v.ownerName,
        email: v.email,
        phone: v.phone || undefined,
        password: v.password,
        planId: v.planId,
        billingCycle: v.billingCycle,
      }),
    onSuccess: (res) => {
      login({
        user: res.user as any,
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
        schoolSlug: res.user.schoolSlug,
      });
      navigate('/dashboard', { replace: true });
    },
  });

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
      {/* Form */}
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">Start your free trial</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Create your school account — no credit card required.
        </p>

        <form
          onSubmit={handleSubmit((v) => signup.mutate(v))}
          className="mt-6 space-y-4"
        >
          <FormRow label="School name" error={errors.schoolName?.message}>
            <input className="inp" placeholder="Sunrise Public School" {...register('schoolName')} />
          </FormRow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Your name" error={errors.ownerName?.message}>
              <input className="inp" placeholder="Jane Doe" {...register('ownerName')} />
            </FormRow>
            <FormRow label="Phone (optional)" error={errors.phone?.message}>
              <input className="inp" placeholder="9876543210" {...register('phone')} />
            </FormRow>
          </div>
          <FormRow label="Work email" error={errors.email?.message}>
            <input className="inp" type="email" placeholder="you@school.edu" {...register('email')} />
          </FormRow>
          <FormRow label="Password" error={errors.password?.message}>
            <input className="inp" type="password" placeholder="At least 8 characters" {...register('password')} />
          </FormRow>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Plan" error={errors.planId?.message}>
              <select className="inp" {...register('planId')}>
                <option value="">Select a plan…</option>
                {selectable.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Billing">
              <select className="inp" {...register('billingCycle')}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly (2 months free)</option>
              </select>
            </FormRow>
          </div>

          {signup.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errMsg(signup.error)}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5"
            disabled={signup.isPending}
          >
            {signup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {signup.isPending ? 'Creating your school…' : 'Create account & start trial'}
          </button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>

      {/* Summary panel */}
      <div className="hidden lg:block">
        <div className="sticky top-24 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center gap-2 text-brand-700">
            <GraduationCap className="h-5 w-5" />
            <span className="font-semibold">Your trial</span>
          </div>
          {chosen ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-bold text-slate-900">{chosen.name}</div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {rupees(cycle === 'yearly' ? chosen.priceYearly : chosen.priceMonthly)}
                  </div>
                  <div className="text-xs text-slate-500">
                    /{cycle === 'yearly' ? 'year' : 'month'} after trial
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white p-4 text-sm">
                <div className="font-medium text-green-700">
                  {chosen.trialDays} days free
                </div>
                <p className="mt-1 text-slate-500">
                  You won’t be charged today. Explore everything, then subscribe from
                  your dashboard’s Billing page when you’re ready.
                </p>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>
                  • {chosen.maxStudents === -1 ? 'Unlimited' : chosen.maxStudents.toLocaleString('en-IN')} students
                </li>
                <li>• {chosen.maxStaff === -1 ? 'Unlimited' : chosen.maxStaff} staff accounts</li>
                <li>• {chosen.features.length} included features</li>
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Pick a plan to see your trial details.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FormRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return (
    anyE?.response?.data?.error?.message ??
    anyE?.response?.data?.message ??
    anyE?.message ??
    'Could not create your account'
  );
}
