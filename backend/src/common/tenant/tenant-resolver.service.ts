import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { School } from '../../database/master/school.entity';

export interface ResolvedTenant {
  schoolId: string;
  slug: string;
  schemaName: string;
  status: string;
  planId: string | null;
}

/**
 * Resolves a tenant (school) by slug from the master DB.
 * Used by the tenant middleware to determine schema_name per request.
 */
@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);
  private readonly schoolRepo: Repository<School>;
  private readonly cache = new Map<string, ResolvedTenant>();
  private readonly cacheTtlMs = 60_000;
  private readonly cacheTimestamps = new Map<string, number>();

  constructor(@InjectDataSource('master') private readonly master: DataSource) {
    this.schoolRepo = master.getRepository(School);
  }

  /** Resolve by school code (uppercase) or slug (kebab-case). */
  async resolveByIdentifier(identifier: string): Promise<ResolvedTenant> {
    const key = identifier.trim();
    if (!key) {
      throw new NotFoundException('School identifier required');
    }

    const cached = this.cache.get(key);
    const ts = this.cacheTimestamps.get(key) ?? 0;
    if (cached && Date.now() - ts < this.cacheTtlMs) {
      return cached;
    }

    // Try code first (case-insensitive), then slug
    const school = await this.schoolRepo
      .createQueryBuilder('s')
      .where('UPPER(s.code) = :code', { code: key.toUpperCase() })
      .orWhere('s.slug = :slug', { slug: key.toLowerCase() })
      .getOne();

    if (!school) {
      throw new NotFoundException(`School "${key}" not found`);
    }

    const resolved: ResolvedTenant = {
      schoolId: school.id,
      slug: school.slug,
      schemaName: school.schemaName || 'shared_pool',
      status: school.status,
      planId: school.planId,
    };

    this.cache.set(key, resolved);
    this.cacheTimestamps.set(key, Date.now());
    return resolved;
  }

  /** @deprecated use resolveByIdentifier */
  resolveBySlug(slug: string) {
    return this.resolveByIdentifier(slug);
  }

  /** Drop every cache entry for a school (any key/case) — e.g. after re-provisioning its schema. */
  invalidateSchool(schoolId: string) {
    for (const [k, v] of this.cache.entries()) {
      if (v.schoolId === schoolId) {
        this.cache.delete(k);
        this.cacheTimestamps.delete(k);
      }
    }
  }

  invalidate(identifier: string) {
    this.cache.delete(identifier);
    this.cacheTimestamps.delete(identifier);
  }
}
