// ============================================================================
// EduPro Shared Types — used by backend, frontend, mobile, desktop
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// USER & AUTH
// ─────────────────────────────────────────────────────────────────────────────

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  TEACHER = 'teacher',
  STAFF = 'staff',
  CASHIER = 'cashier',
}

export enum SuperadminRole {
  SUPERADMIN = 'superadmin',
  SUPPORT = 'support',
  FINANCE = 'finance',
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOL / SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

export enum SchoolStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  GRACE_PERIOD = 'grace_period',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  GRACE_PERIOD = 'grace_period',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  STRIPE = 'stripe',
  MANUAL = 'manual',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  FAILED = 'failed',
  VOID = 'void',
}

export enum PlanName {
  STARTER = 'starter',
  GROWTH = 'growth',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum SchemaMigrationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT / ENROLLMENT
// ─────────────────────────────────────────────────────────────────────────────

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum StudentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRANSFERRED = 'transferred',
  ALUMNI = 'alumni',
}

export enum ParentRelation {
  FATHER = 'father',
  MOTHER = 'mother',
  GUARDIAN = 'guardian',
}

export enum EnrollmentStatus {
  ACTIVE = 'active',
  TRANSFERRED = 'transferred',
  PROMOTED = 'promoted',
  DETAINED = 'detained',
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  HOLIDAY = 'holiday',
  HALF_DAY = 'half_day',
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMS / RESULTS
// ─────────────────────────────────────────────────────────────────────────────

export enum ExamType {
  UNIT_TEST = 'unit_test',
  MID_TERM = 'mid_term',
  FINAL = 'final',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
}

export enum ExamStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
}

export enum PromotionStatus {
  PROMOTED = 'promoted',
  DETAINED = 'detained',
  TRANSFERRED = 'transferred',
}

export enum TcReason {
  TRANSFER = 'transfer',
  COMPLETION = 'completion',
  EXPULSION = 'expulsion',
  WITHDRAWAL = 'withdrawal',
  OTHER = 'other',
}

export enum Conduct {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  SATISFACTORY = 'satisfactory',
  POOR = 'poor',
}

// ─────────────────────────────────────────────────────────────────────────────
// FEES / PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

export enum FeeHeadType {
  TUITION = 'tuition',
  TRANSPORT = 'transport',
  HOSTEL = 'hostel',
  LIBRARY = 'library',
  LAB = 'lab',
  OTHER = 'other',
}

export enum FeeFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
  YEARLY = 'yearly',
  ONE_TIME = 'one_time',
}

export enum ConcessionType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum FeeCollectionStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  WAIVED = 'waived',
}

export enum PaymentMode {
  CASH = 'cash',
  UPI = 'upi',
  CARD = 'card',
  NETBANKING = 'netbanking',
  CHEQUE = 'cheque',
  DD = 'dd',
  ONLINE = 'online',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF / TIMETABLE / LEAVE
// ─────────────────────────────────────────────────────────────────────────────

export enum StaffStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  RESIGNED = 'resigned',
  TERMINATED = 'terminated',
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
}

export enum LeaveType {
  CASUAL = 'casual',
  SICK = 'sick',
  EARNED = 'earned',
  UNPAID = 'unpaid',
  MATERNITY = 'maternity',
  OTHER = 'other',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY
// ─────────────────────────────────────────────────────────────────────────────

export enum BookIssueStatus {
  ISSUED = 'issued',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
  LOST = 'lost',
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSTEL
// ─────────────────────────────────────────────────────────────────────────────

export enum HostelRoomType {
  SINGLE = 'single',
  DOUBLE = 'double',
  DORMITORY = 'dormitory',
}

export enum HostelRoomStatus {
  AVAILABLE = 'available',
  FULL = 'full',
  MAINTENANCE = 'maintenance',
}

export enum HostelAllocationStatus {
  ACTIVE = 'active',
  VACATED = 'vacated',
}

// ─────────────────────────────────────────────────────────────────────────────
// USER INVITATION
// ─────────────────────────────────────────────────────────────────────────────

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

// ─────────────────────────────────────────────────────────────────────────────
// API ENVELOPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PAYLOADS
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  schoolSlug?: string;
}

export interface PinLoginRequest {
  userId: string;
  pin: string;
  schoolSlug: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | SuperadminRole;
  schoolId?: string;
  schoolSlug?: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;        // user id
  email: string;
  role: UserRole | SuperadminRole;
  schoolId?: string;
  schoolSlug?: string;
  type?: 'access' | 'refresh' | 'pin';
  iat?: number;
  exp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_FEATURES: Record<PlanName, string[]> = {
  [PlanName.STARTER]: ['attendance', 'fees', 'basic_reports', 'sms_alerts'],
  [PlanName.GROWTH]: [
    'attendance', 'fees', 'basic_reports', 'sms_alerts',
    'exams', 'parent_app', 'online_payments', 'library',
  ],
  [PlanName.PROFESSIONAL]: [
    'attendance', 'fees', 'basic_reports', 'sms_alerts',
    'exams', 'parent_app', 'online_payments', 'library',
    'transport', 'hostel', 'advanced_reports', 'api_access',
  ],
  [PlanName.ENTERPRISE]: [
    'attendance', 'fees', 'basic_reports', 'sms_alerts',
    'exams', 'parent_app', 'online_payments', 'library',
    'transport', 'hostel', 'advanced_reports', 'api_access',
    'custom_domain', 'sso', 'dedicated_support',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TENANT HEADER NAME
// ─────────────────────────────────────────────────────────────────────────────

export const TENANT_HEADER = 'x-school-slug';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const SHARED_POOL_SCHEMA = 'shared_pool';
export const RUPEE_TO_PAISE = 100;
