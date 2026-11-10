import { rgb } from "pdf-lib";
import { BasePDFGenerator, FONT_SIZE, MARGIN, PAGE_WIDTH, A4_HEIGHT, A4_WIDTH } from "./BasePDFGenerator";
import { PDFGenerationOptions } from "./types";

export interface AIReportPDFData {
  title: string;
  generatedAt: string;
  executiveSummary: string;
  markdownContent: string;
  keyStats: { label: string; value: string; change?: string }[];
  highlights: string[];
  recommendations: string[];
}

export class AIReportPDFGenerator extends BasePDFGenerator {
  // Set useAutoHeader to false so the letterhead ONLY draws once on Page 1
  protected useAutoHeader = false;

  protected drawHeader() {
    this.currentY = A4_HEIGHT - MARGIN;
    const startY = this.currentY;
    let headerHeight = 75;

    // Header Background Shading
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: startY - headerHeight + 5,
      width: PAGE_WIDTH,
      height: headerHeight,
      color: rgb(0.97, 0.98, 1),
    });

    let textLeftMargin = MARGIN + 15;

    // Logo (Right Aligned)
    if (this.logoImage) {
      const targetHeight = 45;
      const logoDims = this.logoImage.scale(targetHeight / this.logoImage.height);
      this.currentPage.drawImage(this.logoImage, {
        x: MARGIN + PAGE_WIDTH - logoDims.width - 15,
        y: startY - targetHeight - 10,
        width: logoDims.width,
        height: targetHeight,
      });
    }

    // Official School Name (Uppercase, bold, primary brand color)
    this.currentPage.drawText(this.sanitizeText((this.options.schoolName || "").toUpperCase()), {
      x: textLeftMargin,
      y: startY - 20,
      size: 15,
      font: this.boldFont,
      color: this.primaryColor,
    });

    let infoY = startY - 35;

    // School Motto
    if (this.options.schoolMotto) {
      this.currentPage.drawText(this.sanitizeText(`"${this.options.schoolMotto}"`), {
        x: textLeftMargin,
        y: infoY,
        size: 8.5,
        font: this.font,
        color: rgb(0.4, 0.45, 0.5),
      });
      infoY -= 13;
    }

    // Contact Details (Address | Tel | Email)
    const contactText = [
      this.options.schoolAddress,
      this.options.schoolHotline ? `Tel: ${this.options.schoolHotline}` : null,
      this.options.schoolEmail ? `Email: ${this.options.schoolEmail}` : null,
    ]
      .filter(Boolean)
      .join("   |   ");

    if (contactText) {
      this.currentPage.drawText(this.sanitizeText(contactText), {
        x: textLeftMargin,
        y: infoY,
        size: 8,
        font: this.font,
        color: rgb(0.35, 0.4, 0.45),
      });
    }

    // Double Decorative Letterhead Rules
    this.currentY = startY - headerHeight - 4;
    this.drawLine(MARGIN, this.currentY, MARGIN + PAGE_WIDTH, this.currentY, 2, this.primaryColor);
    this.currentY -= 3;
    this.drawLine(
      MARGIN + PAGE_WIDTH * 0.1,
      this.currentY,
      MARGIN + PAGE_WIDTH * 0.9,
      this.currentY,
      0.75,
      this.secondaryColor,
    );
    this.currentY -= 16;
  }

  public async generate(data: AIReportPDFData): Promise<string> {
    await this.initialize();
    this.addPage();
    this.drawHeader(); // Letterhead drawn ONLY ONCE on Page 1

    // Title Banner
    this.drawTitleBanner(data.title || "END-OF-TERM ADMINISTRATIVE REPORT");

    // Sub-date
    this.drawText(this.sanitizeText(`Generated on: ${data.generatedAt}`), MARGIN, {
      size: 8.5,
      font: this.font,
      color: rgb(0.4, 0.45, 0.5),
    });
    this.currentY -= 12;

    // Executive Summary Box
    if (data.executiveSummary) {
      this.ensureSpace(50);
      const summaryBoxHeight = 45;

      this.currentPage.drawRectangle({
        x: MARGIN,
        y: this.currentY - summaryBoxHeight,
        width: PAGE_WIDTH,
        height: summaryBoxHeight,
        color: rgb(0.93, 0.96, 1),
      });

      this.currentPage.drawRectangle({
        x: MARGIN,
        y: this.currentY - summaryBoxHeight,
        width: 4,
        height: summaryBoxHeight,
        color: this.primaryColor,
      });

      this.drawText("EXECUTIVE SUMMARY", MARGIN + 12, {
        size: 9,
        font: this.boldFont,
        color: this.primaryColor,
      });
      this.currentY -= 2;

      this.drawText(this.sanitizeText(data.executiveSummary.replace(/\*\*/g, "")), MARGIN + 12, {
        size: 8.5,
        font: this.font,
        color: rgb(0.2, 0.25, 0.35),
        maxWidth: PAGE_WIDTH - 24,
      });
      this.currentY -= 18;
    }

    // Key Stats Grid
    if (data.keyStats && data.keyStats.length > 0) {
      this.ensureSpace(40);
      const cardWidth = (PAGE_WIDTH - 12) / Math.min(data.keyStats.length, 4);
      const cardHeight = 36;
      let xOffset = MARGIN;

      data.keyStats.slice(0, 4).forEach((stat) => {
        this.currentPage.drawRectangle({
          x: xOffset,
          y: this.currentY - cardHeight,
          width: cardWidth - 4,
          height: cardHeight,
          color: rgb(0.97, 0.98, 0.99),
          borderColor: rgb(0.88, 0.91, 0.94),
          borderWidth: 1,
        });

        this.currentPage.drawText(this.sanitizeText(stat.label.toUpperCase()), {
          x: xOffset + 6,
          y: this.currentY - 12,
          size: 7,
          font: this.boldFont,
          color: rgb(0.4, 0.45, 0.5),
        });

        this.currentPage.drawText(this.sanitizeText(stat.value), {
          x: xOffset + 6,
          y: this.currentY - 26,
          size: 11,
          font: this.boldFont,
          color: rgb(0.1, 0.15, 0.25),
        });

        xOffset += cardWidth;
      });

      this.currentY -= cardHeight + 14;
    }

    // Markdown Content Sections
    const lines = (data.markdownContent || "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        this.currentY -= 4;
        continue;
      }

      const cleanLine = line.replace(/\*\*/g, "");

      if (cleanLine.startsWith("## ")) {
        this.ensureSpace(24);
        this.drawSectionHeader(cleanLine.replace("## ", ""));
      } else if (cleanLine.startsWith("### ")) {
        this.ensureSpace(18);
        this.drawText(this.sanitizeText(cleanLine.replace("### ", "").toUpperCase()), MARGIN, {
          size: 9.5,
          font: this.boldFont,
          color: this.secondaryColor,
        });
        this.currentY -= 12;
      } else if (cleanLine.startsWith("- ")) {
        this.ensureSpace(14);
        this.drawText(this.sanitizeText(`• ${cleanLine.replace("- ", "")}`), MARGIN + 10, {
          size: 8.5,
          font: this.font,
          color: rgb(0.2, 0.25, 0.3),
          maxWidth: PAGE_WIDTH - 20,
        });
        this.currentY -= 10;
      } else if (cleanLine.includes("*Suggestion:*") || cleanLine.includes("Suggestion:")) {
        this.ensureSpace(30);
        const sugText = cleanLine.replace(/\*Suggestion:\*|Suggestion:/g, "").trim();

        this.currentPage.drawRectangle({
          x: MARGIN,
          y: this.currentY - 26,
          width: PAGE_WIDTH,
          height: 26,
          color: rgb(1, 0.98, 0.92),
          borderColor: rgb(0.96, 0.72, 0.2),
          borderWidth: 1,
        });

        this.drawText("SUGGESTION:", MARGIN + 6, {
          size: 7.5,
          font: this.boldFont,
          color: rgb(0.7, 0.35, 0.05),
        });

        this.drawText(this.sanitizeText(sugText), MARGIN + 70, {
          size: 7.5,
          font: this.font,
          color: rgb(0.45, 0.2, 0.05),
          maxWidth: PAGE_WIDTH - 80,
        });
        this.currentY -= 32;
      } else {
        this.ensureSpace(12);
        this.drawText(this.sanitizeText(cleanLine), MARGIN, {
          size: 8.5,
          font: this.font,
          color: rgb(0.2, 0.25, 0.3),
          maxWidth: PAGE_WIDTH,
        });
        this.currentY -= 11;
      }
    }

    // Strategic Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      this.ensureSpace(60);
      this.currentY -= 10;
      this.drawSectionHeader("STRATEGIC RECOMMENDATIONS");

      data.recommendations.forEach((rec, rIdx) => {
        const cleanRec = rec.replace(/\*\*/g, "");
        this.ensureSpace(12);
        this.drawText(this.sanitizeText(`${rIdx + 1}. ${cleanRec}`), MARGIN + 8, {
          size: 8.5,
          font: this.boldFont,
          color: rgb(0.1, 0.4, 0.2),
          maxWidth: PAGE_WIDTH - 16,
        });
        this.currentY -= 12;
      });
    }

    // Official Sign-Off Box
    this.ensureSpace(100);
    this.currentY -= 15;
    const signoffHeight = 85;

    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.currentY - signoffHeight,
      width: PAGE_WIDTH,
      height: signoffHeight,
      color: rgb(0.98, 0.97, 1),
      borderColor: rgb(0.88, 0.82, 0.96),
      borderWidth: 1,
    });

    this.drawText("OFFICIAL ADMINISTRATIVE SIGN-OFF & APPROVAL", MARGIN + 12, {
      size: 8.5,
      font: this.boldFont,
      color: rgb(0.4, 0.15, 0.6),
    });
    this.currentY -= 20;

    const colWidth = (PAGE_WIDTH - 40) / 2;

    // Prepared by Line
    this.drawLine(MARGIN + 12, this.currentY - 15, MARGIN + 12 + colWidth, this.currentY - 15, 1, rgb(0.5, 0.5, 0.5));
    this.currentPage.drawText("Prepared by: Headmaster / Administrator", {
      x: MARGIN + 12,
      y: this.currentY - 26,
      size: 8,
      font: this.boldFont,
      color: rgb(0.2, 0.2, 0.3),
    });

    // Reviewed by Line
    const col2X = MARGIN + 20 + colWidth;
    this.drawLine(col2X, this.currentY - 15, col2X + colWidth, this.currentY - 15, 1, rgb(0.5, 0.5, 0.5));
    this.currentPage.drawText("Reviewed by: Proprietor / Board Chair", {
      x: col2X,
      y: this.currentY - 26,
      size: 8,
      font: this.boldFont,
      color: rgb(0.2, 0.2, 0.3),
    });

    this.currentY -= 40;

    // Date Line
    this.drawLine(MARGIN + 12, this.currentY - 5, MARGIN + 12 + colWidth * 0.6, this.currentY - 5, 1, rgb(0.5, 0.5, 0.5));
    this.currentPage.drawText("Date: ________________________", {
      x: MARGIN + 12,
      y: this.currentY - 16,
      size: 8,
      font: this.boldFont,
      color: rgb(0.2, 0.2, 0.3),
    });

    // Stamp Box
    this.currentPage.drawRectangle({
      x: col2X + colWidth / 2 - 40,
      y: this.currentY - 25,
      width: 100,
      height: 35,
      borderColor: rgb(0.6, 0.6, 0.7),
      borderWidth: 1,
    });
    this.currentPage.drawText("OFFICIAL SCHOOL STAMP", {
      x: col2X + colWidth / 2 - 32,
      y: this.currentY - 12,
      size: 6.5,
      font: this.boldFont,
      color: rgb(0.5, 0.5, 0.6),
    });

    return await this.savePdf();
  }
}
