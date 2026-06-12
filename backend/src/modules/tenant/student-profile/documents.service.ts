import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StudentDocument } from '../../../database/tenant/student-document.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { StorageService } from '../../../common/storage/storage.service';
import {
  CreateStudentDocumentDto,
  UpdateStudentDocumentDto,
} from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly storage: StorageService,
  ) {}

  list(schemaName: string, schoolId: string, studentId: string) {
    return this.tenant.runInSchema(schemaName, async (em) =>
      em.getRepository(StudentDocument).find({
        where: { schoolId, studentId },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  create(schemaName: string, schoolId: string, dto: CreateStudentDocumentDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const student = await em
        .getRepository(Student)
        .findOne({ where: { id: dto.studentId, schoolId } });
      if (!student) throw new BadRequestException('Student not found');
      const repo = em.getRepository(StudentDocument);
      return repo.save(
        repo.create({
          schoolId,
          studentId: dto.studentId,
          type: dto.type,
          title: dto.title,
          fileUrl: dto.fileUrl,
          fileName: dto.fileName ?? null,
          note: dto.note ?? null,
        }),
      );
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateStudentDocumentDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(StudentDocument);
      const d = await repo.findOne({ where: { id, schoolId } });
      if (!d) throw new NotFoundException('Document not found');
      const target = d as unknown as Record<string, unknown>;
      for (const k of ['type', 'title', 'fileUrl', 'fileName', 'note'] as const)
        if (dto[k] !== undefined) target[k] = dto[k];
      return repo.save(d);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(StudentDocument);
      const d = await repo.findOne({ where: { id, schoolId } });
      if (!d) throw new NotFoundException('Document not found');
      const url = d.fileUrl;
      await repo.remove(d);
      // Best-effort cleanup of the underlying file.
      await this.storage.deleteByUrl(url);
      return { deleted: true, id };
    });
  }
}
