import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, ILike, In, Repository } from 'typeorm';
import slugify from 'slugify';
import * as bcrypt from 'bcrypt';
import { School } from '../../../database/master/school.entity';
import { Plan } from '../../../database/master/plan.entity';
import { User, UserRole } from '../../../database/tenant/user.entity';
import { Student } from '../../../database/tenant/student.entity';
import { Staff } from '../../../database/tenant/staff.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Section } from '../../../database/tenant/section.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';

const STAFF_ROLES: UserRole[] = [
  'owner',
  'admin',
  'manager',
  'teacher',
  'staff',
  'cashier',
];
import { OrganizationsService } from '../organizations/organizations.service';
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
    private readonly organizations: OrganizationsService,
  ) {
    this.repo = ds.getRepository(School);
    this.planRepo = ds.getRepository(Plan);
  }

  list(organizationId?: string) {
    return this.repo.find({
      where: organizationId ? { organizationId } : {},
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

    // Organization scope: enforce the school limit and per-org name uniqueness
    // BEFORE any writes. (No-op for platform-direct schools with no org.)
    if (dto.organizationId) {
      await this.organizations.assertCanCreateSchool(dto.organizationId);
      const nameDup = await this.repo.findOne({
        where: { organizationId: dto.organizationId, name: ILike(dto.name) },
      });
      if (nameDup) {
        throw new ConflictException(
          'A school with this name already exists in this organization',
        );
      }
    }

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
        organizationId: dto.organizationId ?? null,
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

  /** The school's current admin/owner (or null), read from its tenant schema. */
  async getOwner(id: string) {
    const school = await this.findOne(id);
    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const owner = await em.getRepository(User).findOne({
        where: { schoolId: school.id, role: 'owner' },
        order: { createdAt: 'ASC' },
      });
      return owner
        ? { id: owner.id, name: owner.name, email: owner.email, isActive: owner.isActive }
        : null;
    });
  }

  /**
   * Update (or create) the school's admin/owner — change name/email and/or
   * reset the password. Operates on the school's own tenant schema.
   */
  async setOwner(
    id: string,
    dto: { name?: string; email?: string; password?: string },
  ) {
    const school = await this.findOne(id);
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const userRepo = em.getRepository(User);
      const owner = await userRepo.findOne({
        where: { schoolId: school.id, role: 'owner' },
        order: { createdAt: 'ASC' },
      });

      // No owner yet → create one (all fields required).
      if (!owner) {
        if (!dto.name || !dto.email || !dto.password) {
          throw new BadRequestException(
            'Name, email and password are all required to create the school admin.',
          );
        }
        const dup = await userRepo.findOne({
          where: { schoolId: school.id, email: dto.email },
        });
        if (dup) {
          throw new ConflictException(
            'A user with this email already exists for this school.',
          );
        }
        const created = await userRepo.save(
          userRepo.create({
            schoolId: school.id,
            name: dto.name,
            email: dto.email,
            passwordHash: await bcrypt.hash(dto.password, rounds),
            pinHash: null,
            role: 'owner',
            isActive: true,
          }),
        );
        return {
          id: created.id,
          name: created.name,
          email: created.email,
          created: true,
        };
      }

      // Update existing owner.
      if (dto.email && dto.email !== owner.email) {
        const dup = await userRepo.findOne({
          where: { schoolId: school.id, email: dto.email },
        });
        if (dup && dup.id !== owner.id) {
          throw new ConflictException(
            'A user with this email already exists for this school.',
          );
        }
        owner.email = dto.email;
      }
      if (dto.name) owner.name = dto.name;
      if (dto.password) {
        owner.passwordHash = await bcrypt.hash(dto.password, rounds);
      }
      owner.isActive = true;
      await userRepo.save(owner);
      return {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        created: false,
      };
    });
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

  /** Quick counts for the school-detail page — students, staff, classes, sections. */
  async getSummary(id: string) {
    const school = await this.findOne(id);
    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const [studentsCount, staffCount, classesCount, sectionsCount] =
        await Promise.all([
          em.getRepository(Student).count({ where: { schoolId: school.id } }),
          em.getRepository(Staff).count({ where: { schoolId: school.id } }),
          em.getRepository(ClassEntity).count({ where: { schoolId: school.id } }),
          em.getRepository(Section).count({ where: { schoolId: school.id } }),
        ]);
      return { studentsCount, staffCount, classesCount, sectionsCount };
    });
  }

  /** Tenant login accounts for this school (owner/admin/manager/teacher/staff/cashier). */
  async getUsers(id: string) {
    const school = await this.findOne(id);
    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const users = await em.getRepository(User).find({
        where: { schoolId: school.id, role: In(STAFF_ROLES) },
        order: { createdAt: 'ASC' },
      });
      return users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.roleKey ?? u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      }));
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
