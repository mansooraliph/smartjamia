import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCheck,
  Save,
  X,
  Clock,
  Sun,
  CircleSlash,
} from 'lucide-react';
import {
  AcademicYearsApi,
  AttendanceApi,
  AttendanceStatus,
  ClassesApi,
  classLabel,
  SectionAttendanceRow,
  SectionsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { useTerminology } from '@/hooks/useTerminology';
import { cn } from '@/lib/cn';

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'slate'; icon: typeof Check }
> = {
  present: { label: 'Present', tone: 'green', icon: Check },
  absent: { label: 'Absent', tone: 'red', icon: X },
  late: { label: 'Late', tone: 'amber', icon: Clock },
  half_day: { label: 'Half Day', tone: 'blue', icon: Sun },
  holiday: { label: 'Holiday', tone: 'slate', icon: CircleSlash },
};

const STATUS_BUTTONS: AttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'half_day',
  'holiday',
];

export function AttendancePage() {
  const qc = useQueryClient();
  const term = useTerminology();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });

  const effectiveYearId = useMemo(() => {
    if (yearId) return yearId;
    return years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? '';
  }, [yearId, years]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', effectiveYearId],
    queryFn: () => ClassesApi.list(effectiveYearId || undefined),
    enabled: !!effectiveYearId,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', classId],
    queryFn: () => SectionsApi.list(classId || undefined),
    enabled: !!classId,
  });

  // Auto-select first section when class changes
  useEffect(() => {
    if (sections.length > 0 && !sections.find((s) => s.id === sectionId)) {
      setSectionId(sections[0].id);
    } else if (sections.length === 0) {
      setSectionId('');
    }
  }, [sections, sectionId]);

  const { data: sectionAtt, isLoading } = useQuery({
    queryKey: ['attendance', sectionId, date],
    queryFn: () => AttendanceApi.getSection(sectionId, date),
    enabled: !!sectionId && !!date,
  });

  // Sync server state into local statuses when data changes
  useEffect(() => {
    if (!sectionAtt) return;
    const init: Record<string, AttendanceStatus> = {};
    for (const r of sectionAtt.rows) {
      init[r.studentId] = (r.status as AttendanceStatus) ?? 'present';
    }
    setStatuses(init);
  }, [sectionAtt]);

  const save = useMutation({
    mutationFn: () => {
      if (!sectionId || !effectiveYearId) throw new Error('missing context');
      const entries = (sectionAtt?.rows ?? []).map((r) => ({
        studentId: r.studentId,
        status: statuses[r.studentId] ?? 'present',
      }));
      return AttendanceApi.bulkMark({
        sectionId,
        academicYearId: effectiveYearId,
        date,
        entries,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', sectionId, date] });
    },
  });

  const markAll = (s: AttendanceStatus) => {
    if (!sectionAtt) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const r of sectionAtt.rows) next[r.studentId] = s;
    setStatuses(next);
  };

  const setStatus = (studentId: string, s: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: s }));
  };

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      half_day: 0,
      holiday: 0,
    };
    for (const s of Object.values(statuses)) c[s]++;
    return c;
  }, [statuses]);

  const total = sectionAtt?.rows.length ?? 0;
  const dirty = useMemo(() => {
    if (!sectionAtt) return false;
    for (const r of sectionAtt.rows) {
      if ((r.status ?? 'present') !== (statuses[r.studentId] ?? 'present')) {
        return true;
      }
    }
    return false;
  }, [statuses, sectionAtt]);

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`Mark daily attendance per ${term.group.toLowerCase()}. Defaults today + current academic year.`}
        actions={
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || total === 0}
            title={
              total === 0
                ? `No students enrolled in this ${term.group.toLowerCase()}`
                : dirty
                  ? 'Save attendance'
                  : 'Nothing changed'
            }
          >
            <Save className="mr-1.5 h-4 w-4" />
            {save.isPending ? 'Saving…' : 'Save attendance'}
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          className="!w-44"
          value={effectiveYearId}
          onChange={(e) => setYearId(e.target.value)}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </Select>
        <Select
          className="!w-44"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSectionId('');
          }}
        >
          <option value="">Select {term.level.toLowerCase()}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c)}
            </option>
          ))}
        </Select>
        <Select
          className="!w-32"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          disabled={!classId || sections.length === 0}
        >
          {sections.length === 0 ? (
            <option value="">— No {term.groupPlural.toLowerCase()} —</option>
          ) : (
            sections.map((s) => (
              <option key={s.id} value={s.id}>
                {term.group} {s.name}
              </option>
            ))
          )}
        </Select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Empty states */}
      {!sectionId ? (
        <div className="card p-8 text-center text-slate-500">
          Pick a {term.level.toLowerCase()} and {term.group.toLowerCase()} to
          mark attendance.
        </div>
      ) : isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : total === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No students enrolled in this {term.group.toLowerCase()} yet.{' '}
          <a href="/students" className="text-brand-600 hover:underline">
            Add students →
          </a>
        </div>
      ) : (
        <>
          {/* Summary + bulk actions */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-700">
                {sectionAtt?.className} · {term.group} {sectionAtt?.sectionName}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{total} students</span>
            </div>
            <div className="flex items-center gap-1.5">
              {STATUS_BUTTONS.map((s) => (
                <Badge key={s} tone={STATUS_META[s].tone}>
                  {STATUS_META[s].label} {counts[s]}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => markAll('present')}
                className="btn bg-green-100 text-green-700 hover:bg-green-200 text-xs px-3 py-1.5"
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" /> All present
              </button>
              <button
                onClick={() => markAll('absent')}
                className="btn bg-red-100 text-red-700 hover:bg-red-200 text-xs px-3 py-1.5"
              >
                <X className="mr-1 h-3.5 w-3.5" /> All absent
              </button>
              <button
                onClick={() => markAll('holiday')}
                className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs px-3 py-1.5"
              >
                <CircleSlash className="mr-1 h-3.5 w-3.5" /> All holiday
              </button>
            </div>
          </div>

          {/* Student list */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">
                    Roll
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-32">
                    Adm #
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sectionAtt?.rows.map((row) => (
                  <StudentRow
                    key={row.studentId}
                    row={row}
                    value={statuses[row.studentId] ?? 'present'}
                    onChange={(s) => setStatus(row.studentId, s)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {save.isSuccess && !dirty && (
            <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              ✓ Saved {save.data?.saved} attendance records.
            </div>
          )}
          {save.error && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errMsg(save.error)}
            </div>
          )}
        </>
      )}
    </>
  );
}

function StudentRow({
  row,
  value,
  onChange,
}: {
  row: SectionAttendanceRow;
  value: AttendanceStatus;
  onChange: (s: AttendanceStatus) => void;
}) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-sm font-medium text-slate-700">
        {row.rollNumber ?? '—'}
      </td>
      <td className="px-4 py-3">
        <div className="leading-tight">
          <div className="font-medium text-slate-900">
            {row.firstName} {row.lastName}
          </div>
          {row.status === null && (
            <div className="text-[10px] uppercase tracking-wider text-amber-600">
              Not yet marked
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <code className="text-xs text-slate-600">{row.admissionNumber}</code>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {STATUS_BUTTONS.map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            const active = value === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                title={meta.label}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                  active
                    ? toneActive(meta.tone)
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{shortLabel(s)}</span>
              </button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

function shortLabel(s: AttendanceStatus): string {
  switch (s) {
    case 'present':
      return 'P';
    case 'absent':
      return 'A';
    case 'late':
      return 'L';
    case 'half_day':
      return 'H';
    case 'holiday':
      return 'Hol';
  }
}

function toneActive(tone: 'green' | 'red' | 'amber' | 'blue' | 'slate') {
  switch (tone) {
    case 'green':
      return 'border-green-300 bg-green-100 text-green-800';
    case 'red':
      return 'border-red-300 bg-red-100 text-red-800';
    case 'amber':
      return 'border-amber-300 bg-amber-100 text-amber-800';
    case 'blue':
      return 'border-blue-300 bg-blue-100 text-blue-800';
    case 'slate':
      return 'border-slate-300 bg-slate-200 text-slate-800';
  }
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
