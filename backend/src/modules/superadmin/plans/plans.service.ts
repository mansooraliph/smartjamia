import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Plan } from '../../../database/master/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  private readonly repo: Repository<Plan>;

  constructor(@InjectDataSource('master') ds: DataSource) {
    this.repo = ds.getRepository(Plan);
  }

  list() {
    return this.repo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    const exists = await this.repo.findOne({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Plan slug already exists');
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.findOne(id);
    if (dto.slug && dto.slug !== plan.slug) {
      const dup = await this.repo.findOne({ where: { slug: dto.slug } });
      if (dup) throw new ConflictException('Plan slug already exists');
    }
    Object.assign(plan, dto);
    return this.repo.save(plan);
  }

  async remove(id: string) {
    const plan = await this.findOne(id);
    await this.repo.remove(plan);
    return { deleted: true, id };
  }
}
