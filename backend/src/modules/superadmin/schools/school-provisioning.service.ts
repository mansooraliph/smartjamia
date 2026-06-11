import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { School } from '../../../database/master/school.entity';
import { SchemaMigrationService } from '../../../common/tenant/schema-migration.service';
import { TenantResolverService } from '../../../common/tenant/tenant-resolver.service';

/**
 * Moves a school off the shared_pool schema into a dedicated `school_<slug>`
 * schema: creates the schema + tables, transactionally relocates the school's
 * rows out of shared_pool, then flips the master record. The tenant read-path
 * already honours `school.schema_name`, so nothing else changes.
 */
@Injectable()
export class SchoolProvisioningService {
  private readonly logger = new Logger(SchoolProvisioningService.name);
  private readonly schools: Repository<School>;

  constructor(
    @InjectDataSource('master') master: DataSource,
    @InjectDataSource('data') private readonly data: DataSource,
    private readonly migration: SchemaMigrationService,
    private readonly resolver: TenantResolverService,
  ) {
    this.schools = master.getRepository(School);
  }

  async provision(schoolId: string) {
    const school = await this.schools.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.isSchemaProvisioned || school.schemaName !== 'shared_pool') {
      throw new ConflictException('School already has a dedicated schema');
    }

    const schemaName = `school_${school.slug.replace(/-/g, '_')}`;

    // 1. Create the schema + all tenant tables.
    await this.migration.provisionSchema(schemaName);

    // 2. Discover tenant tables in shared_pool + which carry school_id.
    const tables: { name: string; has_school: boolean }[] = await this.data.query(
      `SELECT t.table_name AS name,
              EXISTS(
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema='shared_pool'
                  AND c.table_name=t.table_name
                  AND c.column_name='school_id'
              ) AS has_school
       FROM information_schema.tables t
       WHERE t.table_schema='shared_pool' AND t.table_type='BASE TABLE'
       ORDER BY t.table_name`,
    );
    const owned = tables.filter((t) => t.has_school);

    // exam_schedules has no school_id — scope it via its exam.
    const ES_FILTER = `exam_id IN (SELECT id FROM shared_pool.exams WHERE school_id = $1)`;
    const hasExamSchedules = tables.some((t) => t.name === 'exam_schedules');

    // 3. Pre-count (informational summary).
    const movedRows: Record<string, number> = {};
    for (const t of owned) {
      const [{ count }] = await this.data.query(
        `SELECT COUNT(*)::int AS count FROM shared_pool."${t.name}" WHERE school_id = $1`,
        [schoolId],
      );
      if (count > 0) movedRows[t.name] = count;
    }
    if (hasExamSchedules) {
      const [{ count }] = await this.data.query(
        `SELECT COUNT(*)::int AS count FROM shared_pool.exam_schedules WHERE ${ES_FILTER}`,
        [schoolId],
      );
      if (count > 0) movedRows.exam_schedules = count;
    }

    // Build explicit column lists per table. Two reasons:
    //  - column ORDER can drift (e.g. users.role_key was ALTERed in later),
    //    so positional SELECT * is unsafe; we map by name.
    //  - each schema has its OWN enum types, so enum columns must be cast
    //    through text into the TARGET schema's enum.
    const insertSelect = async (
      table: string,
    ): Promise<{ insert: string; select: string }> => {
      const cols: { column_name: string; data_type: string; udt_name: string }[] =
        await this.data.query(
          `SELECT column_name, data_type, udt_name FROM information_schema.columns
           WHERE table_schema='shared_pool' AND table_name=$1 ORDER BY ordinal_position`,
          [table],
        );
      const insert = cols.map((c) => `"${c.column_name}"`).join(', ');
      const select = cols
        .map((c) =>
          c.data_type === 'USER-DEFINED'
            ? `"${c.column_name}"::text::"${schemaName}"."${c.udt_name}"`
            : `"${c.column_name}"`,
        )
        .join(', ');
      return { insert, select };
    };

    // 4. Move rows (single transaction; fully-qualified names — search_path agnostic).
    await this.data.transaction(async (em) => {
      // INSERT phase — read shared_pool while it's still intact.
      for (const t of owned) {
        const { insert, select } = await insertSelect(t.name);
        await em.query(
          `INSERT INTO "${schemaName}"."${t.name}" (${insert}) SELECT ${select} FROM shared_pool."${t.name}" WHERE school_id = $1`,
          [schoolId],
        );
      }
      if (hasExamSchedules) {
        const { insert, select } = await insertSelect('exam_schedules');
        await em.query(
          `INSERT INTO "${schemaName}".exam_schedules (${insert}) SELECT ${select} FROM shared_pool.exam_schedules WHERE ${ES_FILTER}`,
          [schoolId],
        );
      }
      // DELETE phase — exam_schedules first (its filter reads shared_pool.exams).
      if (hasExamSchedules) {
        await em.query(
          `DELETE FROM shared_pool.exam_schedules WHERE ${ES_FILTER}`,
          [schoolId],
        );
      }
      for (const t of owned) {
        await em.query(
          `DELETE FROM shared_pool."${t.name}" WHERE school_id = $1`,
          [schoolId],
        );
      }
    });

    // 5. Flip the master record → tenant requests now route to the new schema.
    school.schemaName = schemaName;
    school.isSchemaProvisioned = true;
    await this.schools.save(school);

    // Bust the tenant resolver cache so the next request routes to the new schema.
    this.resolver.invalidateSchool(schoolId);

    const total = Object.values(movedRows).reduce((a, b) => a + b, 0);
    this.logger.log(
      `Provisioned ${school.code} → ${schemaName} (${total} rows moved)`,
    );
    return { schoolId, schemaName, totalRowsMoved: total, movedRows };
  }
}
