import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class TenantJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = auth.slice('Bearer '.length).trim();

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.scope !== 'tenant') {
      throw new ForbiddenException('Tenant scope required');
    }

    const tenant = (req as any).tenant;
    if (!tenant) {
      throw new ForbiddenException('Tenant context missing');
    }
    if (payload.schoolId !== tenant.schoolId) {
      throw new ForbiddenException('Token does not match this school');
    }

    (req as any).user = payload;
    return true;
  }
}
