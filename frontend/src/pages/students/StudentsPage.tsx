import { useEffect, useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  FileText,
  Users,
  Upload,
  UserPlus,
  UserCheck,
  KeyRound,
} from 'lucide-react';
import {
  AcademicYearsApi,
  ClassesApi,
  classLabel,
  ExportFormat,
  SectionsApi,
  Student,
  StudentsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';
import {
  ImportStudentsModal,
  BulkAssignModal,
} from './StudentBulkModals';
import { PortalPinModal } from '@/components/shared/PortalPinModal';
import { useTerminology } from '@/hooks/useTerminology';
import { usePermissions } from '@/hooks/usePermissions';

const GENDERS = ['male', 'female', 'other'] as const;
const STUDENT_STATUSES = ['active', 'inactive', 'transferred', 'alumni'] as const;

const schema = z
  .object({
    admissionNumber: z.string().min(1, 'Required'),
    firstName: z.string().min(1, 'Required'),
    lastName: z.string().min(1, 'Required'),
    dateOfBirth: z.string().min(1, 'Required'),
    gender: z.enum(GENDERS),
    bloodGroup: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    pincode: z.string().optional().or(z.literal('')),
    previousSchool: z.string().optional().or(z.literal('')),
    admissionDate: z.string().min(1, 'Required'),
    status: z.enum(STUDENT_STATUSES),
    academicYearId: z.string().optional().or(z.literal('')),
    classId: z.string().optional().or(z.literal('')),
    sectionId: z.string().optional().or(z.literal('')),
    rollNumber: z.string().optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    // Section is optional; year + class are required once any enrollment field
    // is touched. (A section without a class makes no sense, so flag that too.)
    const any = v.academicYearId || v.classId || v.sectionId;
    if (!any) return;
    if (!v.academicYearId)
      ctx.addIssue({
        path: ['academicYearId'],
        code: z.ZodIssueCode.custom,
        message: 'Required for enrollment',
      });
    if (!v.classId)
      ctx.addIssue({
        path: ['classId'],
        code: z.ZodIssueCode.custom,
        message: 'Required for enrollment',
      });
  });
type FormValues = z.infer<typeof schema>;

const statusTone: Record<Student['status'], 'green' | 'slate' | 'amber' | 'blue'> = {
  active: 'green',
  inactive: 'slate',
  transferred: 'amber',
  alumni: 'blue',
};

export function StudentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const term = useTerminology();
  const { can } = usePermissions();
  const canCreate = can('/students', 'create');
  const canDelete = can('/students', 'delete');
  const canWrite = canCreate || canDelete;
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Reset to the first page whenever the filters or search change.
  useEffect(() => {
    setPage(1);
  }, [search, yearFilter, classFilter, sectionFilter, limit]);

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });

  const effectiveYearId = useMemo(() => {
    if (yearFilter) return yearFilter;
    return years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? '';
  }, [yearFilter, years]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', effectiveYearId],
    queryFn: () => ClassesApi.list(effectiveYearId || undefined),
    enabled: !!effectiveYearId,
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ['sections-all'],
    queryFn: () => SectionsApi.list(),
  });

  const filteredSections = useMemo(
    () =>
      classFilter
        ? allSections.filter((s) => s.classId === classFilter)
        : allSections,
    [classFilter, allSections],
  );

  const listParams = {
    page,
    limit,
    search: search || undefined,
    academicYearId: effectiveYearId || undefined,
    classId: classFilter || undefined,
    sectionId: sectionFilter || undefined,
  };

  const { data: pageData, isLoading } = useQuery({
    queryKey: [
      'students',
      page,
      limit,
      search,
      effectiveYearId,
      classFilter,
      sectionFilter,
    ],
    queryFn: () => StudentsApi.list(listParams),
    placeholderData: keepPreviousData,
  });
  const students = pageData?.items ?? [];

  const [modal, setModal] = useState<{ open: boolean; student?: Student }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; student?: Student }>(
    { open: false },
  );
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pinModal, setPinModal] = useState<{ open: boolean; student?: Student }>(
    { open: false },
  );

  const setPin = useMutation({
    mutationFn: (v: { id: string; pin: string }) =>
      StudentsApi.setPin(v.id, v.pin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      setPinModal({ open: false });
    },
  });
  const removePin = useMutation({
    mutationFn: (id: string) => StudentsApi.removePin(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      setPinModal({ open: false });
    },
  });

  // Suggest the next admission number when admitting a new student.
  const { data: nextAdm } = useQuery({
    queryKey: ['next-admission-number', modal.open],
    queryFn: StudentsApi.nextAdmissionNumber,
    enabled: modal.open && !modal.student,
  });

  const upsert = useMutation({
    mutationFn: (v: { id?: string; payload: Record<string, unknown> }) =>
      v.id
        ? StudentsApi.update(v.id, v.payload)
        : StudentsApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => StudentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setConfirm({ open: false });
    },
  });

  const classMap = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, classLabel(c)])),
    [classes],
  );
  const sectionMap = useMemo(
    () => Object.fromEntries(allSections.map((s) => [s.id, s.name])),
    [allSections],
  );

  return (
    <>
      <PageHeader
        title="Students"
        description="Admission records and enrollments. Search by name or admission number."
        actions={
          <div className="flex items-center gap-2">
            <ExportButtons
              onExport={(format: ExportFormat) =>
                StudentsApi.export(format, {
                  search: search || undefined,
                  academicYearId: effectiveYearId || undefined,
                  classId: classFilter || undefined,
                  sectionId: sectionFilter || undefined,
                })
              }
            />
            {canCreate && (
              <>
                <button
                  className="btn-secondary"
                  onClick={() => setBulkOpen(true)}
                  disabled={years.length === 0}
                  title={`Assign many students to a ${term.level.toLowerCase()}`}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" /> Bulk assign
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setImportOpen(true)}
                  disabled={years.length === 0}
                  title="Import students from Excel"
                >
                  <Upload className="mr-1.5 h-4 w-4" /> Import
                </button>
                <button
                  className="btn-primary"
                  onClick={() => navigate('/students/new')}
                  disabled={years.length === 0}
                  title={
                    years.length === 0
                      ? 'Create an academic year first'
                      : 'Enroll a new student'
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add student
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by name or admission #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          className="!w-44"
          value={effectiveYearId}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </Select>
        <Select
          className="!w-44"
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value);
            setSectionFilter('');
          }}
        >
          <option value="">All {term.levelPlural.toLowerCase()}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c)}
            </option>
          ))}
        </Select>
        <Select
          className="!w-32"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          disabled={!classFilter}
        >
          <option value="">All {term.groupPlural.toLowerCase()}</option>
          {filteredSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable<Student>
        rows={students}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No students yet."
        columns={[
          {
            key: 'admissionNumber',
            header: 'Adm #',
            render: (s) => (
              <code className="text-xs font-medium text-slate-700">
                {s.admissionNumber}
              </code>
            ),
          },
          {
            key: 'name',
            header: 'Name',
            render: (s) => (
              <div className="leading-tight">
                <button
                  className="font-medium text-slate-900 hover:text-brand-600 hover:underline"
                  onClick={() => navigate(`/students/${s.id}`)}
                  title="View profile"
                >
                  {s.firstName} {s.lastName}
                </button>
                <div className="text-xs text-slate-500 capitalize">
                  {s.gender}
                </div>
              </div>
            ),
          },
          {
            key: 'class',
            header: `${term.level} · ${term.group}`,
            render: (s) =>
              s.enrollment ? (
                <span className="text-sm">
                  <Badge tone="blue">
                    {classMap[s.enrollment.classId] ?? '—'}
                  </Badge>{' '}
                  <Badge tone="slate">
                    {sectionMap[s.enrollment.sectionId] ?? '—'}
                  </Badge>
                </span>
              ) : (
                <span className="text-slate-400">Not enrolled</span>
              ),
          },
          {
            key: 'roll',
            header: 'Roll',
            render: (s) => s.enrollment?.rollNumber ?? '—',
          },
          {
            key: 'dob',
            header: 'DOB',
            render: (s) => formatDate(s.dateOfBirth),
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge>,
          },
        ]}
        actions={
          !canWrite
            ? undefined
            : (s) => (
          <>
            {canCreate && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                onClick={() => navigate(`/students/${s.id}/edit`)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
              onClick={() => navigate(`/parents?student=${s.id}`)}
              title="Parents & guardians"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-600"
              onClick={() => navigate(`/visitors?student=${s.id}`)}
              title="Visitors"
            >
              <UserCheck className="h-4 w-4" />
            </button>
            <button
              className={`rounded-md p-1.5 hover:bg-slate-100 ${
                s.userId
                  ? 'text-green-600'
                  : 'text-slate-500 hover:text-brand-600'
              }`}
              onClick={() => setPinModal({ open: true, student: s })}
              title={s.userId ? 'Portal access enabled' : 'Set portal PIN'}
            >
              <KeyRound className="h-4 w-4" />
            </button>
            {s.status === 'active' && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                onClick={() =>
                  navigate(`/transfer-certificates?student=${s.id}`)
                }
                title="Issue Transfer Certificate"
              >
                <FileText className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setConfirm({ open: true, student: s })}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      />

      {pageData && (
        <Pagination
          page={pageData.page}
          totalPages={pageData.totalPages}
          total={pageData.total}
          limit={pageData.limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      <PortalPinModal
        open={pinModal.open}
        onClose={() => setPinModal({ open: false })}
        subject={
          pinModal.student
            ? `${pinModal.student.firstName} ${pinModal.student.lastName}`
            : ''
        }
        loginHint={`Logs in with admission # ${pinModal.student?.admissionNumber ?? ''}`}
        hasAccess={!!pinModal.student?.userId}
        busy={setPin.isPending || removePin.isPending}
        error={errMsg(setPin.error)}
        onSet={(pin) =>
          pinModal.student && setPin.mutate({ id: pinModal.student.id, pin })
        }
        onRevoke={() =>
          pinModal.student && removePin.mutate(pinModal.student.id)
        }
      />

      <ImportStudentsModal
        open={importOpen}
        years={years.map((y) => ({
          id: y.id,
          name: y.name,
          isCurrent: y.isCurrent,
        }))}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['students'] });
          qc.invalidateQueries({ queryKey: ['school-stats'] });
        }}
      />

      <BulkAssignModal
        open={bulkOpen}
        years={years.map((y) => ({
          id: y.id,
          name: y.name,
          isCurrent: y.isCurrent,
        }))}
        onClose={() => setBulkOpen(false)}
        onAssigned={() => qc.invalidateQueries({ queryKey: ['students'] })}
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.student && remove.mutate(confirm.student.id)}
        loading={remove.isPending}
        title="Delete student?"
        message={`Soft-delete ${confirm.student?.firstName} ${confirm.student?.lastName}. Records remain in the database for compliance.`}
        confirmText="Delete student"
      />
    </>
  );
}


function errMsg(e: unknown): string | undefined {
  if (!e) return undefined;
  const anyE = e as any;
  return (
    anyE?.response?.data?.error?.message ??
    anyE?.message ??
    'Something went wrong'
  );
}
