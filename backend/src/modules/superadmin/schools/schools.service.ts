import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import slugify from 'slugify';
import * as bcrypt from 'bcrypt';
import { School } from '../../../database/master/school.entity';
import { Plan } from '../../../database/master/plan.entity';
import { User } from '../../../database/tenant/user.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  private readonly repo: Repository<School>;
  private readonly planRepo: Repository<Plan>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly tenantSchema: TenantSchemaService,
    private readonly config: ConfigService,
  ) {
    this.repo = ds.getRepository(School);
    this.planRepo = ds.getRepository(Plan);
  }

  list() {
    return this.repo.find({
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const school = await this.repo.findOne({
      where: { id },
      relations: { plan: true },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async create(dto: CreateSchoolDto) {
    const slug = (dto.slug ?? this.generateSlug(dto.name)).toLowerCase();
    const code = (dto.code ?? this.generateCode(dto.name)).toUpperCase();

    if (await this.repo.findOne({ where: { slug } })) {
      throw new ConflictException('School slug already exists');
    }
    if (await this.repo.findOne({ where: { code } })) {
      throw new ConflictException('School code already exists');
    }
    if (await this.repo.findOne({ where: { email: dto.email } })) {
      throw new ConflictException('School email already exists');
    }

    let plan: Plan | null = null;
    if (dto.planId) {
      plan = await this.planRepo.findOne({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Plan not found');
    }

    const trialDays = plan?.trialDays ?? 14;
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    const school = await this.repo.save(
      this.repo.create({
        name: dto.name,
        slug,
        code,
        email: dto.email,
        phone: dto.phone ?? null,
        logoUrl: dto.logoUrl ?? null,
        planId: dto.planId ?? null,
        schemaName: 'shared_pool',
        isSchemaProvisioned: false,
        status: dto.status ?? 'trial',
        trialStartsAt: trialStart,
        trialEndsAt: trialEnd,
      }),
    );

    if (dto.ownerEmail && dto.ownerPassword && dto.ownerName) {
      await this.createOwner(school, {
        name: dto.ownerName,
        email: dto.ownerEmail,
        password: dto.ownerPassword,
      });
    }

    return this.repo.findOne({
      where: { id: school.id },
      relations: { plan: true },
    });
  }

  async update(id: string, dto: UpdateSchoolDto) {
    const school = await this.findOne(id);

    if (dto.slug && dto.slug !== school.slug) {
      if (await this.repo.findOne({ where: { slug: dto.slug } })) {
        throw new ConflictException('School slug already exists');
      }
    }

    if (dto.code) {
      const upper = dto.code.toUpperCase();
      if (upper !== school.code) {
        if (await this.repo.findOne({ where: { code: upper } })) {
          throw new ConflictException('School code already exists');
        }
        (dto as any).code = upper;
      }
    }

    if (dto.email && dto.email !== school.email) {
      if (await this.repo.findOne({ where: { email: dto.email } })) {
        throw new ConflictException('School email already exists');
      }
    }

    if (dto.planId) {
      const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Plan not found');
    }

    const { ownerName, ownerEmail, ownerPassword, ...patch } = dto as any;
    Object.assign(school, patch);
    return this.repo.save(school);
  }

  async remove(id: string) {
    const school = await this.findOne(id);
    await this.repo.softRemove(school);
    return { deleted: true, id };
  }

  /** Create or reset the school owner user in the tenant schema. */
  async createOwner(
    school: School,
    owner: { name: string; email: string; password: string },
  ) {
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(owner.password, rounds);

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const userRepo = em.getRepository(User);

      const existing = await userRepo.findOne({
        where: { schoolId: school.id, email: owner.email },
      });
      if (existing) {
        throw new ConflictException(
          'A user with this email already exists for this school',
        );
      }

      return userRepo.save(
        userRepo.create({
          schoolId: school.id,
          name: owner.name,
          email: owner.email,
          passwordHash,
          pinHash: null,
          role: 'owner',
          isActive: true,
        }),
      );
    });
  }

  /** Generate a default code from the name: initials if multi-word, else first 8 chars. */
  private generateCode(name: string): string {
    const cleaned = name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const initials = words.map((w) => w[0]).join('').slice(0, 6);
      if (initials.length >= 2) return initials;
    }
    return (words[0] ?? 'SCHOOL').slice(0, 8) || 'SCHOOL';
  }

  private generateSlug(name: string): string {
    return slugify(name, { lower: true, strict: true, trim: true });
  }
}
