import api from '@/lib/axios';
import { downloadExport, ImportCommitResult, ImportPreview, Paginated } from '@/services/school.api';

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

// ───── Types ────────────────────────────────────────────────────────────────
export type ExamBoardCourseLevel =
  | 'ug'
  | 'pg'
  | 'diploma'
  | 'phd'
  | 'certificate'
  | 'other';
export type ExamBoardTermSystem = 'annual' | 'semester' | 'trimester';

export interface ExamBoardCourse {
  id: string;
  organizationId: string;
  level: ExamBoardCourseLevel;
  name: string;
  code: string | null;
  termSystem: ExamBoardTermSystem;
  durationYears: number;
  isActive: boolean;
  createdAt: string;
}

export interface ExamBoardAcademicYear {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ExamBoardInstitution {
  school: {
    id: string;
    name: string;
    code: string;
    slug: string;
    status: string;
  };
  isEnabled: boolean;
}

export interface ExamBoardBatch {
  id: string;
  organizationId: string;
  schoolId: string;
  examBoardCourseId: string;
  examBoardAcademicYearId: string;
  examBoardSchemeId: string | null;
  name: string;
  code: string | null;
  capacity: number | null;
  status: 'active' | 'closed';
  createdAt: string;
}

export interface ExamBoardScheme {
  id: string;
  organizationId: string;
  examBoardCourseId: string;
  startingAcademicYearId: string | null;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ExamBoardSubject {
  id: string;
  organizationId: string;
  examBoardCourseId: string;
  termNumber: number;
  name: string;
  nameArabic: string | null;
  code: string | null;
  maxMarks: number;
  passMarks: number;
  ceMaxMarks: number | null;
  cePassMarks: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface CourseTerm {
  number: number;
  label: string;
}

export interface ExamBoardSchemeSyllabus {
  id: string;
  examBoardSchemeId: string;
  termNumber: number;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
}

export type ExamBoardExamType =
  | 'unit_test'
  | 'mid_term'
  | 'final'
  | 'quarterly'
  | 'half_yearly';
export type ExamBoardExamStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed';

export interface ExamBoardExam {
  id: string;
  schoolId: string;
  examBoardBatchId: string;
  termNumber: number;
  name: string;
  examType: ExamBoardExamType;
  startDate: string;
  endDate: string;
  status: ExamBoardExamStatus;
  createdAt: string;
}

export interface ExamBoardExamSubject {
  id: string;
  examBoardExamId: string;
  subjectName: string;
  date: string | null;
  time: string | null;
  maxMarks: number;
  passMarks: number;
  ceMaxMarks: number | null;
  cePassMarks: number | null;
}

export interface CreateBatchExamPayload {
  termNumber: number;
  name: string;
  examType: ExamBoardExamType;
  startDate: string;
  endDate: string;
}

export interface CreateBatchExamSubjectPayload {
  subjectName: string;
  date?: string;
  time?: string;
  maxMarks: number;
  passMarks: number;
  ceMaxMarks?: number;
  cePassMarks?: number;
}

export interface ExamBoardEnrollment {
  id: string;
  schoolId: string;
  studentId: string;
  examBoardBatchId: string;
  enrolledBy: string;
  enrollmentDate: string;
  status: 'active' | 'withdrawn';
  createdAt: string;
  student: {
    id: string;
    admissionNumber: string;
    studentName: string;
  } | null;
}

export interface CreateExamBoardCoursePayload {
  name: string;
  code?: string;
  level?: ExamBoardCourseLevel;
  termSystem?: ExamBoardTermSystem;
  durationYears?: number;
}

export interface CreateExamBoardAcademicYearPayload {
  name: string;
  startDate: string;
  endDate: string;
}

export interface CreateExamBoardBatchPayload {
  schoolId: string;
  examBoardCourseId: string;
  examBoardAcademicYearId: string;
  examBoardSchemeId?: string;
  name: string;
  code?: string;
  capacity?: number;
}

export interface CreateExamBoardSchemePayload {
  examBoardCourseId: string;
  startingAcademicYearId?: string;
  name: string;
  code?: string;
}

export interface CreateExamBoardSubjectPayload {
  examBoardCourseId: string;
  termNumber: number;
  name: string;
  nameArabic?: string;
  code?: string;
  maxMarks?: number;
  passMarks?: number;
  ceMaxMarks?: number;
  cePassMarks?: number;
}

// ───── Org Admin: Examination Board ──────────────────────────────────────────
export const ExamBoardApi = {
  listInstitutions: async (): Promise<ExamBoardInstitution[]> =>
    unwrap(await api.get('/org/exam-board/institutions')),
  setInstitutionEnabled: async (schoolId: string, isEnabled: boolean) =>
    unwrap(await api.put(`/org/exam-board/institutions/${schoolId}`, { isEnabled })),

  listCourses: async (): Promise<ExamBoardCourse[]> =>
    unwrap(await api.get('/org/exam-board/courses')),
  createCourse: async (payload: CreateExamBoardCoursePayload): Promise<ExamBoardCourse> =>
    unwrap(await api.post('/org/exam-board/courses', payload)),
  updateCourse: async (
    id: string,
    payload: Partial<CreateExamBoardCoursePayload> & { isActive?: boolean },
  ): Promise<ExamBoardCourse> =>
    unwrap(await api.patch(`/org/exam-board/courses/${id}`, payload)),
  deleteCourse: async (id: string) => unwrap(await api.delete(`/org/exam-board/courses/${id}`)),

  listAcademicYears: async (): Promise<ExamBoardAcademicYear[]> =>
    unwrap(await api.get('/org/exam-board/academic-years')),
  createAcademicYear: async (
    payload: CreateExamBoardAcademicYearPayload,
  ): Promise<ExamBoardAcademicYear> =>
    unwrap(await api.post('/org/exam-board/academic-years', payload)),
  updateAcademicYear: async (
    id: string,
    payload: Partial<CreateExamBoardAcademicYearPayload> & { isActive?: boolean },
  ): Promise<ExamBoardAcademicYear> =>
    unwrap(await api.patch(`/org/exam-board/academic-years/${id}`, payload)),
  setCurrentAcademicYear: async (id: string): Promise<ExamBoardAcademicYear> =>
    unwrap(await api.patch(`/org/exam-board/academic-years/${id}/set-current`, {})),
  deleteAcademicYear: async (id: string) =>
    unwrap(await api.delete(`/org/exam-board/academic-years/${id}`)),

  listInstitutionCourses: async (
    schoolId: string,
  ): Promise<{ course: ExamBoardCourse; isEnabled: boolean }[]> =>
    unwrap(await api.get(`/org/exam-board/institutions/${schoolId}/courses`)),
  setInstitutionCourse: async (
    schoolId: string,
    courseId: string,
    isEnabled: boolean,
  ) =>
    unwrap(
      await api.put(
        `/org/exam-board/institutions/${schoolId}/courses/${courseId}`,
        { isEnabled },
      ),
    ),

  listInstitutionAcademicYears: async (
    schoolId: string,
  ): Promise<{ academicYear: ExamBoardAcademicYear; isEnabled: boolean }[]> =>
    unwrap(await api.get(`/org/exam-board/institutions/${schoolId}/academic-years`)),
  setInstitutionAcademicYear: async (
    schoolId: string,
    yearId: string,
    isEnabled: boolean,
  ) =>
    unwrap(
      await api.put(
        `/org/exam-board/institutions/${schoolId}/academic-years/${yearId}`,
        { isEnabled },
      ),
    ),

  listBatches: async (filters?: {
    schoolId?: string;
    examBoardCourseId?: string;
    examBoardAcademicYearId?: string;
  }): Promise<ExamBoardBatch[]> =>
    unwrap(await api.get('/org/exam-board/batches', { params: filters })),
  getBatch: async (id: string): Promise<ExamBoardBatch> =>
    unwrap(await api.get(`/org/exam-board/batches/${id}`)),
  listBatchEnrollments: async (id: string): Promise<ExamBoardEnrollment[]> =>
    unwrap(await api.get(`/org/exam-board/batches/${id}/enrollments`)),
  listBatchExams: async (id: string): Promise<ExamBoardExam[]> =>
    unwrap(await api.get(`/org/exam-board/batches/${id}/exams`)),
  listBatchExamSubjects: async (batchId: string, examId: string): Promise<ExamBoardExamSubject[]> =>
    unwrap(await api.get(`/org/exam-board/batches/${batchId}/exams/${examId}/subjects`)),
  createBatchExam: async (batchId: string, payload: CreateBatchExamPayload): Promise<ExamBoardExam> =>
    unwrap(await api.post(`/org/exam-board/batches/${batchId}/exams`, payload)),
  addBatchExamSubject: async (
    batchId: string,
    examId: string,
    payload: CreateBatchExamSubjectPayload,
  ): Promise<ExamBoardExamSubject> =>
    unwrap(await api.post(`/org/exam-board/batches/${batchId}/exams/${examId}/subjects`, payload)),
  updateBatchExamSubject: async (
    batchId: string,
    examId: string,
    subjectId: string,
    payload: Partial<CreateBatchExamSubjectPayload>,
  ): Promise<ExamBoardExamSubject> =>
    unwrap(
      await api.patch(
        `/org/exam-board/batches/${batchId}/exams/${examId}/subjects/${subjectId}`,
        payload,
      ),
    ),
  createBatch: async (payload: CreateExamBoardBatchPayload): Promise<ExamBoardBatch> =>
    unwrap(await api.post('/org/exam-board/batches', payload)),
  updateBatch: async (
    id: string,
    payload: Partial<CreateExamBoardBatchPayload> & { status?: 'active' | 'closed' },
  ): Promise<ExamBoardBatch> =>
    unwrap(await api.patch(`/org/exam-board/batches/${id}`, payload)),
  deleteBatch: async (id: string) => unwrap(await api.delete(`/org/exam-board/batches/${id}`)),

  listCourseTerms: async (courseId: string): Promise<CourseTerm[]> =>
    unwrap(await api.get(`/org/exam-board/courses/${courseId}/terms`)),

  listSchemes: async (examBoardCourseId?: string): Promise<ExamBoardScheme[]> =>
    unwrap(await api.get('/org/exam-board/schemes', { params: { examBoardCourseId } })),
  createScheme: async (payload: CreateExamBoardSchemePayload): Promise<ExamBoardScheme> =>
    unwrap(await api.post('/org/exam-board/schemes', payload)),
  updateScheme: async (
    id: string,
    payload: Partial<CreateExamBoardSchemePayload> & { isActive?: boolean },
  ): Promise<ExamBoardScheme> =>
    unwrap(await api.patch(`/org/exam-board/schemes/${id}`, payload)),
  deleteScheme: async (id: string) => unwrap(await api.delete(`/org/exam-board/schemes/${id}`)),
  copySchemeConfig: async (schemeId: string, sourceSchemeId: string) =>
    unwrap<{ copiedSubjects: number }>(
      await api.post(`/org/exam-board/schemes/${schemeId}/copy-config`, { sourceSchemeId }),
    ),
  listSchemeSyllabi: async (schemeId: string): Promise<ExamBoardSchemeSyllabus[]> =>
    unwrap(await api.get(`/org/exam-board/schemes/${schemeId}/syllabus`)),
  uploadSchemeSyllabus: async (
    schemeId: string,
    termNumber: number,
    file: File,
  ): Promise<ExamBoardSchemeSyllabus> => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(
      await api.post(`/org/exam-board/schemes/${schemeId}/terms/${termNumber}/syllabus`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
  deleteSchemeSyllabus: async (schemeId: string, termNumber: number) =>
    unwrap(await api.delete(`/org/exam-board/schemes/${schemeId}/terms/${termNumber}/syllabus`)),
  listSchemeTermSubjects: async (
    schemeId: string,
    termNumber: number,
  ): Promise<{ subject: ExamBoardSubject; isAssigned: boolean }[]> =>
    unwrap(await api.get(`/org/exam-board/schemes/${schemeId}/terms/${termNumber}/subjects`)),
  setSchemeTermSubjects: async (
    schemeId: string,
    termNumber: number,
    examBoardSubjectIds: string[],
  ) =>
    unwrap<{ assigned: number }>(
      await api.put(`/org/exam-board/schemes/${schemeId}/terms/${termNumber}/subjects`, {
        examBoardSubjectIds,
      }),
    ),

  listSubjects: async (filters?: {
    examBoardCourseId?: string;
    termNumber?: number;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<Paginated<ExamBoardSubject>> =>
    unwrap(await api.get('/org/exam-board/subjects', { params: filters })),
  createSubject: async (payload: CreateExamBoardSubjectPayload): Promise<ExamBoardSubject> =>
    unwrap(await api.post('/org/exam-board/subjects', payload)),
  updateSubject: async (
    id: string,
    payload: Partial<CreateExamBoardSubjectPayload> & { isActive?: boolean },
  ): Promise<ExamBoardSubject> =>
    unwrap(await api.patch(`/org/exam-board/subjects/${id}`, payload)),
  deleteSubject: async (id: string) => unwrap(await api.delete(`/org/exam-board/subjects/${id}`)),
  importSubjectsTemplate: () =>
    downloadExport(
      '/org/exam-board/subjects/import/template',
      'exam-board-subject-import-template',
      'xlsx',
    ),
  importSubjectsPreview: async (
    file: File,
    examBoardCourseId: string,
  ): Promise<ImportPreview> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      await api.post('/org/exam-board/subjects/import/preview', fd, {
        params: { examBoardCourseId },
      }),
    );
  },
  importSubjectsCommit: async (
    file: File,
    examBoardCourseId: string,
  ): Promise<ImportCommitResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      await api.post('/org/exam-board/subjects/import/commit', fd, {
        params: { examBoardCourseId },
      }),
    );
  },

  listBatchTermSubjects: async (
    batchId: string,
    termNumber: number,
  ): Promise<{ subject: ExamBoardSubject; isAssigned: boolean }[]> =>
    unwrap(await api.get(`/org/exam-board/batches/${batchId}/terms/${termNumber}/subjects`)),
  setBatchTermSubjects: async (
    batchId: string,
    termNumber: number,
    examBoardSubjectIds: string[],
  ) =>
    unwrap<{ assigned: number }>(
      await api.put(`/org/exam-board/batches/${batchId}/terms/${termNumber}/subjects`, {
        examBoardSubjectIds,
      }),
    ),
  copyBatchConfig: async (batchId: string, sourceBatchId: string) =>
    unwrap<{ copiedSubjects: number }>(
      await api.post(`/org/exam-board/batches/${batchId}/copy-config`, { sourceBatchId }),
    ),
};
