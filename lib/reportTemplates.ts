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
          height: auto !important;
          min-height: 100% !important;
          overflow: visible !important;
          display: block !important;
          background-color: white;
        }
        body {
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          color: #0f172a;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .paper {
          padding: 15mm 18mm;
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          display: block;
          page-break-after: always;
          overflow: visible !important;
          position: relative;
          margin: 0 auto;
          background-color: white;
        }

        .header-table { width: 100%; border-bottom: 2pt solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
        .header-logo { width: 80px; vertical-align: middle; }
        .header-text { text-align: left; padding-left: 20px; vertical-align: middle; }
        .school-name { font-size: 22pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; }
        .school-info { font-size: 9pt; margin: 2px 0; font-weight: 600; color: #475569; }

        .title { text-align:center; font-weight:900; margin: 20px 0; font-size: 14pt; letter-spacing: 1.5pt; text-transform: uppercase; }

        .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1pt solid #E2E8F0; }
        .info-grid td { padding: 8pt 12pt; font-size: 10pt; border: 1pt solid #E2E8F0; }
        .label-cell { background-color: #F1F5F9; color: #475569; font-weight: 800; width: 25%; font-size: 8pt; text-transform: uppercase; }
        .value-cell { width: 25%; font-weight: 700; color: #0f172a; }

        table.results { width: 100%; border-collapse: collapse; margin-bottom: 25px; table-layout: fixed; border: 1.5pt solid #0f172a; }
        table.results th { background-color: #0f172a !important; -webkit-print-color-adjust: exact; color: #fff; padding: 10pt 5pt; font-size: 9pt; border: 1pt solid #0f172a; text-transform: uppercase; }
        table.results td { padding: 8pt 5pt; font-size: 10pt; border: 1pt solid #cbd5e1; text-align: center; font-weight: 600; color: #0f172a; }
        table.results tr:nth-child(even) { background-color: #f8fafc; }
        .subj-name { text-align: left !important; padding-left: 12pt !important; font-weight: 800; text-transform: uppercase; color: #0f172a; }

        .summary-box { border: 1.5pt solid #0f172a; padding: 12pt; margin-bottom: 20px; background-color: #fff; }
        .summary-text { font-size: 11pt; font-weight: 900; margin: 0; color: #0f172a; text-align: center; letter-spacing: 1pt; }

        .remarks-box { margin-top: 10pt; border: 1pt solid #cbd5e1; padding: 15pt; border-radius: 0; background-color: #fff; }
        .remark-line { margin-bottom: 10pt; font-size: 10pt; line-height: 1.5; color: #1e293b; border-bottom: 0.5pt dashed #cbd5e1; padding-bottom: 5pt; }
        .remark-header { font-weight: 900; color: #0f172a; margin-right: 10pt; font-size: 8.5pt; text-transform: uppercase; }

        .footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px; }
        .sig-section { width: 40%; text-align: center; }
        .sig-image { height: 45pt; object-fit: contain; margin-bottom: -5pt; max-width: 90%; }
        .sig-line { border-top: 1pt solid #1E293B; width: 85%; margin: 5pt auto; }
        .sig-label { font-size: 8.5pt; font-weight: 800; text-transform: uppercase; color: #64748B; }

        .qr-section { text-align: right; width: 20%; }
        .qr-img { width: 50pt; height: 50pt; opacity: 0.8; }
      </style>
    </head>
    <body>
      <div class="paper">
        <table class="header-table">
          <tr>
            <td class="header-logo">
              ${logoDataUri ? `<img src="${logoDataUri}" style="width: 80px; height: 80px;" />` : ""}
            </td>
            <td class="header-text">
              <h1 class="school-name">${SCHOOL_CONFIG.fullName}</h1>
              <p class="school-info">${SCHOOL_CONFIG.address || ""}</p>
              <p class="school-info">Contact: ${SCHOOL_CONFIG.hotline || ""} | Email: ${SCHOOL_CONFIG.email || ""}</p>
            </td>
          </tr>
        </table>

        <div class="title">${reportType} Progress Report</div>

        <table class="info-grid">
          <tr>
            <td class="label-cell">Student Name</td><td class="value-cell">${studentName}</td>
            <td class="label-cell">Class/Grade</td><td class="value-cell">${className}</td>
          </tr>
          <tr>
            <td class="label-cell">Academic Year</td><td class="value-cell">${academicYearState}</td>
            <td class="label-cell">Term/Period</td><td class="value-cell">${termState}</td>
          </tr>
          <tr>
            <td class="label-cell">Position</td><td class="value-cell">${overallPosition}</td>
            <td class="label-cell">Attendance</td><td class="value-cell">${attendance || "N/A"}</td>
          </tr>
        </table>

        <table class="results">
          <thead>
            <tr>
              <th style="width: 30%;">Subject</th>
              ${isFullReport ? '<th style="width: 10%;">Class</th><th style="width: 10%;">Exams</th><th style="width: 10%;">Total</th>' : '<th style="width: 10%;">Total</th>'}
              <th style="width: 8%;">Grade</th>
              <th style="width: 8%;">Pos.</th>
              <th style="width: 24%;">Remark</th>
            </tr>
          </thead>
          <tbody>
          ${subjectsData
            .map((s) => {
              const classScoreDisplay = isNaN(Number(s.classScore))
                ? s.classScore
                : Number(s.classScore).toFixed(1);
              const examsScoreDisplay = isNaN(Number(s.examsScore))
                ? s.examsScore
                : Number(s.examsScore).toFixed(1);
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
              <td>${s.pos}</td>
              <td style="font-size: 9pt; text-align: left; padding-left: 5pt;">${s.remark}</td>
            </tr>`;
            })
            .join("")}
          </tbody>
        </table>

        <div class="summary-box">
          <p class="summary-text">TRS: ${TRS} | TAS: ${TAS} | AGGREGATE: ${AGGREGATE}</p>
        </div>

        <div class="remarks-box">
          ${isFullReport && !isPreschool ? `<div class="remark-line"><span class="remark-header">BEHAVIORAL:</span> Conduct: <b>${conduct}</b> | Attitude: <b>${attitude}</b> | Interest: <b>${interest}</b></div>` : ""}
          ${isFullReport && isPreschool ? `
            <div class="remark-line"><span class="remark-header">PHYSICAL DEV:</span>
              ${physicalDev.date ? `Date: ${physicalDev.date} | ` : ""}
              HT: ${physicalDev.height || "-"}m |
              WT: ${physicalDev.weight || "-"}kg
            </div>
            <div style="font-size: 8pt; margin-bottom: 10pt; color: #475569;">
                <b>Assessments:</b> ${Object.entries(preschoolAssessments).filter(([_, v]) => v !== 'N/A').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ') || 'None recorded'}
            </div>
          ` : ""}
          <div class="remark-line"><span class="remark-header">CLASS TEACHER:</span> ${teacherRemarks || "Satisfactory performance."}</div>
          <div class="remark-line"><span class="remark-header">ADMINISTRATIVE:</span> ${adminRemarks || "Keep up the hard work."}</div>
          <div class="remark-line"><span class="remark-header">NEXT TERM BEGINS:</span> <b>${nextTermBegins || "TBA"}</b></div>
          ${promotedTo ? `<div class="remark-line"><span class="remark-header">PROMOTED TO:</span> <b>${promotedTo}</b></div>` : ""}
        </div>

        <div class="footer">
          <div class="sig-section" style="width: 60%; text-align: left;">
            ${sigDataUri ? `<img src="${sigDataUri}" class="sig-image" style="margin-left: 20px;" />` : '<div style="height:45pt;"></div>'}
            <div class="sig-line" style="width: 80%; margin-left: 0;"></div>
            <div class="sig-label" style="margin-left: 20px;">Head of Institution</div>
          </div>
          <div class="qr-section">
            <img src="${qrDataUri}" class="qr-img"/>
            <div style="font-size:7pt; color:#64748B; margin-top:4pt;">Verify Report</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
