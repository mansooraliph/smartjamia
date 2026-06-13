import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Repository } from 'typeorm';
import { BiometricDevice } from '../../../database/master/biometric-device.entity';
import { BiometricDeviceCommand } from '../../../database/master/biometric-device-command.entity';
import { School } from '../../../database/master/school.entity';
import { paginate } from '../../../common/dto/pagination.dto';
import {
  ListCommandsQueryDto,
  ListDevicesQueryDto,
} from './dto/biometric-device.dto';

@Injectable()
export class BiometricDevicesAdminService {
  private readonly deviceRepo: Repository<BiometricDevice>;
  private readonly commandRepo: Repository<BiometricDeviceCommand>;
  private readonly schoolRepo: Repository<School>;

  constructor(@InjectDataSource('master') ds: DataSource) {
    this.deviceRepo = ds.getRepository(BiometricDevice);
    this.commandRepo = ds.getRepository(BiometricDeviceCommand);
    this.schoolRepo = ds.getRepository(School);
  }

  async list(q: ListDevicesQueryDto) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(200, Math.max(1, q.limit ?? 20));
    const qb = this.deviceRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.school', 's')
      .orderBy('d.createdAt', 'DESC');

    if (q.schoolId) qb.andWhere('d.school_id = :sid', { sid: q.schoolId });
    if (q.isApproved !== undefined)
      qb.andWhere('d.is_approved = :ap', { ap: q.isApproved });
    if (q.isAssigned !== undefined)
      qb.andWhere(
        q.isAssigned ? 'd.school_id IS NOT NULL' : 'd.school_id IS NULL',
      );
    if (q.search) {
      const t = `%${q.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) =>
          w.where('d.sn ILIKE :t', { t }).orWhere('d.alias ILIKE :t', { t }),
        ),
      );
    }
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async findOne(id: string) {
    const d = await this.deviceRepo.findOne({
      where: { id },
      relations: { school: true },
    });
    if (!d) throw new NotFoundException('Device not found');
    return d;
  }

  async unassigned() {
    return this.deviceRepo.find({
      where: { schoolId: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async assignToSchool(id: string, schoolId: string, adminId: string) {
    const device = await this.findOne(id);
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      relations: { plan: true },
    });
    if (!school) throw new NotFoundException('School not found');
    const features = (school.plan?.features as string[]) ?? [];
    if (!features.includes('biometric_devices')) {
      throw new BadRequestException(
        "This school's plan does not include biometric devices",
      );
    }
    device.schoolId = schoolId;
    device.assignedAt = new Date();
    device.assignedBy = adminId ?? null;
    return this.deviceRepo.save(device);
  }

  async unassign(id: string) {
    const device = await this.findOne(id);
    device.schoolId = null;
    device.assignedAt = null;
    device.assignedBy = null;
    return this.deviceRepo.save(device);
  }

  async approve(id: string, adminId: string) {
    const device = await this.findOne(id);
    device.isApproved = true;
    device.approvedBy = adminId ?? null;
    device.approvedAt = new Date();
    return this.deviceRepo.save(device);
  }

  async deactivate(id: string, adminId: string, reason: string) {
    const device = await this.findOne(id);
    device.deactivatedAt = new Date();
    device.deactivatedBy = adminId ?? null;
    device.deactivationReason = reason;
    return this.deviceRepo.save(device);
  }

  async reactivate(id: string) {
    const device = await this.findOne(id);
    device.deactivatedAt = null;
    device.deactivatedBy = null;
    device.deactivationReason = null;
    return this.deviceRepo.save(device);
  }

  async remove(id: string) {
    const device = await this.findOne(id);
    await this.deviceRepo.softRemove(device);
    return { deleted: true, id };
  }

  /** Queue a reboot command for the device. */
  async queueRestart(id: string, adminId?: string) {
    const device = await this.findOne(id);
    await this.commandRepo.insert({
      sn: device.sn,
      schoolId: device.schoolId,
      command: 'REBOOT',
      status: 0,
      createdByUserId: adminId ?? null,
    });
    return { queued: true, sn: device.sn };
  }

  /** Ask the device to report its info/stats (handled on next devicecmd). */
  async queueSync(id: string, adminId?: string) {
    const device = await this.findOne(id);
    await this.commandRepo.insert({
      sn: device.sn,
      schoolId: device.schoolId,
      command: 'INFO',
      status: 0,
      createdByUserId: adminId ?? null,
    });
    return { queued: true, sn: device.sn };
  }

  async listCommands(q: ListCommandsQueryDto) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(200, Math.max(1, q.limit ?? 20));
    const where: Record<string, unknown> = {};
    if (q.sn) where.sn = q.sn;
    if (q.status !== undefined) where.status = q.status;
    const [items, total] = await this.commandRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(items, total, page, limit);
  }

  async deviceCommands(id: string) {
    const device = await this.findOne(id);
    return this.commandRepo.find({
      where: { sn: device.sn },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
