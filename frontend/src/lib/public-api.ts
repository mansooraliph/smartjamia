import axios from 'axios';

export interface PublicPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number; // paise
  priceYearly: number;
  trialDays: number;
  maxUsers: number;
  maxStudents: number;
  maxStaff: number;
  features: string[];
  limits: Record<string, unknown>;
  isFeatured: boolean;
  isCustom: boolean;
}

export interface SignupPayload {
  schoolName: string;
  ownerName: string;
  email: string;
  phone?: string;
  password: string;
  planId: string;
  billingCycle?: 'monthly' | 'yearly';
}

export interface SignupResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    schoolSlug: string;
    schoolId: string;
    permissions?: string[];
  };
  school: { id: string; slug: string; status: string };
  tokens: { accessToken: string; refreshToken: string };
  trial: { endsAt: string; days: number };
  plan: { name: string; slug: string };
}

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

export const PublicApi = {
  plans: async (): Promise<PublicPlan[]> =>
    unwrap(await axios.get('/api/v1/public/plans')),
  signup: async (payload: SignupPayload): Promise<SignupResult> =>
    unwrap(await axios.post('/api/v1/public/signup', payload)),
};

/** ₹ formatting from paise. */
export function rupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
