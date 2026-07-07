import axios from 'axios';
import type { TenantSession } from './org.api';

export interface AccountSchoolDTO {
  schoolId: string;
  code: string;
  slug: string;
  name: string;
  role: string;
  status: string;
}

export interface AccountLoginResult {
  account: { id: string; name: string; email: string; scope: 'account' };
  schools: AccountSchoolDTO[];
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

/**
 * Multi-school account auth. Both calls use raw axios with an explicit bearer:
 * the account token must NOT go through the shared `api` interceptor (which
 * would attach the active tenant token / an X-School-Code header instead).
 */
export const AccountApi = {
  login: async (email: string, password: string): Promise<AccountLoginResult> => {
    const r = await axios.post('/api/v1/auth/account/login', { email, password });
    return (r.data?.data ?? r.data) as AccountLoginResult;
  },

  selectSchool: async (
    schoolId: string,
    accountToken: string,
  ): Promise<TenantSession> => {
    const r = await axios.post(
      '/api/v1/auth/account/select-school',
      { schoolId },
      { headers: { Authorization: `Bearer ${accountToken}` } },
    );
    return (r.data?.data ?? r.data) as TenantSession;
  },
};
