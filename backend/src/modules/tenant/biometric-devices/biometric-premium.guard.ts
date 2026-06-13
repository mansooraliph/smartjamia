import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { School } from '../../../database/master/school.entity';

/**
 * Allows the request only if the tenant's active plan includes the
 * `biometric_devices` feature. Runs after TenantMiddleware (so req.tenant is set).
 */
@Injectable()
export class BiometricPremiumGuard implements CanActivate {
  private readonly schoolRepo: Repository<School>;

  constructor(@InjectDataSource('master') ds: DataSource) {
    this.schoolRepo = ds.getRepository(School);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const schoolId: string | undefined = req.tenant?.schoolId;
    if (!schoolId) throw new ForbiddenException('Tenant not resolved');
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      relations: { plan: true },
    });
    const features = (school?.plan?.features as string[]) ?? [];
    if (!features.includes('biometric_devices')) {
      throw new ForbiddenException(
        'Biometric devices is a premium feature. Please upgrade your plan.',
      );
    }
    return true;
  }
}
