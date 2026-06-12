import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffDocument } from '../../../database/tenant/staff-document.entity';
import { Staff } from '../../../database/tenant/staff.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { StorageService } from '../../../common/storage/storage.service';
import {
  CreateStaffDocumentDto,
  UpdateStaffDocumentDto,
} from './dto/staff-document.dto';

@Injectable()
export class StaffDocumentsService {
  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly storage: StorageService,
  ) {}

  list(schemaName: string, schoolId: string, staffId: string) {
    return this.tenant.runInSchema(schemaName, async (em) =>
      em.getRepository(StaffDocument).find({
        where: { schoolId, staffId },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  create(schemaName: string, schoolId: string, dto: CreateStaffDocumentDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const staff = await em
        .getRepository(Staff)
        .findOne({ where: { id: dto.staffId, schoolId } });
      if (!staff) throw new BadRequestException('Staff not found');
      const repo = em.getRepository(StaffDocument);
      return repo.save(
        repo.create({
          schoolId,
          staffId: dto.staffId,
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
    dto: UpdateStaffDocumentDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(StaffDocument);
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
      const repo = em.getRepository(StaffDocument);
      const d = await repo.findOne({ where: { id, schoolId } });
      if (!d) throw new NotFoundException('Document not found');
      const url = d.fileUrl;
      await repo.remove(d);
      await this.storage.deleteByUrl(url);
      return { deleted: true, id };
    });
  }
}
