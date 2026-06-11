import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchoolProfile } from '../../../database/tenant/school-profile.entity';
import { School } from '../../../database/master/school.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import {
  DEFAULT_TERMINOLOGY,
  Terminology,
  TerminologyDto,
} from './dto/terminology.dto';
import {
  MenuAccessDto,
  MenuAccessResult,
  RoleAccessMap,
  sanitizeRoleAccess,
} from './dto/menu-access.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly tenant: TenantSchemaService,
    @InjectDataSource('master') private readonly master: DataSource,
  ) {}

  getTerminology(schemaName: string, schoolId: string): Promise<Terminology> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const profile = await em
        .getRepository(SchoolProfile)
        .findOne({ where: { schoolId } });
      return this.mergeTerminology(profile?.settings);
    });
  }

  setTerminology(
    schemaName: string,
    schoolId: string,
    dto: TerminologyDto,
  ): Promise<Terminology> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(SchoolProfile);
      let profile = await repo.findOne({ where: { schoolId } });
      if (!profile) {
        // school_profile.name is NOT NULL — seed it from the master record.
        const school = await this.master
          .getRepository(School)
          .findOne({ where: { id: schoolId } });
        profile = repo.create({
          schoolId,
          name: school?.name ?? 'School',
          settings: {},
        });
      }
      const current = this.mergeTerminology(profile.settings);
      const next: Terminology = {
        level: dto.level?.trim() || current.level,
        levelPlural: dto.levelPlural?.trim() || current.levelPlural,
        group: dto.group?.trim() || current.group,
        groupPlural: dto.groupPlural?.trim() || current.groupPlural,
      };
      profile.settings = { ...(profile.settings ?? {}), terminology: next };
      await repo.save(profile);
      return next;
    });
  }

  // ── Menu / module access per non-admin role ─────────────────────────────────
  getMenuAccess(
    schemaName: string,
    schoolId: string,
  ): Promise<MenuAccessResult> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const profile = await em
        .getRepository(SchoolProfile)
        .findOne({ where: { schoolId } });
      return {
        roleAccess: sanitizeRoleAccess(
          (profile?.settings as Record<string, unknown>)?.roleAccess,
        ),
      };
    });
  }

  setMenuAccess(
    schemaName: string,
    schoolId: string,
    dto: MenuAccessDto,
  ): Promise<MenuAccessResult> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(SchoolProfile);
      let profile = await repo.findOne({ where: { schoolId } });
      if (!profile) {
        const school = await this.master
          .getRepository(School)
          .findOne({ where: { id: schoolId } });
        profile = repo.create({
          schoolId,
          name: school?.name ?? 'School',
          settings: {},
        });
      }
      const roleAccess: RoleAccessMap = sanitizeRoleAccess(dto.roleAccess);
      profile.settings = { ...(profile.settings ?? {}), roleAccess };
      await repo.save(profile);
      return { roleAccess };
    });
  }

  private mergeTerminology(settings?: Record<string, unknown>): Terminology {
    const t = (settings?.terminology ?? {}) as Partial<Terminology>;
    return {
      level: t.level || DEFAULT_TERMINOLOGY.level,
      levelPlural: t.levelPlural || DEFAULT_TERMINOLOGY.levelPlural,
      group: t.group || DEFAULT_TERMINOLOGY.group,
      groupPlural: t.groupPlural || DEFAULT_TERMINOLOGY.groupPlural,
    };
  }
}
