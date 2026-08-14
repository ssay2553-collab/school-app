import moment from "moment";
import {
  AcademicReportData,
  FeeReportData,
  FinancialSummaryData,
  FeeStatementData,
  FeeReceiptData,
} from "./pdf/types";
import { AcademicReportGenerator } from "./pdf/AcademicReport";
import { FeeReportGenerator } from "./pdf/FeeReport";
import {
  FinancialSummaryGenerator,
  FeeStatementGenerator,
  FeeReceiptGenerator,
} from "./pdf/FinancialReports";
import { SCHOOL_CONFIG } from "../constants/Config";
import { getSchoolSignature } from "../constants/Signatures";

// Re-export types for backward compatibility
export * from "./pdf/types";

// Convenience functions that use the new modular generators
export async function generateAcademicReportPDF(
  data: AcademicReportData,
  schoolName: string,
  schoolHotline: string,
  schoolEmail: string,
  schoolAddress?: string,
  schoolMotto?: string,
  schoolLogo?: any,
) {
  const adminSig = data.adminSig || getSchoolSignature(SCHOOL_CONFIG.schoolId);

  const generator = new AcademicReportGenerator({
    fileName: `Academic_Report_${data.studentName.replace(/\s+/g, "_")}`,
    schoolName,
    schoolHotline,
    schoolEmail,
    schoolAddress,
    schoolMotto,
    schoolLogo,
    primaryColor: SCHOOL_CONFIG.primaryColor,
    secondaryColor: SCHOOL_CONFIG.secondaryColor,
  });

  return generator.generate({ ...data, adminSig });
}

export async function generateFeeReportPDF(
  data: FeeReportData,
  schoolName: string,
  schoolHotline: string,
  schoolEmail: string,
  schoolAddress?: string,
  schoolMotto?: string,
  schoolLogo?: any,
) {
  const generator = new FeeReportGenerator({
    fileName: `Fee_Report_${data.academicYear}_${data.term.replace(/\s+/g, "_")}`,
    schoolName,
    schoolHotline,
    schoolEmail,
    schoolAddress,
    schoolMotto,
    schoolLogo,
  });

  return generator.generate(data);
}

export async function generateFinancialSummaryPDF(
  data: FinancialSummaryData,
  schoolName: string,
  schoolHotline: string,
  schoolEmail: string,
  schoolAddress?: string,
  schoolLogo?: any,
) {
  const generator = new FinancialSummaryGenerator({
    fileName: `Financial_Summary_${moment().format("YYYY-MM-DD")}`,
    schoolName,
    schoolHotline,
    schoolEmail,
    schoolAddress,
    schoolLogo,
  });

  return generator.generate(data);
}

export async function generateFeeStatementPDF(
  data: FeeStatementData,
  schoolName: string,
  schoolHotline: string,
  schoolEmail: string,
  schoolAddress?: string,
  schoolMotto?: string,
  schoolLogo?: any,
) {
  const generator = new FeeStatementGenerator({
    fileName: `Statement_${data.studentName.replace(/\s+/g, "_")}_${data.term.replace(/\s+/g, "_")}`,
    schoolName,
    schoolHotline,
    schoolEmail,
    schoolAddress,
    schoolMotto,
    schoolLogo,
  });

  return generator.generate(data);
}

export async function generateFeeReceiptPDF(
  data: FeeReceiptData,
  schoolName: string,
  schoolHotline: string,
  schoolEmail: string,
  schoolAddress?: string,
  schoolMotto?: string,
  schoolLogo?: any,
) {
  const generator = new FeeReceiptGenerator({
    fileName: `Receipt_${data.receiptNo}`,
    schoolName,
    schoolHotline,
    schoolEmail,
    schoolAddress,
    schoolMotto,
    schoolLogo,
  });

  return generator.generate(data);
}
