import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
} from './dto/academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  list(schemaName: string, schoolId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(AcademicYear).find({
        where: { schoolId },
        order: { startDate: 'DESC' },
      });
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const ay = await em
        .getRepository(AcademicYear)
        .findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      return ay;
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateAcademicYearDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const dup = await repo.findOne({ where: { schoolId, name: dto.name } });
      if (dup) throw new ConflictException('Academic year name already exists');

      if (dto.isCurrent) {
        await repo.update({ schoolId, isCurrent: true }, { isCurrent: false });
      }
      return repo.save(
        repo.create({
          schoolId,
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isCurrent: dto.isCurrent ?? false,
          isLocked: false,
        }),
      );
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateAcademicYearDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      if (ay.isLocked) {
        throw new ConflictException('Academic year is locked');
      }

      if (dto.isCurrent === true) {
        await repo.update(
          { schoolId, isCurrent: true },
          { isCurrent: false },
        );
      }
      Object.assign(ay, {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : ay.startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : ay.endDate,
      });
      return repo.save(ay);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      if (ay.isLocked) {
        throw new ConflictException('Academic year is locked');
      }
      await repo.remove(ay);
      return { deleted: true, id };
    });
  }

  setCurrent(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      await repo.update({ schoolId, isCurrent: true }, { isCurrent: false });
      ay.isCurrent = true;
      return repo.save(ay);
    });
  }

  setLocked(schemaName: string, schoolId: string, id: string, locked: boolean) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      ay.isLocked = locked;
      return repo.save(ay);
    });
  }
}
