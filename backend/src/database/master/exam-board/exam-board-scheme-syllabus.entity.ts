import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Syllabus PDF attached to one Year/Semester/Trimester of a scheme. One
 * upload per scheme+term — re-uploading replaces the previous file.
 */
@Entity({ name: 'exam_board_scheme_syllabi' })
@Index(['examBoardSchemeId'])
@Index(['examBoardSchemeId', 'termNumber'], { unique: true })
export class ExamBoardSchemeSyllabus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'exam_board_scheme_id' })
  examBoardSchemeId: string;

  @Column({ type: 'integer', name: 'term_number' })
  termNumber: number;

  @Column({ type: 'varchar', length: 500, name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName: string;

  @Column({ type: 'integer', name: 'file_size', nullable: true })
  fileSize: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
