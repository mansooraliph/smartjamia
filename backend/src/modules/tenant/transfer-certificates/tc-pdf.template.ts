import Handlebars from 'handlebars';

export interface TcTemplateData {
  schoolName: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  affiliation?: string | null;
  principalName?: string | null;
  tcNumber: string;
  issueDate: string;
  studentName: string;
  admissionNumber: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  fatherName?: string | null;
  lastClass: string;
  reason: string;
  conduct: string;
  feesCleared: boolean;
  issuedByName?: string | null;
}

const TEMPLATE = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1e293b; margin: 0; }
  .sheet { border: 3px double #475569; padding: 28px 34px; min-height: 960px; position: relative; }
  .head { text-align: center; border-bottom: 2px solid #475569; padding-bottom: 14px; }
  .school { font-size: 26px; font-weight: 700; letter-spacing: .5px; color: #0f172a; }
  .addr { font-size: 12px; color: #475569; margin-top: 4px; }
  .affil { font-size: 11px; color: #64748b; margin-top: 2px; font-style: italic; }
  .title { text-align: center; margin: 26px 0 6px; }
  .title h1 { font-size: 20px; letter-spacing: 4px; text-transform: uppercase; margin: 0;
              display: inline-block; border-bottom: 2px solid #b45309; padding-bottom: 4px; color: #b45309; }
  .meta { display: flex; justify-content: space-between; font-size: 13px; margin: 18px 4px 10px; }
  .meta b { color: #0f172a; }
  table.body { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
  table.body td { padding: 9px 6px; vertical-align: top; border-bottom: 1px dotted #cbd5e1; }
  table.body td.label { width: 38%; color: #475569; }
  table.body td.value { font-weight: 600; color: #0f172a; }
  .fill { border-bottom: 1px solid #94a3b8; }
  .footer { position: absolute; bottom: 28px; left: 34px; right: 34px; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 56px; }
  .sign div { text-align: center; font-size: 12px; color: #475569; }
  .sign .line { width: 180px; border-top: 1px solid #475569; padding-top: 5px; }
  .note { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 18px; }
  .seal { font-size: 11px; color: #94a3b8; }
  .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; }
  .ok { background:#dcfce7; color:#166534; }
  .pending { background:#fef3c7; color:#92400e; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="school">{{schoolName}}</div>
      {{#if schoolAddress}}<div class="addr">{{schoolAddress}}</div>{{/if}}
      <div class="addr">
        {{#if schoolPhone}}Phone: {{schoolPhone}}{{/if}}
        {{#if schoolEmail}} &nbsp;•&nbsp; {{schoolEmail}}{{/if}}
      </div>
      {{#if affiliation}}<div class="affil">{{affiliation}}</div>{{/if}}
    </div>

    <div class="title"><h1>Transfer Certificate</h1></div>

    <div class="meta">
      <span>TC No: <b>{{tcNumber}}</b></span>
      <span>Date of Issue: <b>{{issueDate}}</b></span>
    </div>

    <table class="body">
      <tr><td class="label">1. Name of the Student</td><td class="value">{{studentName}}</td></tr>
      <tr><td class="label">2. Admission Number</td><td class="value">{{admissionNumber}}</td></tr>
      {{#if fatherName}}<tr><td class="label">3. Father / Guardian Name</td><td class="value">{{fatherName}}</td></tr>{{/if}}
      <tr><td class="label">4. Date of Birth</td><td class="value">{{#if dateOfBirth}}{{dateOfBirth}}{{else}}<span class="fill">&nbsp;</span>{{/if}}</td></tr>
      <tr><td class="label">5. Gender</td><td class="value">{{#if gender}}{{gender}}{{else}}—{{/if}}</td></tr>
      <tr><td class="label">6. Class Last Studied</td><td class="value">{{lastClass}}</td></tr>
      <tr><td class="label">7. Reason for Leaving</td><td class="value">{{reason}}</td></tr>
      <tr><td class="label">8. Conduct &amp; Character</td><td class="value">{{conduct}}</td></tr>
      <tr><td class="label">9. All Dues Cleared</td><td class="value">
        {{#if feesCleared}}<span class="badge ok">YES</span>{{else}}<span class="badge pending">PENDING</span>{{/if}}
      </td></tr>
    </table>

    <div class="footer">
      <div class="sign">
        <div><div class="line">Class Teacher</div></div>
        <div class="seal">(School Seal)</div>
        <div><div class="line">{{#if principalName}}{{principalName}}<br/>{{/if}}Principal</div></div>
      </div>
      <div class="note">
        Issued by {{#if issuedByName}}{{issuedByName}}{{else}}the school office{{/if}} via EduPro.
        This is a system-generated certificate.
      </div>
    </div>
  </div>
</body>
</html>`;

const compiled = Handlebars.compile(TEMPLATE);

export function renderTcHtml(data: TcTemplateData): string {
  return compiled(data);
}
