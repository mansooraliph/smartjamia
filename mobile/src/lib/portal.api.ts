import { api } from './api';

export interface StudentProfile {
  id: string;
  admissionNumber: string;
  studentName: string;
  gender: string;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  photoUrl: string | null;
  status: string;
  className: string | null;
  sectionName: string | null;
  rollNumber: string | null;
}

export interface AttendanceSummary {
  summary: {
    present: number;
    absent: number;
    late: number;
    half_day: number;
    holiday: number;
    workingDays: number;
    percentage: number | null;
  };
  recent: { date: string; status: string; note: string | null }[];
}

export interface ExamResult {
  examId: string;
  name: string;
  examType: string | null;
  startDate: string | null;
  subjects: {
    subject: string;
    code: string;
    marksObtained: number | null;
    maxMarks: number;
    passMarks: number;
    grade: string | null;
    isAbsent: boolean;
    passed: boolean;
  }[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  grade: string | null;
  passed: boolean;
  rank: number | null;
  reportCardUrl: string | null;
}

export interface TimetableGrid {
  section: { id: string; name: string };
  className: string;
  days: string[];
  periods: { periodNumber: number; startTime: string; endTime: string }[];
  cells: { dayOfWeek: string; periodNumber: number; subject: string; code: string; teacher: string | null }[];
}

export const PortalApi = {
  me: async () => (await api.get<{ role: 'student'; student: StudentProfile }>('/portal/me')).data,
  attendance: async () => (await api.get<AttendanceSummary>('/portal/attendance')).data,
  results: async () => (await api.get<{ exams: ExamResult[] }>('/portal/results')).data,
  timetable: async () => (await api.get<{ enrolled: boolean; grid: TimetableGrid | null }>('/portal/timetable')).data,
};
