import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StudentQualification } from '../../../database/tenant/student-qualification.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import {
  CreateStudentQualificationDto,
  UpdateStudentQualificationDto,
} from './dto/qualification.dto';

@Injectable()
export class QualificationsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  list(schemaName: string, schoolId: string, studentId: string) {
    return this.tenant.runInSchema(schemaName, async (em) =>
      em.getRepository(StudentQualification).find({
        where: { schoolId, studentId },
        order: { orderIndex: 'ASC', yearOfPassing: 'ASC' },
      }),
    );
  }

  create(
    schemaName: string,
    schoolId: string,
    dto: CreateStudentQualificationDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const student = await em
        .getRepository(Student)
        .findOne({ where: { id: dto.studentId, schoolId } });
      if (!student) throw new BadRequestException('Student not found');
      const repo = em.getRepository(StudentQualification);
      return repo.save(
        repo.create({
          schoolId,
          studentId: dto.studentId,
          examName: dto.examName,
          board: dto.board ?? null,
          institution: dto.institution ?? null,
          yearOfPassing: dto.yearOfPassing ?? null,
          percentage: dto.percentage ?? null,
          grade: dto.grade ?? null,
          registerNumber: dto.registerNumber ?? null,
          fileUrl: dto.fileUrl ?? null,
          orderIndex: dto.orderIndex ?? 0,
        }),
      );
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateStudentQualificationDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(StudentQualification);
      const q = await repo.findOne({ where: { id, schoolId } });
      if (!q) throw new NotFoundException('Qualification not found');
      const target = q as unknown as Record<string, unknown>;
      const keys: (keyof UpdateStudentQualificationDto)[] = [
        'examName',
        'board',
        'institution',
        'yearOfPassing',
        'percentage',
        'grade',
        'registerNumber',
        'fileUrl',
        'orderIndex',
      ];
      for (const k of keys) if (dto[k] !== undefined) target[k] = dto[k];
      return repo.save(q);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(StudentQualification);
      const q = await repo.findOne({ where: { id, schoolId } });
      if (!q) throw new NotFoundException('Qualification not found');
      await repo.remove(q);
      return { deleted: true, id };
    });
  }
}
