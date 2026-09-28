import { BasePDFGenerator, MARGIN } from "./BasePDFGenerator";
import { rgb } from "pdf-lib";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export const LANDSCAPE_WIDTH = 841.89;
export const LANDSCAPE_HEIGHT = 595.28;
export const LANDSCAPE_MARGIN = 30;
export const LANDSCAPE_PAGE_WIDTH = LANDSCAPE_WIDTH - LANDSCAPE_MARGIN * 2;

export interface TimetablePDFData {
  className: string;
  curriculum: string;
  timetableDays: Record<string, Array<{ startTime?: string; endTime?: string; subject: string }>>;
  numColumns: number;
  otherActivities?: Array<{ title: string; time?: string }>;
}

export class TimetablePDFGenerator extends BasePDFGenerator {
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

    // Frame
    this.currentPage.drawRectangle({
      x: 15,
      y: 15,
      width: LANDSCAPE_WIDTH - 30,
      height: LANDSCAPE_HEIGHT - 30,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
    });

    if (this.useAutoHeader) {
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
    this.drawText(this.options.schoolName.toUpperCase(), LANDSCAPE_MARGIN, {
      size: 16,
      font: this.boldFont,
      color: this.primaryColor,
      align: "center",
      maxWidth: LANDSCAPE_PAGE_WIDTH,
      skipEnsureSpace: true,
    });
    this.currentY -= 18;

    const contactText = [
      this.options.schoolHotline ? `Tel: ${this.options.schoolHotline}` : null,
      this.options.schoolEmail ? `Email: ${this.options.schoolEmail}` : null,
      this.options.schoolAddress ? `Address: ${this.options.schoolAddress}` : null,
    ]
      .filter(Boolean)
      .join("   |   ");

    if (contactText) {
      this.drawText(contactText, LANDSCAPE_MARGIN, {
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
    const titleBoxHeight = 28;
    this.ensureSpace(titleBoxHeight);

    this.drawRect(LANDSCAPE_MARGIN, LANDSCAPE_PAGE_WIDTH, titleBoxHeight, {
      color: this.primaryColor,
    });

    const bannerText = text.toUpperCase();
    const fontSize = 12;
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

  public async generate(data: TimetablePDFData) {
    await this.initialize();
    this.addPage();

    // Title Banner: Class Timetable
    this.drawTitleBanner(`Class Timetable: ${data.className} (${data.curriculum || "General"} Curriculum)`);
    this.currentY -= 5;

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const numCols = data.numColumns || 6;
    const dayColWidth = 100;
    const periodColWidth = (LANDSCAPE_PAGE_WIDTH - dayColWidth) / numCols;

    const rowHeight = 70;
    const headerRowHeight = 46;

    this.ensureSpace(headerRowHeight + 15);

    let headerX = LANDSCAPE_MARGIN;
    // Day header
    this.drawRect(headerX, dayColWidth, headerRowHeight, { color: this.primaryColor });
    this.currentPage.drawText("DAY / PERIOD", {
      x: headerX + 8,
      y: this.currentY - headerRowHeight / 2 - 4,
      size: 9.5,
      font: this.boldFont,
      color: rgb(1, 1, 1),
    });
    headerX += dayColWidth;

    for (let i = 0; i < numCols; i++) {
      this.drawRect(headerX, periodColWidth, headerRowHeight, { color: this.primaryColor });

      const periodLabel = `Period ${i + 1}`;
      const firstDayPeriods = data.timetableDays["Monday"] || data.timetableDays[Object.keys(data.timetableDays)[0]] || [];
      const periodInfo = firstDayPeriods[i];
      const startTime = periodInfo?.startTime || "";
      const endTime = periodInfo?.endTime || "";

      // 1. Period Title (Top)
      const titleWidth = this.boldFont.widthOfTextAtSize(periodLabel, 8.5);
      this.currentPage.drawText(periodLabel, {
        x: headerX + (periodColWidth - titleWidth) / 2,
        y: this.currentY - 11,
        size: 8.5,
        font: this.boldFont,
        color: rgb(1, 1, 1),
      });

      // 2. Start Time (Middle - moved up)
      if (startTime) {
        const startWidth = this.font.widthOfTextAtSize(startTime, 7.5);
        this.currentPage.drawText(startTime, {
          x: headerX + (periodColWidth - startWidth) / 2,
          y: this.currentY - 24,
          size: 7.5,
          font: this.font,
          color: rgb(0.9, 0.93, 1),
        });
      }

      // 3. End Time (Bottom - came down)
      if (endTime) {
        const endWidth = this.font.widthOfTextAtSize(endTime, 7.5);
        this.currentPage.drawText(endTime, {
          x: headerX + (periodColWidth - endWidth) / 2,
          y: this.currentY - 37,
          size: 7.5,
          font: this.font,
          color: rgb(0.9, 0.93, 1),
        });
      }

      headerX += periodColWidth;
    }
    this.currentY -= headerRowHeight;

    // Table Rows (Days)
    days.forEach((day, index) => {
      this.ensureSpace(rowHeight);
      let rowX = LANDSCAPE_MARGIN;
      const rowBg = index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.98, 1);

      // Day cell
      this.drawRect(rowX, dayColWidth, rowHeight, {
        color: rowBg,
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 0.75,
      });
      this.currentPage.drawText(day, {
        x: rowX + 10,
        y: this.currentY - rowHeight + (rowHeight - 11) / 2,
        size: 11,
        font: this.boldFont,
        color: this.primaryColor,
      });
      rowX += dayColWidth;

      // Period cells
      const dayPeriods = data.timetableDays[day] || [];
      for (let i = 0; i < numCols; i++) {
        const periodData = dayPeriods[i] || { subject: "" };
        const subjectText = periodData.subject || "";

        this.drawRect(rowX, periodColWidth, rowHeight, {
          color: rowBg,
          borderColor: rgb(0.85, 0.88, 0.92),
          borderWidth: 0.75,
        });

        if (subjectText) {
          const fontSize = 10;
          const textWidth = this.font.widthOfTextAtSize(subjectText, fontSize);
          const textX = rowX + Math.max(6, (periodColWidth - textWidth) / 2);

          this.currentPage.drawText(subjectText, {
            x: textX,
            y: this.currentY - rowHeight + (rowHeight - fontSize) / 2,
            size: fontSize,
            font: this.boldFont,
            color: rgb(0.12, 0.16, 0.23),
            maxWidth: periodColWidth - 12,
          });
        }

        rowX += periodColWidth;
      }
      this.currentY -= rowHeight;
    });

    // Other activities section if present
    if (data.otherActivities && data.otherActivities.length > 0) {
      this.currentY -= 15;
      this.drawSectionHeader("Other Activities & Breaks");
      this.currentY -= 5;

      data.otherActivities.forEach((act) => {
        this.ensureSpace(18);
        this.drawText(`• ${act.title}${act.time ? ` (${act.time})` : ""}`, LANDSCAPE_MARGIN, {
          size: 9.5,
          font: this.font,
          color: rgb(0.2, 0.25, 0.3),
        });
        this.currentY -= 5;
      });
    }

    return this.saveLandscapePdf();
  }

  protected async saveLandscapePdf() {
    const pages = this.pdfDoc.getPages();
    pages.forEach((page) => {
      page.drawText(`OFFICIAL TIMETABLE - ${this.options.schoolName}`, {
        x: LANDSCAPE_MARGIN,
        y: 18,
        size: 7.5,
        font: this.font,
        color: rgb(0.5, 0.55, 0.6),
      });

      const footerRight = `Generated by EduEaz Platform`;
      page.drawText(footerRight, {
        x: LANDSCAPE_WIDTH - LANDSCAPE_MARGIN - this.font.widthOfTextAtSize(footerRight, 7.5),
        y: 18,
        size: 7.5,
        font: this.font,
        color: rgb(0.5, 0.55, 0.6),
      });
    });

    const pdfBytes = await this.pdfDoc.save();
    const fileName = `${this.options.fileName}_${Date.now()}.pdf`;

    if (Platform.OS === "web") {
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      return fileName;
    }

    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    const uint8Array = new Uint8Array(pdfBytes);
    let binary = "";
    const len = uint8Array.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(fileUri);
    return fileUri;
  }
}
