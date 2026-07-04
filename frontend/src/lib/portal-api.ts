import axios from 'axios';

const PORTAL_TOKEN_KEY = 'edupro-portal-token';

export function getPortalToken(): string | null {
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}
export function setPortalToken(token: string | null) {
  if (token) localStorage.setItem(PORTAL_TOKEN_KEY, token);
  else localStorage.removeItem(PORTAL_TOKEN_KEY);
}

// Dedicated instance — carries only the PIN token, never the admin headers.
const portalAxios = axios.create({ baseURL: '/api/v1' });
portalAxios.interceptors.request.use((config) => {
  const t = getPortalToken();
  if (t) config.headers.set('Authorization', `Bearer ${t}`);
  return config;
});

export interface PortalStudent {
  id: string;
  admissionNumber: string;
  studentName: string;
  gender: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  photoUrl: string | null;
  status: string;
  className: string | null;
  sectionName: string | null;
  rollNumber: string | null;
}

export interface PortalMe {
  role: 'student' | 'parent';
  student?: PortalStudent | null;
  parent?: {
    id: string;
    name: string;
    relation: string | null;
    phone: string;
    email: string | null;
  } | null;
}

export interface PortalSession {
  token: string;
  user: { id: string; name: string; role: 'student' | 'parent' };
}

export interface PortalAttendance {
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

export interface PortalResultSubject {
  subject: string;
  code: string;
  marksObtained: number | null;
  maxMarks: number;
  passMarks: number;
  grade: string | null;
  isAbsent: boolean;
  passed: boolean;
}

export interface PortalResultExam {
  examId: string;
  name: string;
  examType: string | null;
  startDate: string | null;
  subjects: PortalResultSubject[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  grade: string;
  passed: boolean;
  rank: number | null;
  reportCardUrl: string | null;
}

export interface PortalResults {
  exams: PortalResultExam[];
}

export interface PortalTimetableCell {
  dayOfWeek: string;
  periodNumber: number;
  subjectId: string;
  subject: string;
  code: string;
  staffId: string | null;
  teacher: string | null;
}

export interface PortalTimetable {
  enrolled: boolean;
  grid: {
    section: { id: string; name: string };
    className: string;
    days: string[];
    periods: { periodNumber: number; startTime: string; endTime: string }[];
    cells: PortalTimetableCell[];
  } | null;
}

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

export const PortalApi = {
  studentLogin: async (
    schoolCode: string,
    admissionNumber: string,
    pin: string,
  ): Promise<PortalSession> =>
    unwrap(
      await axios.post('/api/v1/auth/student-login', {
        schoolCode,
        admissionNumber,
        pin,
      }),
    ),
  parentLogin: async (
    schoolCode: string,
    mobile: string,
    pin: string,
  ): Promise<PortalSession> =>
    unwrap(
      await axios.post('/api/v1/auth/parent-login', { schoolCode, mobile, pin }),
    ),
  me: async (): Promise<PortalMe> => unwrap(await portalAxios.get('/portal/me')),
  attendance: async (): Promise<PortalAttendance> =>
    unwrap(await portalAxios.get('/portal/attendance')),
  results: async (): Promise<PortalResults> =>
    unwrap(await portalAxios.get('/portal/results')),
  timetable: async (): Promise<PortalTimetable> =>
    unwrap(await portalAxios.get('/portal/timetable')),
};
