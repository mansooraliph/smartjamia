import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EntityManager } from 'typeorm';
import { Staff } from '../../../database/tenant/staff.entity';
import { User } from '../../../database/tenant/user.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import {
  buildTemplate,
  ImportRowResult,
  parseSheet,
  summarize,
  toDate,
} from '../../../common/import/excel-import.util';

const ROLES = new Set(['admin', 'manager', 'teacher', 'staff', 'cashier']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALIASES: Record<string, string[]> = {
  name: ['name', 'fullname'],
  email: ['email'],
  role: ['role'],
  employeeId: ['employeeid', 'empid', 'employeeno'],
  designation: ['designation', 'title'],
  department: ['department', 'dept'],
  qualification: ['qualification', 'qualifications'],
  joiningDate: ['joiningdate', 'doj', 'dateofjoining'],
  salaryRupees: ['salary', 'salaryrupees', 'monthlysalary'],
  password: ['password'],
};

@Injectable()
export class StaffImportService {
  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly config: ConfigService,
  ) {}

  template() {
    return buildTemplate('Staff', Object.keys(ALIASES), {
      name: 'Ahmed Khan',
      email: 'ahmed.khan@school.edu',
      role: 'teacher',
      employeeId: 'EMP101',
      designation: 'Senior Teacher',
      department: 'Mathematics',
      qualification: 'M.Sc, B.Ed',
      joiningDate: '2026-04-01',
      salaryRupees: '45000',
      password: '(optional)',
    });
  }

  preview(schemaName: string, schoolId: string, buffer: Buffer) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await parseSheet(buffer, ALIASES);
      return summarize(await this.validate(em, schoolId, raw));
    });
  }

  commit(schemaName: string, schoolId: string, buffer: Buffer) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await parseSheet(buffer, ALIASES);
      const rows = await this.validate(em, schoolId, raw);
      const userRepo = em.getRepository(User);
      const staffRepo = em.getRepository(Staff);
      const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));
      let created = 0;
      const errors: { rowNumber: number; error: string }[] = [];
      for (const row of rows) {
        if (row.errors.length) {
          errors.push({ rowNumber: row.rowNumber, error: row.errors[0] });
          continue;
        }
        const d = row.data;
        const passwordHash =
          d.password && d.password !== '(optional)'
            ? await bcrypt.hash(d.password, rounds)
            : null;
        const user = await userRepo.save(
          userRepo.create({
            schoolId,
            name: d.name,
            email: d.email,
            passwordHash,
            pinHash: null,
            role: d.role.toLowerCase() as any,
            isActive: true,
          }),
        );
        await staffRepo.save(
          staffRepo.create({
            schoolId,
            userId: user.id,
            employeeId: d.employeeId,
            designation: d.designation,
            department: d.department || null,
            qualification: d.qualification || null,
            joiningDate: new Date(toDate(d.joiningDate) ?? d.joiningDate),
            salary: d.salaryRupees ? Math.round(Number(d.salaryRupees) * 100) : 0,
            status: 'active',
          }),
        );
        created++;
      }
      const invalid = rows.filter((r) => r.errors.length).length;
      return { created, skipped: invalid, errors };
    });
  }

  private async validate(
    em: EntityManager,
    schoolId: string,
    raw: Record<string, string>[],
  ): Promise<ImportRowResult[]> {
    const existing = await em
      .getRepository(User)
      .find({ where: { schoolId }, select: { email: true } });
    const existingEmails = new Set(
      existing.map((u) => u.email.toLowerCase()),
    );
    const existingEmps = new Set(
      (
        await em
          .getRepository(Staff)
          .find({ where: { schoolId }, select: { employeeId: true } })
      ).map((s) => s.employeeId.toLowerCase()),
    );
    const seenEmail = new Set<string>();
    const seenEmp = new Set<string>();

    return raw.map((d) => {
      const errors: string[] = [];
      if (!d.name) errors.push('Name is required');
      const email = (d.email || '').toLowerCase();
      if (!email) errors.push('Email is required');
      else if (!EMAIL_RE.test(d.email)) errors.push('Email is invalid');
      else if (existingEmails.has(email) || seenEmail.has(email))
        errors.push('Email already exists');
      else seenEmail.add(email);

      const role = (d.role || '').toLowerCase();
      if (!role) errors.push('Role is required');
      else if (!ROLES.has(role))
        errors.push('Role must be admin/manager/teacher/staff/cashier');

      const emp = (d.employeeId || '').toLowerCase();
      if (!emp) errors.push('Employee ID is required');
      else if (existingEmps.has(emp) || seenEmp.has(emp))
        errors.push('Employee ID already exists');
      else seenEmp.add(emp);

      if (!d.designation) errors.push('Designation is required');
      if (!d.joiningDate) errors.push('Joining date is required');
      else if (!toDate(d.joiningDate))
        errors.push('Joining date is not a valid date');

      return { rowNumber: Number(d.__row ?? 0), data: d, errors };
    });
  }
}
