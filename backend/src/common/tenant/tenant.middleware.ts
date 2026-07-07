import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantResolverService } from './tenant-resolver.service';
import { tenantStorage, TenantContext } from './tenant-context';

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: TenantContext;
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly resolver: TenantResolverService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (this.isPublicPath(path)) {
      return next();
    }

    const identifier =
      (req.headers['x-school-code'] as string) ||
      (req.headers['x-school-slug'] as string) ||
      (req.headers['X-School-Code'] as string) ||
      (req.headers['X-School-Slug'] as string);

    if (!identifier) {
      throw new BadRequestException(
        'Missing X-School-Code header for tenant resolution',
      );
    }

    const tenant = await this.resolver.resolveByIdentifier(identifier);
    const ctx: TenantContext = {
      schoolId: tenant.schoolId,
      schoolSlug: tenant.slug,
      schemaName: tenant.schemaName,
    };

    req.tenant = ctx;

    tenantStorage.run(ctx, () => next());
  }

  private isPublicPath(path: string): boolean {
    return (
      path.startsWith('/uploads') ||
      path.startsWith('/api/docs') ||
      path === '/api/v1' ||
      path === '/api/v1/' ||
      path === '/api/v1/health' ||
      path.startsWith('/api/v1/auth') ||
      path.startsWith('/api/v1/superadmin') ||
      path.startsWith('/api/v1/org') ||
      path.startsWith('/api/v1/portal') ||
      path.startsWith('/api/v1/public')
    );
  }
}
