import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BiometricDevice } from '../../../database/master/biometric-device.entity';
import { BiometricDeviceCommand } from '../../../database/master/biometric-device-command.entity';
import { BiometricTransaction } from '../../../database/tenant/biometric-transaction.entity';
import { BiometricEnrollment } from '../../../database/tenant/biometric-enrollment.entity';
import { Student } from '../../../database/tenant/student.entity';
import { Staff } from '../../../database/tenant/staff.entity';
import { User } from '../../../database/tenant/user.entity';
import { Visitor } from '../../../database/tenant/visitor.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { IclockService } from '../../biometric/iclock.service';
import {
  EnrollUserType,
  buildUserCode,
  visitorBase,
} from '../../biometric/user-code.util';
import { paginate } from '../../../common/dto/pagination.dto';
import {
  ListEnrollmentsQueryDto,
  ListTransactionsQueryDto,
} from './dto/biometric-query.dto';
import {
  BiometricType,
  BulkActionResult,
  BulkEnrollDto,
  EnrollRemotelyDto,
  EnrollUserDto,
} from './dto/device-actions.dto';

/** A user that can be enrolled, resolved to its device PIN. */
export interface EnrollableUser {
  id: string;
  userType: EnrollUserType;
  /** Base identifier (admission #, employee id, or visitor short id). */
  code: string;
  /** Full device PIN (prefix + base). */
  userCode: string;
  name: string;
  subtitle?: string;
}

const BIO_TYPE_LABEL: Record<BiometricType, string> = {
  fingerprint: 'FP',
  face: 'FACE',
  palm: 'PALM',
};

@Injectable()
export class BiometricDevicesService {
  private readonly logger = new Logger(BiometricDevicesService.name);
  private readonly deviceRepo: Repository<BiometricDevice>;
  private readonly commandRepo: Repository<BiometricDeviceCommand>;

  constructor(
    @InjectDataSource('master') master: DataSource,
    private readonly tenant: TenantSchemaService,
    private readonly iclock: IclockService,
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

  // ── Device actions (single) ─────────────────────────────────────────────────

  /** Queue a reboot command for one device (with deactivation guard). */
  async restartDevice(schoolId: string, id: string, userId?: string) {
    const device = await this.findDevice(schoolId, id);
    if (device.deactivatedAt) {
      throw new BadRequestException('Device is deactivated');
    }
    await this.iclock.queueDeviceCommand(
      schoolId,
      'REBOOT',
      undefined,
      device.sn,
      userId,
    );
    return { message: `Restart command queued for ${this.label(device)}` };
  }

  /** Ask the device to report its info/stats on next poll. */
  async readDeviceInfo(schoolId: string, id: string, userId?: string) {
    const device = await this.findDevice(schoolId, id);
    await this.iclock.queueDeviceCommand(
      schoolId,
      'INFO',
      undefined,
      device.sn,
      userId,
    );
    return { message: `Info request queued for ${this.label(device)}` };
  }

  /** Set the duplicate-punch (re-record) interval, in seconds, on one device. */
  async setDuplicatePunch(
    schoolId: string,
    id: string,
    seconds: number,
    userId?: string,
  ) {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
      throw new BadRequestException('seconds must be an integer between 0 and 3600');
    }
    const device = await this.findDevice(schoolId, id);
    await this.iclock.queueDeviceCommand(
      schoolId,
      `SET OPTION AlarmReRec=${seconds}`,
      undefined,
      device.sn,
      userId,
    );
    // Reuse the existing transfer_interval column to remember the setting.
    await this.deviceRepo.update({ id: device.id }, { transferInterval: seconds });
    return {
      message: `Duplicate punch interval set to ${seconds}s on ${this.label(device)}`,
    };
  }

  /** Trigger a remote enrollment (fingerprint/face/palm) on one device. */
  async enrollRemotely(
    schoolId: string,
    schemaName: string,
    id: string,
    dto: EnrollRemotelyDto,
    userId?: string,
  ) {
    const device = await this.findDevice(schoolId, id);
    const resolved = await this.resolveRawUserCode(
      schemaName,
      schoolId,
      dto.userCode,
    );
    if (!resolved) {
      throw new NotFoundException('User not found in this school');
    }
    // Add the user (prefixed PIN) first, then queue the enroll command.
    await this.iclock.queueDeviceCommand(
      schoolId,
      `DATA USER PIN=${resolved.userCode}\tName=${resolved.name}\tPri=0`,
      undefined,
      device.sn,
      userId,
    );
    await this.iclock.queueDeviceCommand(
      schoolId,
      this.buildEnrollCommand(resolved.userCode, dto.biometricType, dto.fingerId),
      undefined,
      device.sn,
      userId,
    );
    return { message: `Enrollment command queued on ${this.label(device)}` };
  }

  // ── Device actions (bulk) ───────────────────────────────────────────────────

  async bulkRestart(
    deviceIds: string[],
    schoolId: string,
    userId?: string,
  ): Promise<BulkActionResult> {
    return this.runBulk(deviceIds, schoolId, 'REBOOT', userId);
  }

  async bulkReadInfo(
    deviceIds: string[],
    schoolId: string,
    userId?: string,
  ): Promise<BulkActionResult> {
    return this.runBulk(deviceIds, schoolId, 'INFO', userId);
  }

  async bulkSetDuplicatePunch(
    deviceIds: string[],
    schoolId: string,
    seconds: number,
    userId?: string,
  ): Promise<BulkActionResult> {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
      throw new BadRequestException('seconds must be an integer between 0 and 3600');
    }
    const result = await this.runBulk(
      deviceIds,
      schoolId,
      `SET OPTION AlarmReRec=${seconds}`,
      userId,
      (successIds) =>
        this.deviceRepo.update(
          { id: In(successIds) },
          { transferInterval: seconds },
        ),
    );
    return result;
  }

  async bulkEnrollRemotely(
    deviceIds: string[],
    schoolId: string,
    schemaName: string,
    dto: BulkEnrollDto,
    userId?: string,
  ): Promise<BulkActionResult> {
    // Resolve the user ONCE, before the loop.
    const resolved = await this.resolveRawUserCode(
      schemaName,
      schoolId,
      dto.userCode,
    );
    if (!resolved) {
      throw new NotFoundException('User not found in this school');
    }
    // Each device gets an add-user command followed by the enroll command.
    const commands = [
      `DATA USER PIN=${resolved.userCode}\tName=${resolved.name}\tPri=0`,
      this.buildEnrollCommand(resolved.userCode, dto.biometricType, dto.fingerId),
    ];
    return this.runBulk(deviceIds, schoolId, commands, userId);
  }

  // ── Bulk helpers ────────────────────────────────────────────────────────────

  /**
   * Shared engine for bulk device actions: loads scoped devices, skips
   * deactivated ones, queues the command per device, and never lets one
   * failure stop the others. `afterSuccess` runs once with the surviving ids.
   */
  private async runBulk(
    deviceIds: string[],
    schoolId: string,
    command: string | string[],
    userId?: string,
    afterSuccess?: (successIds: string[]) => Promise<unknown>,
  ): Promise<BulkActionResult> {
    const commands = Array.isArray(command) ? command : [command];
    const devices = await this.deviceRepo.find({
      where: { id: In(deviceIds), schoolId },
    });
    const successIds: string[] = [];
    const failed: string[] = [];

    for (const device of devices) {
      if (device.deactivatedAt) {
        this.logger.warn(`Skipping deactivated device ${this.label(device)}`);
        failed.push(this.label(device));
        continue;
      }
      try {
        // Queue each command in order (e.g. add-user, then enroll).
        for (const cmd of commands) {
          await this.iclock.queueDeviceCommand(
            schoolId,
            cmd,
            undefined,
            device.sn,
            userId,
          );
        }
        successIds.push(device.id);
      } catch (err) {
        this.logger.error(
          `Bulk command failed for ${this.label(device)}: ${(err as Error).message}`,
        );
        failed.push(this.label(device));
      }
    }

    if (afterSuccess && successIds.length) {
      await afterSuccess(successIds).catch(() => undefined);
    }

    const successCount = successIds.length;
    const failedCount = failed.length;
    const parts = [`Command queued on ${successCount} device(s)`];
    if (failedCount) parts.push(`${failedCount} failed`);
    return {
      success_count: successCount,
      failed_count: failedCount,
      failed_devices: failed,
      message: parts.join(', '),
    };
  }

  private buildEnrollCommand(
    userCode: string,
    biometricType: BiometricType,
    fingerId?: number,
  ): string {
    switch (biometricType) {
      case 'face':
        return `ENROLL_FACE\tPIN=${userCode}\tRETRY=3\tOVERWRITE=1`;
      case 'palm':
        return `ENROLL_PALM\tPIN=${userCode}\tRETRY=3\tOVERWRITE=1`;
      case 'fingerprint':
      default:
        return `ENROLL_FP\tPIN=${userCode}\tFID=${fingerId ?? 6}\tRETRY=3\tOVERWRITE=1`;
    }
  }

  /**
   * Resolve a raw admission#/employee-id to its prefixed device PIN + display
   * name, or null if no student/staff matches. Used by the enroll-by-code
   * endpoints so they emit prefixed PINs consistent with the rest of the system.
   */
  private async resolveRawUserCode(
    schemaName: string,
    schoolId: string,
    rawCode: string,
  ): Promise<{ userCode: string; name: string } | null> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const student = await em.getRepository(Student).findOne({
        where: { schoolId, admissionNumber: rawCode },
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
        },
      });
      if (student) {
        return {
          userCode: buildUserCode('student', student.admissionNumber),
          name: `${student.firstName} ${student.lastName}`.trim(),
        };
      }
      const staff = await em.getRepository(Staff).findOne({
        where: { schoolId, employeeId: rawCode },
        select: { id: true, employeeId: true, userId: true },
      });
      if (staff) {
        const u = staff.userId
          ? await em.getRepository(User).findOne({
              where: { id: staff.userId },
              select: { id: true, name: true, role: true },
            })
          : null;
        const type = this.staffUserType(u?.role);
        return {
          userCode: buildUserCode(type, staff.employeeId),
          name: u?.name ?? staff.employeeId,
        };
      }
      return null;
    });
  }

  private label(device: BiometricDevice): string {
    return device.alias || device.sn;
  }

  // ── User enrollment (students / teachers / staff / visitors) ────────────────

  /** Classify a staff member as teacher vs other staff by their login role. */
  private staffUserType(role?: string | null): EnrollUserType {
    return (role ?? '').toLowerCase() === 'teacher' ? 'teacher' : 'staff';
  }

  /** Search enrollable users of a given type, each resolved to its device PIN. */
  async listEnrollableUsers(
    schoolId: string,
    schemaName: string,
    type: EnrollUserType,
    search?: string,
  ): Promise<EnrollableUser[]> {
    const term = (search ?? '').trim();
    const like = `%${term}%`;
    return this.tenant.runInSchema(schemaName, async (em) => {
      if (type === 'student') {
        const qb = em
          .getRepository(Student)
          .createQueryBuilder('s')
          .where('s.school_id = :schoolId', { schoolId })
          .andWhere("s.status = 'active'")
          .orderBy('s.first_name', 'ASC')
          .take(20);
        if (term)
          qb.andWhere(
            '(s.first_name ILIKE :like OR s.last_name ILIKE :like OR s.admission_number ILIKE :like)',
            { like },
          );
        const rows = await qb.getMany();
        return rows.map((s) => ({
          id: s.id,
          userType: 'student' as const,
          code: s.admissionNumber,
          userCode: buildUserCode('student', s.admissionNumber),
          name: `${s.firstName} ${s.lastName}`.trim(),
          subtitle: s.admissionNumber,
        }));
      }

      if (type === 'teacher' || type === 'staff') {
        const qb = em
          .getRepository(Staff)
          .createQueryBuilder('st')
          .leftJoin(User, 'u', 'u.id = st.user_id')
          .select([
            'st.id AS id',
            'st.employee_id AS employee_id',
            'u.name AS name',
          ])
          .where('st.school_id = :schoolId', { schoolId })
          .andWhere("st.status = 'active'")
          .orderBy('u.name', 'ASC')
          .limit(20);
        if (type === 'teacher') qb.andWhere("u.role = 'teacher'");
        else qb.andWhere("(u.role IS NULL OR u.role <> 'teacher')");
        if (term)
          qb.andWhere('(u.name ILIKE :like OR st.employee_id ILIKE :like)', {
            like,
          });
        const rows = await qb.getRawMany<{
          id: string;
          employee_id: string;
          name: string | null;
        }>();
        return rows.map((r) => ({
          id: r.id,
          userType: type,
          code: r.employee_id,
          userCode: buildUserCode(type, r.employee_id),
          name: r.name ?? r.employee_id,
          subtitle: r.employee_id,
        }));
      }

      // Visitors
      const qb = em
        .getRepository(Visitor)
        .createQueryBuilder('v')
        .where('v.school_id = :schoolId', { schoolId })
        .andWhere('v.is_blacklisted = false')
        .orderBy('v.name', 'ASC')
        .take(20);
      if (term)
        qb.andWhere('(v.name ILIKE :like OR v.mobile ILIKE :like)', { like });
      const rows = await qb.getMany();
      return rows.map((v) => {
        const base = visitorBase(v.id);
        return {
          id: v.id,
          userType: 'visitor' as const,
          code: base,
          userCode: buildUserCode('visitor', base),
          name: v.name,
          subtitle: v.mobile,
        };
      });
    });
  }

  /** Resolve one enrollable user (by type + entity id) to its PIN + name. */
  private async resolveEnrollableUser(
    schoolId: string,
    schemaName: string,
    type: EnrollUserType,
    id: string,
  ): Promise<EnrollableUser | null> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      if (type === 'student') {
        const s = await em.getRepository(Student).findOne({
          where: { id, schoolId },
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
          },
        });
        if (!s) return null;
        return {
          id: s.id,
          userType: 'student',
          code: s.admissionNumber,
          userCode: buildUserCode('student', s.admissionNumber),
          name: `${s.firstName} ${s.lastName}`.trim(),
          subtitle: s.admissionNumber,
        };
      }
      if (type === 'teacher' || type === 'staff') {
        const st = await em.getRepository(Staff).findOne({
          where: { id, schoolId },
          select: { id: true, employeeId: true, userId: true },
        });
        if (!st) return null;
        const u = st.userId
          ? await em.getRepository(User).findOne({
              where: { id: st.userId },
              select: { id: true, name: true, role: true },
            })
          : null;
        // Classify by login role so the prefix matches attendance resolution.
        const resolvedType = this.staffUserType(u?.role);
        return {
          id: st.id,
          userType: resolvedType,
          code: st.employeeId,
          userCode: buildUserCode(resolvedType, st.employeeId),
          name: u?.name ?? st.employeeId,
          subtitle: st.employeeId,
        };
      }
      const v = await em.getRepository(Visitor).findOne({
        where: { id, schoolId },
        select: { id: true, name: true, mobile: true },
      });
      if (!v) return null;
      const base = visitorBase(v.id);
      return {
        id: v.id,
        userType: 'visitor',
        code: base,
        userCode: buildUserCode('visitor', base),
        name: v.name,
        subtitle: v.mobile,
      };
    });
  }

  /**
   * Enroll a user onto the chosen devices: queues an add-user command plus the
   * biometric enroll command on each device, and records a pending enrollment.
   */
  async enrollUser(
    schoolId: string,
    schemaName: string,
    dto: EnrollUserDto,
    requestedByUserId?: string,
  ): Promise<BulkActionResult> {
    const user = await this.resolveEnrollableUser(
      schoolId,
      schemaName,
      dto.userType,
      dto.userId,
    );
    if (!user) throw new NotFoundException('User not found in this school');

    const devices = await this.deviceRepo.find({
      where: { id: In(dto.deviceIds), schoolId },
    });
    if (!devices.length) {
      throw new NotFoundException('No matching devices for this school');
    }

    const addUserCmd = `DATA USER PIN=${user.userCode}\tName=${user.name}\tPri=0`;
    const enrollCmd = this.buildEnrollCommand(
      user.userCode,
      dto.biometricType,
      dto.fingerId,
    );

    const successIds: string[] = [];
    const failed: string[] = [];
    const rows: Partial<BiometricDeviceCommand>[] = [];
    for (const device of devices) {
      if (device.deactivatedAt) {
        failed.push(this.label(device));
        continue;
      }
      // Add-user first so the device knows the PIN, then the enroll command.
      rows.push({
        sn: device.sn,
        schoolId,
        command: addUserCmd,
        status: 0,
        createdByUserId: requestedByUserId ?? null,
      });
      rows.push({
        sn: device.sn,
        schoolId,
        command: enrollCmd,
        status: 0,
        createdByUserId: requestedByUserId ?? null,
      });
      successIds.push(device.id);
    }
    if (rows.length) await this.commandRepo.insert(rows);

    // Record a pending enrollment row (refreshed when the template arrives).
    const typeLabel = BIO_TYPE_LABEL[dto.biometricType];
    const index =
      dto.biometricType === 'fingerprint' ? String(dto.fingerId ?? 6) : '0';
    const firstSn = devices.find((d) => !d.deactivatedAt)?.sn ?? null;
    await this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(BiometricEnrollment);
      const data = {
        schoolId,
        userCode: user.userCode,
        type: typeLabel,
        index,
        studentId: user.userType === 'student' ? user.id : null,
        staffId:
          user.userType === 'teacher' || user.userType === 'staff'
            ? user.id
            : null,
        visitorId: user.userType === 'visitor' ? user.id : null,
        userType: user.userType,
        name: user.name,
        status: 'pending',
        deviceSn: firstSn,
      };
      const existing = await repo.findOne({
        where: { schoolId, userCode: user.userCode, type: typeLabel, index },
      });
      if (existing) await repo.update({ id: existing.id }, data);
      else await repo.save(repo.create(data));
    });

    const parts = [
      `Enrollment queued for ${user.name} on ${successIds.length} device(s)`,
    ];
    if (failed.length) parts.push(`${failed.length} skipped (deactivated)`);
    return {
      success_count: successIds.length,
      failed_count: failed.length,
      failed_devices: failed,
      message: parts.join(', '),
    };
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
            select: { id: true, name: true, role: true },
          })
        : [];
      const nameById = new Map(users.map((u) => [u.id, u.name]));
      const roleById = new Map(users.map((u) => [u.id, u.role]));

      const cmds: string[] = [];
      for (const s of students) {
        const name = `${s.firstName} ${s.lastName}`.trim();
        const code = buildUserCode('student', s.admissionNumber);
        cmds.push(`DATA USER PIN=${code}\tName=${name}\tPri=0`);
      }
      for (const st of staff) {
        const name = nameById.get(st.userId) ?? st.employeeId;
        const type = this.staffUserType(roleById.get(st.userId));
        const code = buildUserCode(type, st.employeeId);
        cmds.push(`DATA USER PIN=${code}\tName=${name}\tPri=0`);
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
