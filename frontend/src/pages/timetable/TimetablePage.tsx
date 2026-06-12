import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Printer, Save, Trash2, Wand2 } from 'lucide-react';
import {
  AcademicYearsApi,
  ClassesApi,
  classLabel,
  DayOfWeek,
  SectionsApi,
  TeacherSchedule,
  TimetableApi,
  TimetableEditorGrid,
  TimetablePeriod,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Input';
import { useTerminology } from '@/hooks/useTerminology';
import { useAuthStore } from '@/stores/auth.store';
import { isAdminRole } from '@/lib/access';
import { cn } from '@/lib/cn';

const DAY_LABEL: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

type CellState = { subjectId: string; staffId: string };
const cellKey = (d: DayOfWeek, p: number) => `${d}:${p}`;

export function TimetablePage() {
  const role = useAuthStore((s) => s.user?.role);
  if (!isAdminRole(role)) return <MySchedule />;
  return <TimetableEditor />;
}

// ───── Admin editor ───────────────────────────────────────────────────────────
function TimetableEditor() {
  const qc = useQueryClient();
  const term = useTerminology();
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [snapshot, setSnapshot] = useState('');

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });
  const effectiveYearId = useMemo(
    () => yearId || years.find((y) => y.isCurrent)?.id || years[0]?.id || '',
    [yearId, years],
  );

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
  useEffect(() => {
    if (sections.length && !sections.find((s) => s.id === sectionId)) {
      setSectionId(sections[0].id);
    } else if (!sections.length) setSectionId('');
  }, [sections, sectionId]);

  const { data: grid, isLoading } = useQuery<TimetableEditorGrid>({
    queryKey: ['timetable', sectionId, effectiveYearId],
    queryFn: () => TimetableApi.grid(sectionId, effectiveYearId),
    enabled: !!sectionId && !!effectiveYearId,
  });

  // Hydrate local state from server.
  useEffect(() => {
    if (!grid) return;
    const c: Record<string, CellState> = {};
    for (const [k, v] of Object.entries(grid.cells)) {
      c[k] = { subjectId: v.subjectId, staffId: v.staffId ?? '' };
    }
    setPeriods(grid.periods.map((p) => ({ ...p })));
    setCells(c);
    setSnapshot(serialize(grid.periods, c));
  }, [grid]);

  const dirty = useMemo(
    () => serialize(periods, cells) !== snapshot,
    [periods, cells, snapshot],
  );

  const save = useMutation({
    mutationFn: () => {
      const payloadCells = [];
      for (const p of periods) {
        for (const d of grid!.days) {
          const cell = cells[cellKey(d, p.periodNumber)];
          if (cell?.subjectId) {
            payloadCells.push({
              dayOfWeek: d,
              periodNumber: p.periodNumber,
              subjectId: cell.subjectId,
              staffId: cell.staffId || null,
            });
          }
        }
      }
      return TimetableApi.save({
        sectionId,
        academicYearId: effectiveYearId,
        periods,
        cells: payloadCells,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['timetable', sectionId, effectiveYearId] }),
  });

  // ── period helpers ──
  const addPeriod = () => {
    const last = periods[periods.length - 1];
    const next = last ? last.periodNumber + 1 : 1;
    const start = last ? addMinutes(last.endTime, 5) : '09:00';
    setPeriods([
      ...periods,
      { periodNumber: next, startTime: start, endTime: addMinutes(start, 45) },
    ]);
  };
  const quickStart = () => {
    const out: TimetablePeriod[] = [];
    let start = '09:00';
    for (let i = 1; i <= 6; i++) {
      const end = addMinutes(start, 45);
      out.push({ periodNumber: i, startTime: start, endTime: end });
      start = addMinutes(end, i === 3 ? 20 : 5); // longer break after P3
    }
    setPeriods(out);
  };
  const removePeriod = (n: number) => {
    setPeriods(periods.filter((p) => p.periodNumber !== n));
    setCells((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (k.endsWith(`:${n}`)) delete next[k];
      return next;
    });
  };
  const setPeriodTime = (n: number, field: 'startTime' | 'endTime', v: string) =>
    setPeriods((prev) =>
      prev.map((p) => (p.periodNumber === n ? { ...p, [field]: v } : p)),
    );

  const setCell = (d: DayOfWeek, p: number, patch: Partial<CellState>) =>
    setCells((prev) => {
      const k = cellKey(d, p);
      const cur = prev[k] ?? { subjectId: '', staffId: '' };
      const merged = { ...cur, ...patch };
      // Clearing the subject clears the teacher too.
      if (patch.subjectId === '') merged.staffId = '';
      return { ...prev, [k]: merged };
    });

  const copyDayToAll = (src: DayOfWeek) => {
    if (!grid) return;
    setCells((prev) => {
      const next = { ...prev };
      for (const p of periods) {
        const srcCell = prev[cellKey(src, p.periodNumber)];
        for (const d of grid.days) {
          if (d === src) continue;
          next[cellKey(d, p.periodNumber)] = srcCell
            ? { ...srcCell }
            : { subjectId: '', staffId: '' };
        }
      }
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title="Timetable"
        description="Pick a section, set period times, then fill subjects & teachers. Students, parents & teachers see it instantly."
        actions={
          <div className="flex items-center gap-2">
            {grid && periods.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => printEditorTimetable(grid, periods, cells)}
                title={dirty ? 'Prints the current on-screen timetable' : undefined}
              >
                <Printer className="mr-1.5 h-4 w-4" /> Print / PDF
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => save.mutate()}
              disabled={!sectionId || !dirty || save.isPending || !periods.length}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {save.isPending ? 'Saving…' : 'Save timetable'}
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select className="!w-40" value={effectiveYearId} onChange={(e) => setYearId(e.target.value)}>
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </Select>
        <Select
          className="!w-40"
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}
        >
          <option value="">Select {term.level.toLowerCase()}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{classLabel(c)}</option>
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
              <option key={s.id} value={s.id}>{term.group} {s.name}</option>
            ))
          )}
        </Select>
      </div>

      {!sectionId ? (
        <div className="card p-8 text-center text-slate-500">
          Pick a {term.level.toLowerCase()} and {term.group.toLowerCase()} to build its timetable.
        </div>
      ) : isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : grid && grid.subjects.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No subjects defined for {grid.className}.{' '}
          <a href="/subjects" className="text-brand-600 hover:underline">Add subjects →</a>
        </div>
      ) : periods.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <div className="text-slate-500">No periods set up yet for this section.</div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={quickStart}>
              <Wand2 className="mr-1.5 h-4 w-4" /> Quick start (6 periods)
            </button>
            <button className="btn-secondary" onClick={addPeriod}>
              <Plus className="mr-1.5 h-4 w-4" /> Add a period
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Editing <span className="font-medium text-slate-700">{grid?.className} {term.group} {grid?.section.name}</span>
            </span>
            <span className="text-slate-300">·</span>
            <button onClick={addPeriod} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">
              <Plus className="h-3.5 w-3.5" /> Add period
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Period
                  </th>
                  {grid?.days.map((d) => (
                    <th key={d} className="border-b border-l border-slate-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <div className="flex items-center justify-center gap-1">
                        {DAY_LABEL[d]}
                        <button
                          title={`Copy ${DAY_LABEL[d]} to all days`}
                          onClick={() => copyDayToAll(d)}
                          className="text-slate-300 hover:text-brand-500"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.periodNumber} className="align-top">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2">
                      <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                        P{p.periodNumber}
                        <button
                          onClick={() => removePeriod(p.periodNumber)}
                          title="Remove period"
                          className="text-slate-300 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="time"
                          value={p.startTime}
                          onChange={(e) => setPeriodTime(p.periodNumber, 'startTime', e.target.value)}
                          className="w-[5.5rem] rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                        <span className="text-slate-300">–</span>
                        <input
                          type="time"
                          value={p.endTime}
                          onChange={(e) => setPeriodTime(p.periodNumber, 'endTime', e.target.value)}
                          className="w-[5.5rem] rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      </div>
                    </td>
                    {grid?.days.map((d) => {
                      const cell = cells[cellKey(d, p.periodNumber)] ?? { subjectId: '', staffId: '' };
                      return (
                        <td key={d} className="border-b border-l border-slate-100 px-2 py-2">
                          <select
                            value={cell.subjectId}
                            onChange={(e) => setCell(d, p.periodNumber, { subjectId: e.target.value })}
                            className={cn(
                              'w-full rounded border px-1.5 py-1 text-xs',
                              cell.subjectId
                                ? 'border-brand-200 bg-brand-50/40 font-medium text-slate-800'
                                : 'border-slate-200 text-slate-400',
                            )}
                          >
                            <option value="">— free —</option>
                            {grid.subjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.code ? `${s.code} · ${s.name}` : s.name}
                              </option>
                            ))}
                          </select>
                          {cell.subjectId && (
                            <select
                              value={cell.staffId}
                              onChange={(e) => setCell(d, p.periodNumber, { staffId: e.target.value })}
                              className="mt-1 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-600"
                            >
                              <option value="">— teacher —</option>
                              {grid.teachers.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {save.isSuccess && !dirty && (
            <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              ✓ Timetable saved ({save.data?.saved} slots).
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

// ───── Teacher: my schedule (read-only) ───────────────────────────────────────
function MySchedule() {
  const teacherName = useAuthStore((s) => s.user?.name) ?? null;
  const { data, isLoading } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: TimetableApi.mySchedule,
  });

  const byKey = useMemo(() => {
    const m = new Map<string, { subject: string; code: string; section: string }>();
    for (const s of data?.slots ?? []) m.set(`${s.dayOfWeek}:${s.periodNumber}`, s);
    return m;
  }, [data]);

  const canPrint = !!data?.isTeacher && data.periods.length > 0;

  return (
    <>
      <PageHeader
        title="My Timetable"
        description="Your weekly teaching schedule."
        actions={
          canPrint ? (
            <button
              className="btn-secondary"
              onClick={() => printTeacherSchedule(data, teacherName)}
            >
              <Printer className="mr-1.5 h-4 w-4" /> Print / PDF
            </button>
          ) : undefined
        }
      />
      {isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : !data?.isTeacher ? (
        <div className="card p-8 text-center text-slate-500">
          No staff profile is linked to your account, so there’s no schedule to show.
        </div>
      ) : data.periods.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          You have no scheduled periods yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Period
                </th>
                {data.days.map((d) => (
                  <th key={d} className="border-b border-l border-slate-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {DAY_LABEL[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.periodNumber}>
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 text-sm">
                    <div className="font-semibold text-slate-700">P{p.periodNumber}</div>
                    <div className="text-xs text-slate-400">{p.startTime}–{p.endTime}</div>
                  </td>
                  {data.days.map((d) => {
                    const slot = byKey.get(`${d}:${p.periodNumber}`);
                    return (
                      <td key={d} className="border-b border-l border-slate-100 px-3 py-2 text-center">
                        {slot ? (
                          <div className="rounded-md bg-brand-50/60 px-2 py-1.5">
                            <div className="text-sm font-medium text-slate-800">{slot.code || slot.subject}</div>
                            <div className="text-[11px] text-slate-500">{slot.section}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Open a clean printable section timetable from the editor's current state. */
function printEditorTimetable(
  grid: TimetableEditorGrid,
  periods: TimetablePeriod[],
  cells: Record<string, CellState>,
) {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
    );
  const subjById = new Map(grid.subjects.map((s) => [s.id, s]));
  const tchById = new Map(grid.teachers.map((t) => [t.id, t]));
  const ordered = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);

  const head =
    `<th class="pcol">Period</th>` +
    grid.days.map((d) => `<th>${esc(DAY_LABEL[d] ?? d)}</th>`).join('');

  const rows = ordered
    .map((p) => {
      const cs = grid.days
        .map((d) => {
          const cell = cells[cellKey(d, p.periodNumber)];
          if (!cell?.subjectId) return `<td class="empty">·</td>`;
          const subj = subjById.get(cell.subjectId);
          const sub = esc(subj?.code || subj?.name || '');
          const teacher = cell.staffId ? tchById.get(cell.staffId) : null;
          const tline = teacher ? `<div class="tch">${esc(teacher.name)}</div>` : '';
          return `<td><div class="sub">${sub}</div>${tline}</td>`;
        })
        .join('');
      return (
        `<tr><td class="pcol"><div class="pn">P${p.periodNumber}</div>` +
        `<div class="pt">${esc(p.startTime)}–${esc(p.endTime)}</div></td>${cs}</tr>`
      );
    })
    .join('');

  const title = `${grid.className} ${grid.section.name}`;
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Timetable — ${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 18px; margin: 0; }
  .meta { color: #64748b; font-size: 12px; margin: 2px 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; vertical-align: middle; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
  .pcol { text-align: left; white-space: nowrap; background: #f8fafc; }
  .pn { font-weight: 600; }
  .pt { font-size: 10px; color: #64748b; }
  .sub { font-weight: 600; font-size: 13px; }
  .tch { font-size: 10px; color: #64748b; }
  td.empty { color: #cbd5e1; }
  .ft { margin-top: 14px; font-size: 10px; color: #94a3b8; }
  @media print { body { margin: 0; } @page { margin: 14mm; } }
</style></head><body>
  <h1>${esc(title)} — Weekly Timetable</h1>
  <div class="meta">Class timetable</div>
  <table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
  <div class="ft">Generated from EduPro.</div>
  <script>window.onload = function(){ window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=650');
  if (!w) {
    window.print();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Open a clean, self-contained printable teacher schedule (also "Save as PDF"). */
function printTeacherSchedule(data: TeacherSchedule, teacherName: string | null) {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
    );
  const byKey = new Map(
    data.slots.map((s) => [`${s.dayOfWeek}:${s.periodNumber}`, s]),
  );

  const head =
    `<th class="pcol">Period</th>` +
    data.days.map((d) => `<th>${esc(DAY_LABEL[d] ?? d)}</th>`).join('');

  const rows = data.periods
    .map((p) => {
      const cells = data.days
        .map((d) => {
          const s = byKey.get(`${d}:${p.periodNumber}`);
          if (!s) return `<td class="empty">·</td>`;
          const sub = esc(s.code || s.subject);
          const section = s.section
            ? `<div class="sec">${esc(s.section)}</div>`
            : '';
          return `<td><div class="sub">${sub}</div>${section}</td>`;
        })
        .join('');
      return (
        `<tr><td class="pcol"><div class="pn">P${p.periodNumber}</div>` +
        `<div class="pt">${esc(p.startTime)}–${esc(p.endTime)}</div></td>${cells}</tr>`
      );
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>My Timetable${teacherName ? ' — ' + esc(teacherName) : ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 18px; margin: 0; }
  .meta { color: #64748b; font-size: 12px; margin: 2px 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; vertical-align: middle; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
  .pcol { text-align: left; white-space: nowrap; background: #f8fafc; }
  .pn { font-weight: 600; }
  .pt { font-size: 10px; color: #64748b; }
  .sub { font-weight: 600; font-size: 13px; }
  .sec { font-size: 10px; color: #64748b; }
  td.empty { color: #cbd5e1; }
  .ft { margin-top: 14px; font-size: 10px; color: #94a3b8; }
  @media print { body { margin: 0; } @page { margin: 14mm; } }
</style></head><body>
  <h1>Weekly Teaching Timetable</h1>
  <div class="meta">${teacherName ? esc(teacherName) : ''}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
  <div class="ft">Generated from EduPro.</div>
  <script>window.onload = function(){ window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=650');
  if (!w) {
    window.print();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ───── helpers ────────────────────────────────────────────────────────────────
function serialize(periods: TimetablePeriod[], cells: Record<string, CellState>) {
  const p = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
  const c = Object.entries(cells)
    .filter(([, v]) => v.subjectId)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ p, c });
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + mins + 24 * 60) % (24 * 60);
  const nh = String(Math.floor(total / 60)).padStart(2, '0');
  const nm = String(total % 60).padStart(2, '0');
  return `${nh}:${nm}`;
}

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}
