import { SCHOOL_CONFIG } from "../constants/Config";

export interface ReportHtmlData {
  logoDataUri: string;
  sigDataUri: string;
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
    logoDataUri,
    sigDataUri,
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
    isPreschool,
    conduct,
    attitude,
    interest,
    physicalDev,
    preschoolAssessments,
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
          height: 297mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          margin: 0 auto;
          background-color: white;
        }

        /* Header Redesign (Non-Table) */
        .header-container {
          display: flex;
          align-items: center;
          border-bottom: 2pt solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .header-logo-container {
          width: 65px;
          height: 65px;
          margin-right: 15px;
        }
        .header-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .header-text-container {
          flex: 1;
        }
        .school-name { font-size: 18pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; }
        .school-info { font-size: 8pt; margin: 1px 0; font-weight: 600; color: #475569; }

        .title { text-align:center; font-weight:900; margin: 8px 0; font-size: 12pt; letter-spacing: 1pt; text-transform: uppercase; color: #0f172a; }

        /* Student Info Redesign (Non-Table) */
        .info-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          margin-bottom: 12px;
          border: 1pt solid #E2E8F0;
        }
        .info-item {
          display: flex;
          border: 0.5pt solid #E2E8F0;
        }
        .info-label {
          background-color: #F8FAFC;
          color: #64748B;
          font-weight: 800;
          padding: 5pt 8pt;
          width: 38%;
          font-size: 7.5pt;
          text-transform: uppercase;
          border-right: 0.5pt solid #E2E8F0;
        }
        .info-value {
          padding: 5pt 8pt;
          width: 62%;
          font-weight: 700;
          color: #0f172a;
          font-size: 8.5pt;
        }

        /* Results Table (Keep as table) */
        table.results { width: 100%; border-collapse: collapse; margin-bottom: 12px; table-layout: fixed; border: 1.5pt solid #0f172a; }
        table.results th { background-color: #0f172a !important; -webkit-print-color-adjust: exact; color: #fff; padding: 6pt 4pt; font-size: 8pt; border: 1pt solid #0f172a; text-transform: uppercase; }
        table.results td { padding: 5pt 4pt; font-size: 8.5pt; border: 1pt solid #e2e8f0; text-align: center; font-weight: 600; color: #0f172a; }
        table.results tr:nth-child(even) { background-color: #f8fafc; }
        .subj-name { text-align: left !important; padding-left: 8pt !important; font-weight: 800; text-transform: uppercase; color: #0f172a; }

        .summary-box {
          border: 1.5pt solid #0f172a;
          padding: 6pt 10pt;
          margin-bottom: 12px;
          background-color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .summary-left { font-size: 8pt; font-weight: 800; color: #64748b; }
        .summary-right { display: flex; align-items: center; }
        .summary-label { font-size: 8.5pt; font-weight: 900; color: #64748b; margin-right: 6pt; text-transform: uppercase; }
        .summary-value { font-size: 14pt; font-weight: 900; color: #ef4444; }

        .remarks-box { border: 1pt solid #e2e8f0; padding: 8pt 12pt; background-color: #fff; }
        .remark-line { margin-bottom: 5pt; font-size: 8.5pt; line-height: 1.4; color: #334155; border-bottom: 0.5pt dashed #e2e8f0; padding-bottom: 3pt; }
        .remark-line:last-child { border-bottom: none; margin-bottom: 0; }
        .remark-header { font-weight: 900; color: #0f172a; margin-right: 6pt; font-size: 7.5pt; text-transform: uppercase; }

        .footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top: auto; padding-top: 12px; }
        .sig-section { width: 32%; text-align: center; }
        .sig-image { height: 50pt; object-fit: contain; margin-bottom: -4pt; max-width: 90%; }
        .sig-line { border-top: 1pt solid #0f172a; width: 100%; margin: 4pt auto; }
        .sig-label { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #64748b; }

        .qr-section { text-align: right; width: 20%; display: flex; flex-direction: column; align-items: flex-end; }
        .qr-img { width: 45pt; height: 45pt; opacity: 0.8; }
      </style>
    </head>
    <body>
      <div class="paper">
        <div class="header-container">
          <div class="header-logo-container">
            ${logoDataUri ? `<img src="${logoDataUri}" class="header-logo-img" />` : ""}
          </div>
          <div class="header-text-container">
            <h1 class="school-name">${SCHOOL_CONFIG.fullName}</h1>
            <p class="school-info">${SCHOOL_CONFIG.address || ""}</p>
            <p class="school-info">Contact: ${SCHOOL_CONFIG.hotline || ""} | Email: ${SCHOOL_CONFIG.email || ""}</p>
          </div>
        </div>

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
              ${isFullReport ? '<th style="width: 10%;">Class</th><th style="width: 10%;">Exams</th><th style="width: 10%;">Total</th>' : '<th style="width: 10%;">Total</th>'}
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
            TRS: <span style="color: #1e293b;">${TRS}</span> | TAS: <span style="color: #1e293b;">${TAS}</span>
          </div>
          <div class="summary-right">
            <span class="summary-label">AGGREGATE:</span>
            <span class="summary-value">${AGGREGATE}</span>
          </div>
        </div>

        <div class="remarks-box">
          ${isFullReport && !isPreschool ? `<div class="remark-line"><span class="remark-header">BEHAVIORAL:</span> Conduct: <b>${conduct}</b> | Attitude: <b>${attitude}</b> | Interest: <b>${interest}</b></div>` : ""}
          <div class="remark-line"><span class="remark-header">CLASS TEACHER:</span> ${teacherRemarks || "Satisfactory performance."}</div>
          <div class="remark-line"><span class="remark-header">ADMINISTRATIVE:</span> ${adminRemarks || "Keep up the hard work."}</div>
          <div class="remark-line"><span class="remark-header">NEXT TERM BEGINS:</span> <b>${nextTermBegins || "TBA"}</b></div>
          ${promotedTo ? `<div class="remark-line"><span class="remark-header">PROMOTED TO:</span> <b>${promotedTo}</b></div>` : ""}
        </div>

        <div class="footer">
          <div class="sig-section">
            ${sigDataUri ? `<img src="${sigDataUri}" class="sig-image" />` : '<div style="height: 60pt;"></div>'}
            <div class="sig-line"></div>
            <div class="sig-label">Head of Institution</div>
          </div>
          <div class="qr-section">
            <img src="${qrDataUri}" class="qr-img"/>
            <div style="font-size:7pt; color:#64748B; margin-top:2pt;">Verify Report</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
