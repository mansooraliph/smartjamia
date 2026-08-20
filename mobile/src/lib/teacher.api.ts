import { api } from './api';

export interface ClassSection {
  id: string;
  classId: string;
  name: string;
  classTeacherId: string | null;
}

export interface ClassRow {
  id: string;
  name: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

export interface SectionAttendanceRow {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  rollNumber: string | null;
  status: string | null;
  note: string | null;
  attendanceId: string | null;
}

export interface SectionAttendance {
  sectionId: string;
  className: string;
  sectionName: string;
  date: string;
  rows: SectionAttendanceRow[];
  summary: Record<string, number>;
}

export interface AttendanceEntry {
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'holiday' | 'half_day';
  note?: string;
}

export interface ExamRow {
  id: string;
  name: string;
  examType: string;
  classId: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface MarksGrid {
  exam: { id: string; name: string; examType: string; classId: string; academicYearId: string; status: string };
  subjects: { id: string; name: string; code: string; maxMarks: number; passMarks: number }[];
  students: { id: string; admissionNumber: string; studentName: string; rollNumber: string | null }[];
  marks: Record<string, { marksObtained: number | null; isAbsent: boolean }>;
}

export interface MarkEntry {
  studentId: string;
  subjectId: string;
  marksObtained?: number;
  isAbsent?: boolean;
}

export interface TimetableGrid {
  section: { id: string; name: string; classId: string };
  className: string;
  days: string[];
  periods: { periodNumber: number; startTime: string; endTime: string }[];
  cells: Record<string, { subjectId: string; staffId: string | null }>;
  subjects: { id: string; name: string; code: string }[];
  teachers: { id: string; name: string; designation: string }[];
}

export const TeacherApi = {
  academicYears: async () => (await api.get<AcademicYear[]>('/school/academic-years')).data,
  classes: async () => (await api.get<ClassRow[]>('/school/classes')).data,
  sections: async () => (await api.get<ClassSection[]>('/school/sections')).data,
  timetable: async (sectionId: string, academicYearId: string) =>
    (await api.get<TimetableGrid>('/school/timetable', { params: { sectionId, academicYearId } })).data,

  sectionAttendance: async (sectionId: string, date: string) =>
    (await api.get<SectionAttendance>(`/school/attendance/section/${sectionId}`, { params: { date } })).data,
  markAttendance: async (params: { sectionId: string; academicYearId: string; date: string; entries: AttendanceEntry[] }) =>
    (await api.post('/school/attendance/bulk', params)).data,

  exams: async (params?: { academicYearId?: string; classId?: string }) =>
    (await api.get<ExamRow[]>('/school/exams', { params })).data,
  marksGrid: async (examId: string) => (await api.get<MarksGrid>(`/school/exams/${examId}/marks-grid`)).data,
  saveMarks: async (examId: string, entries: MarkEntry[]) =>
    (await api.post(`/school/exams/${examId}/marks`, { entries })).data,
};
