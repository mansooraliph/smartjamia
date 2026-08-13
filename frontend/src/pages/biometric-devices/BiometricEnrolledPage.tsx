import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Fingerprint, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { ENROLL_USER_TYPES, EnrollUserType } from '@/constants/biometric';
import { BiometricDevicesApi } from '@/services/biometric-devices.api';
import { ClassesApi, classLabel } from '@/services/school.api';

function fmt(dt?: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

const USER_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ENROLL_USER_TYPES.map((u) => [u.value, `${u.icon} ${u.label}`]),
);

const BIO_TYPE_LABEL: Record<string, string> = {
  FP: 'Fingerprint',
  FACE: 'Face',
  PALM: 'Palm',
  USERPIC: 'Photo',
  BIOPHOTO: 'Bio Photo',
};

export function BiometricEnrolledPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [userType, setUserType] = useState<EnrollUserType | ''>('');
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const classes = useQuery({
    queryKey: ['bio-enrolled-classes'],
    queryFn: () => ClassesApi.list(),
    enabled: userType === 'student',
    staleTime: 5 * 60 * 1000,
  });

  const setFilter = (patch: {
    search?: string;
    userType?: EnrollUserType | '';
    classId?: string;
    from?: string;
    to?: string;
  }) => {
    if ('search' in patch) setSearch(patch.search ?? '');
    if ('userType' in patch) {
      setUserType(patch.userType ?? '');
      setClassId(''); // class filter only makes sense for students
    }
    if ('classId' in patch) setClassId(patch.classId ?? '');
    if ('from' in patch) setFrom(patch.from ?? '');
    if ('to' in patch) setTo(patch.to ?? '');
    setPage(1);
  };

  const list = useQuery({
    queryKey: ['bio-enrolled', page, limit, search, userType, classId, from, to],
    queryFn: () =>
      BiometricDevicesApi.listEnrollments({
        page,
        limit,
        search: search || undefined,
        userType: userType || undefined,
        classId: userType === 'student' && classId ? classId : undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Enrolled List"
        description="Everyone whose biometric template has been captured or queued."
        actions={
          <button
            className="btn-secondary"
            onClick={() => navigate('/biometric-devices')}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </button>
        }
      />

      {/* Filters */}
      <div className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Search" className="lg:col-span-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setFilter({ search: e.target.value })}
              placeholder="Name or PIN…"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="User Type" className="lg:col-span-1">
          <Select
            value={userType}
            onChange={(e) =>
              setFilter({ userType: e.target.value as EnrollUserType | '' })
            }
          >
            <option value="">All types</option>
            {ENROLL_USER_TYPES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.icon} {u.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Class" className="lg:col-span-1">
          <Select
            value={classId}
            onChange={(e) => setFilter({ classId: e.target.value })}
            disabled={userType !== 'student'}
          >
            <option value="">All classes</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="From" className="lg:col-span-1">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFilter({ from: e.target.value })}
          />
        </Field>
        <Field label="To" className="lg:col-span-1">
          <Input
            type="date"
            value={to}
            onChange={(e) => setFilter({ to: e.target.value })}
          />
        </Field>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Biometric</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  <Fingerprint className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No enrollments match these filters.
                </td>
              </tr>
            ) : (
              items.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">
                      {e.name ?? '—'}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      {e.userCode}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {e.userType ? (USER_TYPE_LABEL[e.userType] ?? e.userType) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {e.className ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {BIO_TYPE_LABEL[e.type] ?? e.type}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {e.deviceAlias ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={e.status === 'enrolled' ? 'green' : 'amber'}>
                      {e.status === 'enrolled' ? 'Enrolled' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {fmt(e.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {list.data && (
        <Pagination
          page={page}
          totalPages={list.data.totalPages}
          total={list.data.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      )}
    </>
  );
}
