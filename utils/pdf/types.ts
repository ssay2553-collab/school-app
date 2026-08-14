import { RGB } from "pdf-lib";

export interface PDFGenerationOptions {
  fileName: string;
  schoolName: string;
  schoolHotline: string;
  schoolEmail: string;
  schoolAddress?: string;
  schoolMotto?: string;
  schoolLogo?: any;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface AcademicReportData {
  studentName: string;
  className: string;
  academicYear: string;
  term: string;
  overallPosition: string;
  attendance: string;
  reportType: string;
  isFullReport: boolean;
  isPreschool?: boolean;
  subjectsData: Array<{
    subject: string;
    classScore?: string | number;
    examsScore?: string | number;
    total: string | number;
    grade: string;
    remark: string;
  }>;
  preschoolAssessments?: Record<string, string>;
  physicalDev?: {
    height?: string;
    weight?: string;
  };
  TRS: string | number;
  TAS: string | number;
  AGGREGATE: string | number;
  conduct?: string;
  attitude?: string;
  interest?: string;
  teacherRemarks: string;
  adminRemarks: string;
  nextTermBegins: string;
  promotedTo?: string;
  adminSig?: any;
  qrCode?: any;
}

export interface FeeReportData {
  academicYear: string;
  term: string;
  currencySymbol?: string;
  groupedData: Record<
    string,
    Array<{
      fullName: string;
      studentID: string;
      totalPayable: number;
      discount: number;
      amountPaid: number;
      balance: number;
    }>
  >;
  schoolTotals: {
    payable: number;
    discount: number;
    paid: number;
    balance: number;
  };
}

export interface FinancialSummaryData {
  totalFees: number; // General Student Fees (Tuition + Charges)
  totalDailyPayments: number;
  totalExpenditure: number;
  netBalance: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  totalDiscount: number;
  discountCount: number;
  ledgerItems: Array<{
    name: string;
    billed: number;
    paid: number;
    balance: number;
  }>;
  categories: Array<{
    name: string;
    count: number;
    total: number;
    today: number;
    week: number;
    month: number;
    term: number;
  }>;
  dateRange?: string;
  currencySymbol?: string;
}

export interface FeeStatementData {
  studentName: string;
  studentClass: string;
  academicYear: string;
  term: string;
  categorySummary: Array<{
    name: string;
    billed: number;
    paid: number;
    balance: number;
  }>;
  totals: {
    billed: number;
    paid: number;
    balance: number;
  };
  discount: number;
  currencySymbol: string;
}

export interface FeeReceiptData {
  studentName: string;
  studentClass: string;
  academicYear: string;
  term: string;
  receiptNo: string;
  date: string;
  category: string;
  amount: number;
  method: string;
  receivedFrom: string;
  processedBy: string;
  currencySymbol: string;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
}

export interface TableOptions {
  headerBgColor?: RGB;
  alternateRowColor?: RGB;
  rowHeight?: number;
}
