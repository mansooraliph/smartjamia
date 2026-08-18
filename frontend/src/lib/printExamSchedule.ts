/** Shared subject-wise exam schedule shape needed to render a printable sheet. */
export interface PrintableExamSubject {
  subjectName: string;
  date: string | null;
  time: string | null;
  maxMarks: number;
  passMarks: number;
}

export interface PrintableExamInfo {
  name: string;
  examType: string;
  startDate: string;
  endDate: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(t: string | null): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Open a clean, self-contained printable subject-wise exam schedule (also "Save as PDF"). */
export function printExamSchedule(
  exam: PrintableExamInfo,
  subjects: PrintableExamSubject[],
  context: { collegeName?: string; batchName?: string; courseName?: string; termLabel?: string },
) {
  const sortedSubjects = [...subjects].sort((a, b) => {
    const ad = a.date ?? '9999-99-99';
    const bd = b.date ?? '9999-99-99';
    return ad === bd ? a.subjectName.localeCompare(b.subjectName) : ad.localeCompare(bd);
  });

  const rows = sortedSubjects
    .map(
      (s, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(s.subjectName)}</td>
        <td>${esc(formatDate(s.date))}</td>
        <td>${esc(formatTime(s.time))}</td>
        <td class="num">${s.maxMarks}</td>
        <td class="num">${s.passMarks}</td>
      </tr>`,
    )
    .join('');

  const metaLine = [context.collegeName, context.courseName, context.batchName, context.termLabel]
    .filter((v): v is string => Boolean(v))
    .map(esc)
    .join(' · ');

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(exam.name)} — Exam Schedule</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 18px; margin: 0; }
  .meta { color: #64748b; font-size: 12px; margin: 2px 0 4px; }
  .dates { color: #64748b; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
  td.num, th.num { text-align: center; }
  .ft { margin-top: 14px; font-size: 10px; color: #94a3b8; }
  @media print { body { margin: 0; } @page { margin: 14mm; } }
</style></head><body>
  <h1>${esc(exam.name)}</h1>
  <div class="meta">${metaLine}</div>
  <div class="dates">${esc(exam.examType.replace('_', ' '))} · ${esc(formatDate(exam.startDate))} – ${esc(formatDate(exam.endDate))}</div>
  <table>
    <thead><tr>
      <th class="num">#</th><th>Subject</th><th>Date</th><th>Time</th><th class="num">Max Marks</th><th class="num">Pass Marks</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No subjects scheduled yet</td></tr>`}</tbody>
  </table>
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
