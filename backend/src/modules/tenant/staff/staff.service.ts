import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { Staff } from '../../../database/tenant/staff.entity';
import { User } from '../../../database/tenant/user.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { paginate } from '../../../common/dto/pagination.dto';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

export interface StaffListOpts {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  department?: string;
}

// Sort expressions. `name` uses a correlated subquery (not a join) so that
// pagination's DISTINCT/two-step query stays valid in Postgres.
const STAFF_SORT: Record<string, string> = {
  name: '(SELECT u2.name FROM users u2 WHERE u2.id = s.user_id)',
  employeeId: 's.employeeId',
  designation: 's.designation',
  department: 's.department',
  joiningDate: 's.joiningDate',
  status: 's.status',
  createdAt: 's.createdAt',
};

@Injectable()
export class StaffService {
  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly config: ConfigService,
  ) {}

  private buildListQuery(
    em: EntityManager,
    schoolId: string,
    opts: StaffListOpts,
  ): SelectQueryBuilder<Staff> {
    const qb = em
      .getRepository(Staff)
      .createQueryBuilder('s')
      .where('s.schoolId = :schoolId', { schoolId })
      .andWhere('s.deletedAt IS NULL');
    if (opts.status) qb.andWhere('s.status = :st', { st: opts.status });
    if (opts.department)
      qb.andWhere('s.department = :dep', { dep: opts.department });
    if (opts.search) {
      const t = `%${opts.search.trim()}%`;
      // Search staff columns + the linked user via EXISTS (no join → pagination-safe).
      qb.andWhere(
        `(s.employeeId ILIKE :t OR s.designation ILIKE :t OR s.department ILIKE :t
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id AND (u.name ILIKE :t OR u.email ILIKE :t)))`,
        { t },
      );
    }
    const sortCol = STAFF_SORT[opts.sortBy ?? ''] ?? 's.createdAt';
    qb.orderBy(sortCol, opts.sortOrder === 'asc' ? 'ASC' : 'DESC').addOrderBy(
      's.id',
      'ASC',
    );
    return qb;
  }

  private async attachUsers(em: EntityManager, staff: Staff[]) {
    if (staff.length === 0) return [];
    const users = await em
      .getRepository(User)
      .find({ where: { id: In(staff.map((s) => s.userId)) } });
    const byId = new Map(users.map((u) => [u.id, u]));
    return staff.map((s) => ({ ...s, user: byId.get(s.userId) ?? null }));
  }

  list(schemaName: string, schoolId: string, opts: StaffListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
      const [staff, total] = await this.buildListQuery(em, schoolId, opts)
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const items = await this.attachUsers(em, staff);
      return paginate(items, total, page, limit);
    });
  }

  exportRows(schemaName: string, schoolId: string, opts: StaffListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const staff = await this.buildListQuery(em, schoolId, opts)
        .take(10000)
        .getMany();
      const withUsers = await this.attachUsers(em, staff);
      return withUsers.map((s) => ({
        employeeId: s.employeeId,
        name: s.user?.name ?? '',
        email: s.user?.email ?? '',
        role: s.user?.role ?? '',
        designation: s.designation,
        department: s.department ?? '',
        qualification: s.qualification ?? '',
        joiningDate: s.joiningDate,
        salary: s.salary ? (s.salary / 100).toFixed(2) : '',
        status: s.status,
      }));
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const s = await em
        .getRepository(Staff)
        .findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Staff not found');
      const user = await em.getRepository(User).findOne({
        where: { id: s.userId },
      });
      return { ...s, user };
    });
  }

  async create(schemaName: string, schoolId: string, dto: CreateStaffDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const userRepo = em.getRepository(User);
      const staffRepo = em.getRepository(Staff);

      const employeeDup = await staffRepo.findOne({
        where: { schoolId, employeeId: dto.employeeId },
      });
      if (employeeDup) {
        throw new ConflictException('Employee ID already exists');
      }
      const emailDup = await userRepo.findOne({
        where: { schoolId, email: dto.email },
      });
      if (emailDup) {
        throw new ConflictException('Email already exists for this school');
      }

      const passwordHash = dto.password
        ? await bcrypt.hash(
            dto.password,
            Number(this.config.get('BCRYPT_ROUNDS', 12)),
          )
        : null;

      const user = await userRepo.save(
        userRepo.create({
          schoolId,
          name: dto.name,
          email: dto.email,
          passwordHash,
          pinHash: null,
          role: dto.role,
          roleKey: dto.roleKey || null,
          isActive: true,
        }),
      );

      const staff = await staffRepo.save(
        staffRepo.create({
          schoolId,
          userId: user.id,
          employeeId: dto.employeeId,
          designation: dto.designation,
          department: dto.department ?? null,
          qualification: dto.qualification ?? null,
          joiningDate: new Date(dto.joiningDate),
          salary: dto.salary ?? 0,
          bankAccount: dto.bankAccount ?? null,
          bankIfsc: dto.bankIfsc ?? null,
          pan: dto.pan ?? null,
          aadhar: dto.aadhar ?? null,
          address: dto.address ?? null,
          mobileCountryCode: dto.mobileCountryCode ?? null,
          mobile: dto.mobile ?? null,
          whatsappCountryCode: dto.whatsappCountryCode ?? null,
          whatsapp: dto.whatsapp ?? null,
          photoUrl: dto.photoUrl ?? null,
          status: dto.status ?? 'active',
        }),
      );

      return { ...staff, user };
    });
  }

  async update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateStaffDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const staffRepo = em.getRepository(Staff);
      const userRepo = em.getRepository(User);

      const staff = await staffRepo.findOne({ where: { id, schoolId } });
      if (!staff) throw new NotFoundException('Staff not found');
      const user = await userRepo.findOne({ where: { id: staff.userId } });
      if (!user) throw new NotFoundException('Linked user missing');

      // User fields
      if (dto.email && dto.email !== user.email) {
        const dup = await userRepo.findOne({
          where: { schoolId, email: dto.email },
        });
        if (dup) throw new ConflictException('Email already exists');
        user.email = dto.email;
      }
      if (dto.name) user.name = dto.name;
      if (dto.role) user.role = dto.role;
      if (dto.roleKey !== undefined) user.roleKey = dto.roleKey || null;
      if (dto.password) {
        user.passwordHash = await bcrypt.hash(
          dto.password,
          Number(this.config.get('BCRYPT_ROUNDS', 12)),
        );
      }
      await userRepo.save(user);

      // Staff fields
      if (dto.employeeId && dto.employeeId !== staff.employeeId) {
        const dup = await staffRepo.findOne({
          where: { schoolId, employeeId: dto.employeeId },
        });
        if (dup) throw new ConflictException('Employee ID already exists');
      }
      Object.assign(staff, {
        ...dto,
        joiningDate: dto.joiningDate
          ? new Date(dto.joiningDate)
          : staff.joiningDate,
      });
      // Remove fields that belong to user
      delete (staff as any).name;
      delete (staff as any).email;
      delete (staff as any).role;
      delete (staff as any).password;
      await staffRepo.save(staff);

      return { ...staff, user };
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const staffRepo = em.getRepository(Staff);
      const userRepo = em.getRepository(User);
      const staff = await staffRepo.findOne({ where: { id, schoolId } });
      if (!staff) throw new NotFoundException('Staff not found');
      await staffRepo.softRemove(staff);
      await userRepo.softDelete({ id: staff.userId });
      return { deleted: true, id };
    });
  }
}
