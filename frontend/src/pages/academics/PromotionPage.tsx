import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, GraduationCap, TriangleAlert } from 'lucide-react';
import {
  AcademicsApi,
  AcademicYearsApi,
  ClassesApi,
  classLabel,
  PromotionAction,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTerminology } from '@/hooks/useTerminology';

const ACTIONS: { value: PromotionAction; label: string }[] = [
  { value: 'promote', label: 'Promote' },
  { value: 'detain', label: 'Detain (repeat)' },
  { value: 'transfer', label: 'Transfer out' },
];

export function PromotionPage() {
  const qc = useQueryClient();
  const term = useTerminology();
  const [fromYearId, setFromYearId] = useState('');
  const [toYearId, setToYearId] = useState('');
  const [sourceClassId, setSourceClassId] = useState('');
  const [promoteToClassId, setPromoteToClassId] = useState('');
  const [promoteToSectionId, setPromoteToSectionId] = useState('');
  const [actions, setActions] = useState<Record<string, PromotionAction>>({});
  const [result, setResult] = useState<string | null>(null);

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });

  // Default from = current, to = the next year by start date.
  useEffect(() => {
    if (!years.length) return;
    const current = years.find((y) => y.isCurrent) ?? years[0];
    if (!fromYearId) setFromYearId(current.id);
    if (!toYearId) {
      const sorted = [...years].sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      );
      const next = sorted.find((y) => y.startDate > current.startDate);
      if (next) setToYearId(next.id);
    }
  }, [years, fromYearId, toYearId]);

  const { data: sourceClasses = [] } = useQuery({
    queryKey: ['promotion-source', fromYearId],
    queryFn: () => AcademicsApi.promotionSource(fromYearId),
    enabled: !!fromYearId,
  });

  const { data: toClasses = [] } = useQuery({
    queryKey: ['classes-with-sections', toYearId],
    queryFn: () => ClassesApi.listWithSections(toYearId),
    enabled: !!toYearId,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['promotion-class-students', fromYearId, sourceClassId],
    queryFn: () => AcademicsApi.classStudents(fromYearId, sourceClassId),
    enabled: !!fromYearId && !!sourceClassId,
  });

  // Reset selections when the batch context changes.
  useEffect(() => {
    setSourceClassId('');
  }, [fromYearId, toYearId]);
  useEffect(() => {
    setActions({});
    setPromoteToClassId('');
    setPromoteToSectionId('');
    setResult(null);
  }, [sourceClassId]);

  const sourceClass = sourceClasses.find((c) => c.id === sourceClassId);
  const promoteSections =
    toClasses.find((c) => c.id === promoteToClassId)?.sections ?? [];

  // Detain target = the to-year class with the same name; first section.
  const detainTarget = useMemo(() => {
    if (!sourceClass) return null;
    const cls = toClasses.find((c) => c.name === sourceClass.name);
    if (!cls) return null;
    return { cls, section: cls.sections?.[0] ?? null };
  }, [sourceClass, toClasses]);

  const actionOf = (id: string): PromotionAction => actions[id] ?? 'promote';
  const counts = useMemo(() => {
    const c = { promote: 0, detain: 0, transfer: 0 };
    students.forEach((s) => c[actionOf(s.id)]++);
    return c;
  }, [students, actions]);

  const promote = useMutation({
    mutationFn: () => {
      const decisions = students.map((s) => {
        const action = actionOf(s.id);
        if (action === 'promote') {
          return {
            studentId: s.id,
            action,
            toClassId: promoteToClassId,
            toSectionId: promoteToSectionId,
            rollNumber: s.rollNumber ?? undefined,
          };
        }
        if (action === 'detain') {
          return {
            studentId: s.id,
            action,
            toClassId: detainTarget?.cls.id,
            toSectionId: detainTarget?.section?.id,
            rollNumber: s.rollNumber ?? undefined,
          };
        }
        return { studentId: s.id, action };
      });
      return AcademicsApi.promote({
        fromAcademicYearId: fromYearId,
        toAcademicYearId: toYearId,
        decisions,
      });
    },
    onSuccess: (r) => {
      setResult(
        `Done — ${r.promoted} promoted, ${r.detained} detained, ${r.transferred} transferred.`,
      );
      qc.invalidateQueries({ queryKey: ['promotion-source'] });
      qc.invalidateQueries({ queryKey: ['promotion-class-students'] });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const sameYear = fromYearId && toYearId && fromYearId === toYearId;
  const needPromoteTarget = counts.promote > 0;
  const promoteReady =
    !needPromoteTarget || (!!promoteToClassId && !!promoteToSectionId);
  const detainBlocked = counts.detain > 0 && !detainTarget?.section;
  const canExecute =
    !!sourceClassId &&
    students.length > 0 &&
    !sameYear &&
    promoteReady &&
    !detainBlocked &&
    !promote.isPending;

  return (
    <>
      <PageHeader
        title="Promotion"
        description="Move students to the next academic year — promote, detain, or transfer out, class by class."
      />

      {/* Year selectors */}
      <div className="mb-5 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            From year
          </label>
          <Select
            className="!w-48"
            value={fromYearId}
            onChange={(e) => setFromYearId(e.target.value)}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.isCurrent ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        </div>
        <ArrowRight className="mb-2 h-5 w-5 text-slate-400" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            To year
          </label>
          <Select
            className="!w-48"
            value={toYearId}
            onChange={(e) => setToYearId(e.target.value)}
          >
            <option value="">— Select —</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {sameYear && (
        <Notice tone="red">
          Source and target years must be different.
        </Notice>
      )}
      {!toYearId && !sameYear && (
        <Notice tone="amber">
          Pick a target year. Create the next academic year and its{' '}
          {term.levelPlural.toLowerCase()} first if it doesn’t exist yet.
        </Notice>
      )}

      {/* Source class picker */}
      {!!fromYearId && (
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Source {term.level.toLowerCase()}
          </div>
          <div className="flex flex-wrap gap-2">
            {sourceClasses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSourceClassId(c.id)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  sourceClassId === c.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {classLabel(c)}{' '}
                <Badge tone="slate" className="ml-1">
                  {c.activeStudents}
                </Badge>
              </button>
            ))}
            {sourceClasses.length === 0 && (
              <span className="text-sm text-slate-400">
                No {term.levelPlural.toLowerCase()} with active students in this
                year.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Promotion table for the selected class */}
      {!!sourceClassId && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end gap-4 border-b border-slate-100 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Promote to ({term.level.toLowerCase()})
              </label>
              <Select
                className="!w-44"
                value={promoteToClassId}
                onChange={(e) => {
                  setPromoteToClassId(e.target.value);
                  setPromoteToSectionId('');
                }}
              >
                <option value="">— Select —</option>
                {toClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {term.group}
              </label>
              <Select
                className="!w-32"
                value={promoteToSectionId}
                onChange={(e) => setPromoteToSectionId(e.target.value)}
                disabled={!promoteToClassId}
              >
                <option value="">— Select —</option>
                {promoteSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="text-xs text-slate-500">
              Detain →{' '}
              {detainTarget ? (
                <span className="font-medium text-slate-700">
                  {detainTarget.cls.name} /{' '}
                  {detainTarget.section?.name ?? '⚠ no section'}
                </span>
              ) : (
                <span className="text-amber-600">
                  no “{sourceClass?.name}” in target year
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {counts.promote} promote · {counts.detain} detain ·{' '}
                {counts.transfer} transfer
              </span>
              <button
                className="btn-primary"
                disabled={!canExecute}
                onClick={() => promote.mutate()}
              >
                <GraduationCap className="mr-1.5 h-4 w-4" />
                {promote.isPending ? 'Processing…' : 'Execute'}
              </button>
            </div>
          </div>

          {detainBlocked && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              Some students are set to detain but the target year has no matching
              class/section. Create it or change those actions.
            </div>
          )}
          {result && (
            <div className="border-b border-green-100 bg-green-50 px-4 py-2 text-sm text-green-700">
              {result}
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2 font-medium">Roll</th>
                <th className="px-4 py-2 font-medium">Admission #</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {studentsLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!studentsLoading &&
                students.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-500">
                      {s.rollNumber ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">{s.admissionNumber}</code>
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {s.studentName}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        className="!w-40"
                        value={actionOf(s.id)}
                        onChange={(e) =>
                          setActions((prev) => ({
                            ...prev,
                            [s.id]: e.target.value as PromotionAction,
                          }))
                        }
                      >
                        {ACTIONS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: 'amber' | 'red';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}
    >
      <TriangleAlert className="h-4 w-4" /> {children}
    </div>
  );
}
