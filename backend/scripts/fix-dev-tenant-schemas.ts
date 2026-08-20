/**
 * One-off migration: brings the dev/test tenant schemas (school_demo_school,
 * school_school_1) up to date with the current tenant entity code. These two
 * schemas were provisioned early and never picked up several fields/tables
 * that were added to the entities later:
 *
 *   - sections.school_id / sections.capacity
 *   - academic_years.exam_board_academic_year_id
 *   - courses.exam_board_course_id
 *   - subjects.ce_max_marks / ce_pass_marks / exam_board_subject_id
 *   - attendance.school_id
 *   - role_permission_overrides table
 *   - exam_board_enrollments / exam_board_exams / exam_board_exam_subjects /
 *     exam_board_marks tables
 *
 * Scoped ONLY to school_demo_school and school_school_1 — the ~60 other
 * tenant schemas hold real imported data on a different legacy table shape
 * and are explicitly out of scope for this fix.
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/fix-dev-tenant-schemas.ts
 */

import 'reflect-metadata';
import { DataDataSource } from '../src/database/data-datasource';

const SCHEMAS = ['school_demo_school', 'school_school_1'];

async function columnExists(schema: string, table: string, column: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, table, column],
  );
  return rows.length > 0;
}

async function tableExists(schema: string, table: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return rows.length > 0;
}

async function addColumnIfMissing(schema: string, table: string, column: string, ddl: string) {
  if (await columnExists(schema, table, column)) {
    console.log(`  · ${schema}.${table}.${column}: already present, skipping`);
    return;
  }
  await DataDataSource.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN ${ddl};`);
  console.log(`  + ${schema}.${table}: added ${column}`);
}

async function fixSections(schema: string) {
  await addColumnIfMissing(schema, 'sections', 'school_id', `"school_id" uuid`);
  await addColumnIfMissing(schema, 'sections', 'capacity', `"capacity" integer NOT NULL DEFAULT 40`);

  await DataDataSource.query(`
    UPDATE "${schema}"."sections" s
       SET school_id = c.school_id
      FROM "${schema}"."classes" c
     WHERE s.class_id = c.id AND s.school_id IS NULL;
  `);
  console.log(`  ~ ${schema}.sections: backfilled school_id from classes`);
}

async function fixAttendance(schema: string) {
  await addColumnIfMissing(schema, 'attendance', 'school_id', `"school_id" uuid`);
  await DataDataSource.query(`
    UPDATE "${schema}"."attendance" a
       SET school_id = ay.school_id
      FROM "${schema}"."academic_years" ay
     WHERE a.academic_year_id = ay.id AND a.school_id IS NULL;
  `);
  console.log(`  ~ ${schema}.attendance: backfilled school_id from academic_years`);
}

async function fixAcademicYears(schema: string) {
  await addColumnIfMissing(schema, 'academic_years', 'exam_board_academic_year_id', `"exam_board_academic_year_id" uuid`);
}

async function fixCourses(schema: string) {
  await addColumnIfMissing(schema, 'courses', 'exam_board_course_id', `"exam_board_course_id" uuid`);
}

async function fixSubjects(schema: string) {
  await addColumnIfMissing(schema, 'subjects', 'ce_max_marks', `"ce_max_marks" integer`);
  await addColumnIfMissing(schema, 'subjects', 'ce_pass_marks', `"ce_pass_marks" integer`);
  await addColumnIfMissing(schema, 'subjects', 'exam_board_subject_id', `"exam_board_subject_id" uuid`);
}

async function fixStudents(schema: string) {
  // demo_school's students table was imported on the old legacy shape
  // (admission_no, no school_id/student_name/gender/date_of_birth/status).
  // Every row already links via user_id to a `users` row that has the
  // equivalent data (name/dob/gender/school_id), so this is a safe,
  // fully-covered backfill rather than a guess. school_school_1 already has
  // the current shape, so all of this is a no-op there.
  if (await columnExists(schema, 'students', 'student_name')) {
    console.log(`  · ${schema}.students: already on current shape, skipping`);
    return;
  }

  await DataDataSource.query(`
    DO $$ BEGIN
      CREATE TYPE "${schema}"."students_gender_enum" AS ENUM('male', 'female', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await DataDataSource.query(`
    DO $$ BEGIN
      CREATE TYPE "${schema}"."students_status_enum" AS ENUM('active', 'inactive', 'transferred', 'alumni');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await addColumnIfMissing(schema, 'students', 'school_id', `"school_id" uuid`);
  await addColumnIfMissing(schema, 'students', 'admission_number', `"admission_number" varchar(50)`);
  await addColumnIfMissing(schema, 'students', 'student_id', `"student_id" varchar(50)`);
  await addColumnIfMissing(schema, 'students', 'student_name', `"student_name" varchar(100)`);
  await addColumnIfMissing(schema, 'students', 'date_of_birth', `"date_of_birth" date`);
  await addColumnIfMissing(schema, 'students', 'gender', `"gender" "${schema}"."students_gender_enum"`);
  await addColumnIfMissing(schema, 'students', 'status', `"status" "${schema}"."students_status_enum" NOT NULL DEFAULT 'active'`);
  await addColumnIfMissing(schema, 'students', 'aadhar_number', `"aadhar_number" varchar(12)`);
  await addColumnIfMissing(schema, 'students', 'photo_url', `"photo_url" varchar(500)`);
  await addColumnIfMissing(schema, 'students', 'mobile_country_code', `"mobile_country_code" varchar(8)`);
  await addColumnIfMissing(schema, 'students', 'mobile', `"mobile" varchar(20)`);
  await addColumnIfMissing(schema, 'students', 'whatsapp_country_code', `"whatsapp_country_code" varchar(8)`);
  await addColumnIfMissing(schema, 'students', 'whatsapp', `"whatsapp" varchar(20)`);
  await addColumnIfMissing(schema, 'students', 'address', `"address" text`);
  await addColumnIfMissing(schema, 'students', 'city', `"city" varchar(100)`);
  await addColumnIfMissing(schema, 'students', 'state', `"state" varchar(100)`);
  await addColumnIfMissing(schema, 'students', 'pincode', `"pincode" varchar(10)`);
  await addColumnIfMissing(schema, 'students', 'previous_school', `"previous_school" varchar(255)`);

  await DataDataSource.query(`
    UPDATE "${schema}"."students" s
       SET school_id = u.school_id,
           student_name = u.name,
           date_of_birth = u.dob,
           gender = u.gender::"${schema}"."students_gender_enum",
           admission_number = COALESCE(s.admission_number, s.admission_no),
           aadhar_number = COALESCE(s.aadhar_number, s.aadhar_no),
           address = COALESCE(s.address, s.current_address, s.permanent_address)
      FROM "${schema}"."users" u
     WHERE s.user_id = u.id
       AND (s.school_id IS NULL OR s.student_name IS NULL OR s.date_of_birth IS NULL OR s.gender IS NULL);
  `);

  const stillMissing: { id: string }[] = await DataDataSource.query(`
    SELECT id FROM "${schema}"."students"
     WHERE school_id IS NULL OR admission_number IS NULL OR student_name IS NULL
        OR date_of_birth IS NULL OR gender IS NULL;
  `);
  if (stillMissing.length > 0) {
    console.log(`  ! ${schema}.students: ${stillMissing.length} row(s) missing required fields after backfill (no linked user) — leaving columns nullable, NOT enforcing NOT NULL. IDs: ${stillMissing.map((r) => r.id).join(', ')}`);
    return;
  }

  await DataDataSource.query(`ALTER TABLE "${schema}"."students" ALTER COLUMN school_id SET NOT NULL;`);
  await DataDataSource.query(`ALTER TABLE "${schema}"."students" ALTER COLUMN admission_number SET NOT NULL;`);
  await DataDataSource.query(`ALTER TABLE "${schema}"."students" ALTER COLUMN student_name SET NOT NULL;`);
  await DataDataSource.query(`ALTER TABLE "${schema}"."students" ALTER COLUMN date_of_birth SET NOT NULL;`);
  await DataDataSource.query(`ALTER TABLE "${schema}"."students" ALTER COLUMN gender SET NOT NULL;`);
  console.log(`  ~ ${schema}.students: backfilled from users and enforced NOT NULL on required columns`);
}

async function createRolePermissionOverrides(schema: string) {
  if (await tableExists(schema, 'role_permission_overrides')) {
    console.log(`  · ${schema}.role_permission_overrides: already present, skipping`);
    return;
  }
  await DataDataSource.query(`
    CREATE TABLE "${schema}"."role_permission_overrides" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "school_id" uuid NOT NULL,
      "role_key" varchar(64) NOT NULL,
      "permissions" jsonb NOT NULL DEFAULT '[]',
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_role_permission_overrides_${schema}" PRIMARY KEY ("id")
    );
  `);
  await DataDataSource.query(`
    CREATE INDEX "IDX_rpo_school_${schema}" ON "${schema}"."role_permission_overrides" ("school_id");
  `);
  await DataDataSource.query(`
    CREATE UNIQUE INDEX "IDX_rpo_school_role_${schema}" ON "${schema}"."role_permission_overrides" ("school_id", "role_key");
  `);
  console.log(`  + ${schema}: created role_permission_overrides table`);
}

async function createExamBoardTables(schema: string) {
  if (await tableExists(schema, 'exam_board_enrollments')) {
    console.log(`  · ${schema}.exam_board_enrollments: already present, skipping exam-board table creation`);
    return;
  }

  await DataDataSource.query(`
    DO $$ BEGIN
      CREATE TYPE "${schema}"."exam_board_enrollments_status_enum" AS ENUM('active', 'withdrawn');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await DataDataSource.query(`
    CREATE TABLE "${schema}"."exam_board_enrollments" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "school_id" uuid NOT NULL,
      "student_id" uuid NOT NULL,
      "exam_board_batch_id" uuid NOT NULL,
      "enrolled_by" uuid NOT NULL,
      "enrollment_date" date NOT NULL,
      "status" "${schema}"."exam_board_enrollments_status_enum" NOT NULL DEFAULT 'active',
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ebe_${schema}" PRIMARY KEY ("id")
    );
  `);
  await DataDataSource.query(`CREATE UNIQUE INDEX "IDX_ebe_student_batch_${schema}" ON "${schema}"."exam_board_enrollments" ("student_id", "exam_board_batch_id");`);
  await DataDataSource.query(`CREATE INDEX "IDX_ebe_batch_${schema}" ON "${schema}"."exam_board_enrollments" ("exam_board_batch_id");`);
  await DataDataSource.query(`CREATE INDEX "IDX_ebe_student_${schema}" ON "${schema}"."exam_board_enrollments" ("student_id");`);
  await DataDataSource.query(`CREATE INDEX "IDX_ebe_school_${schema}" ON "${schema}"."exam_board_enrollments" ("school_id");`);

  await DataDataSource.query(`
    DO $$ BEGIN
      CREATE TYPE "${schema}"."exam_board_exams_exam_type_enum" AS ENUM('unit_test', 'mid_term', 'final', 'quarterly', 'half_yearly');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await DataDataSource.query(`
    DO $$ BEGIN
      CREATE TYPE "${schema}"."exam_board_exams_status_enum" AS ENUM('draft', 'scheduled', 'ongoing', 'completed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await DataDataSource.query(`
    CREATE TABLE "${schema}"."exam_board_exams" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "school_id" uuid NOT NULL,
      "exam_board_batch_id" uuid NOT NULL,
      "term_number" integer NOT NULL,
      "name" varchar(100) NOT NULL,
      "exam_type" "${schema}"."exam_board_exams_exam_type_enum" NOT NULL,
      "exam_category" varchar(20) NOT NULL DEFAULT 'regular',
      "start_date" date NOT NULL,
      "end_date" date NOT NULL,
      "status" "${schema}"."exam_board_exams_status_enum" NOT NULL DEFAULT 'draft',
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ebex_${schema}" PRIMARY KEY ("id")
    );
  `);
  await DataDataSource.query(`CREATE INDEX "IDX_ebex_batch_${schema}" ON "${schema}"."exam_board_exams" ("exam_board_batch_id");`);
  await DataDataSource.query(`CREATE INDEX "IDX_ebex_school_${schema}" ON "${schema}"."exam_board_exams" ("school_id");`);

  await DataDataSource.query(`
    CREATE TABLE "${schema}"."exam_board_exam_subjects" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "exam_board_exam_id" uuid NOT NULL,
      "subject_name" varchar(100) NOT NULL,
      "date" date,
      "time" TIME,
      "max_marks" integer NOT NULL,
      "pass_marks" integer NOT NULL,
      "ce_max_marks" integer,
      "ce_pass_marks" integer,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ebexs_${schema}" PRIMARY KEY ("id")
    );
  `);
  await DataDataSource.query(`CREATE INDEX "IDX_ebexs_exam_${schema}" ON "${schema}"."exam_board_exam_subjects" ("exam_board_exam_id");`);

  await DataDataSource.query(`
    CREATE TABLE "${schema}"."exam_board_marks" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "school_id" uuid NOT NULL,
      "student_id" uuid NOT NULL,
      "exam_board_exam_id" uuid NOT NULL,
      "exam_board_exam_subject_id" uuid NOT NULL,
      "marks_obtained" numeric(5,2) NOT NULL DEFAULT '0',
      "max_marks" integer NOT NULL,
      "ce_marks_obtained" numeric(5,2),
      "is_absent" boolean NOT NULL DEFAULT false,
      "grade" varchar(5),
      "entered_by" uuid NOT NULL,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ebm_${schema}" PRIMARY KEY ("id")
    );
  `);
  await DataDataSource.query(`CREATE UNIQUE INDEX "IDX_ebm_student_subject_${schema}" ON "${schema}"."exam_board_marks" ("student_id", "exam_board_exam_subject_id");`);
  await DataDataSource.query(`CREATE INDEX "IDX_ebm_school_${schema}" ON "${schema}"."exam_board_marks" ("school_id");`);

  console.log(`  + ${schema}: created exam_board_enrollments, exam_board_exams, exam_board_exam_subjects, exam_board_marks`);
}

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    for (const schema of SCHEMAS) {
      console.log(`\n▸ Fixing ${schema}`);
      await fixSections(schema);
      await fixStudents(schema);
      await fixAcademicYears(schema);
      await fixCourses(schema);
      await fixSubjects(schema);
      await fixAttendance(schema);
      await createRolePermissionOverrides(schema);
      await createExamBoardTables(schema);
    }

    await DataDataSource.destroy();
    console.log('\n✔ Migration complete\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  }
}

main();
