import { rgb } from "pdf-lib";
import { BasePDFGenerator, FONT_SIZE, MARGIN, PAGE_WIDTH, A4_HEIGHT, A4_WIDTH } from "./BasePDFGenerator";
import { FeeReportData } from "./types";

export class FeeReportGenerator extends BasePDFGenerator {
  protected useAutoHeader = true;

  protected drawHeader() {
    const startY = this.currentY;
    const headerHeight = 90;

    // Background Gradient-like effect
    this.currentPage.drawRectangle({
      x: 0,
      y: startY - headerHeight + 20,
      width: A4_WIDTH,
      height: headerHeight - 20,
      color: rgb(0.97, 0.98, 1),
    });

    // Logo (Centered at the very top)
    let infoStartY = startY - 10;
    if (this.logoImage) {
      const targetHeight = 40;
      const logoDims = this.logoImage.scale(targetHeight / this.logoImage.height);
      this.currentPage.drawImage(this.logoImage, {
        x: (A4_WIDTH - logoDims.width) / 2,
        y: startY - targetHeight,
        width: logoDims.width,
        height: targetHeight,
      });
      infoStartY = startY - targetHeight - 10;
    }

    this.currentY = infoStartY;

    // School Name
    this.drawText(this.options.schoolName.toUpperCase(), MARGIN, {
      size: 16,
      font: this.boldFont,
      color: this.primaryColor,
      align: "center",
      maxWidth: PAGE_WIDTH,
      skipEnsureSpace: true,
    });

    this.currentY -= 20;

    // Contact Info (Row)
    const contactInfo = [
        this.options.schoolAddress,
        this.options.schoolHotline ? `Tel: ${this.options.schoolHotline}` : null,
        this.options.schoolEmail ? `Email: ${this.options.schoolEmail}` : null,
    ].filter(Boolean).join("  •  ");

    if (contactInfo) {
        this.drawText(contactInfo, MARGIN, {
            size: 8,
            font: this.font,
            color: rgb(0.4, 0.4, 0.5),
            align: "center",
            maxWidth: PAGE_WIDTH,
            skipEnsureSpace: true,
        });
    }

    this.currentY = startY - headerHeight;

    // Bottom Decorative Bar
    this.currentPage.drawRectangle({
        x: MARGIN,
        y: this.currentY,
        width: PAGE_WIDTH,
        height: 2,
        color: this.primaryColor
    });

    this.currentY -= 20;
  }

  async generate(data: FeeReportData) {
    await this.initialize();
    this.addPage();

    this.drawTitleBanner("COMPREHENSIVE FEE STATUS REPORT");

    this.drawText(`Academic Year: ${data.academicYear} | Term: ${data.term}`, MARGIN, {
      size: FONT_SIZE.small,
      color: rgb(0.45, 0.5, 0.58),
      align: "center",
      maxWidth: PAGE_WIDTH,
    });

    this.currentY -= 20;

    const finalCurrency = data.currencySymbol === "₵" ? "GHS" : (data.currencySymbol || "GHS");

    Object.entries(data.groupedData).forEach(([className, students]) => {
      this.ensureSpace(100);

      this.drawSectionHeader(`CLASS: ${className}`);

      const columns = [
        { header: "STUDENT NAME", width: 175.28 },
        { header: "ID", width: 70 },
        { header: `PAYABLE`, width: 85, align: "right" as const },
        { header: `PAID`, width: 85, align: "right" as const },
        { header: `BALANCE`, width: 100, align: "right" as const },
      ];

      const rows = students.map((s) => [
        s.fullName.toUpperCase(),
        s.studentID,
        s.totalPayable.toFixed(2),
        s.amountPaid.toFixed(2),
        s.balance.toFixed(2),
      ]);

      this.drawTable(MARGIN, columns, rows, {
        headerBgColor: this.primaryColor,
      });

      const classTotalPayable = students.reduce((sum, s) => sum + s.totalPayable, 0);
      const classTotalPaid = students.reduce((sum, s) => sum + s.amountPaid, 0);
      const classTotalBalance = students.reduce((sum, s) => sum + s.balance, 0);

      this.currentY -= 15;
      const boxHeight = 26;
      const boxTopY = this.currentY;

      // Professional summary row style
      this.drawRect(MARGIN, PAGE_WIDTH, boxHeight, {
        color: rgb(0.96, 0.96, 0.96),
      });
      this.drawLine(MARGIN, boxTopY, MARGIN + PAGE_WIDTH, boxTopY, 0.5, rgb(0.85, 0.85, 0.85));
      this.drawLine(MARGIN, boxTopY - boxHeight, MARGIN + PAGE_WIDTH, boxTopY - boxHeight, 0.5, rgb(0.85, 0.85, 0.85));

      const boxFontSize = 8.5;
      this.currentY = boxTopY - (boxHeight - boxFontSize) / 2 - 2;
      this.drawText(
        `CLASS SUMMARY: ${students.length} Students | Payable: ${finalCurrency}${classTotalPayable.toFixed(2)} | Paid: ${finalCurrency}${classTotalPaid.toFixed(2)} | Balance: ${finalCurrency}${classTotalBalance.toFixed(2)}`,
        MARGIN + 12,
        {
          size: boxFontSize,
          font: this.boldFont,
          color: rgb(0.2, 0.2, 0.2),
          skipEnsureSpace: true,
        }
      );
      this.currentY = boxTopY - boxHeight - 25;
    });

    const isMultiClass = Object.keys(data.groupedData).length > 1;

    if (isMultiClass) {
      this.ensureSpace(220);
      if (this.currentY < A4_HEIGHT * 0.45) {
        this.addPage();
      }

      this.drawSectionHeader("SCHOOL-WIDE FINANCIAL SUMMARY");

      this.drawText(`Consolidated Report for Academic Year: ${data.academicYear} | ${data.term}`, MARGIN + 12, {
        size: FONT_SIZE.small,
        color: rgb(0.45, 0.5, 0.58),
      });

      this.currentY -= 10;

      const currency = finalCurrency;
      const summaryData = [
        ["Total Fees Payable", `${currency} ${data.schoolTotals.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
        ["Total Discounts Granted", `${currency} ${data.schoolTotals.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
        ["Total Amount Paid", `${currency} ${data.schoolTotals.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
        ["Total Outstanding Balance", `${currency} ${data.schoolTotals.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
      ];

      const summaryColumns = [
        { header: "CATEGORY", width: 315.28 },
        { header: `AMOUNT (${currency})`, width: 200, align: "right" as const },
      ];

      this.drawTable(MARGIN, summaryColumns, summaryData, {
        headerBgColor: this.primaryColor,
        rowHeight: 26,
      });
    }

    return this.savePdf();
  }
}
