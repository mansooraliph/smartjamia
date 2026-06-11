import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface TransportStop {
  name: string;
  time: string;
  fee_paise: number;
}

@Entity({ name: 'transport_routes' })
@Index(['schoolId'])
export class TransportRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 100, name: 'route_name' })
  routeName: string;

  @Column({ type: 'uuid', name: 'vehicle_id', nullable: true })
  vehicleId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'driver_name' })
  driverName: string;

  @Column({ type: 'varchar', length: 20, name: 'driver_phone' })
  driverPhone: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  stops: TransportStop[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
