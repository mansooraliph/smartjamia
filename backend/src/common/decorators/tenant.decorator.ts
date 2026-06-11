import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';

export const Tenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const tenant = req.tenant as TenantContext | undefined;
    if (!tenant) return undefined;
    return data ? tenant[data] : tenant;
  },
);
