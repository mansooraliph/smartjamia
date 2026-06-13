import api from '@/lib/axios';

// ───── Types ────────────────────────────────────────────────────────────────
export interface AcademicYear {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassEntity {
  id: string;
  schoolId: string;
  academicYearId: string;
  courseId?: string | null;
  /** Resolved course name (college mode) — null when unassigned/school mode. */
  courseName?: string | null;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  sections?: Section[];
}

/**
 * Display label for a class. In college mode classes reuse names like
 * "Semester 1" across courses, so prefix the course to disambiguate
 * (e.g. "B.Sc CS · Semester 1"). Falls back to the bare name.
 */
export function classLabel(cls: {
  name: string;
  courseName?: string | null;
}): string {
  return cls.courseName ? `${cls.courseName} · ${cls.name}` : cls.name;
}

export type CourseLevel =
  | 'ug'
  | 'pg'
  | 'diploma'
  | 'phd'
  | 'certificate'
  | 'other';

export type TermSystem = 'annual' | 'semester' | 'trimester';

export interface Course {
  id: string;
  schoolId: string;
  academicYearId: string;
  level: CourseLevel;
  name: string;
  code: string | null;
  termSystem: TermSystem;
  durationYears: number;
  orderIndex: number;
  classCount?: number;
  classesGenerated?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  capacity: number;
  classTeacherId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  code: string;
  isOptional: boolean;
  maxMarks: number;
  passMarks: number;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  schoolId: string;
  userId?: string | null; // set when portal (PIN) access is enabled
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup: string | null;
  religion: string | null;
  caste: string | null;
  aadharNumber: string | null;
  photoUrl: string | null;
  mobileCountryCode: string | null;
  mobile: string | null;
  whatsappCountryCode: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  previousSchool: string | null;
  admissionDate: string;
  status: 'active' | 'inactive' | 'transferred' | 'alumni';
  createdAt: string;
  updatedAt: string;
  enrollment?: {
    id: string;
    academicYearId: string;
    classId: string;
    sectionId: string;
    rollNumber: string | null;
  } | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'teacher' | 'staff' | 'cashier';
  roleKey?: string | null;
  isActive: boolean;
  avatarUrl: string | null;
}

export interface Staff {
  id: string;
  schoolId: string;
  userId: string;
  employeeId: string;
  designation: string;
  department: string | null;
  qualification: string | null;
  joiningDate: string;
  salary: number;
  bankAccount: string | null;
  bankIfsc: string | null;
  pan: string | null;
  aadhar: string | null;
  address: string | null;
  mobileCountryCode: string | null;
  mobile: string | null;
  whatsappCountryCode: string | null;
  whatsapp: string | null;
  photoUrl: string | null;
  status: 'active' | 'on_leave' | 'resigned' | 'terminated';
  createdAt: string;
  updatedAt: string;
  user?: User | null;
}

export interface SchoolStats {
  students: { total: number; active: number };
  staff: { total: number; active: number };
  classes: { total: number };
  sections: { total: number };
  subjects: { total: number };
  academicYears: { total: number; current: AcademicYear | null };
}

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

// ───── Pagination & Export helpers ──────────────────────────────────────────
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ExportFormat = 'xlsx' | 'pdf';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

/** Fetch a file (with auth headers) and trigger a browser download. */
export async function downloadExport(
  path: string,
  baseName: string,
  format: ExportFormat,
  params: Record<string, unknown> = {},
): Promise<void> {
  const res = await api.get(path, {
    params: { ...params, format },
    responseType: 'blob',
  });
  const blob = new Blob([res.data]);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${baseName}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

// ───── Settings: academic terminology ───────────────────────────────────────
export interface Terminology {
  level: string;
  levelPlural: string;
  group: string;
  groupPlural: string;
  institutionType: 'school' | 'college';
}

export const DEFAULT_TERMINOLOGY: Terminology = {
  level: 'Class',
  levelPlural: 'Classes',
  group: 'Section',
  groupPlural: 'Sections',
  institutionType: 'school',
};

export type RoleAccessMap = Record<string, string[]>;
export interface MenuAccess {
  roleAccess: RoleAccessMap;
}

// ───── RBAC: roles & permissions ────────────────────────────────────────────
export type PermAction = 'list' | 'create' | 'delete';
export interface PermModule {
  key: string;
  label: string;
  group: string;
  actions: PermAction[];
}
export interface MePerms {
  role: string;
  isSystem: boolean;
  isAdmin: boolean;
  permissions: string[];
}
export interface RoleView {
  id: string | null;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}
export interface PermissionCatalog {
  modules: PermModule[];
  permissions: string[];
}

// ───── Billing ──────────────────────────────────────────────────────────────
export interface BillingPlanRef {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  isCustom: boolean;
  isFeatured?: boolean;
  features?: string[];
  maxStudents?: number;
  maxStaff?: number;
}
export interface BillingInvoice {
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}
export interface BillingInfo {
  status: string;
  isTrial: boolean;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  subscriptionEndsAt: string | null;
  plan: BillingPlanRef | null;
  subscription: {
    status: string;
    billingCycle: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    paymentGateway: string | null;
  } | null;
  invoices: BillingInvoice[];
  availablePlans: BillingPlanRef[];
  gatewayConfigured: boolean;
  razorpayKeyId: string;
}
export interface CheckoutOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  planName: string;
}
export const BillingApi = {
  get: async (): Promise<BillingInfo> => unwrap(await api.get('/school/billing')),
  checkout: async (
    planId: string,
    billingCycle: 'monthly' | 'yearly',
  ): Promise<CheckoutOrder> =>
    unwrap(await api.post('/school/billing/checkout', { planId, billingCycle })),
  verify: async (payload: {
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<BillingInfo> =>
    unwrap(await api.post('/school/billing/verify', payload)),
};

export const RbacApi = {
  me: async (): Promise<MePerms> => unwrap(await api.get('/school/me')),
  roles: async (): Promise<RoleView[]> =>
    unwrap(await api.get('/school/roles')),
  catalog: async (): Promise<PermissionCatalog> =>
    unwrap(await api.get('/school/roles/catalog')),
  createRole: async (data: {
    name: string;
    description?: string;
    permissions: string[];
  }): Promise<RoleView> => unwrap(await api.post('/school/roles', data)),
  updateRole: async (
    id: string,
    data: { name?: string; description?: string; permissions?: string[] },
  ): Promise<RoleView> => unwrap(await api.patch(`/school/roles/${id}`, data)),
  deleteRole: async (id: string) =>
    unwrap(await api.delete(`/school/roles/${id}`)),
};

export const SettingsApi = {
  getTerminology: async (): Promise<Terminology> =>
    unwrap(await api.get('/school/settings/terminology')),
  setTerminology: async (data: Partial<Terminology>): Promise<Terminology> =>
    unwrap(await api.put('/school/settings/terminology', data)),
  getMenuAccess: async (): Promise<MenuAccess> =>
    unwrap(await api.get('/school/settings/menu-access')),
  setMenuAccess: async (roleAccess: RoleAccessMap): Promise<MenuAccess> =>
    unwrap(await api.put('/school/settings/menu-access', { roleAccess })),
};

// ───── Visitor management ───────────────────────────────────────────────────
export type VisitorGender = 'male' | 'female' | 'other';

export interface VisitorStudentRef {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
}

export interface Visitor {
  id: string;
  schoolId: string;
  studentId: string;
  name: string;
  relation: string | null;
  gender: VisitorGender | null;
  mobile: string;
  email: string | null;
  place: string | null;
  address: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  photoUrl: string | null;
  notes: string | null;
  isBlacklisted: boolean;
  createdAt: string;
  updatedAt: string;
  student: VisitorStudentRef | null;
}

export interface VisitorLookup {
  id: string;
  name: string;
  mobile: string;
  relation: string | null;
  isBlacklisted: boolean;
  studentId: string;
  student: VisitorStudentRef | null;
}

export type VisitStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';
export interface Visit {
  id: string;
  schoolId: string;
  visitorId: string;
  studentId: string;
  meetingWith: string | null;
  purpose: string;
  reason: string | null;
  partySize: number;
  vehicleNumber: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  status: VisitStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  passNumber: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationMinutes: number | null;
  belongings: string | null;
  remarks: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  visitor: {
    id: string;
    name: string;
    mobile: string;
    relation: string | null;
    isBlacklisted: boolean;
  } | null;
  student: VisitorStudentRef | null;
}

export interface VisitSummary {
  currentlyInside: number;
  pendingRequests: number;
  scheduledToday: number;
}

export interface VisitorListParams extends ListParams {
  gender?: VisitorGender;
  blacklisted?: string;
  studentId?: string;
}
export interface VisitListParams extends ListParams {
  status?: VisitStatus;
  visitorId?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const VisitorsApi = {
  list: async (params?: VisitorListParams): Promise<Paginated<Visitor>> =>
    unwrap(await api.get('/school/visitors', { params })),
  lookup: async (params?: {
    search?: string;
    studentId?: string;
  }): Promise<VisitorLookup[]> =>
    unwrap(await api.get('/school/visitors/lookup', { params })),
  create: async (data: Record<string, unknown>): Promise<Visitor> =>
    unwrap(await api.post('/school/visitors', data)),
  update: async (id: string, data: Record<string, unknown>): Promise<Visitor> =>
    unwrap(await api.patch(`/school/visitors/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/visitors/${id}`)),
  export: (format: ExportFormat, params?: VisitorListParams) =>
    downloadExport('/school/visitors/export', 'visitors', format, params),
  importTemplate: () =>
    downloadExport(
      '/school/visitors/import/template',
      'visitor-import-template',
      'xlsx',
    ),
  importPreview: async (file: File): Promise<ImportPreview> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(await api.post('/school/visitors/import/preview', fd));
  },
  importCommit: async (file: File): Promise<ImportCommitResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(await api.post('/school/visitors/import/commit', fd));
  },
};

export const VisitsApi = {
  list: async (params?: VisitListParams): Promise<Paginated<Visit>> =>
    unwrap(await api.get('/school/visits', { params })),
  summary: async (): Promise<VisitSummary> =>
    unwrap(await api.get('/school/visits/summary')),
  create: async (data: Record<string, unknown>): Promise<Visit> =>
    unwrap(await api.post('/school/visits', data)),
  approve: async (id: string): Promise<Visit> =>
    unwrap(await api.post(`/school/visits/${id}/approve`)),
  reject: async (id: string, rejectionReason?: string): Promise<Visit> =>
    unwrap(await api.post(`/school/visits/${id}/reject`, { rejectionReason })),
  checkIn: async (
    id: string,
    data: { passNumber?: string; belongings?: string; checkInAt?: string },
  ): Promise<Visit> =>
    unwrap(await api.post(`/school/visits/${id}/check-in`, data)),
  checkOut: async (id: string, data: { remarks?: string }): Promise<Visit> =>
    unwrap(await api.post(`/school/visits/${id}/check-out`, data)),
  cancel: async (id: string): Promise<Visit> =>
    unwrap(await api.post(`/school/visits/${id}/cancel`)),
  noShow: async (id: string): Promise<Visit> =>
    unwrap(await api.post(`/school/visits/${id}/no-show`)),
  export: (format: ExportFormat, params?: VisitListParams) =>
    downloadExport('/school/visits/export', 'visit-history', format, params),
};

// ───── Stats ────────────────────────────────────────────────────────────────
export const SchoolStatsApi = {
  overview: async (): Promise<SchoolStats> =>
    unwrap(await api.get('/school/stats')),
};

// ───── Academic Years ───────────────────────────────────────────────────────
export const AcademicYearsApi = {
  list: async (): Promise<AcademicYear[]> =>
    unwrap(await api.get('/school/academic-years')),
  create: async (data: Partial<AcademicYear>): Promise<AcademicYear> =>
    unwrap(await api.post('/school/academic-years', data)),
  update: async (
    id: string,
    data: Partial<AcademicYear>,
  ): Promise<AcademicYear> =>
    unwrap(await api.patch(`/school/academic-years/${id}`, data)),
  setCurrent: async (id: string): Promise<AcademicYear> =>
    unwrap(await api.post(`/school/academic-years/${id}/set-current`)),
  lock: async (id: string): Promise<AcademicYear> =>
    unwrap(await api.post(`/school/academic-years/${id}/lock`)),
  unlock: async (id: string): Promise<AcademicYear> =>
    unwrap(await api.post(`/school/academic-years/${id}/unlock`)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/academic-years/${id}`)),
  copyStructure: async (
    id: string,
    fromYearId: string,
  ): Promise<{
    from: string;
    to: string;
    courses: number;
    classes: number;
    sections: number;
  }> =>
    unwrap(
      await api.post(`/school/academic-years/${id}/copy-structure`, {
        fromYearId,
      }),
    ),
};

// ───── Classes & Sections ───────────────────────────────────────────────────
export const ClassesApi = {
  list: async (academicYearId?: string): Promise<ClassEntity[]> =>
    unwrap(
      await api.get('/school/classes', {
        params: academicYearId ? { academicYearId } : undefined,
      }),
    ),
  listWithSections: async (
    academicYearId?: string,
    courseId?: string,
  ): Promise<ClassEntity[]> =>
    unwrap(
      await api.get('/school/classes', {
        params: {
          withSections: 'true',
          ...(academicYearId ? { academicYearId } : {}),
          ...(courseId ? { courseId } : {}),
        },
      }),
    ),
  create: async (data: Partial<ClassEntity>): Promise<ClassEntity> =>
    unwrap(await api.post('/school/classes', data)),
  update: async (
    id: string,
    data: Partial<ClassEntity>,
  ): Promise<ClassEntity> =>
    unwrap(await api.patch(`/school/classes/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/classes/${id}`)),
  export: (format: ExportFormat, academicYearId?: string) =>
    downloadExport('/school/classes/export', 'classes', format, {
      ...(academicYearId ? { academicYearId } : {}),
    }),
};

export const CoursesApi = {
  list: async (academicYearId?: string): Promise<Course[]> =>
    unwrap(
      await api.get('/school/courses', {
        params: academicYearId ? { academicYearId } : undefined,
      }),
    ),
  create: async (data: {
    academicYearId: string;
    level: CourseLevel;
    name: string;
    code?: string;
    termSystem?: TermSystem;
    durationYears?: number;
    orderIndex?: number;
  }): Promise<Course> => unwrap(await api.post('/school/courses', data)),
  update: async (
    id: string,
    data: Partial<{
      level: CourseLevel;
      name: string;
      code: string;
      termSystem: TermSystem;
      durationYears: number;
      orderIndex: number;
    }>,
  ): Promise<Course> => unwrap(await api.patch(`/school/courses/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/courses/${id}`)),
};

export const SectionsApi = {
  list: async (classId?: string): Promise<Section[]> =>
    unwrap(
      await api.get('/school/sections', {
        params: classId ? { classId } : undefined,
      }),
    ),
  create: async (data: Partial<Section>): Promise<Section> =>
    unwrap(await api.post('/school/sections', data)),
  update: async (id: string, data: Partial<Section>): Promise<Section> =>
    unwrap(await api.patch(`/school/sections/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/sections/${id}`)),
};

// ───── Subjects ─────────────────────────────────────────────────────────────
export const SubjectsApi = {
  list: async (classId?: string): Promise<Subject[]> =>
    unwrap(
      await api.get('/school/subjects', {
        params: classId ? { classId } : undefined,
      }),
    ),
  create: async (data: Partial<Subject>): Promise<Subject> =>
    unwrap(await api.post('/school/subjects', data)),
  update: async (id: string, data: Partial<Subject>): Promise<Subject> =>
    unwrap(await api.patch(`/school/subjects/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/subjects/${id}`)),
  export: (format: ExportFormat, classId?: string) =>
    downloadExport('/school/subjects/export', 'subjects', format, {
      ...(classId ? { classId } : {}),
    }),
  importTemplate: () =>
    downloadExport(
      '/school/subjects/import/template',
      'subject-import-template',
      'xlsx',
    ),
  importPreview: async (
    file: File,
    academicYearId?: string,
  ): Promise<ImportPreview> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      await api.post('/school/subjects/import/preview', fd, {
        params: academicYearId ? { academicYearId } : undefined,
      }),
    );
  },
  importCommit: async (
    file: File,
    academicYearId?: string,
  ): Promise<ImportCommitResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      await api.post('/school/subjects/import/commit', fd, {
        params: academicYearId ? { academicYearId } : undefined,
      }),
    );
  },
};

// ───── Students ─────────────────────────────────────────────────────────────
export interface StudentLookup {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  status: Student['status'];
}

export interface StudentListParams extends ListParams {
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
}

export const StudentsApi = {
  list: async (params?: StudentListParams): Promise<Paginated<Student>> =>
    unwrap(await api.get('/school/students', { params })),
  lookup: async (params?: {
    search?: string;
    status?: string;
  }): Promise<StudentLookup[]> =>
    unwrap(await api.get('/school/students/lookup', { params })),
  get: async (id: string): Promise<Student> =>
    unwrap(await api.get(`/school/students/${id}`)),
  nextAdmissionNumber: async (): Promise<{ admissionNumber: string }> =>
    unwrap(await api.get('/school/students/next-admission-number')),
  create: async (data: Record<string, unknown>): Promise<Student> =>
    unwrap(await api.post('/school/students', data)),
  update: async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<Student> =>
    unwrap(await api.patch(`/school/students/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/students/${id}`)),
  setPin: async (id: string, pin: string) =>
    unwrap(await api.post(`/school/students/${id}/portal-pin`, { pin })),
  removePin: async (id: string) =>
    unwrap(await api.delete(`/school/students/${id}/portal-pin`)),
  export: (format: ExportFormat, params?: StudentListParams) =>
    downloadExport('/school/students/export', 'students', format, params),
  importTemplate: () =>
    downloadExport(
      '/school/students/import/template',
      'student-import-template',
      'xlsx',
    ),
  importPreview: async (
    file: File,
    academicYearId?: string,
  ): Promise<ImportPreview> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      await api.post('/school/students/import/preview', fd, {
        params: academicYearId ? { academicYearId } : undefined,
      }),
    );
  },
  importCommit: async (
    file: File,
    academicYearId?: string,
  ): Promise<ImportCommitResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      await api.post('/school/students/import/commit', fd, {
        params: academicYearId ? { academicYearId } : undefined,
      }),
    );
  },
};

// ───── Uploads (images / PDFs) ───────────────────────────────────────────────
export interface UploadResult {
  url: string;
  name: string;
  size: number;
  mime: string;
}
export const UploadApi = {
  upload: async (file: File): Promise<UploadResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(await api.post('/school/uploads', fd));
  },
};

// ───── Student qualifications (prior education) ──────────────────────────────
export interface StudentQualification {
  id: string;
  schoolId: string;
  studentId: string;
  examName: string;
  board: string | null;
  institution: string | null;
  yearOfPassing: number | null;
  percentage: string | null;
  grade: string | null;
  registerNumber: string | null;
  fileUrl: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}
export const QualificationsApi = {
  list: async (studentId: string): Promise<StudentQualification[]> =>
    unwrap(
      await api.get('/school/student-qualifications', {
        params: { studentId },
      }),
    ),
  create: async (data: Record<string, unknown>): Promise<StudentQualification> =>
    unwrap(await api.post('/school/student-qualifications', data)),
  update: async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<StudentQualification> =>
    unwrap(await api.patch(`/school/student-qualifications/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/student-qualifications/${id}`)),
};

// ───── Student documents (proofs / certificates) ────────────────────────────
export type StudentDocumentType =
  | 'aadhaar'
  | 'birth_certificate'
  | 'transfer_certificate'
  | 'marksheet'
  | 'id_proof'
  | 'address_proof'
  | 'caste_certificate'
  | 'income_certificate'
  | 'photo'
  | 'other';
export interface StudentDocument {
  id: string;
  schoolId: string;
  studentId: string;
  type: StudentDocumentType;
  title: string;
  fileUrl: string;
  fileName: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export const DocumentsApi = {
  list: async (studentId: string): Promise<StudentDocument[]> =>
    unwrap(
      await api.get('/school/student-documents', { params: { studentId } }),
    ),
  create: async (data: Record<string, unknown>): Promise<StudentDocument> =>
    unwrap(await api.post('/school/student-documents', data)),
  update: async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<StudentDocument> =>
    unwrap(await api.patch(`/school/student-documents/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/student-documents/${id}`)),
};

// ───── Academics: bulk-enroll & promotion ───────────────────────────────────
export interface ImportRowResult {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  willEnroll: boolean;
  autoAdmissionNumber: boolean;
}
export interface ImportPreview {
  rows: ImportRowResult[];
  summary: { total: number; valid: number; invalid: number };
}
export interface ImportCommitResult {
  created: number;
  skipped: number;
  errors: { rowNumber: number; error: string }[];
}

export interface PromotionSourceClass {
  id: string;
  name: string;
  courseName?: string | null;
  orderIndex: number;
  activeStudents: number;
}
export interface PromotionClassStudent {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
}
export type PromotionAction = 'promote' | 'detain' | 'transfer';
export interface PromotionDecision {
  studentId: string;
  action: PromotionAction;
  toClassId?: string;
  toSectionId?: string;
  rollNumber?: string;
}

export const AcademicsApi = {
  bulkEnroll: async (data: {
    academicYearId: string;
    classId: string;
    sectionId: string;
    studentIds: string[];
    startRoll?: number;
  }): Promise<{ assigned: number; errors: unknown[] }> =>
    unwrap(await api.post('/school/academics/bulk-enroll', data)),
  promotionSource: async (
    academicYearId: string,
  ): Promise<PromotionSourceClass[]> =>
    unwrap(
      await api.get('/school/academics/promotion/source', {
        params: { academicYearId },
      }),
    ),
  classStudents: async (
    academicYearId: string,
    classId: string,
  ): Promise<PromotionClassStudent[]> =>
    unwrap(
      await api.get('/school/academics/promotion/class-students', {
        params: { academicYearId, classId },
      }),
    ),
  promote: async (data: {
    fromAcademicYearId: string;
    toAcademicYearId: string;
    decisions: PromotionDecision[];
  }): Promise<{ promoted: number; detained: number; transferred: number }> =>
    unwrap(await api.post('/school/academics/promote', data)),
};

// ───── Parents / Guardians ──────────────────────────────────────────────────
export type ParentRelation = 'father' | 'mother' | 'guardian';

export interface Parent {
  id: string;
  schoolId: string;
  userId?: string | null; // set when portal (PIN) access is enabled
  studentId: string;
  relation: ParentRelation;
  name: string;
  phoneCountryCode: string | null;
  phone: string;
  whatsappCountryCode: string | null;
  whatsapp: string | null;
  email: string | null;
  occupation: string | null;
  annualIncome: number | null;
  aadharNumber: string | null;
  photoUrl: string | null;
  isPrimary: boolean;
  createdAt: string;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface ParentListParams extends ListParams {
  studentId?: string;
  relation?: ParentRelation;
}

export const ParentsApi = {
  list: async (params?: ParentListParams): Promise<Paginated<Parent>> =>
    unwrap(await api.get('/school/parents', { params })),
  create: async (data: Record<string, unknown>): Promise<Parent> =>
    unwrap(await api.post('/school/parents', data)),
  update: async (id: string, data: Record<string, unknown>): Promise<Parent> =>
    unwrap(await api.patch(`/school/parents/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/parents/${id}`)),
  setPin: async (id: string, pin: string) =>
    unwrap(await api.post(`/school/parents/${id}/portal-pin`, { pin })),
  removePin: async (id: string) =>
    unwrap(await api.delete(`/school/parents/${id}/portal-pin`)),
  export: (format: ExportFormat, params?: ParentListParams) =>
    downloadExport('/school/parents/export', 'parents', format, params),
  importTemplate: () =>
    downloadExport(
      '/school/parents/import/template',
      'parent-import-template',
      'xlsx',
    ),
  importPreview: async (file: File): Promise<ImportPreview> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(await api.post('/school/parents/import/preview', fd));
  },
  importCommit: async (file: File): Promise<ImportCommitResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(await api.post('/school/parents/import/commit', fd));
  },
};

// ───── Transfer Certificates ─────────────────────────────────────────────────
export type TcReason =
  | 'transfer'
  | 'completion'
  | 'expulsion'
  | 'withdrawal'
  | 'other';
export type TcConduct = 'excellent' | 'good' | 'satisfactory' | 'poor';

export interface TransferCertificate {
  id: string;
  schoolId: string;
  studentId: string;
  tcNumber: string;
  issueDate: string;
  reason: TcReason;
  lastClass: string;
  conduct: TcConduct;
  feesCleared: boolean;
  pdfUrl: string | null;
  issuedBy: string;
  createdAt: string;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    status: Student['status'];
  } | null;
}

export interface IssueTcPayload {
  studentId: string;
  reason: TcReason;
  conduct?: TcConduct;
  feesCleared?: boolean;
  issueDate?: string;
  lastClass?: string;
}

export interface TcListParams extends ListParams {
  reason?: TcReason;
}

export const TransferCertificatesApi = {
  list: async (
    params?: TcListParams,
  ): Promise<Paginated<TransferCertificate>> =>
    unwrap(await api.get('/school/transfer-certificates', { params })),
  get: async (id: string): Promise<TransferCertificate> =>
    unwrap(await api.get(`/school/transfer-certificates/${id}`)),
  issue: async (payload: IssueTcPayload): Promise<TransferCertificate> =>
    unwrap(await api.post('/school/transfer-certificates', payload)),
  regeneratePdf: async (id: string) =>
    unwrap(await api.post(`/school/transfer-certificates/${id}/pdf`)),
  revoke: async (id: string) =>
    unwrap(await api.delete(`/school/transfer-certificates/${id}`)),
  export: (format: ExportFormat, params?: TcListParams) =>
    downloadExport(
      '/school/transfer-certificates/export',
      'transfer-certificates',
      format,
      params,
    ),
};

// ───── Attendance ───────────────────────────────────────────────────────────
export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'holiday'
  | 'half_day';

export interface SectionAttendanceRow {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  status: AttendanceStatus | null;
  note: string | null;
  attendanceId: string | null;
}

export interface SectionAttendance {
  sectionId: string;
  className: string;
  sectionName: string;
  date: string;
  rows: SectionAttendanceRow[];
  summary: Record<AttendanceStatus, number>;
}

export const AttendanceApi = {
  getSection: async (
    sectionId: string,
    date: string,
  ): Promise<SectionAttendance> =>
    unwrap(
      await api.get(`/school/attendance/section/${sectionId}`, {
        params: { date },
      }),
    ),
  bulkMark: async (data: {
    sectionId: string;
    academicYearId: string;
    date: string;
    entries: {
      studentId: string;
      status: AttendanceStatus;
      note?: string;
    }[];
  }): Promise<{ saved: number; date: string; sectionId: string }> =>
    unwrap(await api.post('/school/attendance/bulk', data)),
  studentSummary: async (
    studentId: string,
    academicYearId?: string,
  ): Promise<Record<string, number>> =>
    unwrap(
      await api.get(`/school/attendance/student/${studentId}/summary`, {
        params: academicYearId ? { academicYearId } : undefined,
      }),
    ),
};

// ───── Staff ────────────────────────────────────────────────────────────────
export interface StaffListParams extends ListParams {
  status?: string;
  department?: string;
}

export const StaffApi = {
  list: async (params?: StaffListParams): Promise<Paginated<Staff>> =>
    unwrap(await api.get('/school/staff', { params })),
  get: async (id: string): Promise<Staff> =>
    unwrap(await api.get(`/school/staff/${id}`)),
  create: async (data: Record<string, unknown>): Promise<Staff> =>
    unwrap(await api.post('/school/staff', data)),
  update: async (id: string, data: Record<string, unknown>): Promise<Staff> =>
    unwrap(await api.patch(`/school/staff/${id}`, data)),
  remove: async (id: string) => unwrap(await api.delete(`/school/staff/${id}`)),
  export: (format: ExportFormat, params?: StaffListParams) =>
    downloadExport('/school/staff/export', 'staff', format, params),
  importTemplate: () =>
    downloadExport(
      '/school/staff/import/template',
      'staff-import-template',
      'xlsx',
    ),
  importPreview: async (file: File): Promise<ImportPreview> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(await api.post('/school/staff/import/preview', fd));
  },
  importCommit: async (file: File): Promise<ImportCommitResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(await api.post('/school/staff/import/commit', fd));
  },
};

// ───── Staff documents ──────────────────────────────────────────────────────
export type StaffDocumentType =
  | 'aadhaar'
  | 'pan'
  | 'id_proof'
  | 'address_proof'
  | 'resume'
  | 'certificate'
  | 'qualification'
  | 'experience'
  | 'contract'
  | 'photo'
  | 'other';
export interface StaffDocument {
  id: string;
  schoolId: string;
  staffId: string;
  type: StaffDocumentType;
  title: string;
  fileUrl: string;
  fileName: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export const StaffDocumentsApi = {
  list: async (staffId: string): Promise<StaffDocument[]> =>
    unwrap(await api.get('/school/staff-documents', { params: { staffId } })),
  create: async (data: Record<string, unknown>): Promise<StaffDocument> =>
    unwrap(await api.post('/school/staff-documents', data)),
  update: async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<StaffDocument> =>
    unwrap(await api.patch(`/school/staff-documents/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/school/staff-documents/${id}`)),
};

// ───── Exams & Marks ────────────────────────────────────────────────────────
export type ExamType =
  | 'unit_test'
  | 'mid_term'
  | 'final'
  | 'quarterly'
  | 'half_yearly';
export type ExamStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed';

export interface Exam {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  examType: ExamType;
  classId: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MarksGridSubject {
  id: string;
  name: string;
  code: string;
  maxMarks: number;
  passMarks: number;
}

export interface MarksGridStudent {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
}

export interface MarksGrid {
  exam: {
    id: string;
    name: string;
    examType: ExamType;
    classId: string;
    academicYearId: string;
    status: ExamStatus;
  };
  subjects: MarksGridSubject[];
  students: MarksGridStudent[];
  marks: Record<string, { marksObtained: number | null; isAbsent: boolean }>;
}

export interface MarkEntry {
  studentId: string;
  subjectId: string;
  marksObtained?: number | null;
  isAbsent?: boolean;
  maxMarks?: number;
}

export const ExamsApi = {
  list: async (params?: {
    academicYearId?: string;
    classId?: string;
  }): Promise<Exam[]> => unwrap(await api.get('/school/exams', { params })),
  get: async (id: string): Promise<Exam> =>
    unwrap(await api.get(`/school/exams/${id}`)),
  marksGrid: async (id: string): Promise<MarksGrid> =>
    unwrap(await api.get(`/school/exams/${id}/marks-grid`)),
  create: async (data: {
    name: string;
    examType: ExamType;
    academicYearId: string;
    classId: string;
    startDate: string;
    endDate: string;
    status?: ExamStatus;
  }): Promise<Exam> => unwrap(await api.post('/school/exams', data)),
  update: async (
    id: string,
    data: Partial<{
      name: string;
      examType: ExamType;
      status: ExamStatus;
      startDate: string;
      endDate: string;
    }>,
  ): Promise<Exam> => unwrap(await api.patch(`/school/exams/${id}`, data)),
  remove: async (id: string) => unwrap(await api.delete(`/school/exams/${id}`)),
  saveMarks: async (
    id: string,
    entries: MarkEntry[],
  ): Promise<{ saved: number }> =>
    unwrap(await api.post(`/school/exams/${id}/marks`, { entries })),
};

// ───── Timetable ────────────────────────────────────────────────────────────
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface TimetablePeriod {
  periodNumber: number;
  startTime: string; // HH:MM
  endTime: string;
}

export interface TimetableEditorGrid {
  section: { id: string; name: string; classId: string };
  className: string;
  days: DayOfWeek[];
  periods: TimetablePeriod[];
  cells: Record<string, { subjectId: string; staffId: string | null }>;
  subjects: { id: string; name: string; code: string }[];
  teachers: { id: string; name: string; designation: string }[];
}

export interface SaveTimetablePayload {
  sectionId: string;
  academicYearId: string;
  periods: TimetablePeriod[];
  cells: {
    dayOfWeek: DayOfWeek;
    periodNumber: number;
    subjectId: string;
    staffId?: string | null;
  }[];
}

export interface TeacherScheduleSlot {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  subject: string;
  code: string;
  section: string;
}

export interface TeacherSchedule {
  isTeacher: boolean;
  days: DayOfWeek[];
  periods: TimetablePeriod[];
  slots: TeacherScheduleSlot[];
}

// ───── Report Cards ─────────────────────────────────────────────────────────
export interface ReportCardRow {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  grade: string | null;
  rank: number | null;
  isPassed: boolean;
  pdfUrl: string | null;
  generatedAt: string | null;
}

export interface ReportCardList {
  count: number;
  items: ReportCardRow[];
}

export const ReportCardsApi = {
  listForExam: async (examId: string): Promise<ReportCardList> =>
    unwrap(await api.get(`/school/exams/${examId}/report-cards`)),
  generate: async (
    examId: string,
  ): Promise<{ examId: string; generated: number; queuedPdfs: number }> =>
    unwrap(await api.post(`/school/exams/${examId}/report-cards`)),
  regenerate: async (id: string): Promise<{ queued: boolean; id: string }> =>
    unwrap(await api.post(`/school/report-cards/${id}/pdf`)),
};

export const TimetableApi = {
  grid: async (
    sectionId: string,
    academicYearId: string,
  ): Promise<TimetableEditorGrid> =>
    unwrap(
      await api.get('/school/timetable', {
        params: { sectionId, academicYearId },
      }),
    ),
  save: async (
    payload: SaveTimetablePayload,
  ): Promise<{ saved: number; periods: number }> =>
    unwrap(await api.put('/school/timetable', payload)),
  mySchedule: async (): Promise<TeacherSchedule> =>
    unwrap(await api.get('/school/timetable/my-schedule')),
};

// ───── Biometric devices (school side) ──────────────────────────────────────
export interface BiometricDevice {
  id: string;
  sn: string;
  alias: string | null;
  terminalName: string | null;
  deviceType: string;
  state: string | null;
  ipAddress: string | null;
  userCount: number | null;
  fpCount: number | null;
  faceCount: number | null;
  transactionCount: number | null;
  isApproved: boolean;
  deactivatedAt: string | null;
  lastSyncAt: string | null;
  lastActivity: string | null;
  createdAt: string;
}

export interface BiometricTransaction {
  id: string;
  deviceSn: string;
  userCode: string;
  studentId: string | null;
  staffId: string | null;
  actualPunchTime: string;
  punchTime: string;
  punchState: number;
  punchStateDisplay: string;
  source: string;
  createdAt: string;
}

export interface BiometricEnrollment {
  id: string;
  userCode: string;
  studentId: string | null;
  staffId: string | null;
  deviceSn: string | null;
  type: string;
  index: string;
  valid: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BiometricStats {
  total_devices: number;
  online_devices: number;
  total_transactions_today: number;
  enrolled_users: number;
}

export interface BiometricCommand {
  id: string;
  sn: string;
  command: string;
  status: number;
  deviceReturnCode: number | null;
  createdAt: string;
}

export interface BiometricTxParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  studentId?: string;
  staffId?: string;
  punchState?: number;
}

export const BiometricApi = {
  listDevices: async (): Promise<BiometricDevice[]> =>
    unwrap(await api.get('/school/biometric-devices')),
  getDevice: async (id: string): Promise<BiometricDevice> =>
    unwrap(await api.get(`/school/biometric-devices/${id}`)),
  stats: async (): Promise<BiometricStats> =>
    unwrap(await api.get('/school/biometric-devices/stats')),
  transactions: async (
    params?: BiometricTxParams,
  ): Promise<Paginated<BiometricTransaction>> =>
    unwrap(await api.get('/school/biometric-devices/transactions', { params })),
  enrollments: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    userCode?: string;
  }): Promise<Paginated<BiometricEnrollment>> =>
    unwrap(await api.get('/school/biometric-devices/enrollments', { params })),
  commands: async (id: string): Promise<BiometricCommand[]> =>
    unwrap(await api.get(`/school/biometric-devices/${id}/commands`)),
  rename: async (id: string, alias: string): Promise<BiometricDevice> =>
    unwrap(await api.patch(`/school/biometric-devices/${id}/alias`, { alias })),
  restart: async (id: string) =>
    unwrap(await api.post(`/school/biometric-devices/${id}/restart`, {})),
  syncUsers: async (id: string) =>
    unwrap(await api.post(`/school/biometric-devices/${id}/sync-users`, {})),
  clearData: async (id: string) =>
    unwrap(await api.post(`/school/biometric-devices/${id}/clear-data`, {})),
  deleteTransaction: async (id: string) =>
    unwrap(await api.delete(`/school/biometric-devices/transactions/${id}`)),
};
