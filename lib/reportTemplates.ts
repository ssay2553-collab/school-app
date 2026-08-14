export interface ReportHtmlData {
  backgroundDataUri?: string;
  schoolLogoDataUri?: string;
  adminSigDataUri?: string;
  schoolName: string;
  schoolHotline: string;
  schoolEmail: string;
  studentName: string;
  className: string;
  academicYearState: string;
  termState: string;
  overallPosition: string;
  attendance: string;
  reportType: string;
  isFullReport: boolean;
  subjectsData: any[];
  TRS: string | number;
  TAS: string | number;
  AGGREGATE: string | number;
  isPreschool: boolean;
  conduct: string;
  attitude: string;
  interest: string;
  physicalDev: any;
  preschoolAssessments: Record<string, string>;
  teacherRemarks: string;
  adminRemarks: string;
  nextTermBegins: string;
  promotedTo: string;
  qrDataUri: string;
}

export const generateAcademicReportHtml = (data: ReportHtmlData) => {
  const {
    backgroundDataUri,
    schoolLogoDataUri,
    adminSigDataUri,
    schoolName,
    schoolHotline,
    schoolEmail,
    studentName,
    className,
    academicYearState,
    termState,
    overallPosition,
    attendance,
    reportType,
    isFullReport,
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
    qrDataUri,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Academic Report - ${studentName}</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          background-color: white;
        }
        body {
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          color: #0f172a;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .paper {
          padding: 8mm 10mm;
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          margin: 0 auto;
          ${backgroundDataUri ? `background-image: url("${backgroundDataUri}");` : "background-color: white;"}
          background-size: cover;
          background-repeat: no-repeat;
          background-position: center;
        }

        .letterhead { display: flex; flex-direction: row; align-items: center; margin-bottom: 15pt; }
        .letterhead-logo { width: 60pt; height: 60pt; margin-right: 15pt; }
        .letterhead-info { flex: 1; }
        .letterhead-school-name { font-size: 16pt; font-weight: 900; color: #1E293B; }
        .letterhead-report-type { font-size: 10pt; font-weight: 800; color: #64748B; margin-top: 2pt; }
        .letterhead-contact { font-size: 8pt; font-weight: 600; color: #64748B; margin-top: 2pt; }

        .title { text-align:center; font-weight:900; margin-top: 10pt; margin-bottom: 12px; font-size: 14pt; letter-spacing: 1pt; text-transform: uppercase; color: #0f172a; }

        .info-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          margin-bottom: 12px;
          border: 1.5pt solid #0f172a;
        }
        .info-item { display: flex; border: 0.5pt solid #cbd5e1; }
        .info-label {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: 800;
          padding: 6pt 8pt;
          width: 40%;
          font-size: 8pt;
          text-transform: uppercase;
          border-right: 0.5pt solid #cbd5e1;
        }
        .info-value { padding: 6pt 8pt; width: 60%; font-weight: 700; color: #0f172a; font-size: 9pt; }

        table.results { width: 100%; border-collapse: collapse; margin-bottom: 12px; table-layout: fixed; border: 2pt solid #0f172a; }
        table.results th { background-color: #0f172a !important; color: #fff; padding: 7pt 4pt; font-size: 8.5pt; border: 1pt solid #0f172a; text-transform: uppercase; }
        table.results td { padding: 6pt 4pt; font-size: 9pt; border: 1pt solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a; }
        table.results tr:nth-child(even) { background-color: rgba(241, 245, 249, 0.6); }
        .subj-name { text-align: left !important; padding-left: 10pt !important; font-weight: 800; text-transform: uppercase; }

        .summary-box {
          border: 2pt solid #0f172a;
          padding: 8pt 12pt;
          margin-bottom: 12px;
          background-color: rgba(255, 255, 255, 0.75);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .summary-left { font-size: 9pt; font-weight: 800; color: #475569; }
        .summary-value { font-size: 16pt; font-weight: 900; color: #e11d48; }

        .remarks-box { border: 1.5pt solid #0f172a; padding: 10pt 15pt; background-color: rgba(255, 255, 255, 0.75); }
        .remark-line { margin-bottom: 7pt; font-size: 9pt; line-height: 1.5; color: #1e293b; border-bottom: 0.5pt dashed #cbd5e1; padding-bottom: 4pt; }
        .remark-line:last-child { border-bottom: none; margin-bottom: 0; }
        .remark-header { font-weight: 900; color: #0f172a; margin-right: 8pt; font-size: 8pt; text-transform: uppercase; }

        .footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top: auto; padding-bottom: 20pt; }
        .qr-section { text-align: left; width: 25%; display: flex; flex-direction: column; align-items: flex-start; }
        .qr-img { width: 50pt; height: 50pt; margin-bottom: 4pt; }
        .signature-section { width: 45%; text-align: center; height: 80pt; }
        .signature-img { width: 100%; height: 50pt; object-fit: contain; margin-bottom: 5pt; }
      </style>
    </head>
    <body>
      <div class="paper">
        ${
          schoolLogoDataUri
            ? `
        <div class="letterhead">
          <img src="${schoolLogoDataUri}" class="letterhead-logo"/>
          <div class="letterhead-info">
            <div class="letterhead-school-name">${schoolName}</div>
            <div class="letterhead-report-type">${reportType.toUpperCase()} PROGRESS REPORT</div>
            <div class="letterhead-contact">${schoolHotline} | ${schoolEmail}</div>
          </div>
        </div>
        `
            : ""
        }
        <div class="title">${reportType} Progress Report</div>

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
              ${isFullReport ? '<th style="width: 10%;">Class</th><th style="width: 10%;">Exams</th><th style="width: 10%;">Total</th>' : '<th style="width: 15%;">Total</th>'}
              <th style="width: 10%;">Grade</th>
              <th style="width: 28%;">Remark</th>
            </tr>
          </thead>
          <tbody>
          ${subjectsData
            .map((s) => {
              const classScoreDisplay = isNaN(Number(s.classScore))
                ? s.classScore
                : Number(s.classScore).toFixed(0);
              const examsScoreDisplay = isNaN(Number(s.examsScore))
                ? s.examsScore
                : Number(s.examsScore).toFixed(0);
              const totalDisplay = isNaN(Number(s.total))
                ? s.total
                : Number(s.total).toFixed(1);
              return `
            <tr>
              <td class="subj-name">${s.subject}</td>
              ${
                isFullReport
                  ? `
                <td>${classScoreDisplay}</td>
                <td>${examsScoreDisplay}</td>
                <td style="font-weight: 900;">${totalDisplay}</td>
              `
                  : `<td>${totalDisplay}</td>`
              }
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

        <div class="footer">
          <div class="qr-section">
            <img src="${qrDataUri}" class="qr-img"/>
            <div style="font-size:7pt; color:#475569; font-weight:700;">VERIFY REPORT</div>
          </div>
          <div class="signature-section">
            ${adminSigDataUri ? `<img src="${adminSigDataUri}" class="signature-img"/>` : ""}
            <div style="width: 100%; height: 1pt; background-color: #1E293B; margin-top: 5pt; margin-bottom: 4pt;"></div>
            <div style="font-size:8pt; font-weight:800; color:#64748B;">Head of Institution</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
