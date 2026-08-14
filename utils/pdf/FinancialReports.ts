import { rgb } from "pdf-lib";
import { BasePDFGenerator, FONT_SIZE, MARGIN, PAGE_WIDTH, A4_HEIGHT } from "./BasePDFGenerator";
import { FinancialSummaryData, FeeStatementData, FeeReceiptData } from "./types";

abstract class FinancialBaseGenerator extends BasePDFGenerator {
  protected useAutoHeader = true;

  protected drawHeader() {
    this.currentY = A4_HEIGHT - 10;
    const startY = this.currentY;
    const headerHeight = 70;

    // Subtle background for the header
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: startY - headerHeight + 10,
      width: PAGE_WIDTH,
      height: headerHeight - 10,
      color: rgb(0.98, 0.98, 1),
    });

    // Logo (Right Aligned)
    if (this.logoImage) {
      const targetHeight = 45;
      const logoDims = this.logoImage.scale(targetHeight / this.logoImage.height);
      this.currentPage.drawImage(this.logoImage, {
        x: MARGIN + PAGE_WIDTH - logoDims.width - 15,
        y: startY - targetHeight - 5,
        width: logoDims.width,
        height: targetHeight,
      });
    }

    // School Details (Left Aligned)
    this.currentPage.drawText(this.options.schoolName.toUpperCase(), {
      x: MARGIN + 15,
      y: startY - 18,
      size: 16,
      font: this.boldFont,
      color: this.primaryColor,
    });

    let infoY = startY - 35;
    const infoSize = 8.5;

    if (this.options.schoolAddress) {
      this.currentPage.drawText(this.options.schoolAddress, {
        x: MARGIN + 15,
        y: infoY,
        size: infoSize,
        font: this.font,
        color: rgb(0.3, 0.3, 0.4),
      });
      infoY -= 12;
    }

    const contactText = [
      this.options.schoolHotline ? `Tel: ${this.options.schoolHotline}` : null,
      this.options.schoolEmail ? `Email: ${this.options.schoolEmail}` : null,
    ]
      .filter(Boolean)
      .join("   |   ");

    if (contactText) {
      this.currentPage.drawText(contactText, {
        x: MARGIN + 15,
        y: infoY,
        size: infoSize,
        font: this.font,
        color: rgb(0.3, 0.3, 0.4),
      });
    }

    this.currentY = startY - headerHeight;
    // Elegant financial border
    this.drawLine(
      MARGIN,
      this.currentY,
      MARGIN + PAGE_WIDTH,
      this.currentY,
      2,
      this.primaryColor
    );
    this.currentY -= 15;
  }
}

export class FinancialSummaryGenerator extends FinancialBaseGenerator {
  async generate(data: FinancialSummaryData) {
    await this.initialize();
    this.addPage();

    this.drawTitleBanner("FINANCIAL SUMMARY REPORT");

    this.currentY -= 10;
    const finalCurrency = data.currencySymbol === "₵" ? "GHS" : (data.currencySymbol || "GHS");

    // 1. School Financial Standing (Top Summary)
    const cardWidth = (PAGE_WIDTH - 20) / 3;
    const cardHeight = 65;
    this.ensureSpace(cardHeight + 20);
    const cardsY = this.currentY;
    const netStanding = data.totalFees - data.totalExpenditure;

    // Total Fees Collected (Gen. Fees Only)
    this.drawRect(MARGIN, cardWidth, cardHeight, {
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    });
    this.currentY = cardsY - 15;
    this.drawText("GEN. FEES COLLECTED", MARGIN + 10, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.39, 0.45, 0.54),
    });
    this.drawText(`${finalCurrency} ${data.totalFees.toLocaleString()}`, MARGIN + 10, {
      size: 14,
      font: this.boldFont,
      color: rgb(0.06, 0.73, 0.5),
    });

    // Total Expenditure
    this.currentY = cardsY;
    this.drawRect(MARGIN + cardWidth + 10, cardWidth, cardHeight, {
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    });
    this.currentY = cardsY - 15;
    this.drawText("TOTAL EXPENDITURE", MARGIN + cardWidth + 20, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.39, 0.45, 0.54),
    });
    this.drawText(
      `${finalCurrency} ${data.totalExpenditure.toLocaleString()}`,
      MARGIN + cardWidth + 20,
      { size: 14, font: this.boldFont, color: rgb(0.94, 0.27, 0.27) }
    );

    // Net Financial Standing
    const netColor = netStanding >= 0 ? rgb(0.06, 0.73, 0.5) : rgb(0.94, 0.27, 0.27);
    this.currentY = cardsY;
    this.drawRect(MARGIN + (cardWidth + 10) * 2, cardWidth, cardHeight, {
      borderColor: netColor,
      borderWidth: 1,
      color: netStanding >= 0 ? rgb(0.94, 0.99, 0.96) : rgb(1, 0.95, 0.95),
    });
    this.currentY = cardsY - 15;
    this.drawText(
      "NET FINANCIAL STANDING (P/L)",
      MARGIN + (cardWidth + 10) * 2 + 10,
      { size: 7.5, font: this.boldFont, color: rgb(0.39, 0.45, 0.54) }
    );
    this.drawText(
      `${finalCurrency} ${netStanding.toLocaleString()}`,
      MARGIN + (cardWidth + 10) * 2 + 10,
      { size: 15, font: this.boldFont, color: netColor }
    );

    this.currentY = cardsY - cardHeight - 20;

    // 2. Fees & Charges Summary (Tuition + all items billed)
    this.drawSectionHeader("General Fees & Charges Detailed Ledger");
    const feeColumns = [
      { header: "ITEM", width: 150 },
      { header: "BILLED", width: 120, align: "right" as const },
      { header: "PAID", width: 120, align: "right" as const },
      { header: "BALANCE", width: 125, align: "right" as const },
    ];

    const feeRows = (data.ledgerItems || []).map(item => [
      item.name,
      `${finalCurrency} ${item.billed.toLocaleString()}`,
      `${finalCurrency} ${item.paid.toLocaleString()}`,
      `${finalCurrency} ${item.balance.toLocaleString()}`,
    ]);

    // Add Subtotal row for ledger
    feeRows.push([
      "TOTAL LEDGER",
      `${finalCurrency} ${data.totalBilled.toLocaleString()}`,
      `${finalCurrency} ${data.totalPaid.toLocaleString()}`,
      `${finalCurrency} ${data.totalOutstanding.toLocaleString()}`,
    ]);

    this.drawTable(MARGIN, feeColumns, feeRows, { headerBgColor: this.primaryColor });
    this.currentY -= 15;

    // 3. Discounts
    this.drawSectionHeader("Discounts Summary");
    this.drawText(
      `Total Students on Discount: ${data.discountCount}  |  Total Discount Amount: ${finalCurrency} ${data.totalDiscount.toLocaleString()}`,
      MARGIN + 10,
      { size: 10, font: this.font }
    );
    this.currentY -= 20;

    // 4. Daily Payments Breakdown (Feeding, Bus, Extra Classes)
    this.drawSectionHeader("Daily Payment Items Summary");
    const dailyColumns = [
      { header: "CATEGORY", width: 130 },
      { header: "THIS WEEK", width: 120, align: "right" as const },
      { header: "THIS MONTH", width: 130, align: "right" as const },
      { header: "TERM TOTAL", width: 135, align: "right" as const },
    ];

    const dailyRows = data.categories
      .filter(cat => ["Feeding Fees", "Bus Fees", "Extra Classes"].includes(cat.name))
      .map(cat => [
        cat.name,
        `${finalCurrency} ${cat.week.toLocaleString()}`,
        `${finalCurrency} ${cat.month.toLocaleString()}`,
        `${finalCurrency} ${cat.term.toLocaleString()}`,
      ]);

    this.drawTable(MARGIN, dailyColumns, dailyRows, { headerBgColor: this.primaryColor });
    this.currentY -= 5;
    this.drawText(
      `DAILY ITEMS TOTAL: ${finalCurrency} ${data.totalDailyPayments.toLocaleString()}`,
      MARGIN + PAGE_WIDTH - 200,
      {
        size: 10,
        font: this.boldFont,
        align: "right",
        maxWidth: 200,
        color: this.primaryColor,
      }
    );
    this.currentY -= 15;

    // 5. Overall Category Breakdown
    this.drawSectionHeader("Full Category Breakdown (Accumulated)");
    const columns = [
      { header: "CATEGORY", width: 250 },
      { header: "TRANSACTIONS", width: 120, align: "center" as const },
      { header: `TOTAL AMOUNT (${finalCurrency})`, width: 145, align: "right" as const },
    ];
    const rows = data.categories.map((cat) => [
      cat.name,
      cat.count,
      `${finalCurrency} ${cat.total.toLocaleString()}`,
    ]);
    this.drawTable(MARGIN, columns, rows, { headerBgColor: this.primaryColor });

    this.currentY = MARGIN + 40;
    this.drawText(
      "Financial Standing = General Fees Collected - Total Expenditure",
      MARGIN,
      {
        size: 8,
        color: rgb(0.58, 0.64, 0.71),
        align: "center",
        maxWidth: PAGE_WIDTH,
      }
    );

    return this.savePdf();
  }
}

export class FeeStatementGenerator extends FinancialBaseGenerator {
  async generate(data: FeeStatementData) {
    await this.initialize();
    this.addPage();

    this.drawTitleBanner("TERM FEE STATEMENT");

    const metaY = this.currentY;
    this.drawRect(MARGIN, PAGE_WIDTH, 50, {
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
      color: rgb(0.97, 0.98, 0.99),
    });
    this.currentY = metaY - 5;
    this.drawText("STUDENT:", MARGIN + 10, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    const studentNameY = this.currentY + 12;
    this.currentY = studentNameY;
    this.drawText(data.studentName, MARGIN + 60, {
      size: 10,
      font: this.boldFont,
    });
    this.currentY = studentNameY - 20;
    this.drawText("CLASS:", MARGIN + 10, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    const classY = this.currentY + 12;
    this.currentY = classY;
    this.drawText(data.studentClass, MARGIN + 60, {
      size: 10,
      font: this.boldFont,
    });

    const rightColX = MARGIN + PAGE_WIDTH / 2 + 20;
    this.currentY = studentNameY;
    this.drawText("TERM:", rightColX, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    this.currentY = studentNameY;
    this.drawText(data.term, rightColX + 40, { size: 10, font: this.boldFont });
    this.currentY = classY;
    this.drawText("YEAR:", rightColX, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    this.currentY = classY;
    this.drawText(data.academicYear, rightColX + 40, {
      size: 10,
      font: this.boldFont,
    });

    this.currentY = metaY - 50 - 20;

    const columns = [
      { header: "DESCRIPTION", width: 195 },
      {
        header: `BILLED (${data.currencySymbol})`,
        width: 100,
        align: "right" as const,
      },
      {
        header: `PAID (${data.currencySymbol})`,
        width: 100,
        align: "right" as const,
      },
      {
        header: `BALANCE (${data.currencySymbol})`,
        width: 120,
        align: "right" as const,
      },
    ];
    const rows = data.categorySummary.map((item) => [
      item.name.toUpperCase(),
      item.billed.toFixed(2),
      item.paid.toFixed(2),
      item.balance.toFixed(2),
    ]);
    this.drawTable(MARGIN, columns, rows, {
      headerBgColor: this.primaryColor,
      alternateRowColor: rgb(1, 1, 1),
    });

    this.currentY -= 20;
    const totalX = MARGIN + PAGE_WIDTH - 250;
    const subtotalY = this.currentY;
    this.drawText("SUBTOTAL BILLED:", totalX, {
      size: 10,
      font: this.boldFont,
      color: rgb(0.39, 0.45, 0.54),
    });
    this.currentY = subtotalY;
    this.drawText(
      `${data.currencySymbol} ${data.totals.billed.toFixed(2)}`,
      MARGIN + PAGE_WIDTH,
      { size: 10, font: this.boldFont, align: "right", maxWidth: 100 }
    );

    const totalPaidY = this.currentY;
    this.drawText("TOTAL PAID:", totalX, {
      size: 10,
      font: this.boldFont,
      color: rgb(0.39, 0.45, 0.54),
    });
    this.currentY = totalPaidY;
    this.drawText(
      `${data.currencySymbol} ${data.totals.paid.toFixed(2)}`,
      MARGIN + PAGE_WIDTH,
      {
        size: 10,
        font: this.boldFont,
        align: "right",
        maxWidth: 100,
        color: rgb(0.06, 0.73, 0.5),
      }
    );

    this.currentY -= 5;
    this.drawLine(
      totalX,
      this.currentY,
      MARGIN + PAGE_WIDTH,
      this.currentY,
      1.5,
      this.primaryColor
    );
    this.currentY -= 5;

    const netBalanceY = this.currentY;
    this.drawText("NET BALANCE DUE:", totalX, {
      size: 12,
      font: this.boldFont,
    });
    const balanceColor =
      data.totals.balance > 0 ? rgb(0.94, 0.27, 0.27) : rgb(0.06, 0.73, 0.5);
    this.currentY = netBalanceY;
    this.drawText(
      `${data.currencySymbol} ${data.totals.balance.toFixed(2)}`,
      MARGIN + PAGE_WIDTH,
      {
        size: 14,
        font: this.boldFont,
        align: "right",
        maxWidth: 100,
        color: balanceColor,
      }
    );

    this.currentY -= 40;
    this.drawText(
      "* This statement provides a comprehensive breakdown of your financial standing.",
      MARGIN,
      { size: 8, color: rgb(0.58, 0.64, 0.71) }
    );

    return this.savePdf();
  }
}

export class FeeReceiptGenerator extends FinancialBaseGenerator {
  async generate(data: FeeReceiptData) {
    await this.initialize();
    this.addPage();

    this.drawTitleBanner("OFFICIAL PAYMENT RECEIPT");

    const metaY = this.currentY;
    this.drawRect(MARGIN, PAGE_WIDTH, 50, {
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
      color: rgb(0.97, 0.98, 0.99),
    });
    this.currentY = metaY - 5;
    this.drawText("STUDENT:", MARGIN + 10, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    const studentNameY = this.currentY + 12;
    this.currentY = studentNameY;
    this.drawText(data.studentName, MARGIN + 60, {
      size: 10,
      font: this.boldFont,
    });
    this.currentY = studentNameY - 20;
    this.drawText("CLASS:", MARGIN + 10, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    const classY = this.currentY + 12;
    this.currentY = classY;
    this.drawText(data.studentClass, MARGIN + 60, {
      size: 10,
      font: this.boldFont,
    });

    const rightColX = MARGIN + PAGE_WIDTH / 2 + 20;
    this.currentY = studentNameY;
    this.drawText("TERM:", rightColX, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    this.currentY = studentNameY;
    this.drawText(data.term, rightColX + 40, { size: 10, font: this.boldFont });
    this.currentY = classY;
    this.drawText("YEAR:", rightColX, {
      size: 8,
      font: this.boldFont,
      color: rgb(0.58, 0.64, 0.71),
    });
    this.currentY = classY;
    this.drawText(data.academicYear, rightColX + 40, {
      size: 10,
      font: this.boldFont,
    });

    this.currentY = metaY - 50 - 20;

    const boxHeight = 160;
    const boxStartY = this.currentY;
    this.drawRect(MARGIN, PAGE_WIDTH, boxHeight, {
      color: rgb(0.94, 0.99, 0.96),
      borderColor: rgb(0.73, 0.97, 0.82),
      borderWidth: 1,
    });

    const drawRow = (label: string, value: string, isHighlight = false) => {
      const rowY = this.currentY;
      this.drawText(label, MARGIN + 20, {
        size: 10,
        font: this.boldFont,
        color: rgb(0.09, 0.4, 0.2),
      });
      this.currentY = rowY;
      this.drawText(value, MARGIN + PAGE_WIDTH - 20, {
        size: isHighlight ? 14 : 10,
        font: this.boldFont,
        align: "right",
        maxWidth: 200,
        color: isHighlight ? rgb(0.08, 0.33, 0.18) : rgb(0.12, 0.16, 0.23),
      });
      this.currentY -= 5;
    };

    this.currentY = boxStartY - 10;
    drawRow("RECEIPT NO:", `#${data.receiptNo}`);
    drawRow("DATE:", data.date);
    drawRow("CATEGORY:", data.category.toUpperCase());
    drawRow(
      "AMOUNT PAID:",
      `${data.currencySymbol} ${data.amount.toFixed(2)}`,
      true
    );
    drawRow("PAYMENT METHOD:", data.method.toUpperCase());
    drawRow("RECEIVED FROM:", data.receivedFrom.toUpperCase());

    this.currentY = boxStartY - boxHeight - 20;
    this.drawRect(MARGIN, PAGE_WIDTH, 40, {
      borderColor: rgb(0.73, 0.97, 0.82),
      borderWidth: 1,
    });
    const thankYouY = this.currentY + 25;
    this.currentY = thankYouY;
    this.drawText(
      "Thank you for your prompt payment! We truly appreciate your support.",
      MARGIN,
      {
        size: 10,
        font: this.font,
        align: "center",
        maxWidth: PAGE_WIDTH,
        color: rgb(0.09, 0.4, 0.2),
      }
    );

    return this.savePdf();
  }
}
