import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock } from 'lucide-react';
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

export function BiometricTransactionsPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [deviceSn, setDeviceSn] = useState('');
  const [userType, setUserType] = useState<EnrollUserType | ''>('');
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const devices = useQuery({
    queryKey: ['bio-tx-devices'],
    queryFn: BiometricDevicesApi.listDevices,
  });
  const classes = useQuery({
    queryKey: ['bio-tx-classes'],
    queryFn: () => ClassesApi.list(),
    enabled: userType === 'student',
    staleTime: 5 * 60 * 1000,
  });

  const filters = { deviceSn, userType, classId, from, to };
  const setFilter = (patch: Partial<typeof filters>) => {
    if ('deviceSn' in patch) setDeviceSn(patch.deviceSn ?? '');
    if ('userType' in patch) {
      setUserType((patch.userType as EnrollUserType | '') ?? '');
      setClassId(''); // class filter only makes sense for students
    }
    if ('classId' in patch) setClassId(patch.classId ?? '');
    if ('from' in patch) setFrom(patch.from ?? '');
    if ('to' in patch) setTo(patch.to ?? '');
    setPage(1);
  };

  const tx = useQuery({
    queryKey: ['bio-tx', page, limit, deviceSn, userType, classId, from, to],
    queryFn: () =>
      BiometricDevicesApi.listTransactions({
        page,
        limit,
        deviceSn: deviceSn || undefined,
        userType: userType || undefined,
        classId: userType === 'student' && classId ? classId : undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const items = tx.data?.items ?? [];
  const deviceOptions = useMemo(
    () =>
      (devices.data ?? []).map((d) => ({
        sn: d.sn,
        label: d.alias || d.sn,
      })),
    [devices.data],
  );

  return (
    <>
      <PageHeader
        title="Transaction Report"
        description="Attendance punches captured across all biometric devices."
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
      <div className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Device" className="lg:col-span-1">
          <Select
            value={deviceSn}
            onChange={(e) => setFilter({ deviceSn: e.target.value })}
          >
            <option value="">All devices</option>
            {deviceOptions.map((d) => (
              <option key={d.sn} value={d.sn}>
                {d.label}
              </option>
            ))}
          </Select>
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
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tx.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  <Clock className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No punches match these filters.
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {fmt(t.punchTime)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">
                      {t.userName ?? '—'}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      {t.userCode}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {t.userType ? (USER_TYPE_LABEL[t.userType] ?? t.userType) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{t.deviceAlias}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={t.punchState === 1 ? 'amber' : 'green'}>
                      {t.punchStateDisplay}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {tx.data && (
        <Pagination
          page={page}
          totalPages={tx.data.totalPages}
          total={tx.data.total}
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
