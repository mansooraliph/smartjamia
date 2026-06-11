import { Injectable } from '@nestjs/common';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { Student } from '../../../database/tenant/student.entity';
import { Staff } from '../../../database/tenant/staff.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Section } from '../../../database/tenant/section.entity';
import { Subject } from '../../../database/tenant/subject.entity';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';

@Injectable()
export class SchoolStatsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  overview(schemaName: string, schoolId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const [
        students,
        activeStudents,
        staff,
        activeStaff,
        classes,
        sections,
        subjects,
        years,
        currentYear,
      ] = await Promise.all([
        em
          .getRepository(Student)
          .count({ where: { schoolId }, withDeleted: false }),
        em
          .getRepository(Student)
          .count({ where: { schoolId, status: 'active' as any } }),
        em
          .getRepository(Staff)
          .count({ where: { schoolId }, withDeleted: false }),
        em
          .getRepository(Staff)
          .count({ where: { schoolId, status: 'active' as any } }),
        em.getRepository(ClassEntity).count({ where: { schoolId } }),
        em.getRepository(Section).count({ where: { schoolId } }),
        em.getRepository(Subject).count({ where: { schoolId } }),
        em.getRepository(AcademicYear).count({ where: { schoolId } }),
        em
          .getRepository(AcademicYear)
          .findOne({ where: { schoolId, isCurrent: true } }),
      ]);

      return {
        students: { total: students, active: activeStudents },
        staff: { total: staff, active: activeStaff },
        classes: { total: classes },
        sections: { total: sections },
        subjects: { total: subjects },
        academicYears: { total: years, current: currentYear ?? null },
      };
    });
  }
}
