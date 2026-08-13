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
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Staff } from '../../../database/tenant/staff.entity';
import { User } from '../../../database/tenant/user.entity';
import { Visitor } from '../../../database/tenant/visitor.entity';
import { SchoolProfile } from '../../../database/tenant/school-profile.entity';
import { School } from '../../../database/master/school.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { IclockService } from '../../biometric/iclock.service';
import {
  EnrollUserType,
  PrefixConfig,
  buildUserCode,
  loadBiometricPrefixes,
  prefixesFromSettings,
  sanitizePrefixes,
  validatePrefixes,
  visitorBase,
} from '../../biometric/user-code.util';
import { paginate } from '../../../common/dto/pagination.dto';
import { getBiometricStatusMap } from '../../../common/biometric/biometric-status.util';
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
  /** 'enrolled' once a template was received; 'pending' if queued but not yet
   *  captured; 'none' if never enrolled on any device. */
  enrollmentStatus: 'enrolled' | 'pending' | 'none';
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
  private readonly schoolRepo: Repository<School>;

  constructor(
    @InjectDataSource('master') master: DataSource,
    private readonly tenant: TenantSchemaService,
    private readonly iclock: IclockService,
  ) {
    this.deviceRepo = master.getRepository(BiometricDevice);
    this.commandRepo = master.getRepository(BiometricDeviceCommand);
    this.schoolRepo = master.getRepository(School);
  }

  // ── Device settings: configurable PIN prefixes per school ───────────────────

  /** Current prefix config (defaults filled in for any unset type). */
  getDeviceSettings(
    schoolId: string,
    schemaName: string,
  ): Promise<{ prefixes: PrefixConfig }> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const profile = await em
        .getRepository(SchoolProfile)
        .findOne({ where: { schoolId }, select: { id: true, settings: true } });
      return { prefixes: prefixesFromSettings(profile?.settings) };
    });
  }

  /** Validate + persist the per-school PIN prefixes. */
  async updateDeviceSettings(
    schoolId: string,
    schemaName: string,
    prefixesInput: Partial<PrefixConfig>,
  ): Promise<{ prefixes: PrefixConfig }> {
    const prefixes = sanitizePrefixes(prefixesInput);
    const error = validatePrefixes(prefixes);
    if (error) throw new BadRequestException(error);

    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(SchoolProfile);
      let profile = await repo.findOne({ where: { schoolId } });
      if (!profile) {
        // school_profile.name is NOT NULL — seed it from the master record.
        const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
        profile = repo.create({
          schoolId,
          name: school?.name ?? 'School',
          settings: {},
        });
      }
      profile.settings = {
        ...(profile.settings ?? {}),
        biometricPrefixes: prefixes,
      };
      await repo.save(profile);
      return { prefixes };
    });
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
      this.buildAddUserCommand(resolved.userCode, resolved.name),
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
      this.buildAddUserCommand(resolved.userCode, resolved.name),
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

  /**
   * Build the device add/update-user command. The ADMS datasheet documents
   * `USER ADD`/`USER DEL`, but real push-protocol firmware rejects those with
   * -1002 (invalid syntax) — `DATA UPDATE USERINFO` is what's actually
   * accepted. Card/Passwd/Grp must be present (even if empty) or some
   * firmware silently drops the record.
   */
  private buildAddUserCommand(userCode: string, name: string): string {
    return `DATA UPDATE USERINFO PIN=${userCode}\tName=${name}\tPri=0\tPasswd=\tCard=\tGrp=1`;
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
      const prefixes = await loadBiometricPrefixes(em, schoolId);
      const student = await em.getRepository(Student).findOne({
        where: { schoolId, admissionNumber: rawCode },
        select: {
          id: true,
          admissionNumber: true,
          studentName: true,
        },
      });
      if (student) {
        return {
          userCode: buildUserCode('student', student.admissionNumber, prefixes),
          name: student.studentName,
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
          userCode: buildUserCode(type, staff.employeeId, prefixes),
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

  /**
   * Look up each id's biometric enrollment status on the given FK column
   * ('enrolled' beats 'pending' when a user has rows in both states, e.g. one
   * finger captured and a second still queued).
   */
  private async enrollmentStatusMap(
    em: import('typeorm').EntityManager,
    schoolId: string,
    fk: 'studentId' | 'staffId' | 'visitorId',
    ids: string[],
  ) {
    return getBiometricStatusMap(em, schoolId, fk, ids);
  }

  /** Search enrollable users of a given type, each resolved to its device PIN. */
  async listEnrollableUsers(
    schoolId: string,
    schemaName: string,
    type: EnrollUserType,
    search?: string,
    classId?: string,
  ): Promise<EnrollableUser[]> {
    const term = (search ?? '').trim();
    const like = `%${term}%`;
    return this.tenant.runInSchema(schemaName, async (em) => {
      const prefixes = await loadBiometricPrefixes(em, schoolId);
      if (type === 'student') {
        const qb = em
          .getRepository(Student)
          .createQueryBuilder('s')
          .where('s.school_id = :schoolId', { schoolId })
          .andWhere("s.status = 'active'")
          .orderBy('s.student_name', 'ASC')
          .take(20);
        if (term)
          qb.andWhere(
            '(s.student_name ILIKE :like OR s.admission_number ILIKE :like)',
            { like },
          );
        if (classId) {
          qb.innerJoin(
            StudentEnrollment,
            'e',
            "e.student_id = s.id AND e.school_id = s.school_id AND e.status = 'active'",
          ).andWhere('e.class_id = :classId', { classId });
        }
        const rows = await qb.getMany();
        const statusById = await this.enrollmentStatusMap(
          em,
          schoolId,
          'studentId',
          rows.map((s) => s.id),
        );
        return rows.map((s) => ({
          id: s.id,
          userType: 'student' as const,
          code: s.admissionNumber,
          userCode: buildUserCode('student', s.admissionNumber, prefixes),
          name: s.studentName,
          subtitle: s.admissionNumber,
          enrollmentStatus: statusById.get(s.id) ?? 'none',
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
        const statusById = await this.enrollmentStatusMap(
          em,
          schoolId,
          'staffId',
          rows.map((r) => r.id),
        );
        return rows.map((r) => ({
          id: r.id,
          userType: type,
          code: r.employee_id,
          userCode: buildUserCode(type, r.employee_id, prefixes),
          name: r.name ?? r.employee_id,
          subtitle: r.employee_id,
          enrollmentStatus: statusById.get(r.id) ?? 'none',
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
      const statusById = await this.enrollmentStatusMap(
        em,
        schoolId,
        'visitorId',
        rows.map((v) => v.id),
      );
      return rows.map((v) => {
        const base = visitorBase(v.id);
        return {
          id: v.id,
          userType: 'visitor' as const,
          code: base,
          userCode: buildUserCode('visitor', base, prefixes),
          name: v.name,
          subtitle: v.mobile,
          enrollmentStatus: statusById.get(v.id) ?? 'none',
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
  ): Promise<Omit<EnrollableUser, 'enrollmentStatus'> | null> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const prefixes = await loadBiometricPrefixes(em, schoolId);
      if (type === 'student') {
        const s = await em.getRepository(Student).findOne({
          where: { id, schoolId },
          select: {
            id: true,
            admissionNumber: true,
            studentName: true,
          },
        });
        if (!s) return null;
        return {
          id: s.id,
          userType: 'student',
          code: s.admissionNumber,
          userCode: buildUserCode('student', s.admissionNumber, prefixes),
          name: s.studentName,
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
          userCode: buildUserCode(resolvedType, st.employeeId, prefixes),
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
        userCode: buildUserCode('visitor', base, prefixes),
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

    const addUserCmd = this.buildAddUserCommand(user.userCode, user.name);
    const enrollCmd = this.buildEnrollCommand(
      user.userCode,
      dto.biometricType,
      dto.fingerId,
    );

    const successIds: string[] = [];
    const failed: string[] = [];
    const addRows: Partial<BiometricDeviceCommand>[] = [];
    const enrollRows: Partial<BiometricDeviceCommand>[] = [];
    for (const device of devices) {
      if (device.deactivatedAt) {
        failed.push(this.label(device));
        continue;
      }
      addRows.push({
        sn: device.sn,
        schoolId,
        command: addUserCmd,
        status: 0,
        createdByUserId: requestedByUserId ?? null,
      });
      enrollRows.push({
        sn: device.sn,
        schoolId,
        command: enrollCmd,
        status: 0,
        createdByUserId: requestedByUserId ?? null,
      });
      successIds.push(device.id);
    }
    // Insert add-user commands FIRST (earlier created_at) so the device creates
    // the user before the enroll command runs — getrequest orders by created_at.
    if (addRows.length) await this.commandRepo.insert(addRows);
    if (enrollRows.length) await this.commandRepo.insert(enrollRows);

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

  /**
   * Queue an arbitrary raw command to a device (manual / advanced tool). The
   * literal two-char sequence `\t` is converted to a real tab so users can type
   * tab-separated commands (e.g. DATA USER PIN=1\tName=John); CR/LF are stripped
   * since one call = one command.
   */
  async runManualCommand(
    schoolId: string,
    id: string,
    rawCommand: string,
    userId?: string,
  ) {
    const device = await this.findDevice(schoolId, id);
    const command = (rawCommand ?? '')
      .replace(/\\t/g, '\t')
      .replace(/[\r\n]/g, '')
      .trim();
    if (!command) throw new BadRequestException('Command is empty');
    await this.commandRepo.insert({
      sn: device.sn,
      schoolId,
      command,
      status: 0,
      createdByUserId: userId ?? null,
    });
    return { queued: true, sn: device.sn, command };
  }

  /** Delete all still-pending (queued, not yet acked) commands for a device. */
  async clearPendingCommands(schoolId: string, id: string) {
    // findDevice verifies the device belongs to this school; clear every pending
    // command for its SN (incl. any queued before assignment with a null school).
    const device = await this.findDevice(schoolId, id);
    const res = await this.commandRepo.delete({ sn: device.sn, status: 0 });
    return { cleared: res.affected ?? 0, sn: device.sn };
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
      const prefixes = await loadBiometricPrefixes(em, schoolId);
      const students = await em.getRepository(Student).find({
        where: { schoolId, status: 'active' as any },
        select: { admissionNumber: true, studentName: true },
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
        const name = s.studentName;
        const code = buildUserCode('student', s.admissionNumber, prefixes);
        cmds.push(this.buildAddUserCommand(code, name));
      }
      for (const st of staff) {
        const name = nameById.get(st.userId) ?? st.employeeId;
        const type = this.staffUserType(roleById.get(st.userId));
        const code = buildUserCode(type, st.employeeId, prefixes);
        cmds.push(this.buildAddUserCommand(code, name));
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

  /** Resolve punch rows to display names + device alias, for the report table. */
  private async attachTransactionDisplay(
    em: import('typeorm').EntityManager,
    schoolId: string,
    rows: BiometricTransaction[],
  ) {
    const studentIds = [
      ...new Set(rows.map((r) => r.studentId).filter(Boolean) as string[]),
    ];
    const staffIds = [
      ...new Set(rows.map((r) => r.staffId).filter(Boolean) as string[]),
    ];
    const visitorIds = [
      ...new Set(rows.map((r) => r.visitorId).filter(Boolean) as string[]),
    ];
    const sns = [...new Set(rows.map((r) => r.deviceSn))];

    const [students, staffRows, visitors, devices] = await Promise.all([
      studentIds.length
        ? em.getRepository(Student).find({
            where: { id: In(studentIds), schoolId },
            select: { id: true, studentName: true },
          })
        : [],
      staffIds.length
        ? em
            .getRepository(Staff)
            .createQueryBuilder('st')
            .leftJoin(User, 'u', 'u.id = st.user_id')
            .select(['st.id AS id', 'u.name AS name'])
            .where('st.id IN (:...ids)', { ids: staffIds })
            .andWhere('st.school_id = :schoolId', { schoolId })
            .getRawMany<{ id: string; name: string | null }>()
        : [],
      visitorIds.length
        ? em.getRepository(Visitor).find({
            where: { id: In(visitorIds), schoolId },
            select: { id: true, name: true },
          })
        : [],
      sns.length
        ? this.deviceRepo.find({ where: { sn: In(sns), schoolId } })
        : [],
    ]);
    const studentName = new Map<string, string | null>(
      students.map((s): [string, string | null] => [s.id, s.studentName]),
    );
    const staffName = new Map<string, string | null>(
      staffRows.map((s): [string, string | null] => [s.id, s.name]),
    );
    const visitorName = new Map<string, string | null>(
      visitors.map((v): [string, string | null] => [v.id, v.name]),
    );
    const deviceAlias = new Map<string, string>(
      devices.map((d): [string, string] => [d.sn, d.alias || d.sn]),
    );

    return rows.map((r) => ({
      ...r,
      userName:
        (r.studentId && studentName.get(r.studentId)) ||
        (r.staffId && staffName.get(r.staffId)) ||
        (r.visitorId && visitorName.get(r.visitorId)) ||
        null,
      deviceAlias: deviceAlias.get(r.deviceSn) ?? r.deviceSn,
    }));
  }

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
      if (q.deviceSn) qb.andWhere('t.device_sn = :sn', { sn: q.deviceSn });
      if (q.userType) qb.andWhere('t.user_type = :ut', { ut: q.userType });
      if (q.classId) {
        qb.innerJoin(
          StudentEnrollment,
          'e',
          "e.student_id = t.student_id AND e.school_id = t.school_id AND e.status = 'active'",
        ).andWhere('e.class_id = :classId', { classId: q.classId });
      }
      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const display = await this.attachTransactionDisplay(em, schoolId, items);
      return paginate(display, total, page, limit);
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
      const qb = em
        .getRepository(BiometricEnrollment)
        .createQueryBuilder('e')
        // Templates can be large — omit the heavy payload from list responses.
        .select([
          'e.id',
          'e.userCode',
          'e.studentId',
          'e.staffId',
          'e.visitorId',
          'e.userType',
          'e.name',
          'e.status',
          'e.deviceSn',
          'e.type',
          'e.index',
          'e.valid',
          'e.createdAt',
          'e.updatedAt',
        ])
        .where('e.school_id = :schoolId', { schoolId })
        .orderBy('e.created_at', 'DESC');

      if (q.type) qb.andWhere('e.type = :type', { type: q.type });
      if (q.userCode) qb.andWhere('e.user_code = :userCode', { userCode: q.userCode });
      if (q.userType) qb.andWhere('e.user_type = :userType', { userType: q.userType });
      if (q.from) qb.andWhere('e.created_at >= :from', { from: q.from });
      if (q.to) qb.andWhere('e.created_at <= :to', { to: q.to });
      if (q.search) {
        const like = `%${q.search.trim()}%`;
        qb.andWhere('(e.name ILIKE :like OR e.user_code ILIKE :like)', { like });
      }
      if (q.classId) {
        qb.innerJoin(
          StudentEnrollment,
          'se',
          "se.student_id = e.student_id AND se.school_id = e.school_id AND se.status = 'active'",
        ).andWhere('se.class_id = :classId', { classId: q.classId });
      }

      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const display = await this.attachEnrollmentDisplay(em, schoolId, items);
      return paginate(display, total, page, limit);
    });
  }

  private async attachEnrollmentDisplay(
    em: import('typeorm').EntityManager,
    schoolId: string,
    rows: BiometricEnrollment[],
  ) {
    const studentIds = [
      ...new Set(rows.map((r) => r.studentId).filter(Boolean) as string[]),
    ];
    const sns = [...new Set(rows.map((r) => r.deviceSn).filter(Boolean) as string[])];

    const [enrollments, devices] = await Promise.all([
      studentIds.length
        ? em.getRepository(StudentEnrollment).find({
            where: { schoolId, studentId: In(studentIds), status: 'active' as any },
          })
        : [],
      sns.length
        ? this.deviceRepo.find({ where: { sn: In(sns), schoolId } })
        : [],
    ]);
    const classIds = [
      ...new Set(enrollments.map((e) => e.classId).filter(Boolean) as string[]),
    ];
    const classes = classIds.length
      ? await em.getRepository(ClassEntity).find({ where: { id: In(classIds) } })
      : [];
    const classNameById = new Map(classes.map((c): [string, string] => [c.id, c.name]));
    const classByStudent = new Map(
      enrollments.map((e): [string, string | null] => [
        e.studentId,
        e.classId ? (classNameById.get(e.classId) ?? null) : null,
      ]),
    );
    const deviceAlias = new Map(
      devices.map((d): [string, string] => [d.sn, d.alias || d.sn]),
    );

    return rows.map((r) => ({
      ...r,
      className: r.studentId ? (classByStudent.get(r.studentId) ?? null) : null,
      deviceAlias: r.deviceSn ? (deviceAlias.get(r.deviceSn) ?? r.deviceSn) : null,
    }));
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
