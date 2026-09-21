import { ReportHtmlData } from "../reportTemplates";

export const generateEndOfTermHtml = (data: ReportHtmlData, styles: string, header: string, footer: string) => {
  const {
    studentName,
    className,
    academicYearState,
    termState,
    overallPosition,
    attendance,
    subjectsData,
    TRS,
    TAS,
    AGGREGATE,
    conduct,
    attitude,
    interest,
    teacherRemarks,
    adminRemarks,
    nextTermBegins,
    promotedTo,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Terminal Report - ${studentName}</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="paper">
        ${header}
        <div class="title">Terminal Progress Report</div>

        <div class="info-container">
          <div class="info-item"><div class="info-label">Student Name</div><div class="info-value">${studentName}</div></div>
          <div class="info-item"><div class="info-label">Class/Grade</div><div class="info-value">${className}</div></div>
          <div class="info-item"><div class="info-label">Academic Year</div><div class="info-value">${academicYearState}</div></div>
          <div class="info-item"><div class="info-label">Term/Period</div><div class="info-value">${termState}</div></div>
          <div class="info-item"><div class="info-label">Position</div><div class="info-value">${overallPosition}</div></div>
          <div class="info-item"><div class="info-label">Attendance</div><div class="info-value">${attendance || "N/A"}</div></div>
        </div>

        <table class="results">
          <thead>
            <tr>
              <th style="width: 32%;">Subject</th>
              <th style="width: 10%;">Class</th>
              <th style="width: 10%;">Exams</th>
              <th style="width: 10%;">Total</th>
              <th style="width: 10%;">Grade</th>
              <th style="width: 28%;">Remark</th>
            </tr>
          </thead>
          <tbody>
          ${subjectsData
            .map((s) => {
              const classScoreDisplay = isNaN(Number(s.classScore)) ? s.classScore : Number(s.classScore).toFixed(0);
              const examsScoreDisplay = isNaN(Number(s.examsScore)) ? s.examsScore : Number(s.examsScore).toFixed(0);
              const totalDisplay = isNaN(Number(s.total)) ? s.total : Number(s.total).toFixed(1);
              return `
            <tr>
              <td class="subj-name">${s.subject}</td>
              <td>${classScoreDisplay}</td>
              <td>${examsScoreDisplay}</td>
              <td style="font-weight: 900;">${totalDisplay}</td>
              <td>${s.grade}</td>
              <td style="font-size: 8.5pt; text-align: left; padding-left: 5pt;">${s.remark}</td>
            </tr>`;
            })
            .join("")}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="summary-left">
            TRS: <span style="color: #0f172a;">${TRS}</span> | TAS: <span style="color: #0f172a;">${TAS}</span>
          </div>
          <div class="summary-right">
            <span style="font-weight:900; margin-right:10pt;">AGGREGATE:</span>
            <span class="summary-value">${AGGREGATE}</span>
          </div>
        </div>

        <div class="remarks-box">
          <div class="remark-line"><span class="remark-header">BEHAVIORAL:</span> Conduct: <b>${conduct}</b> | Attitude: <b>${attitude}</b> | Interest: <b>${interest}</b></div>
          <div class="remark-line"><span class="remark-header">CLASS TEACHER:</span> ${teacherRemarks || "Satisfactory performance."}</div>
          <div class="remark-line"><span class="remark-header">ADMINISTRATIVE:</span> ${adminRemarks || "Keep up the hard work."}</div>
          <div class="remark-line"><span class="remark-header">NEXT TERM BEGINS:</span> <b>${nextTermBegins || "TBA"}</b></div>
          ${promotedTo ? `<div class="remark-line"><span class="remark-header">PROMOTED TO:</span> <b>${promotedTo}</b></div>` : ""}
        </div>

        ${footer}
      </div>
    </body>
    </html>
  `;
};
