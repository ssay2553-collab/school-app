import { rgb } from "pdf-lib";
import { BasePDFGenerator, FONT_SIZE, MARGIN, PAGE_WIDTH, A4_HEIGHT, A4_WIDTH } from "./BasePDFGenerator";
import { TableColumn } from "./types";

export interface FeeItemDetail {
  name: string;
  billed: number;
  paid: number;
  discount: number;
  balance: number;
  collectionEfficiency: number;
}

export interface DailyPaymentsDetail {
  feedingTotal: number;
  feedingCount: number;
  busTotal: number;
  busCount: number;
  extraTotal: number;
  extraCount: number;
  totalDailyAuxiliary: number;
}

export interface AIReportPDFData {
  title: string;
  generatedAt: string;
  executiveSummary: string;
  markdownContent: string;
  keyStats: { label: string; value: string; change?: string }[];
  highlights: string[];
  recommendations: string[];
  feeItemsBreakdown?: FeeItemDetail[];
  dailyPaymentsBreakdown?: DailyPaymentsDetail;
}

export class AIReportPDFGenerator extends BasePDFGenerator {
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
      this.ensureSpace(55);
      const summaryBoxHeight = 50;

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
      this.ensureSpace(45);
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
          size: 10.5,
          font: this.boldFont,
          color: rgb(0.1, 0.15, 0.25),
        });

        xOffset += cardWidth;
      });

      this.currentY -= cardHeight + 14;
    }

    let renderedFeeTable = false;
    let renderedAuxTable = false;

    // Markdown Content Sections
    const lines = (data.markdownContent || "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        this.currentY -= 4;
        continue;
      }

      // Skip markdown table border/header markup lines since we draw real tables programmatically
      if (line.startsWith("|") || line.includes("---")) {
        continue;
      }

      const cleanLine = line.replace(/\*\*/g, "");

      // Check if we should render Fee Ledger Table strictly at Section 9.1
      if (!renderedFeeTable && data.feeItemsBreakdown && data.feeItemsBreakdown.length > 0 && (cleanLine.includes("9.1") || cleanLine.includes("Itemized Fee Ledger Breakdown"))) {
        this.ensureSpace(20);
        this.drawText("ITEMIZED FEE LEDGER BREAKDOWN & CATEGORY ANALYSIS", MARGIN, {
          size: 9.5,
          font: this.boldFont,
          color: this.secondaryColor,
        });
        this.currentY -= 8;

        const feeColumns: TableColumn[] = [
          { header: "Fee Category", width: 130, align: "left" },
          { header: "Billed (GHS)", width: 75, align: "right" },
          { header: "Paid (GHS)", width: 75, align: "right" },
          { header: "Discount", width: 65, align: "right" },
          { header: "Balance", width: 75, align: "right" },
          { header: "Eff %", width: 55, align: "right" },
        ];

        const feeRows = data.feeItemsBreakdown.map((item) => [
          item.name,
          `₵${item.billed.toLocaleString()}`,
          `₵${item.paid.toLocaleString()}`,
          `₵${item.discount.toLocaleString()}`,
          `₵${item.balance.toLocaleString()}`,
          `${item.collectionEfficiency}%`,
        ]);

        this.drawTable(MARGIN, feeColumns, feeRows, {
          headerBgColor: this.primaryColor,
          alternateRowColor: rgb(0.97, 0.98, 1),
          rowHeight: 18,
        });
        renderedFeeTable = true;
        this.currentY -= 10;
        continue;
      }

      // Check if we should render Daily Auxiliary Table strictly at Section 9.2
      if (!renderedAuxTable && data.dailyPaymentsBreakdown && data.dailyPaymentsBreakdown.totalDailyAuxiliary > 0 && (cleanLine.includes("9.2") || cleanLine.includes("Daily Auxiliary Payments"))) {
        this.ensureSpace(20);
        this.drawText("DAILY FINANCIAL PAYMENTS & AUXILIARY ALLOCATIONS", MARGIN, {
          size: 9.5,
          font: this.boldFont,
          color: this.secondaryColor,
        });
        this.currentY -= 8;

        const auxColumns: TableColumn[] = [
          { header: "Auxiliary Category", width: 220, align: "left" },
          { header: "Total Collected (GHS)", width: 140, align: "right" },
          { header: "Activity Logs Count", width: 115, align: "right" },
        ];

        const auxRows = [
          ["Feeding Fees Allocation", `₵${data.dailyPaymentsBreakdown.feedingTotal.toLocaleString()}`, `${data.dailyPaymentsBreakdown.feedingCount} logs`],
          ["Bus & Transportation Fees", `₵${data.dailyPaymentsBreakdown.busTotal.toLocaleString()}`, `${data.dailyPaymentsBreakdown.busCount} logs`],
          ["Extra Classes & Enrichment", `₵${data.dailyPaymentsBreakdown.extraTotal.toLocaleString()}`, `${data.dailyPaymentsBreakdown.extraCount} logs`],
          ["Total Daily Auxiliary Revenue", `₵${data.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}`, "Combined"],
        ];

        this.drawTable(MARGIN, auxColumns, auxRows, {
          headerBgColor: this.secondaryColor,
          alternateRowColor: rgb(0.97, 0.98, 1),
          rowHeight: 18,
        });
        renderedAuxTable = true;
        this.currentY -= 10;
        continue;
      }

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
      } else if (cleanLine.includes("*Intelligent Suggestion:*") || cleanLine.includes("*Suggestion:*") || cleanLine.includes("Suggestion:")) {
        this.ensureSpace(32);
        const sugText = cleanLine.replace(/\*Intelligent Suggestion:\*|\*Suggestion:\*|Suggestion:/g, "").trim();

        this.currentPage.drawRectangle({
          x: MARGIN,
          y: this.currentY - 28,
          width: PAGE_WIDTH,
          height: 28,
          color: rgb(1, 0.98, 0.92),
          borderColor: rgb(0.96, 0.72, 0.2),
          borderWidth: 1,
        });

        this.drawText("RECOMMENDATION / INSIGHT:", MARGIN + 6, {
          size: 7.5,
          font: this.boldFont,
          color: rgb(0.7, 0.35, 0.05),
        });

        this.drawText(this.sanitizeText(sugText), MARGIN + 120, {
          size: 7.5,
          font: this.font,
          color: rgb(0.45, 0.2, 0.05),
          maxWidth: PAGE_WIDTH - 130,
        });
        this.currentY -= 34;
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
      this.ensureSpace(70);
      this.currentY -= 10;
      this.drawSectionHeader("PRIORITIZED STRATEGIC RECOMMENDATIONS");

      data.recommendations.forEach((rec, rIdx) => {
        const cleanRec = rec.replace(/\*\*/g, "");
        this.ensureSpace(14);
        this.drawText(this.sanitizeText(`${rIdx + 1}. ${cleanRec}`), MARGIN + 8, {
          size: 8.5,
          font: this.boldFont,
          color: rgb(0.1, 0.4, 0.2),
          maxWidth: PAGE_WIDTH - 16,
        });
        this.currentY -= 14;
      });
    }

    // Official Sign-Off Box
    this.ensureSpace(105);
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

    this.drawPageNumbers();
    return await this.savePdf();
  }
}
