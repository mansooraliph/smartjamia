import { api } from './api';
import type { StudentUser, TeacherUser } from '../stores/auth.store';

interface TeacherLoginResponse {
  user: TeacherUser;
  school: { id: string; slug: string; status: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

interface StudentLoginResponse {
  user: { id: string; name: string; role: 'student'; schoolSlug: string };
  token: string;
  expiresIn: number;
}

export const AuthApi = {
  teacherLogin: async (schoolCode: string, email: string, password: string) => {
    const res = await api.post<TeacherLoginResponse>('/auth/login', { schoolCode, email, password });
    return res.data;
  },
  studentLogin: async (schoolCode: string, admissionNumber: string, pin: string) => {
    const res = await api.post<StudentLoginResponse>('/auth/student-login', { schoolCode, admissionNumber, pin });
    return res.data;
  },
};

export type { TeacherUser, StudentUser };
