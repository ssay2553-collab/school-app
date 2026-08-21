import { rgb } from "pdf-lib";
import { BasePDFGenerator, FONT_SIZE, MARGIN, PAGE_WIDTH } from "./BasePDFGenerator";
import { AcademicReportData } from "./types";

export class AcademicReportGenerator extends BasePDFGenerator {
  protected useAutoHeader = true;

  protected drawHeader() {
    const startY = this.currentY;
    let headerHeight = 85;

    // Logo (Centered)
    if (this.logoImage) {
      const logoDims = this.logoImage.scale(0.4);
      const targetHeight = 60;
      const targetWidth = (logoDims.width / logoDims.height) * targetHeight;

      this.currentPage.drawImage(this.logoImage, {
        x: MARGIN + (PAGE_WIDTH - targetWidth) / 2,
        y: startY - targetHeight,
        width: targetWidth,
        height: targetHeight,
      });
      headerHeight = targetHeight + 70; // Adjust header height based on logo
    }

    let infoY = startY - (this.logoImage ? 70 : 18);

    // School Details (Centered)
    const schoolName = this.options.schoolName.toUpperCase();
    const nameSize = 18;
    const nameWidth = this.boldFont.widthOfTextAtSize(schoolName, nameSize);
    this.currentPage.drawText(schoolName, {
      x: MARGIN + (PAGE_WIDTH - nameWidth) / 2,
      y: infoY,
      size: nameSize,
      font: this.boldFont,
      color: this.primaryColor,
    });

    infoY -= 15;

    if (this.options.schoolMotto) {
      const motto = `"${this.options.schoolMotto}"`;
      const mottoSize = 9;
      const mottoWidth = this.font.widthOfTextAtSize(motto, mottoSize);
      this.currentPage.drawText(motto, {
        x: MARGIN + (PAGE_WIDTH - mottoWidth) / 2,
        y: infoY,
        size: mottoSize,
        font: this.font,
        color: rgb(0.4, 0.4, 0.4),
      });
      infoY -= 12;
    }

    if (this.options.schoolAddress) {
      const addrSize = 9;
      const addrWidth = this.font.widthOfTextAtSize(this.options.schoolAddress, addrSize);
      this.currentPage.drawText(this.options.schoolAddress, {
        x: MARGIN + (PAGE_WIDTH - addrWidth) / 2,
        y: infoY,
        size: addrSize,
        color: rgb(0.3, 0.3, 0.3),
        font: this.font,
      });
      infoY -= 12;
    }

    const contactText = [
      this.options.schoolHotline ? `Tel: ${this.options.schoolHotline}` : null,
      this.options.schoolEmail ? `Email: ${this.options.schoolEmail}` : null,
    ]
      .filter(Boolean)
      .join("  |  ");

    if (contactText) {
      const contactSize = 9;
      const contactWidth = this.font.widthOfTextAtSize(contactText, contactSize);
      this.currentPage.drawText(contactText, {
        x: MARGIN + (PAGE_WIDTH - contactWidth) / 2,
        y: infoY,
        size: contactSize,
        color: rgb(0.3, 0.3, 0.3),
        font: this.font,
      });
    }

    this.currentY = infoY - 15;

    // Elegant double line separator
    this.drawLine(MARGIN, this.currentY, MARGIN + PAGE_WIDTH, this.currentY, 1.5, this.primaryColor);
    this.drawLine(
      MARGIN,
      this.currentY - 2.5,
      MARGIN + PAGE_WIDTH,
      this.currentY - 2.5,
      0.5,
      this.secondaryColor
    );

    this.currentY -= 20;
  }

  async generate(data: AcademicReportData) {
    await this.initialize();
    this.addPage();

    const subjectsCount = data.subjectsData.length;
    const tableRowHeight = data.isPreschool ? 22 : (subjectsCount <= 7 ? 22 : 18);
    const sectionGap = subjectsCount <= 7 ? 15 : 8;

    // Report Title Banner
    this.drawTitleBanner(`${data.reportType} PROGRESS REPORT`);

    // Professional Student Information Section
    this.drawSectionHeader("STUDENT INFORMATION");

    const profileBoxHeight = 70;
    const rowHeight = profileBoxHeight / 2;
    const labelHeight = 12;

    this.drawRect(MARGIN, PAGE_WIDTH, profileBoxHeight, {
      color: rgb(1, 1, 1),
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1.5,
    });

    const profileY = this.currentY;
    const profileColWidth = PAGE_WIDTH / 3;

    // Shaded backgrounds for labels
    [0, rowHeight].forEach((offset) => {
      this.currentPage.drawRectangle({
        x: MARGIN + 0.75,
        y: profileY - offset - labelHeight,
        width: PAGE_WIDTH - 1.5,
        height: labelHeight,
        color: rgb(0.96, 0.97, 0.98),
      });
    });

    // Grid lines
    this.drawLine(MARGIN + profileColWidth, profileY, MARGIN + profileColWidth, profileY - profileBoxHeight, 1, rgb(0.85, 0.88, 0.92));
    this.drawLine(MARGIN + profileColWidth * 2, profileY, MARGIN + profileColWidth * 2, profileY - profileBoxHeight, 1, rgb(0.85, 0.88, 0.92));
    this.drawLine(MARGIN, profileY - rowHeight, MARGIN + PAGE_WIDTH, profileY - rowHeight, 1, rgb(0.85, 0.88, 0.92));

    const drawField = (label: string, value: string, x: number, y: number) => {
      this.currentPage.drawText(label, {
        x: x + 8,
        y: y - 9,
        size: 6,
        font: this.boldFont,
        color: rgb(0.4, 0.45, 0.5),
      });

      const valStr = String(value || "N/A").toUpperCase();
      const drawX = x + 8;
      const drawY = y - 24;
      const size = 8.5;

      if (label === "OVERALL POSITION" || label === "ATTENDANCE") {
        if (valStr.includes(" OF ")) {
          const parts = valStr.split(" OF ");
          this.currentPage.drawText(parts[0], {
            x: drawX,
            y: drawY,
            size,
            font: this.boldFont,
            color: rgb(0.8, 0.1, 0.1),
          });
          const firstWidth = this.boldFont.widthOfTextAtSize(parts[0], size);
          this.currentPage.drawText(` OF ${parts[1]}`, {
            x: drawX + firstWidth,
            y: drawY,
            size,
            font: this.boldFont,
            color: rgb(0, 0, 0),
          });
        } else {
          this.currentPage.drawText(valStr, {
            x: drawX,
            y: drawY,
            size,
            font: this.boldFont,
            color: rgb(0.8, 0.1, 0.1),
          });
        }
      } else {
        this.currentPage.drawText(valStr, {
          x: drawX,
          y: drawY,
          size,
          font: this.boldFont,
          color: this.primaryColor,
        });
      }
    };

    // Row 1
    drawField("STUDENT NAME", data.studentName, MARGIN, profileY);
    drawField("CLASS / GRADE", data.className, MARGIN + profileColWidth, profileY);
    drawField("ACADEMIC YEAR", data.academicYear, MARGIN + (profileColWidth * 2), profileY);

    // Row 2
    drawField("TERM / PERIOD", data.term, MARGIN, profileY - rowHeight);
    drawField("OVERALL POSITION", data.overallPosition, MARGIN + profileColWidth, profileY - rowHeight);
    drawField("ATTENDANCE", data.attendance || "N/A", MARGIN + (profileColWidth * 2), profileY - rowHeight);

    this.currentY -= (profileBoxHeight + 8);

    const tableColumns = data.isFullReport
      ? [
          { header: "SUBJECT", width: 155 },
          { header: "CLS", width: 45, align: "center" as const },
          { header: "EXM", width: 45, align: "center" as const },
          { header: "TOTAL", width: 60, align: "center" as const },
          { header: "GRADE", width: 45, align: "center" as const },
          { header: "REMARK", width: 165 },
        ]
      : [
          { header: "SUBJECT", width: 200 },
          { header: "TOTAL", width: 75, align: "center" as const },
          { header: "GRADE", width: 55, align: "center" as const },
          { header: "REMARK", width: 185 },
        ];

    const tableRows = data.subjectsData.map((s) => {
      if (data.isFullReport) {
        return [
          s.subject.toUpperCase(),
          isNaN(Number(s.classScore)) ? String(s.classScore) : Number(s.classScore).toFixed(0),
          isNaN(Number(s.examsScore)) ? String(s.examsScore) : Number(s.examsScore).toFixed(0),
          isNaN(Number(s.total)) ? String(s.total) : Number(s.total).toFixed(0),
          s.grade,
          s.remark,
        ];
      }
      return [
        s.subject.toUpperCase(),
        isNaN(Number(s.total)) ? String(s.total) : Number(s.total).toFixed(0),
        s.grade,
        s.remark,
      ];
    });

    this.drawTable(MARGIN, tableColumns, tableRows, {
      headerBgColor: this.primaryColor,
      rowHeight: tableRowHeight,
    });

    this.currentY -= 2;

    this.ensureSpace(22);
    const summaryHeight = 22;
    const summaryY = this.currentY;

    // Neutral Summary Row (Minimalist & Compact)
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: summaryY - summaryHeight,
      width: PAGE_WIDTH,
      height: summaryHeight,
      color: rgb(0.96, 0.96, 0.96),
    });
    this.drawLine(MARGIN, summaryY, MARGIN + PAGE_WIDTH, summaryY, 0.5, rgb(0.85, 0.85, 0.85));
    this.drawLine(MARGIN, summaryY - summaryHeight, MARGIN + PAGE_WIDTH, summaryY - summaryHeight, 0.5, rgb(0.85, 0.85, 0.85));

    this.currentPage.drawText(`TOTAL RAW SCORE: ${data.TRS}   |   AVERAGE: ${data.TAS}`, {
      x: MARGIN + 10,
      y: summaryY - 14,
      size: 9,
      font: this.boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    const aggregateLabel = "AGGREGATE: ";
    const aggregateValue = String(data.AGGREGATE);
    const aggValueWidth = this.boldFont.widthOfTextAtSize(aggregateValue, 10);
    const aggLabelWidth = this.boldFont.widthOfTextAtSize(aggregateLabel, 10);

    this.currentPage.drawText(aggregateLabel, {
      x: MARGIN + PAGE_WIDTH - aggValueWidth - aggLabelWidth - 10,
      y: summaryY - 14,
      size: 10,
      font: this.boldFont,
      color: rgb(0.15, 0.15, 0.15),
    });

    this.currentPage.drawText(aggregateValue, {
      x: MARGIN + PAGE_WIDTH - aggValueWidth - 10,
      y: summaryY - 14,
      size: 10,
      font: this.boldFont,
      color: rgb(0.8, 0.1, 0.1),
    });

    this.currentY -= (summaryHeight + sectionGap);

    if (data.isPreschool && data.preschoolAssessments) {
      this.drawSectionHeader("DEVELOPMENTAL & SKILLS ASSESSMENT");

      const assessments = Object.entries(data.preschoolAssessments);
      const half = Math.ceil(assessments.length / 2);
      const leftCol = assessments.slice(0, half);
      const rightCol = assessments.slice(half);

      const colWidth = PAGE_WIDTH / 2;
      const rowHeight = 16;
      const startY = this.currentY;

      const drawAssessmentCol = (items: [string, any][], xOffset: number) => {
        let currY = startY;
        items.forEach(([skill, rating]) => {
          this.ensureSpace(rowHeight);
          this.drawRect(MARGIN + xOffset, colWidth, rowHeight, {
            borderColor: rgb(0.9, 0.9, 0.9),
            borderWidth: 0.5,
          });

          this.currentPage.drawText(skill.toUpperCase(), {
            x: MARGIN + xOffset + 5,
            y: currY - 11,
            size: 6.5,
            font: this.font,
            color: rgb(0.3, 0.3, 0.3),
          });

          const ratingText = String(rating).toUpperCase();
          const ratingWidth = this.boldFont.widthOfTextAtSize(ratingText, 7);
          this.currentPage.drawText(ratingText, {
            x: MARGIN + xOffset + colWidth - ratingWidth - 5,
            y: currY - 11,
            size: 7,
            font: this.boldFont,
            color: this.primaryColor,
          });
          currY -= rowHeight;
        });
        return currY;
      };

      const leftEndY = drawAssessmentCol(leftCol, 0);
      const rightEndY = drawAssessmentCol(rightCol, colWidth);

      this.currentY = Math.min(leftEndY, rightEndY) - 10;

      if (data.physicalDev) {
        this.drawSectionHeader("PHYSICAL DEVELOPMENT");
        const physHeight = 25;
        this.drawRect(MARGIN, PAGE_WIDTH, physHeight, {
          color: rgb(0.98, 0.99, 1),
          borderColor: rgb(0.85, 0.88, 0.92),
          borderWidth: 1,
        });

        const physY = this.currentY;
        const drawPhys = (label: string, val: string, x: number) => {
          this.currentPage.drawText(label, {
            x: x + 8,
            y: physY - 8,
            size: 6,
            font: this.boldFont,
            color: rgb(0.4, 0.45, 0.5),
          });
          this.currentPage.drawText(val || "N/A", {
            x: x + 8,
            y: physY - 18,
            size: 8,
            font: this.boldFont,
            color: this.primaryColor,
          });
        };

        drawPhys("HEIGHT (CM)", data.physicalDev.height || "-", MARGIN);
        drawPhys("WEIGHT (KG)", data.physicalDev.weight || "-", MARGIN + (PAGE_WIDTH / 2));
        this.currentY -= (physHeight + 12);
      }
    }

    if (data.isFullReport && !data.isPreschool) {
      this.drawSectionHeader("BEHAVIORAL RATINGS");

      const rowHeight = 22;
      const colWidth = PAGE_WIDTH / 3;
      const ratingsY = this.currentY;

      // Table-like structure for Behavioral Ratings
      this.drawRect(MARGIN, PAGE_WIDTH, rowHeight, {
        color: rgb(0.98, 0.98, 1),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 1,
      });

      const drawRating = (label: string, val: any, x: number) => {
        this.currentPage.drawText(label, {
          x: x + 8,
          y: ratingsY - 8,
          size: 6,
          font: this.boldFont,
          color: rgb(0.4, 0.45, 0.5),
        });
        this.currentPage.drawText(String(val || "N/A").toUpperCase(), {
          x: x + 8,
          y: ratingsY - 18,
          size: 8,
          font: this.boldFont,
          color: this.primaryColor,
        });
      };

      drawRating("CONDUCT", data.conduct, MARGIN);
      drawRating("ATTITUDE", data.attitude, MARGIN + colWidth);
      drawRating("INTEREST", data.interest, MARGIN + colWidth * 2);

      // Vertical dividers
      this.drawLine(MARGIN + colWidth, ratingsY, MARGIN + colWidth, ratingsY - rowHeight, 1, rgb(0.85, 0.88, 0.92));
      this.drawLine(MARGIN + colWidth * 2, ratingsY, MARGIN + colWidth * 2, ratingsY - rowHeight, 1, rgb(0.85, 0.88, 0.92));

      this.currentY -= (rowHeight + 12);
    }

    const drawRemarkBox = (label: string, content: string) => {
      this.drawSectionHeader(label);
      const boxWidth = PAGE_WIDTH;
      const padding = 10;
      const fontSize = 8.5;
      const lineHeight = 12;

      // Calculate height based on text wrapping
      const text = content || "Satisfactory performance.";
      const textWidth = this.font.widthOfTextAtSize(text, fontSize);
      const numLines = Math.max(1, Math.ceil(textWidth / (boxWidth - padding * 2)));
      const boxHeight = (numLines * lineHeight) + (padding * 2);

      this.ensureSpace(boxHeight);
      const startY = this.currentY;

      this.drawRect(MARGIN, boxWidth, boxHeight, {
        color: rgb(1, 1, 1),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 1,
      });

      this.currentPage.drawText(text, {
        x: MARGIN + padding,
        y: startY - padding - fontSize,
        size: fontSize,
        font: this.font,
        color: rgb(0.2, 0.25, 0.3),
        maxWidth: boxWidth - padding * 2,
        lineHeight: lineHeight,
      });

      this.currentY = startY - boxHeight - 8;
    };

    drawRemarkBox("TEACHER'S REMARKS", data.teacherRemarks);
    drawRemarkBox("ADMINISTRATIVE REMARKS", data.adminRemarks);

    this.currentY -= 4;

    // Next Term & Promotion Status Box
    const statusBoxHeight = 20;
    this.drawRect(MARGIN, PAGE_WIDTH, statusBoxHeight, {
      color: rgb(0.97, 0.99, 0.97),
      borderColor: rgb(0.85, 0.9, 0.85),
      borderWidth: 1,
    });

    const statusTextY = this.currentY - 13;

    this.currentPage.drawText("NEXT TERM BEGINS:", {
      x: MARGIN + 10,
      y: statusTextY,
      size: 8,
      font: this.boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    this.currentPage.drawText(String(data.nextTermBegins || "TBA").toUpperCase(), {
      x: MARGIN + 105,
      y: statusTextY,
      size: 8.5,
      font: this.boldFont,
      color: rgb(0.1, 0.5, 0.1),
    });

    if (data.promotedTo) {
      const promoLabel = "PROMOTED TO:";
      const promoVal = data.promotedTo.toUpperCase();
      const rightX = MARGIN + PAGE_WIDTH - 10;
      const promoValWidth = this.boldFont.widthOfTextAtSize(promoVal, 8.5);
      const promoLabelWidth = this.boldFont.widthOfTextAtSize(promoLabel, 8);

      this.currentPage.drawText(promoLabel, {
        x: rightX - promoValWidth - promoLabelWidth - 8,
        y: statusTextY,
        size: 8,
        font: this.boldFont,
        color: rgb(0.3, 0.3, 0.3),
      });
      this.currentPage.drawText(promoVal, {
        x: rightX - promoValWidth,
        y: statusTextY,
        size: 8.5,
        font: this.boldFont,
        color: rgb(0.1, 0.5, 0.1),
      });
    }

    this.currentY -= (statusBoxHeight + 8);

    // QR Code to cover space if present
    if (data.qrCode) {
      const qrImg = await this.embedImage(data.qrCode);
      if (qrImg) {
        const qrSize = 65;
        this.ensureSpace(qrSize + 20);
        this.currentPage.drawImage(qrImg, {
          x: MARGIN + (PAGE_WIDTH - qrSize) / 2,
          y: this.currentY - qrSize - 10,
          width: qrSize,
          height: qrSize,
        });

        const qrLabel = "Student Record Verification";
        const qrLabelWidth = this.font.widthOfTextAtSize(qrLabel, 6);
        this.currentPage.drawText(qrLabel, {
          x: MARGIN + (PAGE_WIDTH - qrLabelWidth) / 2,
          y: this.currentY - qrSize - 18,
          size: 6,
          font: this.font,
          color: rgb(0.5, 0.5, 0.5),
        });

        this.currentY -= (qrSize + 25);
      }
    }

    // Signatures Section
    const sigBottomY = MARGIN + 10;
    const sigColWidth = 160;
    const lineX = MARGIN + (PAGE_WIDTH - sigColWidth) / 2; // Centered signature

    // Admin Signature (Centered)
    if (data.adminSig) {
      const sigImg = await this.embedImage(data.adminSig);
      if (sigImg) {
        const sigWidth = 80;
        const sigHeight = 40;
        this.currentPage.drawImage(sigImg, {
          x: MARGIN + (PAGE_WIDTH - sigWidth) / 2,
          y: sigBottomY + 12,
          width: sigWidth,
          height: sigHeight,
        });
      }
    }

    this.drawLine(lineX, sigBottomY + 10, lineX + sigColWidth, sigBottomY + 10, 0.5, rgb(0.4, 0.4, 0.4));

    const sigLabel = "Head of Institution / Admin";
    const sigLabelSize = 8.5;
    const sigLabelWidth = this.boldFont.widthOfTextAtSize(sigLabel, sigLabelSize);
    this.currentPage.drawText(sigLabel, {
      x: MARGIN + (PAGE_WIDTH - sigLabelWidth) / 2,
      y: sigBottomY - 2,
      size: sigLabelSize,
      font: this.boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    return this.savePdf();
  }
}
