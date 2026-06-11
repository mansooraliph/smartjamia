import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, Not } from 'typeorm';
import { Branch } from '../../../database/master/branch.entity';
import { School } from '../../../database/master/school.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  private readonly repo: Repository<Branch>;
  private readonly schoolRepo: Repository<School>;

  constructor(@InjectDataSource('master') ds: DataSource) {
    this.repo = ds.getRepository(Branch);
    this.schoolRepo = ds.getRepository(School);
  }

  list(schoolId?: string) {
    return this.repo.find({
      where: schoolId ? { schoolId } : {},
      relations: { school: true },
      order: { isPrimary: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const branch = await this.repo.findOne({
      where: { id },
      relations: { school: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(dto: CreateBranchDto) {
    const school = await this.schoolRepo.findOne({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('School not found');

    const codeDup = await this.repo.findOne({
      where: { schoolId: dto.schoolId, code: dto.code },
    });
    if (codeDup) {
      throw new ConflictException('Branch code already exists for this school');
    }

    // If this is the first branch or isPrimary requested, ensure only one primary
    if (dto.isPrimary) {
      await this.repo.update(
        { schoolId: dto.schoolId, isPrimary: true },
        { isPrimary: false },
      );
    } else {
      const existing = await this.repo.count({
        where: { schoolId: dto.schoolId },
      });
      if (existing === 0) {
        dto.isPrimary = true; // first branch is always primary
      }
    }

    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.findOne(id);

    if (dto.schoolId && dto.schoolId !== branch.schoolId) {
      const s = await this.schoolRepo.findOne({ where: { id: dto.schoolId } });
      if (!s) throw new NotFoundException('School not found');
    }

    if (dto.code && dto.code !== branch.code) {
      const dup = await this.repo.findOne({
        where: {
          schoolId: dto.schoolId ?? branch.schoolId,
          code: dto.code,
          id: Not(id),
        },
      });
      if (dup) {
        throw new ConflictException(
          'Branch code already exists for this school',
        );
      }
    }

    if (dto.isPrimary === true) {
      await this.repo.update(
        {
          schoolId: dto.schoolId ?? branch.schoolId,
          isPrimary: true,
          id: Not(id),
        },
        { isPrimary: false },
      );
    }

    Object.assign(branch, dto);
    return this.repo.save(branch);
  }

  async remove(id: string) {
    const branch = await this.findOne(id);
    if (branch.isPrimary) {
      const otherCount = await this.repo.count({
        where: { schoolId: branch.schoolId, id: Not(id) },
      });
      if (otherCount > 0) {
        throw new ConflictException(
          'Cannot delete primary branch while other branches exist. Promote another branch first.',
        );
      }
    }
    await this.repo.softRemove(branch);
    return { deleted: true, id };
  }
}
