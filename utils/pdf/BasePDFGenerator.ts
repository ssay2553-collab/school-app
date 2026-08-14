import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  PDFFont,
  PDFPage,
  RGB,
  PDFImage,
} from "pdf-lib";
import { Platform } from "react-native";
import { PDFGenerationOptions, TableColumn, TableOptions } from "./types";

// PDF Constants
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
export const MARGIN = 40;
export const PAGE_WIDTH = A4_WIDTH - MARGIN * 2;
export const FONT_SIZE = {
  title: 18,
  subtitle: 14,
  heading: 12,
  body: 10,
  small: 8,
  tableHeader: 9,
  tableCell: 8.5,
};

export class BasePDFGenerator {
  protected pdfDoc!: PDFDocument;
  protected font!: PDFFont;
  protected boldFont!: PDFFont;
  protected currentPage!: PDFPage;
  protected currentY: number;
  protected options: PDFGenerationOptions;
  protected initialized: boolean = false;
  protected logoImage?: PDFImage;
  protected primaryColor!: RGB;
  protected secondaryColor!: RGB;

  protected useAutoHeader: boolean = false;

  constructor(options: PDFGenerationOptions) {
    this.options = options;
    this.currentY = A4_HEIGHT - MARGIN;
  }

  protected async embedImage(imageSource: any) {
    if (!imageSource) return undefined;
    try {
      let arrayBuffer: ArrayBuffer;
      if (typeof imageSource === "string") {
        let uri = imageSource;
        if (
          !imageSource.startsWith("data:") &&
          !imageSource.startsWith("http") &&
          !imageSource.startsWith("file:")
        ) {
          // Likely raw base64 string from database, prepend data URI prefix
          // Detect if it's likely a PNG or JPG if possible, otherwise default to png
          const isJpg = imageSource.startsWith("/9j/"); // Base64 for JPEG start
          uri = `data:image/${isJpg ? "jpeg" : "png"};base64,${imageSource}`;
        }
        const response = await fetch(uri);
        arrayBuffer = await response.arrayBuffer();
      } else {
        const asset = Asset.fromModule(imageSource);
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        const response = await fetch(asset.localUri || asset.uri);
        arrayBuffer = await response.arrayBuffer();
      }

      try {
        return await this.pdfDoc.embedPng(arrayBuffer);
      } catch {
        try {
          return await this.pdfDoc.embedJpg(arrayBuffer);
        } catch (err) {
          console.error("Failed to embed image as PNG or JPG", err);
          return undefined;
        }
      }
    } catch (error) {
      console.error("Error embedding image:", error);
      return undefined;
    }
  }

  protected async initialize() {
    if (this.initialized) return;
    this.pdfDoc = await PDFDocument.create();
    this.pdfDoc.setTitle("Academic Progress Report");
    this.pdfDoc.setAuthor(this.options.schoolName || "EduEaz");
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.boldFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);

    if (this.options.schoolLogo) {
      this.logoImage = await this.embedImage(this.options.schoolLogo);
    }

    this.primaryColor = this.options.primaryColor
      ? this.hexToRgb(this.options.primaryColor)
      : rgb(0.12, 0.16, 0.23);
    this.secondaryColor = this.options.secondaryColor
      ? this.hexToRgb(this.options.secondaryColor)
      : rgb(0.96, 0.28, 0.9);

    this.initialized = true;
  }

  protected addPage() {
    this.currentPage = this.pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.currentY = A4_HEIGHT - MARGIN - 10;

    // Background tint
    this.currentPage.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      color: rgb(0.99, 0.99, 1),
    });

    // Frame
    this.currentPage.drawRectangle({
      x: 15,
      y: 15,
      width: A4_WIDTH - 30,
      height: A4_HEIGHT - 30,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
    });

    if (this.useAutoHeader) {
      this.drawHeader();
    }
  }

  protected ensureSpace(heightNeeded: number) {
    if (!this.currentPage || this.currentY - heightNeeded < MARGIN) {
      this.addPage();
    }
  }

  protected drawText(
    text: string,
    x: number,
    options: {
      size?: number;
      font?: PDFFont;
      color?: RGB;
      align?: "left" | "center" | "right";
      maxWidth?: number;
      skipEnsureSpace?: boolean;
      lineHeight?: number;
    } = {},
  ) {
    const {
      size = FONT_SIZE.body,
      font = this.font,
      color = rgb(0.12, 0.16, 0.23),
      align = "left",
      maxWidth = PAGE_WIDTH,
      skipEnsureSpace = false,
      lineHeight = size * 1.2,
    } = options;

    const textWidth = font.widthOfTextAtSize(text || "", size);
    const numLines = Math.max(1, Math.ceil(textWidth / maxWidth));
    const estimatedHeight = numLines * lineHeight;

    if (!skipEnsureSpace) {
      this.ensureSpace(estimatedHeight);
    }

    let drawX = x;
    if (align !== "left") {
      const actualWidth = Math.min(textWidth, maxWidth);
      if (align === "center") {
        drawX = x + (maxWidth - actualWidth) / 2;
      } else if (align === "right") {
        drawX = x + maxWidth - actualWidth;
      }
    }

    this.currentPage.drawText(text || "", {
      x: drawX,
      y: this.currentY - size,
      size,
      font,
      color,
      maxWidth: maxWidth,
      lineHeight: lineHeight,
    });

    if (!skipEnsureSpace) {
      this.currentY -= estimatedHeight;
    }
    return this.currentY;
  }

  protected drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number = 1,
    color: RGB = rgb(0, 0, 0),
  ) {
    this.ensureSpace(0);
    this.currentPage.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color,
    });
  }

  protected drawRect(
    x: number,
    width: number,
    height: number,
    options: {
      borderColor?: RGB;
      borderWidth?: number;
      color?: RGB;
    } = {},
  ) {
    const { borderColor, borderWidth = 1, color } = options;

    this.ensureSpace(height);

    if (color) {
      this.currentPage.drawRectangle({
        x,
        y: this.currentY - height,
        width,
        height,
        color: color as any,
      });
    }

    if (borderColor) {
      this.currentPage.drawRectangle({
        x,
        y: this.currentY - height,
        width,
        height,
        borderColor: borderColor as any,
        borderWidth,
        color: undefined,
      });
    }
  }

  protected drawHeader() {
    const startY = this.currentY;

    // Top Decorative Accent Strip
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: startY + 15,
      width: PAGE_WIDTH,
      height: 3,
      color: this.primaryColor,
    });

    // Logo (Centered)
    if (this.logoImage) {
      const logoDims = this.logoImage.scale(0.35);
      const targetHeight = 45;
      const targetWidth = (logoDims.width / logoDims.height) * targetHeight;

      this.currentPage.drawImage(this.logoImage, {
        x: (A4_WIDTH - targetWidth) / 2,
        y: startY - targetHeight - 2,
        width: targetWidth,
        height: targetHeight,
      });
      this.currentY = startY - targetHeight - 12;
    } else {
      this.currentY = startY - 5;
    }

    // School Name (Prominent)
    this.drawText(this.options.schoolName.toUpperCase(), MARGIN, {
      size: 18,
      font: this.boldFont,
      color: this.primaryColor,
      align: "center",
      maxWidth: PAGE_WIDTH,
      skipEnsureSpace: true,
    });
    this.currentY -= 22;

    // Balanced spacing for info
    const spacing = 12;

    if (this.options.schoolMotto) {
      this.drawText(`"${this.options.schoolMotto}"`, MARGIN, {
        size: 9,
        font: this.font,
        color: rgb(0.4, 0.45, 0.5),
        align: "center",
        maxWidth: PAGE_WIDTH,
        skipEnsureSpace: true,
      });
      this.currentY -= spacing;
    }

    if (this.options.schoolAddress) {
      this.drawText(this.options.schoolAddress, MARGIN, {
        size: 8.5,
        color: rgb(0.3, 0.35, 0.4),
        align: "center",
        maxWidth: PAGE_WIDTH,
        skipEnsureSpace: true,
      });
      this.currentY -= spacing;
    }

    const contactText = [
      this.options.schoolHotline ? `Tel: ${this.options.schoolHotline}` : null,
      this.options.schoolEmail ? `Email: ${this.options.schoolEmail}` : null,
    ]
      .filter(Boolean)
      .join("   |   ");

    if (contactText) {
      this.drawText(contactText, MARGIN, {
        size: 8.5,
        color: rgb(0.3, 0.35, 0.4),
        align: "center",
        maxWidth: PAGE_WIDTH,
        skipEnsureSpace: true,
      });
      this.currentY -= spacing;
    }

    // Bottom Decorative Rule
    this.currentY -= 4;
    this.drawLine(MARGIN, this.currentY, A4_WIDTH - MARGIN, this.currentY, 1.5, this.primaryColor);
    this.currentY -= 2.5;
    this.drawLine(
      MARGIN + PAGE_WIDTH * 0.1,
      this.currentY,
      MARGIN + PAGE_WIDTH * 0.9,
      this.currentY,
      0.5,
      this.secondaryColor
    );
    this.currentY -= 15;
  }

  protected drawTitleBanner(text: string) {
    const titleBoxHeight = 26;
    this.ensureSpace(titleBoxHeight);

    this.drawRect(MARGIN, PAGE_WIDTH, titleBoxHeight, {
      color: this.primaryColor,
    });

    const bannerText = text.toUpperCase();
    const fontSize = 12;
    const textWidth = this.boldFont.widthOfTextAtSize(bannerText, fontSize);

    this.currentPage.drawText(bannerText, {
      x: MARGIN + (PAGE_WIDTH - textWidth) / 2,
      y: this.currentY - titleBoxHeight / 2 - fontSize / 2 + 2,
      size: fontSize,
      font: this.boldFont,
      color: rgb(1, 1, 1),
    });
    this.currentY -= titleBoxHeight + 8;
  }

  protected drawSectionHeader(text: string) {
    this.ensureSpace(18);
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.currentY - 10,
      width: 3,
      height: 10,
      color: this.secondaryColor,
    });

    this.drawText(text.toUpperCase(), MARGIN + 12, {
      size: 9,
      font: this.boldFont,
      color: this.primaryColor,
      skipEnsureSpace: true,
    });
    this.currentY -= 14;
  }

  protected drawTable(
    x: number,
    columns: TableColumn[],
    rows: Array<Array<string | number>>,
    options: TableOptions = {},
  ) {
    const {
      headerBgColor = rgb(0.12, 0.16, 0.23),
      alternateRowColor = rgb(1, 1, 1),
      rowHeight = 20,
    } = options;

    const drawHeader = () => {
      let headerX = x;
      this.ensureSpace(rowHeight);

      // If useAutoHeader is true, addPage (called by ensureSpace) already drew the main header.
      // If useAutoHeader is false, we might need to draw the main header if we just added a page.
      if (!this.useAutoHeader && this.currentY >= A4_HEIGHT - MARGIN - 10) {
        this.drawHeader();
      }

      columns.forEach((col) => {
        this.drawRect(headerX, col.width, rowHeight, {
          color: headerBgColor,
        });

        const textWidth = this.font.widthOfTextAtSize(col.header, FONT_SIZE.tableHeader);
        let textX = headerX + 6;
        if (col.align === "center") textX = headerX + (col.width - textWidth) / 2;
        else if (col.align === "right") textX = headerX + col.width - textWidth - 6;

        this.currentPage.drawText(col.header, {
          x: textX,
          y: this.currentY - rowHeight + (rowHeight - FONT_SIZE.tableHeader) / 2 + 1,
          size: FONT_SIZE.tableHeader,
          font: this.boldFont,
          color: rgb(1, 1, 1),
        });
        headerX += col.width;
      });
      this.currentY -= rowHeight;
    };

    drawHeader();

    rows.forEach((row, index) => {
      const pageBefore = this.currentPage;
      this.ensureSpace(rowHeight);
      if (this.currentPage !== pageBefore) {
        drawHeader();
      }

      let rowX = x;
      const bgColor = index % 2 === 1 ? alternateRowColor : rgb(0.97, 0.98, 1);

      columns.forEach((col, colIndex) => {
        this.drawRect(rowX, col.width, rowHeight, {
          color: bgColor,
          borderColor: rgb(0.85, 0.88, 0.92),
          borderWidth: 0.5,
        });

        const cellValue = String(row[colIndex] || "");
        const textWidth = this.font.widthOfTextAtSize(cellValue, FONT_SIZE.tableCell);
        let textX = rowX + 6;
        if (col.align === "center") textX = rowX + (col.width - textWidth) / 2;
        else if (col.align === "right") textX = rowX + col.width - textWidth - 6;

        this.currentPage.drawText(cellValue, {
          x: textX,
          y: this.currentY - rowHeight + (rowHeight - FONT_SIZE.tableCell) / 2 + 1,
          size: FONT_SIZE.tableCell,
          font: this.font,
          color: rgb(0.1, 0.1, 0.1),
        });

        rowX += col.width;
      });

      this.currentY -= rowHeight;
    });

    return this.currentY;
  }

  protected addPageIfRequired(heightNeeded: number) {
    if (this.currentY - heightNeeded < MARGIN) {
      this.addPage();
    }
  }

  protected drawPageNumbers() {
    const pages = this.pdfDoc.getPages();
    const { width } = pages[0].getSize();

    pages.forEach((page, i) => {
      page.drawText(`OFFICIAL DOCUMENT`, {
        x: MARGIN,
        y: 22,
        size: 7,
        font: this.font,
        color: rgb(0.5, 0.55, 0.6),
      });

      const footerRight = `Generated by EduEaz Platform`;
      page.drawText(footerRight, {
        x: width - MARGIN - this.font.widthOfTextAtSize(footerRight, 7),
        y: 22,
        size: 7,
        font: this.font,
        color: rgb(0.5, 0.55, 0.6),
      });
    });
  }

  protected async savePdf() {
    this.drawPageNumbers();
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
    const base64 = this.uint8ArrayToBase64(uint8Array);
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(fileUri);
    return fileUri;
  }

  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = "";
    const len = uint8Array.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  protected hexToRgb(hex: string): RGB {
    // Remove # if present
    hex = hex.replace("#", "");

    // Handle short hex codes (e.g. #03F)
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    return rgb(r, g, b);
  }
}
