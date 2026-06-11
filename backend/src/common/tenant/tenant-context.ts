import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  schoolId: string;
  schoolSlug: string;
  schemaName: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getCurrentTenant(): TenantContext | undefined {
  return tenantStorage.getStore();
}

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}
