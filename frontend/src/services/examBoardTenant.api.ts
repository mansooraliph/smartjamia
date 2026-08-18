import api from '@/lib/axios';

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

export interface EbCourse {
  id: string;
  name: string;
  code: string | null;
  level: string;
  termSystem: string;
  durationYears: number;
}

export interface EbAcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface EbBatch {
  id: string;
  examBoardCourseId: string;
  examBoardAcademicYearId: string;
  name: string;
  code: string | null;
  capacity: number | null;
  status: 'active' | 'closed';
}

export interface EbEnrollment {
  id: string;
  studentId: string;
  examBoardBatchId: string;
  enrollmentDate: string;
  status: string;
  student: { id: string; admissionNumber: string; studentName: string } | null;
}

export interface EbExam {
  id: string;
  examBoardBatchId: string;
  termNumber: number;
  name: string;
  examType: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled' | 'ongoing' | 'completed';
}

export interface CourseTerm {
  number: number;
  label: string;
}

export interface EbAssignedSubject {
  id: string;
  examBoardCourseId: string;
  termNumber: number;
  name: string;
  code: string | null;
  maxMarks: number;
  passMarks: number;
  ceMaxMarks: number | null;
  cePassMarks: number | null;
}

export interface EbExamSubject {
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

export interface EbMark {
  id: string;
  studentId: string;
  examBoardExamId: string;
  examBoardExamSubjectId: string;
  marksObtained: number;
  maxMarks: number;
  ceMarksObtained: number | null;
  isAbsent: boolean;
}

export const TenantExamBoardApi = {
  listCourses: async (): Promise<EbCourse[]> => unwrap(await api.get('/school/exam-board/courses')),
  listAcademicYears: async (): Promise<EbAcademicYear[]> =>
    unwrap(await api.get('/school/exam-board/academic-years')),
  listBatches: async (filters?: { examBoardCourseId?: string; examBoardAcademicYearId?: string }): Promise<EbBatch[]> =>
    unwrap(await api.get('/school/exam-board/batches', { params: filters })),
  listEnrollments: async (batchId: string): Promise<EbEnrollment[]> =>
    unwrap(await api.get('/school/exam-board/enrollments', { params: { batchId } })),
  enroll: async (examBoardBatchId: string, studentIds: string[]) =>
    unwrap<{ enrolled: number; alreadyEnrolled: number }>(
      await api.post('/school/exam-board/enroll', { examBoardBatchId, studentIds }),
    ),

  listCourseTerms: async (courseId: string): Promise<CourseTerm[]> =>
    unwrap(await api.get(`/school/exam-board/courses/${courseId}/terms`)),
  listAssignedSubjects: async (batchId: string, termNumber: number): Promise<EbAssignedSubject[]> =>
    unwrap(await api.get(`/school/exam-board/batches/${batchId}/terms/${termNumber}/subjects`)),

  listExams: async (batchId?: string): Promise<EbExam[]> =>
    unwrap(await api.get('/school/exam-board/exams', { params: batchId ? { batchId } : undefined })),
  createExam: async (payload: {
    examBoardBatchId: string;
    termNumber: number;
    name: string;
    examType: string;
    startDate: string;
    endDate: string;
  }): Promise<EbExam> => unwrap(await api.post('/school/exam-board/exams', payload)),
  updateExam: async (id: string, payload: Partial<EbExam>): Promise<EbExam> =>
    unwrap(await api.patch(`/school/exam-board/exams/${id}`, payload)),

  listSubjects: async (examId: string): Promise<EbExamSubject[]> =>
    unwrap(await api.get(`/school/exam-board/exams/${examId}/subjects`)),
  addSubject: async (
    examId: string,
    payload: {
      subjectName: string;
      date?: string;
      time?: string;
      maxMarks: number;
      passMarks: number;
      ceMaxMarks?: number;
      cePassMarks?: number;
    },
  ): Promise<EbExamSubject> =>
    unwrap(await api.post(`/school/exam-board/exams/${examId}/subjects`, payload)),
  updateSubject: async (
    examId: string,
    subjectId: string,
    payload: Partial<{
      date?: string;
      time?: string;
      maxMarks: number;
      passMarks: number;
      ceMaxMarks?: number;
      cePassMarks?: number;
    }>,
  ): Promise<EbExamSubject> =>
    unwrap(await api.patch(`/school/exam-board/exams/${examId}/subjects/${subjectId}`, payload)),

  listMarks: async (examId: string, subjectId?: string): Promise<EbMark[]> =>
    unwrap(await api.get(`/school/exam-board/exams/${examId}/marks`, { params: subjectId ? { subjectId } : undefined })),
  saveMarks: async (
    examId: string,
    subjectId: string,
    marks: { studentId: string; marksObtained: number; ceMarksObtained?: number; isAbsent?: boolean }[],
  ) =>
    unwrap<{ saved: number }>(
      await api.put(`/school/exam-board/exams/${examId}/subjects/${subjectId}/marks`, { marks }),
    ),
};
