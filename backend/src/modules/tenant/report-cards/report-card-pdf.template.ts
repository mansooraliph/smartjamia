import Handlebars from 'handlebars';

export interface ReportCardSubjectRow {
  subject: string;
  code: string;
  maxMarks: number;
  marksObtained: string | null; // null => absent
  grade: string | null;
  passed: boolean;
  isAbsent: boolean;
}

export interface ReportCardTemplateData {
  schoolName: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  affiliation?: string | null;
  principalName?: string | null;

  examName: string;
  examType?: string | null;
  academicYear?: string | null;

  studentName: string;
  admissionNumber: string;
  className: string;
  sectionName?: string | null;
  rollNumber?: string | null;
  dateOfBirth?: string | null;
  fatherName?: string | null;

  subjects: ReportCardSubjectRow[];
  totalObtained: string;
  totalMax: string;
  percentage: string;
  grade: string;
  rank?: number | null;
  classSize?: number | null;
  isPassed: boolean;
  generatedOn: string;
}

const TEMPLATE = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1e293b; margin: 0; }
  .sheet { border: 3px double #475569; padding: 26px 32px; min-height: 960px; position: relative; }
  .head { text-align: center; border-bottom: 2px solid #475569; padding-bottom: 12px; }
  .school { font-size: 25px; font-weight: 700; letter-spacing: .5px; color: #0f172a; }
  .addr { font-size: 12px; color: #475569; margin-top: 4px; }
  .affil { font-size: 11px; color: #64748b; margin-top: 2px; font-style: italic; }
  .title { text-align: center; margin: 22px 0 4px; }
  .title h1 { font-size: 18px; letter-spacing: 3px; text-transform: uppercase; margin: 0;
              display: inline-block; border-bottom: 2px solid #b45309; padding-bottom: 4px; color: #b45309; }
  .subtitle { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 16px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin: 14px 6px 18px; }
  .info div { padding: 2px 0; }
  .info b { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #94a3b8; padding: 7px 10px; font-size: 13px; }
  th { background: #f1f5f9; text-transform: uppercase; letter-spacing: .03em; font-size: 11px; color: #334155; }
  td.l, th.l { text-align: left; }
  td.c, th.c { text-align: center; }
  .ab { color: #b45309; font-style: italic; }
  .fail { color: #b91c1c; font-weight: 700; }
  tfoot td { font-weight: 700; background: #f8fafc; }
  .summary { display: flex; justify-content: space-between; align-items: center;
             margin-top: 20px; padding: 14px 18px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; }
  .summary .big { font-size: 22px; font-weight: 700; color: #0f172a; }
  .summary .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
  .result-pass { color: #15803d; font-weight: 700; }
  .result-fail { color: #b91c1c; font-weight: 700; }
  .foot { display: flex; justify-content: space-between; margin-top: 70px; font-size: 12px; color: #334155; }
  .sign { text-align: center; }
  .sign .line { border-top: 1px solid #475569; width: 170px; margin: 0 auto 4px; }
  .gen { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="school">{{schoolName}}</div>
      {{#if schoolAddress}}<div class="addr">{{schoolAddress}}</div>{{/if}}
      <div class="addr">
        {{#if schoolPhone}}Ph: {{schoolPhone}}{{/if}}
        {{#if schoolEmail}} · {{schoolEmail}}{{/if}}
      </div>
      {{#if affiliation}}<div class="affil">{{affiliation}}</div>{{/if}}
    </div>

    <div class="title"><h1>Report Card</h1></div>
    <div class="subtitle">
      {{examName}}{{#if examType}} ({{examType}}){{/if}}{{#if academicYear}} · {{academicYear}}{{/if}}
    </div>

    <div class="info">
      <div><b>Name:</b> {{studentName}}</div>
      <div><b>Admission #:</b> {{admissionNumber}}</div>
      <div><b>Class:</b> {{className}}{{#if sectionName}} · {{sectionName}}{{/if}}</div>
      <div><b>Roll #:</b> {{#if rollNumber}}{{rollNumber}}{{else}}—{{/if}}</div>
      {{#if fatherName}}<div><b>Father/Guardian:</b> {{fatherName}}</div>{{/if}}
      {{#if dateOfBirth}}<div><b>Date of Birth:</b> {{dateOfBirth}}</div>{{/if}}
    </div>

    <table>
      <thead>
        <tr>
          <th class="l">Subject</th>
          <th class="c">Max</th>
          <th class="c">Obtained</th>
          <th class="c">Grade</th>
          <th class="c">Result</th>
        </tr>
      </thead>
      <tbody>
        {{#each subjects}}
        <tr>
          <td class="l">{{this.subject}}{{#if this.code}} ({{this.code}}){{/if}}</td>
          <td class="c">{{this.maxMarks}}</td>
          <td class="c">{{#if this.isAbsent}}<span class="ab">Absent</span>{{else}}{{this.marksObtained}}{{/if}}</td>
          <td class="c">{{#if this.grade}}{{this.grade}}{{else}}—{{/if}}</td>
          <td class="c">{{#if this.isAbsent}}—{{else}}{{#if this.passed}}Pass{{else}}<span class="fail">Fail</span>{{/if}}{{/if}}</td>
        </tr>
        {{/each}}
      </tbody>
      <tfoot>
        <tr>
          <td class="l">Total</td>
          <td class="c">{{totalMax}}</td>
          <td class="c">{{totalObtained}}</td>
          <td class="c">{{grade}}</td>
          <td class="c">{{#if isPassed}}Pass{{else}}<span class="fail">Fail</span>{{/if}}</td>
        </tr>
      </tfoot>
    </table>

    <div class="summary">
      <div><div class="lbl">Percentage</div><div class="big">{{percentage}}%</div></div>
      <div><div class="lbl">Grade</div><div class="big">{{grade}}</div></div>
      {{#if rank}}<div><div class="lbl">Rank</div><div class="big">{{rank}}{{#if classSize}} / {{classSize}}{{/if}}</div></div>{{/if}}
      <div><div class="lbl">Result</div><div class="big {{#if isPassed}}result-pass{{else}}result-fail{{/if}}">{{#if isPassed}}PASS{{else}}FAIL{{/if}}</div></div>
    </div>

    <div class="foot">
      <div class="sign"><div class="line"></div>Class Teacher</div>
      <div class="sign"><div class="line"></div>{{#if principalName}}{{principalName}}<br/>{{/if}}Principal</div>
    </div>

    <div class="gen">Generated on {{generatedOn}}</div>
  </div>
</body>
</html>`;

const compiled = Handlebars.compile(TEMPLATE);

export function renderReportCardHtml(data: ReportCardTemplateData): string {
  return compiled(data);
}
