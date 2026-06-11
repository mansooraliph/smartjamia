import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  Download,
  GraduationCap,
  LogOut,
  Printer,
  User,
} from 'lucide-react';
import {
  getPortalToken,
  PortalApi,
  PortalAttendance,
  PortalResults,
  PortalStudent,
  PortalTimetable,
  setPortalToken,
} from '@/lib/portal-api';
import { cn } from '@/lib/cn';

type Tab = 'profile' | 'timetable' | 'attendance' | 'results';

const DAY_LABEL: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

export function PortalHomePage() {
  const navigate = useNavigate();
  const token = getPortalToken();
  const [tab, setTab] = useState<Tab>('profile');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portal-me'],
    queryFn: PortalApi.me,
    enabled: !!token,
    retry: false,
  });

  if (!token) return <Navigate to="/portal/login" replace />;

  const logout = () => {
    setPortalToken(null);
    navigate('/portal/login', { replace: true });
  };

  if (isError) {
    setPortalToken(null);
    return <Navigate to="/portal/login" replace />;
  }

  const student = data?.student ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {data?.role === 'parent' ? (
              <User className="h-4 w-4" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
          </div>
          <div className="text-sm font-semibold text-slate-900">
            {data?.role === 'parent' ? 'Parent Portal' : 'Student Portal'}
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      {/* Tabs */}
      <nav className="border-b border-slate-200 bg-white px-2">
        <div className="mx-auto flex max-w-lg gap-1">
          <TabButton
            active={tab === 'profile'}
            onClick={() => setTab('profile')}
            icon={User}
            label="Profile"
          />
          <TabButton
            active={tab === 'timetable'}
            onClick={() => setTab('timetable')}
            icon={CalendarRange}
            label="Timetable"
          />
          <TabButton
            active={tab === 'attendance'}
            onClick={() => setTab('attendance')}
            icon={CalendarCheck}
            label="Attendance"
          />
          <TabButton
            active={tab === 'results'}
            onClick={() => setTab('results')}
            icon={ClipboardList}
            label="Results"
          />
        </div>
      </nav>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {isLoading && (
          <div className="card p-6 text-center text-slate-400">Loading…</div>
        )}

        {tab === 'profile' && (
          <>
            {data?.role === 'parent' && data.parent && (
              <div className="card p-5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Signed in as
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {data.parent.name}
                </div>
                <div className="text-sm capitalize text-slate-500">
                  {[data.parent.relation, data.parent.phone]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            )}
            {student ? (
              <StudentCard
                student={student}
                heading={data?.role === 'parent' ? 'Your ward' : 'My profile'}
              />
            ) : (
              !isLoading && (
                <div className="card p-6 text-center text-slate-500">
                  No student record linked to this account.
                </div>
              )
            )}
          </>
        )}

        {tab === 'timetable' && (
          <TimetableSection
            enabled={!!student}
            studentName={
              student ? `${student.firstName} ${student.lastName}` : null
            }
            admissionNumber={student?.admissionNumber ?? null}
          />
        )}
        {tab === 'attendance' && <AttendanceSection enabled={!!student} />}
        {tab === 'results' && (
          <ResultsSection
            enabled={!!student}
            studentName={
              student ? `${student.firstName} ${student.lastName}` : null
            }
            admissionNumber={student?.admissionNumber ?? null}
            classLabel={
              student
                ? [student.className, student.sectionName]
                    .filter(Boolean)
                    .join(' · ')
                : null
            }
          />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition',
        active
          ? 'border-brand-500 text-brand-600'
          : 'border-transparent text-slate-500 hover:text-slate-700',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ───── Attendance ─────────────────────────────────────────────────────────────
const ATT_META: Record<string, { label: string; dot: string; text: string }> = {
  present: { label: 'Present', dot: 'bg-green-500', text: 'text-green-700' },
  absent: { label: 'Absent', dot: 'bg-red-500', text: 'text-red-700' },
  late: { label: 'Late', dot: 'bg-amber-500', text: 'text-amber-700' },
  half_day: { label: 'Half Day', dot: 'bg-blue-500', text: 'text-blue-700' },
  holiday: { label: 'Holiday', dot: 'bg-slate-400', text: 'text-slate-600' },
};

function AttendanceSection({ enabled }: { enabled: boolean }) {
  const { data, isLoading, isError } = useQuery<PortalAttendance>({
    queryKey: ['portal-attendance'],
    queryFn: PortalApi.attendance,
    enabled,
    retry: false,
  });

  if (!enabled)
    return <Empty>No student record linked to this account.</Empty>;
  if (isLoading)
    return <div className="card p-6 text-center text-slate-400">Loading…</div>;
  if (isError || !data)
    return <Empty>Could not load attendance.</Empty>;

  const s = data.summary;
  const pct = s.percentage;

  return (
    <>
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Attendance
          </div>
          {pct != null && (
            <div
              className={cn(
                'text-2xl font-bold',
                pct >= 75
                  ? 'text-green-600'
                  : pct >= 50
                    ? 'text-amber-600'
                    : 'text-red-600',
              )}
            >
              {pct}%
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(['present', 'absent', 'late', 'half_day', 'holiday'] as const).map(
            (k) => (
              <div
                key={k}
                className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2 text-center"
              >
                <div className={cn('text-lg font-bold', ATT_META[k].text)}>
                  {s[k]}
                </div>
                <div className="text-[11px] text-slate-500">
                  {ATT_META[k].label}
                </div>
              </div>
            ),
          )}
        </div>
        <div className="mt-2 text-center text-xs text-slate-400">
          {s.workingDays} working days
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          Recent
        </div>
        {data.recent.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400">
            No attendance recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {data.recent.map((r, i) => {
              const meta = ATT_META[r.status] ?? {
                label: r.status,
                dot: 'bg-slate-300',
                text: 'text-slate-600',
              };
              return (
                <li
                  key={`${r.date}-${i}`}
                  className="flex items-center justify-between px-5 py-2.5 text-sm"
                >
                  <span className="text-slate-600">{r.date?.slice(0, 10)}</span>
                  <span className={cn('flex items-center gap-1.5 font-medium', meta.text)}>
                    <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

// ───── Results ────────────────────────────────────────────────────────────────
function ResultsSection({
  enabled,
  studentName,
  admissionNumber,
  classLabel,
}: {
  enabled: boolean;
  studentName: string | null;
  admissionNumber: string | null;
  classLabel: string | null;
}) {
  const { data, isLoading, isError } = useQuery<PortalResults>({
    queryKey: ['portal-results'],
    queryFn: PortalApi.results,
    enabled,
    retry: false,
  });

  if (!enabled)
    return <Empty>No student record linked to this account.</Empty>;
  if (isLoading)
    return <div className="card p-6 text-center text-slate-400">Loading…</div>;
  if (isError || !data)
    return <Empty>Could not load results.</Empty>;
  if (data.exams.length === 0)
    return <Empty>No exam results published yet.</Empty>;

  return (
    <>
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-medium text-slate-500">
          {data.exams.length} exam{data.exams.length > 1 ? 's' : ''}
        </div>
        <button
          onClick={() =>
            printResults(data, { studentName, admissionNumber, classLabel })
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" /> Print / PDF
        </button>
      </div>
      {data.exams.map((ex) => (
        <div key={ex.examId} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-brand-50/40 px-5 py-3">
            <div>
              <div className="font-semibold text-slate-900">{ex.name}</div>
              <div className="text-xs capitalize text-slate-500">
                {ex.examType?.replace('_', ' ') ?? ''}
                {ex.startDate ? ` · ${ex.startDate.slice(0, 10)}` : ''}
                {ex.rank ? ` · Rank ${ex.rank}` : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-slate-900">
                {ex.percentage}%
              </div>
              <span
                className={cn(
                  'inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold',
                  ex.passed
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700',
                )}
              >
                {ex.grade} · {ex.passed ? 'Pass' : 'Fail'}
              </span>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {ex.subjects.map((su) => (
                <tr key={su.code + su.subject}>
                  <td className="px-5 py-2 text-slate-700">{su.subject}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                    {su.isAbsent ? (
                      <span className="text-amber-600">Absent</span>
                    ) : (
                      <>
                        {su.marksObtained}
                        <span className="text-slate-400">/{su.maxMarks}</span>
                      </>
                    )}
                  </td>
                  <td className="w-12 px-3 py-2 text-right">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        su.passed ? 'text-slate-600' : 'text-red-600',
                      )}
                    >
                      {su.grade ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="px-5 py-2 text-slate-700">Total</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                  {ex.totalObtained}
                  <span className="text-slate-400">/{ex.totalMax}</span>
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
          {ex.reportCardUrl && (
            <div className="border-t border-slate-100 px-5 py-2.5 text-right">
              <a
                href={ex.reportCardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
              >
                <Download className="h-4 w-4" /> Download report card
              </a>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ───── Timetable ──────────────────────────────────────────────────────────────
function TimetableSection({
  enabled,
  studentName,
  admissionNumber,
}: {
  enabled: boolean;
  studentName: string | null;
  admissionNumber: string | null;
}) {
  const { data, isLoading, isError } = useQuery<PortalTimetable>({
    queryKey: ['portal-timetable'],
    queryFn: PortalApi.timetable,
    enabled,
    retry: false,
  });

  if (!enabled) return <Empty>No student record linked to this account.</Empty>;
  if (isLoading)
    return <div className="card p-6 text-center text-slate-400">Loading…</div>;
  if (isError || !data) return <Empty>Could not load timetable.</Empty>;
  if (!data.enrolled || !data.grid)
    return <Empty>Not enrolled in a section yet.</Empty>;

  const { grid } = data;
  if (grid.periods.length === 0)
    return <Empty>No timetable published for your class yet.</Empty>;

  const cellMap = new Map(
    grid.cells.map((c) => [`${c.dayOfWeek}:${c.periodNumber}`, c]),
  );
  const todayIdx = new Date().getDay(); // 0=Sun..6=Sat
  const dayName = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][todayIdx];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-brand-50/40 px-5 py-3">
        <div>
          <div className="font-semibold text-slate-900">
            {grid.className} {grid.section.name}
          </div>
          <div className="text-xs text-slate-500">
            {studentName ? `${studentName} · ` : ''}Weekly timetable
          </div>
        </div>
        <button
          onClick={() =>
            printTimetable(grid, { studentName, admissionNumber })
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" /> Print / PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-400">
                Period
              </th>
              {grid.days.map((d) => (
                <th
                  key={d}
                  className={cn(
                    'border-b border-l border-slate-200 px-2 py-2 text-center text-[11px] font-semibold uppercase',
                    d === dayName ? 'bg-brand-100 text-brand-700' : 'text-slate-400',
                  )}
                >
                  {DAY_LABEL[d] ?? d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.periods.map((p) => (
              <tr key={p.periodNumber}>
                <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-2 py-2">
                  <div className="font-semibold text-slate-700">
                    P{p.periodNumber}
                  </div>
                  <div className="whitespace-nowrap text-[10px] text-slate-400">
                    {p.startTime}
                  </div>
                </td>
                {grid.days.map((d) => {
                  const c = cellMap.get(`${d}:${p.periodNumber}`);
                  return (
                    <td
                      key={d}
                      className={cn(
                        'border-b border-l border-slate-100 px-2 py-2 text-center',
                        d === dayName && 'bg-brand-50/40',
                      )}
                    >
                      {c ? (
                        <div>
                          <div className="font-medium leading-tight text-slate-800">
                            {c.code || c.subject}
                          </div>
                          {c.teacher && (
                            <div className="text-[10px] leading-tight text-slate-400">
                              {c.teacher}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-200">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type TimetableGrid = NonNullable<PortalTimetable['grid']>;

/** Open a clean, self-contained printable timetable (also "Save as PDF"). */
function printTimetable(
  grid: TimetableGrid,
  who: { studentName: string | null; admissionNumber: string | null },
) {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
    );
  const cellMap = new Map(
    grid.cells.map((c) => [`${c.dayOfWeek}:${c.periodNumber}`, c]),
  );

  const head =
    `<th class="pcol">Period</th>` +
    grid.days
      .map((d) => `<th>${esc(DAY_LABEL[d] ?? d)}</th>`)
      .join('');

  const rows = grid.periods
    .map((p) => {
      const cells = grid.days
        .map((d) => {
          const c = cellMap.get(`${d}:${p.periodNumber}`);
          if (!c) return `<td class="empty">·</td>`;
          const sub = esc(c.code || c.subject);
          const teacher = c.teacher
            ? `<div class="tch">${esc(c.teacher)}</div>`
            : '';
          return `<td><div class="sub">${sub}</div>${teacher}</td>`;
        })
        .join('');
      return (
        `<tr><td class="pcol"><div class="pn">P${p.periodNumber}</div>` +
        `<div class="pt">${esc(p.startTime)}–${esc(p.endTime)}</div></td>${cells}</tr>`
      );
    })
    .join('');

  const subtitle = [
    who.studentName ? esc(who.studentName) : '',
    who.admissionNumber ? esc(who.admissionNumber) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Timetable — ${esc(grid.className)} ${esc(grid.section.name)}</title>
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
  <h1>${esc(grid.className)} ${esc(grid.section.name)} — Weekly Timetable</h1>
  <div class="meta">${subtitle}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
  <div class="ft">Generated from the EduPro portal.</div>
  <script>window.onload = function(){ window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=650');
  if (!w) {
    // Pop-up blocked — fall back to printing the current page.
    window.print();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Open a clean, self-contained printable results sheet (also "Save as PDF"). */
function printResults(
  data: PortalResults,
  who: {
    studentName: string | null;
    admissionNumber: string | null;
    classLabel: string | null;
  },
) {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
    );

  const examBlocks = data.exams
    .map((ex) => {
      const rows = ex.subjects
        .map((su) => {
          const marks = su.isAbsent
            ? `<span class="ab">Absent</span>`
            : `${su.marksObtained}<span class="mx">/${su.maxMarks}</span>`;
          const res = su.isAbsent
            ? 'AB'
            : su.passed
              ? 'Pass'
              : '<span class="fail">Fail</span>';
          return `<tr><td class="l">${esc(su.subject)}</td><td>${marks}</td><td>${esc(su.grade ?? '—')}</td><td>${res}</td></tr>`;
        })
        .join('');
      const meta = [
        ex.examType ? esc(ex.examType.replace('_', ' ')) : '',
        ex.startDate ? esc(ex.startDate.slice(0, 10)) : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return `
      <div class="exam">
        <div class="ehead">
          <div><div class="ename">${esc(ex.name)}</div><div class="emeta">${meta}</div></div>
          <div class="eright">
            <div class="pct">${ex.percentage}%</div>
            <div class="${ex.passed ? 'pass' : 'fail'}">${esc(ex.grade)} · ${ex.passed ? 'Pass' : 'Fail'}</div>
          </div>
        </div>
        <table>
          <thead><tr><th class="l">Subject</th><th>Marks</th><th>Grade</th><th>Result</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td class="l">Total</td><td>${ex.totalObtained}<span class="mx">/${ex.totalMax}</span></td><td colspan="2">${ex.percentage}% · ${esc(ex.grade)}</td></tr></tfoot>
        </table>
      </div>`;
    })
    .join('');

  const subtitle = [
    who.admissionNumber ? esc(who.admissionNumber) : '',
    who.classLabel ? esc(who.classLabel) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Exam Results${who.studentName ? ' — ' + esc(who.studentName) : ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 18px; margin: 0; }
  .meta { color: #64748b; font-size: 12px; margin: 2px 0 18px; }
  .exam { margin-bottom: 18px; page-break-inside: avoid; }
  .ehead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px; }
  .ename { font-weight: 700; font-size: 14px; }
  .emeta { font-size: 11px; color: #64748b; text-transform: capitalize; }
  .eright { text-align: right; }
  .pct { font-weight: 700; font-size: 16px; }
  .pass { font-size: 11px; font-weight: 600; color: #15803d; }
  .fail { font-size: 11px; font-weight: 600; color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-size: 12px; }
  th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
  .l { text-align: left; }
  .mx { color: #94a3b8; }
  .ab { color: #b45309; }
  tfoot td { font-weight: 700; background: #f8fafc; }
  .ft { margin-top: 10px; font-size: 10px; color: #94a3b8; }
  @media print { body { margin: 0; } @page { margin: 14mm; } }
</style></head><body>
  <h1>Exam Results${who.studentName ? ' — ' + esc(who.studentName) : ''}</h1>
  <div class="meta">${subtitle}</div>
  ${examBlocks}
  <div class="ft">Generated from the EduPro portal.</div>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-6 text-center text-sm text-slate-500">{children}</div>
  );
}

function StudentCard({
  student,
  heading,
}: {
  student: PortalStudent;
  heading: string;
}) {
  const rows: [string, string][] = [
    ['Admission #', student.admissionNumber],
    [
      'Class',
      [student.className, student.sectionName].filter(Boolean).join(' · ') ||
        '—',
    ],
    ['Roll number', student.rollNumber ?? '—'],
    ['Gender', student.gender ?? '—'],
    ['Date of birth', student.dateOfBirth?.slice(0, 10) ?? '—'],
    ['Blood group', student.bloodGroup ?? '—'],
    ['Status', student.status],
  ];
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-brand-50/40 px-5 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
          {student.firstName[0]}
          {student.lastName[0]}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {heading}
          </div>
          <div className="text-lg font-bold text-slate-900">
            {student.firstName} {student.lastName}
          </div>
        </div>
      </div>
      <dl className="divide-y divide-slate-50">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-5 py-2.5 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium capitalize text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
