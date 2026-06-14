import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BiometricDevice } from '../../database/master/biometric-device.entity';
import { BiometricDeviceCommand } from '../../database/master/biometric-device-command.entity';
import { BiometricDeviceLog } from '../../database/master/biometric-device-log.entity';
import { School } from '../../database/master/school.entity';
import { BiometricTransaction } from '../../database/tenant/biometric-transaction.entity';
import { BiometricEnrollment } from '../../database/tenant/biometric-enrollment.entity';
import { Student } from '../../database/tenant/student.entity';
import { Staff } from '../../database/tenant/staff.entity';
import { Visitor } from '../../database/tenant/visitor.entity';
import { TenantSchemaService } from '../../common/tenant/tenant-schema.service';
import { EnrollUserType, parseUserCode } from './user-code.util';

interface ResolvedUser {
  studentId: string | null;
  staffId: string | null;
  visitorId: string | null;
  userType: EnrollUserType | null;
}

/**
 * ZKTeco / ESSL push-protocol implementation. All responses are plain text;
 * devices reject JSON. Hot paths (getrequest, cdata) avoid ORM hydration and
 * never block on logging.
 */
@Injectable()
export class IclockService {
  private readonly logger = new Logger(IclockService.name);
  private readonly deviceRepo: Repository<BiometricDevice>;
  private readonly commandRepo: Repository<BiometricDeviceCommand>;
  private readonly logRepo: Repository<BiometricDeviceLog>;
  private readonly schoolRepo: Repository<School>;

  constructor(
    @InjectDataSource('master') private readonly master: DataSource,
    private readonly tenant: TenantSchemaService,
  ) {
    this.deviceRepo = master.getRepository(BiometricDevice);
    this.commandRepo = master.getRepository(BiometricDeviceCommand);
    this.logRepo = master.getRepository(BiometricDeviceLog);
    this.schoolRepo = master.getRepository(School);
  }

  // ── Public protocol handlers ───────────────────────────────────────────────

  /** GET /iclock/cdata — device polls for its config/options. */
  async handleHandshake(sn: string, _query: Record<string, string>): Promise<string> {
    const tz = await this.touchDevice(sn);
    const stamp = Math.floor(Date.now() / 1000);
    return [
      `GET OPTION FROM: ${sn}`,
      'Stamp=9999',
      `OpStamp=${stamp}`,
      'ErrorDelay=30',
      'Delay=30',
      'TransTimes=00:00;23:59',
      'TransInterval=2',
      'TransFlag=111111111111',
      `TimeZone=${tz}`,
      'Realtime=1',
      'Encrypt=0',
      'FaceFunOn=1',
      'FaceOnlyOn=0',
      'FaceTransOn=1',
      'FaceAlgorithm=3',
      'FaceThreshold=60',
    ].join('\n');
  }

  /** GET /iclock/registry — device first contact / handshake. */
  async handleRegistry(sn: string, _query: Record<string, string>): Promise<string> {
    const tz = await this.touchDevice(sn);
    const stamp = Math.floor(Date.now() / 1000);
    return [
      'OK',
      'Stamp=9999',
      `OpStamp=${stamp}`,
      'ErrorDelay=30',
      'Delay=30',
      'TransTimes=00:00;23:59',
      'TransInterval=2',
      'TransFlag=111111111111',
      `TimeZone=${tz}`,
      'Realtime=1',
      'Encrypt=0',
    ].join('\n');
  }

  /** GET /iclock/getrequest — device polls for pending commands. (hot path) */
  async handleGetRequest(sn: string): Promise<string> {
    // Mark poll time without blocking (fire-and-forget).
    this.deviceRepo
      .update({ sn }, { pushTime: new Date().toISOString(), state: '1' })
      .catch(() => undefined);

    const rows: { id: string; command: string }[] = await this.master.query(
      `SELECT id, command FROM biometric_device_commands
       WHERE sn = $1 AND status = 0
       ORDER BY created_at ASC LIMIT 20`,
      [sn],
    );
    if (!rows.length) return 'OK';
    return rows.map((r) => `C:${r.id}:${r.command}`).join('\n');
  }

  /** POST /iclock/devicecmd — device reports command results. */
  async handleDeviceCommands(rawBody: string): Promise<string> {
    const lines = rawBody.split('\n').map((l) => l.trim()).filter(Boolean);
    const successIds: string[] = [];
    const errorMap = new Map<number, string[]>();
    let hasInfo = false;

    for (const line of lines) {
      const kv = this.parseKv(line);
      const id = kv['ID'];
      if (!id) continue;
      if ((kv['CMD'] || '').toUpperCase() === 'INFO') hasInfo = true;
      const ret = Number(kv['Return'] ?? kv['return'] ?? 0);
      if (ret === 0) {
        successIds.push(id);
      } else {
        const arr = errorMap.get(ret) ?? [];
        arr.push(id);
        errorMap.set(ret, arr);
      }
    }

    if (successIds.length) {
      await this.commandRepo.update(
        { id: In(successIds) },
        { status: 1, deviceReturnCode: 0 },
      );
    }
    for (const [code, ids] of errorMap) {
      await this.commandRepo.update(
        { id: In(ids) },
        { status: 2, deviceReturnCode: code },
      );
    }
    if (hasInfo) await this.updateDeviceInfo(rawBody).catch(() => undefined);
    return 'OK';
  }

  /** POST /iclock/cdata — device pushes attendance / biometric data. */
  async handleReceiveRecords(
    sn: string,
    table: string,
    rawBody: string,
  ): Promise<string> {
    this.logTraffic(sn, '/iclock/cdata', 'POST', table, rawBody);
    const device = await this.deviceRepo.findOne({ where: { sn } });
    if (!device) return 'ERROR';

    const rows = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, ''))
      .filter((l) => l.length > 0)
      .map((l) => l.split('\t'));

    try {
      const t = (table || '').toUpperCase();
      let count = rows.length;
      if (t === 'ATTLOG') {
        count = await this.processAttendanceLogs(rows, sn, device);
      } else if (t === 'OPERLOG') {
        await this.processOperLog(rawBody, sn, device);
      } else if (t === 'BIODATA') {
        await this.processBioData(rawBody, sn, device);
      } else if (t === 'BIOPHOTO') {
        await this.processBioPhoto(rawBody, sn, device);
      } else if (t === 'OPTIONS' || table === 'options') {
        await this.updateDeviceInfo(rawBody, sn);
      }
      return `OK: ${count}`;
    } catch (err) {
      this.logger.error(`receiveRecords ${table} failed: ${(err as Error).message}`);
      return `ERROR: ${rows.length}`;
    }
  }

  // ── Processors ──────────────────────────────────────────────────────────────

  private async processAttendanceLogs(
    rows: string[][],
    sn: string,
    device: BiometricDevice,
  ): Promise<number> {
    if (!device.schoolId) {
      this.logger.warn(`ATTLOG from unassigned device ${sn} — skipped`);
      return 0;
    }
    const schemaName = await this.schemaFor(device.schoolId);
    if (!schemaName) return 0;
    const schoolId = device.schoolId;

    return this.tenant.runInSchema(schemaName, async (em) => {
      const userCodes = [...new Set(rows.map((r) => r[0]).filter(Boolean))];
      const resolved = await this.resolveUsers(em, schoolId, userCodes);

      const values = rows
        .filter((r) => r[0] && r[1])
        .map((r) => {
          const userCode = r[0];
          const actual = this.parseDeviceTime(r[1]);
          const punchState = Number(r[2] ?? 0) || 0;
          const ru =
            resolved.get(userCode) ??
            ({
              studentId: null,
              staffId: null,
              visitorId: null,
              userType: null,
            } as ResolvedUser);
          return {
            schoolId,
            deviceSn: sn,
            userCode,
            studentId: ru.studentId,
            staffId: ru.staffId,
            visitorId: ru.visitorId,
            userType: ru.userType,
            actualPunchTime: actual,
            punchTime: actual,
            punchState,
            punchStateDisplay: punchState === 1 ? 'Check Out' : 'Check In',
            terminalSn: sn,
            uploadTime: new Date(),
            source: 'Device',
          };
        });
      if (!values.length) return 0;

      // Bulk insert; the unique index drops duplicate punches.
      const res = await em
        .createQueryBuilder()
        .insert()
        .into(BiometricTransaction)
        .values(values)
        .orIgnore()
        .execute();
      return res.identifiers.filter(Boolean).length || values.length;
    });
  }

  private async processBioData(
    rawBody: string,
    sn: string,
    device: BiometricDevice,
  ): Promise<void> {
    if (!device.schoolId) return;
    const schemaName = await this.schemaFor(device.schoolId);
    if (!schemaName) return;
    const schoolId = device.schoolId;

    // BIODATA lines look like: "BIODATA Pin=1\tNo=0\tIndex=0\tValid=1\t...Tmp=...."
    const records = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, '').trim())
      .filter((l) => /pin=/i.test(l));

    await this.tenant.runInSchema(schemaName, async (em) => {
      for (const line of records) {
        const kv = this.parseKv(line.replace(/^BIODATA\s+/i, ''));
        const userCode = kv['Pin'] || kv['PIN'];
        if (!userCode) continue;
        const typeCode = this.bioTypeLabel(kv['Type'] ?? kv['type']);
        const index = kv['Index'] ?? kv['No'] ?? '0';
        const [ru] = [
          (await this.resolveUsers(em, schoolId, [userCode])).get(userCode),
        ];
        await this.upsertEnrollment(em, schoolId, sn, {
          userCode,
          type: typeCode,
          index,
          no: kv['No'] ?? null,
          valid: kv['Valid'] ?? null,
          duress: kv['Duress'] ?? null,
          typeRaw: kv['Type'] ?? null,
          majorVer: kv['MajorVer'] ?? null,
          minorVer: kv['MinorVer'] ?? null,
          format: kv['Format'] ?? null,
          tmp: kv['Tmp'] ?? null,
          studentId: ru?.studentId ?? null,
          staffId: ru?.staffId ?? null,
          visitorId: ru?.visitorId ?? null,
          userType: ru?.userType ?? null,
        });
      }
    });

    // Propagate templates to the school's OTHER devices.
    await this.queueDeviceCommand(
      device.schoolId,
      this.firstLine(rawBody),
      sn,
    ).catch(() => undefined);
  }

  private async processBioPhoto(
    rawBody: string,
    sn: string,
    device: BiometricDevice,
  ): Promise<void> {
    if (!device.schoolId) return;
    const schemaName = await this.schemaFor(device.schoolId);
    if (!schemaName) return;
    const schoolId = device.schoolId;

    const records = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, '').trim())
      .filter((l) => /pin=/i.test(l));

    await this.tenant.runInSchema(schemaName, async (em) => {
      for (const line of records) {
        const kv = this.parseKv(line.replace(/^(BIOPHOTO|USERPIC)\s+/i, ''));
        const userCode = kv['Pin'] || kv['PIN'];
        if (!userCode) continue;
        const isUserPic = /^USERPIC/i.test(line);
        const ru = (await this.resolveUsers(em, schoolId, [userCode])).get(
          userCode,
        );
        await this.upsertEnrollment(em, schoolId, sn, {
          userCode,
          type: isUserPic ? 'USERPIC' : 'BIOPHOTO',
          index: '0',
          size: kv['Size'] ?? null,
          format: kv['Format'] ?? null,
          image: kv['Content'] ?? kv['FileName'] ?? null,
          studentId: ru?.studentId ?? null,
          staffId: ru?.staffId ?? null,
          visitorId: ru?.visitorId ?? null,
          userType: ru?.userType ?? null,
        });
      }
    });

    await this.queueDeviceCommand(
      device.schoolId,
      this.firstLine(rawBody),
      sn,
    ).catch(() => undefined);
  }

  private async processOperLog(
    rawBody: string,
    sn: string,
    device: BiometricDevice,
  ): Promise<void> {
    // OPERLOG carries mixed records; we capture biometric enrollment lines and
    // ignore pure audit/operation entries.
    const lines = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, '').trim())
      .filter(Boolean);
    for (const line of lines) {
      if (/^FP\s/i.test(line) || /\bFID=/i.test(line)) {
        await this.processBioData(line, sn, device).catch(() => undefined);
      } else if (/^USERPIC\s/i.test(line) || /^BIOPHOTO\s/i.test(line)) {
        await this.processBioPhoto(line, sn, device).catch(() => undefined);
      }
      // USER lines: no destructive action — device remains source of truth.
    }
  }

  /** Parse a device INFO blob and refresh the stored device stats. */
  async updateDeviceInfo(rawBody: string, sn?: string): Promise<void> {
    const grab = (re: RegExp) => {
      const m = re.exec(rawBody);
      return m ? m[1].trim() : undefined;
    };
    const serial = sn ?? grab(/SerialNumber=([^\s,~]+)/i);
    if (!serial) return;
    const patch: Partial<BiometricDevice> = {
      lastActivity: new Date().toISOString(),
      state: '1',
    };
    const name = grab(/DeviceName=([^,~\n]+)/i);
    const ip = grab(/IPAddress=([^\s,~\n]+)/i);
    const userCount = grab(/UserCount=(\d+)/i);
    const txCount = grab(/(?:TransactionCount|AttCount)=(\d+)/i);
    const fpCount = grab(/FPCount=(\d+)/i);
    const faceCount = grab(/FaceCount=(\d+)/i);
    const fwVer = grab(/FWVersion=([^\s,~\n]+)/i);
    if (name) patch.terminalName = name;
    if (ip) patch.ipAddress = ip;
    if (userCount) patch.userCount = Number(userCount);
    if (txCount) patch.transactionCount = Number(txCount);
    if (fpCount) patch.fpCount = Number(fpCount);
    if (faceCount) patch.faceCount = Number(faceCount);
    if (fwVer) patch.fwVer = fwVer;
    patch.lastSyncAt = new Date();
    await this.deviceRepo.update({ sn: serial }, patch as any);
  }

  /**
   * Queue a command to a school's approved devices (optionally exclude one SN
   * or target only one). Single bulk insert.
   */
  async queueDeviceCommand(
    schoolId: string,
    command: string,
    exceptSn?: string,
    onlySn?: string,
    createdByUserId?: string,
  ): Promise<void> {
    if (!command) return;
    const devices = await this.deviceRepo.find({
      where: { schoolId, isApproved: true },
      select: { sn: true },
    });
    const targets = devices
      .map((d) => d.sn)
      .filter((s) => (onlySn ? s === onlySn : exceptSn ? s !== exceptSn : true));
    if (!targets.length) return;
    await this.commandRepo.insert(
      targets.map((s) => ({
        sn: s,
        schoolId,
        command,
        status: 0,
        createdByUserId: createdByUserId ?? null,
      })),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Find-or-create the device; mark online; return its tz offset (minutes). */
  private async touchDevice(sn: string): Promise<number> {
    if (!sn) return 0;
    let device = await this.deviceRepo.findOne({ where: { sn } });
    if (!device) {
      device = await this.deviceRepo.save(
        this.deviceRepo.create({
          sn,
          alias: sn,
          deviceType: 'iclock',
          communicationMethod: 'push',
          isApproved: false,
          schoolId: null,
          state: '1',
          lastActivity: new Date().toISOString(),
        }),
      );
      this.logger.log(`Auto-registered new biometric device: ${sn}`);
    } else {
      await this.deviceRepo.update(
        { sn },
        { state: '1', lastActivity: new Date().toISOString() },
      );
    }
    return device.terminalTz ?? 0;
  }

  private async schemaFor(schoolId: string): Promise<string | null> {
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: { id: true, schemaName: true },
    });
    return school?.schemaName ?? null;
  }

  /**
   * Resolve device PINs to a student / staff / visitor. PINs carry a one-letter
   * type prefix (see user-code.util). Codes without a recognised prefix fall
   * back to a raw admission#/employee-id match for backward compatibility.
   */
  private async resolveUsers(
    em: EntityManager,
    schoolId: string,
    userCodes: string[],
  ): Promise<Map<string, ResolvedUser>> {
    const map = new Map<string, ResolvedUser>();
    if (!userCodes.length) return map;

    // Bucket codes by decoded prefix; remember which base maps to which raw code.
    const studentBases = new Map<string, string>(); // base → raw code
    const staffBases = new Map<string, string[]>(); // base → raw codes (T or E)
    const visitorCodes: string[] = [];
    const legacy: string[] = [];

    for (const raw of userCodes) {
      const parsed = parseUserCode(raw);
      if (!parsed) {
        legacy.push(raw);
        continue;
      }
      if (parsed.type === 'student') {
        studentBases.set(parsed.base, raw);
      } else if (parsed.type === 'teacher' || parsed.type === 'staff') {
        const arr = staffBases.get(parsed.base) ?? [];
        arr.push(raw);
        staffBases.set(parsed.base, arr);
      } else if (parsed.type === 'visitor') {
        visitorCodes.push(raw);
      }
    }
    // Legacy codes: try both a student and a staff raw match.
    for (const raw of legacy) {
      studentBases.set(raw, raw);
      const arr = staffBases.get(raw) ?? [];
      arr.push(raw);
      staffBases.set(raw, arr);
    }

    // Students.
    if (studentBases.size) {
      const students = await em.getRepository(Student).find({
        where: { schoolId, admissionNumber: In([...studentBases.keys()]) },
        select: { id: true, admissionNumber: true },
      });
      for (const s of students) {
        const raw = studentBases.get(s.admissionNumber);
        if (raw)
          map.set(raw, {
            studentId: s.id,
            staffId: null,
            visitorId: null,
            userType: 'student',
          });
      }
    }

    // Staff (teacher + non-teaching share the staff table).
    if (staffBases.size) {
      const staff = await em.getRepository(Staff).find({
        where: { schoolId, employeeId: In([...staffBases.keys()]) },
        select: { id: true, employeeId: true },
      });
      for (const st of staff) {
        for (const raw of staffBases.get(st.employeeId) ?? []) {
          if (map.has(raw)) continue; // a student match already won this code
          const parsed = parseUserCode(raw);
          map.set(raw, {
            studentId: null,
            staffId: st.id,
            visitorId: null,
            userType: parsed?.type === 'teacher' ? 'teacher' : 'staff',
          });
        }
      }
    }

    // Visitors — resolved via the enrollment mapping (userCode → visitorId).
    if (visitorCodes.length) {
      const rows = await em.getRepository(BiometricEnrollment).find({
        where: { schoolId, userCode: In(visitorCodes) },
        select: { userCode: true, visitorId: true },
      });
      for (const r of rows) {
        if (r.visitorId && !map.has(r.userCode))
          map.set(r.userCode, {
            studentId: null,
            staffId: null,
            visitorId: r.visitorId,
            userType: 'visitor',
          });
      }
    }

    return map;
  }

  private async upsertEnrollment(
    em: EntityManager,
    schoolId: string,
    deviceSn: string,
    data: Partial<BiometricEnrollment> & { userCode: string; type: string },
  ): Promise<void> {
    const repo = em.getRepository(BiometricEnrollment);
    const index = data.index ?? '0';
    const existing = await repo.findOne({
      where: { schoolId, userCode: data.userCode, type: data.type, index },
    });
    if (existing) {
      await repo.update({ id: existing.id }, { ...data, deviceSn, index });
    } else {
      await repo.save(repo.create({ ...data, schoolId, deviceSn, index }));
    }
  }

  private parseKv(line: string): Record<string, string> {
    const out: Record<string, string> = {};
    // Records are tab-separated key=value pairs; tolerate spaces too.
    for (const part of line.split(/\t|\s{2,}/)) {
      const eq = part.indexOf('=');
      if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1);
    }
    return out;
  }

  private bioTypeLabel(raw?: string): string {
    switch ((raw ?? '').trim()) {
      case '0':
        return 'FP';
      case '2':
        return 'FACE';
      case '9':
        return 'PALM';
      default:
        return (raw || 'FP').toUpperCase();
    }
  }

  private parseDeviceTime(s: string): Date {
    const t = (s || '').trim();
    const d = new Date(t.replace(' ', 'T'));
    return isNaN(d.getTime()) ? new Date() : d;
  }

  private firstLine(raw: string): string {
    return raw.split('\n')[0]?.replace(/\r$/, '') ?? '';
  }

  /** Fire-and-forget request log (never blocks the device response). */
  private logTraffic(
    sn: string,
    url: string,
    method: string,
    tableName: string | null,
    data: string,
  ): void {
    setImmediate(() => {
      this.logRepo
        .insert({
          sn: sn || null,
          url,
          method,
          tableName: tableName || null,
          data: (data || '').slice(0, 10_000),
        })
        .catch(() => undefined);
    });
  }
}
