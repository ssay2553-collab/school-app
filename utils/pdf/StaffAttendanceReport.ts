import { rgb } from "pdf-lib";
import { BasePDFGenerator, FONT_SIZE } from "./BasePDFGenerator";
import { StaffAttendancePDFData, WeeklyStaffLog, DailyStaffLog } from "./types";
import { SCHOOL_CONFIG } from "../../constants/Config";

export const LANDSCAPE_WIDTH = 841.89;
export const LANDSCAPE_HEIGHT = 595.28;
export const LANDSCAPE_MARGIN = 30;
export const LANDSCAPE_PAGE_WIDTH = LANDSCAPE_WIDTH - LANDSCAPE_MARGIN * 2;

export class StaffAttendancePDFGenerator extends BasePDFGenerator {
  constructor(options: any) {
    super(options);
    this.useAutoHeader = true;
  }

  protected addPage() {
    this.currentPage = this.pdfDoc.addPage([LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT]);
    this.currentY = LANDSCAPE_HEIGHT - LANDSCAPE_MARGIN - 5;

    // Background tint
    this.currentPage.drawRectangle({
      x: 0,
      y: 0,
      width: LANDSCAPE_WIDTH,
      height: LANDSCAPE_HEIGHT,
      color: rgb(0.99, 0.99, 1),
    });

    // Outer Frame
    this.currentPage.drawRectangle({
      x: 15,
      y: 15,
      width: LANDSCAPE_WIDTH - 30,
      height: LANDSCAPE_HEIGHT - 30,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
    });

    if (this.useAutoHeader && this.pdfDoc.getPageCount() === 1) {
      this.drawLandscapeHeader();
    }
  }

  protected drawLandscapeHeader() {
    const startY = this.currentY;

    // Top Decorative Accent Strip
    this.currentPage.drawRectangle({
      x: LANDSCAPE_MARGIN,
      y: startY + 10,
      width: LANDSCAPE_PAGE_WIDTH,
      height: 3,
      color: this.primaryColor,
    });

    // School Name
    this.drawText(this.sanitizeText(this.options.schoolName.toUpperCase()), LANDSCAPE_MARGIN, {
      size: 15,
      font: this.boldFont,
      color: this.primaryColor,
      align: "center",
      maxWidth: LANDSCAPE_PAGE_WIDTH,
      skipEnsureSpace: true,
    });
    this.currentY -= 18;

    const contactText = [
      this.options.schoolAddress,
      this.options.schoolHotline ? `Tel: ${this.options.schoolHotline}` : null,
      this.options.schoolEmail ? `Email: ${this.options.schoolEmail}` : null,
    ]
      .filter(Boolean)
      .join("   |   ");

    if (contactText) {
      this.drawText(this.sanitizeText(contactText), LANDSCAPE_MARGIN, {
        size: 8,
        color: rgb(0.3, 0.35, 0.4),
        align: "center",
        maxWidth: LANDSCAPE_PAGE_WIDTH,
        skipEnsureSpace: true,
      });
      this.currentY -= 12;
    }

    // Bottom Decorative Rule
    this.drawLine(LANDSCAPE_MARGIN, this.currentY, LANDSCAPE_WIDTH - LANDSCAPE_MARGIN, this.currentY, 1.2, this.primaryColor);
    this.currentY -= 10;
  }

  protected drawTitleBanner(text: string) {
    const titleBoxHeight = 26;
    this.ensureSpace(titleBoxHeight);

    this.drawRect(LANDSCAPE_MARGIN, LANDSCAPE_PAGE_WIDTH, titleBoxHeight, {
      color: this.primaryColor,
    });

    const bannerText = this.sanitizeText(text.toUpperCase());
    const fontSize = 11;
    const textWidth = this.boldFont.widthOfTextAtSize(bannerText, fontSize);

    this.currentPage.drawText(bannerText, {
      x: LANDSCAPE_MARGIN + (LANDSCAPE_PAGE_WIDTH - textWidth) / 2,
      y: this.currentY - titleBoxHeight / 2 - fontSize / 2 + 2,
      size: fontSize,
      font: this.boldFont,
      color: rgb(1, 1, 1),
    });
    this.currentY -= titleBoxHeight + 10;
  }

  public async generate(data: StaffAttendancePDFData) {
    await this.initialize();
    this.addPage();

    this.drawTitleBanner("STAFF ATTENDANCE DETAILED LOG & WEEKLY BREAKDOWN REPORT");

    this.drawText(
      this.sanitizeText(
        `Filter Period: ${data.timeFilter.toUpperCase()}   |   Generated: ${data.generatedAt}   |   School: ${this.options.schoolName}`
      ),
      LANDSCAPE_MARGIN,
      {
        size: 8.5,
        color: rgb(0.4, 0.45, 0.52),
        align: "center",
        maxWidth: LANDSCAPE_PAGE_WIDTH,
      }
    );

    this.currentY -= 15;

    const weeks = data.weeks || [];

    if (weeks.length === 0) {
      this.drawText("No attendance logs available for the selected period.", LANDSCAPE_MARGIN, {
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
        align: "center",
        maxWidth: LANDSCAPE_PAGE_WIDTH,
      });
    } else {
      for (const week of weeks) {
        this.renderWeekBlock(week);
      }
    }

    // Overall Summary Section
    this.renderOverallSummary(data.overallStats || []);

    return await this.savePdf();
  }

  private renderWeekBlock(week: WeeklyStaffLog) {
    // Height needed for week header + table header + at least 1 staff row
    this.ensureSpace(120);

    // Week Title Banner
    const bannerHeight = 22;
    this.drawRect(LANDSCAPE_MARGIN, LANDSCAPE_PAGE_WIDTH, bannerHeight, {
      color: rgb(0.15, 0.23, 0.37),
    });

    const weekTitle = this.sanitizeText(week.weekLabel.toUpperCase());
    this.currentPage.drawText(weekTitle, {
      x: LANDSCAPE_MARGIN + 10,
      y: this.currentY - bannerHeight / 2 - 4,
      size: 9.5,
      font: this.boldFont,
      color: rgb(1, 1, 1),
    });
    this.currentY -= bannerHeight + 4;

    // Holidays banner if any
    if (week.holidays && week.holidays.length > 0) {
      const holText = this.sanitizeText(
        `HOLIDAYS / BREAKS IN THIS WEEK: ` + week.holidays.map(h => `${h.date} (${h.title})`).join("   |   ")
      );
      this.drawRect(LANDSCAPE_MARGIN, LANDSCAPE_PAGE_WIDTH, 18, {
        color: rgb(0.88, 0.94, 1.0),
        borderColor: rgb(0.7, 0.82, 0.96),
        borderWidth: 0.8,
      });
      this.currentPage.drawText(holText, {
        x: LANDSCAPE_MARGIN + 10,
        y: this.currentY - 13,
        size: 7.5,
        font: this.boldFont,
        color: rgb(0.05, 0.35, 0.65),
      });
      this.currentY -= 22;
    }

    // Table Column Dimensions
    const staffColWidth = 151;
    const dayColWidth = 126; // 126 * 5 = 630 => Total 781 pt
    const headerHeight = 22;

    this.ensureSpace(headerHeight + 35);

    // Render Table Header Row
    let startX = LANDSCAPE_MARGIN;

    // Staff Name Header
    this.drawRect(startX, staffColWidth, headerHeight, {
      color: this.primaryColor,
    });
    this.currentPage.drawText(this.sanitizeText("STAFF MEMBER"), {
      x: startX + 8,
      y: this.currentY - headerHeight / 2 - 3,
      size: 8.5,
      font: this.boldFont,
      color: rgb(1, 1, 1),
    });
    startX += staffColWidth;

    // Day Headers (Monday to Friday)
    week.days.forEach(d => {
      this.drawRect(startX, dayColWidth, headerHeight, {
        color: d.isHoliday ? rgb(0.2, 0.4, 0.6) : this.primaryColor,
      });
      const dayHeaderStr = this.sanitizeText(`${d.dayName.toUpperCase()} (${d.formattedDate})`);
      this.currentPage.drawText(dayHeaderStr, {
        x: startX + (dayColWidth - this.boldFont.widthOfTextAtSize(dayHeaderStr, 8)) / 2,
        y: this.currentY - headerHeight / 2 - 3,
        size: 8,
        font: this.boldFont,
        color: rgb(1, 1, 1),
      });
      startX += dayColWidth;
    });

    this.currentY -= headerHeight;

    // Render Staff Rows
    const rowHeight = 40;

    (week.staffLogs || []).forEach(st => {
      this.ensureSpace(rowHeight + 4);

      let cellX = LANDSCAPE_MARGIN;

      // Staff Name Cell
      this.drawRect(cellX, staffColWidth, rowHeight, {
        color: rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 0.5,
      });

      const sName = this.sanitizeText(st.teacherName);
      const sEmail = this.sanitizeText(st.teacherEmail || "");

      this.currentPage.drawText(sName.length > 22 ? sName.slice(0, 20) + "..." : sName, {
        x: cellX + 6,
        y: this.currentY - 14,
        size: 8.5,
        font: this.boldFont,
        color: rgb(0.1, 0.15, 0.25),
      });

      if (sEmail) {
        this.currentPage.drawText(sEmail.length > 25 ? sEmail.slice(0, 23) + "..." : sEmail, {
          x: cellX + 6,
          y: this.currentY - 28,
          size: 7,
          font: this.font,
          color: rgb(0.45, 0.5, 0.6),
        });
      }

      cellX += staffColWidth;

      // Render 5 Days Cells
      week.days.forEach(d => {
        const dayLog: DailyStaffLog = st.dailyLogs?.[d.date] || {
          date: d.date,
          dayName: d.dayName,
          status: 'Not Logged',
        };

        this.renderDailyCell(cellX, dayColWidth, rowHeight, dayLog);
        cellX += dayColWidth;
      });

      this.currentY -= rowHeight;
    });

    this.currentY -= 15;
  }

  private renderDailyCell(x: number, width: number, height: number, log: DailyStaffLog) {
    let bgColor = rgb(0.97, 0.97, 0.98); // default
    let borderColor = rgb(0.88, 0.88, 0.92);
    let statusText = "-";
    let statusColor = rgb(0.5, 0.5, 0.5);

    if (log.status === 'Holiday') {
      bgColor = rgb(0.93, 0.96, 1.0);
      borderColor = rgb(0.75, 0.85, 0.96);
      statusText = "HOLIDAY";
      statusColor = rgb(0.05, 0.35, 0.65);
    } else if (log.status === 'On Time') {
      bgColor = rgb(0.94, 0.98, 0.95);
      borderColor = rgb(0.75, 0.9, 0.8);
      statusText = "ON TIME";
      statusColor = rgb(0.02, 0.55, 0.3);
    } else if (log.status === 'Late') {
      bgColor = rgb(1.0, 0.97, 0.91);
      borderColor = rgb(0.95, 0.85, 0.65);
      statusText = "LATE";
      statusColor = rgb(0.8, 0.45, 0.0);
    } else if (log.status === 'Excused') {
      bgColor = rgb(0.93, 0.95, 1.0);
      borderColor = rgb(0.78, 0.84, 0.96);
      statusText = "EXCUSED";
      statusColor = rgb(0.12, 0.35, 0.85);
    } else if (log.status === 'Absent') {
      bgColor = rgb(0.99, 0.93, 0.93);
      borderColor = rgb(0.95, 0.75, 0.75);
      statusText = "ABSENT";
      statusColor = rgb(0.82, 0.12, 0.12);
    }

    this.drawRect(x, width, height, {
      color: bgColor,
      borderColor: borderColor,
      borderWidth: 0.5,
    });

    // Draw Status Text
    this.currentPage.drawText(this.sanitizeText(statusText), {
      x: x + 6,
      y: this.currentY - 12,
      size: 7.5,
      font: this.boldFont,
      color: statusColor,
    });

    if (log.status === 'Holiday') {
      const holTitle = this.sanitizeText(log.holidayTitle || "School Holiday");
      this.currentPage.drawText(holTitle.length > 18 ? holTitle.slice(0, 16) + "..." : holTitle, {
        x: x + 6,
        y: this.currentY - 26,
        size: 6.5,
        font: this.font,
        color: rgb(0.2, 0.4, 0.6),
      });
    } else if (log.status === 'On Time' || log.status === 'Late' || log.status === 'Excused') {
      const inStr = this.sanitizeText(`In:  ${log.checkInTime || "-"}`);
      const outStr = this.sanitizeText(`Out: ${log.checkOutTime || "-"}`);

      this.currentPage.drawText(inStr, {
        x: x + 6,
        y: this.currentY - 24,
        size: 6.8,
        font: this.font,
        color: rgb(0.2, 0.25, 0.35),
      });

      this.currentPage.drawText(outStr, {
        x: x + 6,
        y: this.currentY - 34,
        size: 6.8,
        font: this.font,
        color: rgb(0.2, 0.25, 0.35),
      });
    } else if (log.status === 'Absent') {
      this.currentPage.drawText(this.sanitizeText("No Check-In"), {
        x: x + 6,
        y: this.currentY - 25,
        size: 6.8,
        font: this.font,
        color: rgb(0.6, 0.2, 0.2),
      });
    }
  }

  private renderOverallSummary(stats: Array<{
    teacherName: string;
    teacherEmail?: string;
    totalDays: number;
    onTimeCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
  }>) {
    if (!stats || stats.length === 0) return;

    this.ensureSpace(100);

    // Title
    this.drawTitleBanner("OVERALL ATTENDANCE SUMMARY STATISTICS");

    const columns = [
      { header: "STAFF MEMBER", width: 220, align: "left" as const },
      { header: "TOTAL DAYS", width: 90, align: "center" as const },
      { header: "ON TIME", width: 90, align: "center" as const },
      { header: "LATE", width: 90, align: "center" as const },
      { header: "ABSENT", width: 90, align: "center" as const },
      { header: "EXCUSED", width: 90, align: "center" as const },
      { header: "RATE %", width: 111, align: "center" as const },
    ];

    const rows = stats.map(s => {
      const attended = s.onTimeCount + s.lateCount + (s.excusedCount || 0);
      const rate = s.totalDays > 0 ? Math.round((attended / s.totalDays) * 100) : 0;
      const cappedRate = Math.min(100, Math.max(0, rate));
      return [
        s.teacherName + (s.teacherEmail ? ` (${s.teacherEmail})` : ""),
        s.totalDays.toString(),
        s.onTimeCount.toString(),
        s.lateCount.toString(),
        s.absentCount.toString(),
        s.excusedCount.toString(),
        `${cappedRate}%`,
      ];
    });

    this.drawTable(LANDSCAPE_MARGIN, columns, rows, {
      headerBgColor: this.primaryColor,
      rowHeight: 22,
    });

    this.currentY -= 20;

    // Footer
    this.ensureSpace(30);
    this.drawLine(LANDSCAPE_MARGIN, this.currentY, LANDSCAPE_MARGIN + LANDSCAPE_PAGE_WIDTH, this.currentY, 0.5, rgb(0.8, 0.8, 0.8));
    this.currentY -= 12;

    const schoolDisplayName = this.options.schoolName || SCHOOL_CONFIG.fullName || SCHOOL_CONFIG.name || "EduEaz School";
    this.drawText(
      this.sanitizeText(`${schoolDisplayName} • Official Staff Attendance Detailed Audit Log`),
      LANDSCAPE_MARGIN,
      {
        size: 7.5,
        color: rgb(0.5, 0.55, 0.6),
        align: "center",
        maxWidth: LANDSCAPE_PAGE_WIDTH,
      }
    );
  }
}
