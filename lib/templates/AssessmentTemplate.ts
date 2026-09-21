import { ReportHtmlData } from "../reportTemplates";

export const generateAssessmentHtml = (data: ReportHtmlData, styles: string, header: string, footer: string) => {
  const {
    studentName,
    className,
    academicYearState,
    reportNumber,
    reportType,
    overallPosition,
    subjectsData,
    TRS,
    TAS,
    AGGREGATE,
    teacherRemarks,
  } = data;

  const typeLabel = reportType === "Trial Test" ? "TEST" : reportType === "Mid-Term" ? "MID-TERM" : "CAT";
  const assessmentTitle = reportType === "Mid-Term" ? "MID-TERM" : `${typeLabel} ${reportNumber || 1}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${assessmentTitle} Report - ${studentName}</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="paper">
        ${header}
        <div class="title">${assessmentTitle} Progress Report</div>

        <div class="info-container">
          <div class="info-item"><div class="info-label">Student Name</div><div class="info-value">${studentName}</div></div>
          <div class="info-item"><div class="info-label">Class/Grade</div><div class="info-value">${className}</div></div>
          <div class="info-item"><div class="info-label">Academic Year</div><div class="info-value">${academicYearState}</div></div>
          <div class="info-item"><div class="info-label">Assessment</div><div class="info-value">${assessmentTitle}</div></div>
          <div class="info-item"><div class="info-label">Position</div><div class="info-value">${overallPosition}</div></div>
          <div class="info-item"><div class="info-label">Term Avg</div><div class="info-value">${TAS}</div></div>
        </div>

        <table class="results">
          <thead>
            <tr>
              <th style="width: 45%;">Subject</th>
              <th style="width: 25%;">Score</th>
              <th style="width: 30%;">Grade</th>
            </tr>
          </thead>
          <tbody>
          ${subjectsData
            .map((s) => {
              const totalDisplay = isNaN(Number(s.total)) ? s.total : Number(s.total).toFixed(1);
              return `
            <tr>
              <td class="subj-name">${s.subject}</td>
              <td style="font-weight: 900;">${totalDisplay}</td>
              <td>${s.grade} (${s.remark})</td>
            </tr>`;
            })
            .join("")}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="summary-left">
            TOTAL SCORE: <span style="color: #0f172a;">${TRS}</span>
          </div>
          <div class="summary-right">
            <span style="font-weight:900; margin-right:10pt;">TERM AVG:</span>
            <span class="summary-value">${TAS}</span>
          </div>
        </div>

        <div class="remarks-box">
          <div class="remark-line"><span class="remark-header">REMARKS:</span> ${teacherRemarks || "Good progress so far. Keep it up."}</div>
        </div>

        ${footer}
      </div>
    </body>
    </html>
  `;
};
