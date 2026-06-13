import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BiometricDevice } from '../../../database/master/biometric-device.entity';
import { BiometricDeviceCommand } from '../../../database/master/biometric-device-command.entity';
import { BiometricTransaction } from '../../../database/tenant/biometric-transaction.entity';
import { BiometricEnrollment } from '../../../database/tenant/biometric-enrollment.entity';
import { Student } from '../../../database/tenant/student.entity';
import { Staff } from '../../../database/tenant/staff.entity';
import { User } from '../../../database/tenant/user.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { paginate } from '../../../common/dto/pagination.dto';
import {
  ListEnrollmentsQueryDto,
  ListTransactionsQueryDto,
} from './dto/biometric-query.dto';

@Injectable()
export class BiometricDevicesService {
  private readonly deviceRepo: Repository<BiometricDevice>;
  private readonly commandRepo: Repository<BiometricDeviceCommand>;

  constructor(
    @InjectDataSource('master') master: DataSource,
    private readonly tenant: TenantSchemaService,
  ) {
    this.deviceRepo = master.getRepository(BiometricDevice);
    this.commandRepo = master.getRepository(BiometricDeviceCommand);
  }

  // ── Devices (master, scoped to this school) ─────────────────────────────────

  listDevices(schoolId: string) {
    return this.deviceRepo.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });
  }

  async findDevice(schoolId: string, id: string) {
    const d = await this.deviceRepo.findOne({ where: { id, schoolId } });
    if (!d) throw new NotFoundException('Device not found');
    return d;
  }

  async updateAlias(schoolId: string, id: string, alias: string) {
    const d = await this.findDevice(schoolId, id);
    d.alias = alias;
    return this.deviceRepo.save(d);
  }

  async restart(schoolId: string, id: string, userId?: string) {
    const d = await this.findDevice(schoolId, id);
    await this.commandRepo.insert({
      sn: d.sn,
      schoolId,
      command: 'REBOOT',
      status: 0,
      createdByUserId: userId ?? null,
    });
    return { queued: true, sn: d.sn };
  }

  async clearData(schoolId: string, id: string, userId?: string) {
    const d = await this.findDevice(schoolId, id);
    // Clears attendance logs on the device while keeping enrolled users.
    await this.commandRepo.insert({
      sn: d.sn,
      schoolId,
      command: 'CLEAR LOG',
      status: 0,
      createdByUserId: userId ?? null,
    });
    return { queued: true, sn: d.sn };
  }

  deviceCommands(schoolId: string, id: string) {
    return this.findDevice(schoolId, id).then((d) =>
      this.commandRepo.find({
        where: { sn: d.sn },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    );
  }

  /** Push all active students + staff to a device as DATA USER commands. */
  async syncUsers(
    schoolId: string,
    schemaName: string,
    id: string,
    userId?: string,
  ) {
    const device = await this.findDevice(schoolId, id);
    const commands = await this.tenant.runInSchema(schemaName, async (em) => {
      const students = await em.getRepository(Student).find({
        where: { schoolId, status: 'active' as any },
        select: { admissionNumber: true, firstName: true, lastName: true },
      });
      const staff = await em.getRepository(Staff).find({
        where: { schoolId, status: 'active' as any },
        select: { employeeId: true, userId: true },
      });
      const userIds = staff.map((s) => s.userId).filter(Boolean) as string[];
      const users = userIds.length
        ? await em.getRepository(User).find({
            where: userIds.map((uid) => ({ id: uid })),
            select: { id: true, name: true },
          })
        : [];
      const nameById = new Map(users.map((u) => [u.id, u.name]));

      const cmds: string[] = [];
      for (const s of students) {
        const name = `${s.firstName} ${s.lastName}`.trim();
        cmds.push(`DATA USER PIN=${s.admissionNumber}\tName=${name}\tPri=0`);
      }
      for (const st of staff) {
        const name = nameById.get(st.userId) ?? st.employeeId;
        cmds.push(`DATA USER PIN=${st.employeeId}\tName=${name}\tPri=0`);
      }
      return cmds;
    });

    if (!commands.length) {
      throw new BadRequestException('No active students or staff to sync');
    }
    await this.commandRepo.insert(
      commands.map((command) => ({
        sn: device.sn,
        schoolId,
        command,
        status: 0,
        createdByUserId: userId ?? null,
      })),
    );
    return { queued: commands.length, sn: device.sn };
  }

  // ── Transactions / enrollments (tenant schema) ──────────────────────────────

  transactions(
    schoolId: string,
    schemaName: string,
    q: ListTransactionsQueryDto,
  ) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(200, Math.max(1, q.limit ?? 20));
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = em
        .getRepository(BiometricTransaction)
        .createQueryBuilder('t')
        .where('t.school_id = :schoolId', { schoolId })
        .orderBy('t.punch_time', 'DESC');
      if (q.from) qb.andWhere('t.punch_time >= :from', { from: q.from });
      if (q.to) qb.andWhere('t.punch_time <= :to', { to: q.to });
      if (q.studentId) qb.andWhere('t.student_id = :sid', { sid: q.studentId });
      if (q.staffId) qb.andWhere('t.staff_id = :stid', { stid: q.staffId });
      if (q.punchState !== undefined)
        qb.andWhere('t.punch_state = :ps', { ps: q.punchState });
      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return paginate(items, total, page, limit);
    });
  }

  enrollments(
    schoolId: string,
    schemaName: string,
    q: ListEnrollmentsQueryDto,
  ) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(200, Math.max(1, q.limit ?? 20));
    return this.tenant.runInSchema(schemaName, async (em) => {
      const where: Record<string, unknown> = { schoolId };
      if (q.type) where.type = q.type;
      if (q.userCode) where.userCode = q.userCode;
      const [items, total] = await em
        .getRepository(BiometricEnrollment)
        .findAndCount({
          where,
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
          // Templates can be large — omit the heavy payload from list responses.
          select: {
            id: true,
            userCode: true,
            studentId: true,
            staffId: true,
            deviceSn: true,
            type: true,
            index: true,
            valid: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      return paginate(items, total, page, limit);
    });
  }

  async deleteTransaction(schoolId: string, schemaName: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(BiometricTransaction);
      const t = await repo.findOne({ where: { id, schoolId } });
      if (!t) throw new NotFoundException('Transaction not found');
      await repo.remove(t);
      return { deleted: true, id };
    });
  }

  async stats(schoolId: string, schemaName: string) {
    const [totalDevices, onlineDevices] = await Promise.all([
      this.deviceRepo.count({ where: { schoolId } }),
      this.deviceRepo.count({ where: { schoolId, state: '1' } }),
    ]);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { txToday, enrolledUsers } = await this.tenant.runInSchema(
      schemaName,
      async (em) => {
        const txToday = await em
          .getRepository(BiometricTransaction)
          .createQueryBuilder('t')
          .where('t.school_id = :schoolId', { schoolId })
          .andWhere('t.punch_time >= :start', { start: todayStart })
          .getCount();
        const distinct = await em
          .getRepository(BiometricEnrollment)
          .createQueryBuilder('e')
          .select('COUNT(DISTINCT e.user_code)', 'c')
          .where('e.school_id = :schoolId', { schoolId })
          .getRawOne<{ c: string }>();
        return { txToday, enrolledUsers: Number(distinct?.c ?? 0) };
      },
    );
    return {
      total_devices: totalDevices,
      online_devices: onlineDevices,
      total_transactions_today: txToday,
      enrolled_users: enrolledUsers,
    };
  }
}
