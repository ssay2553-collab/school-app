export interface CleanupReport {
  orphanedRecords: number;
  fixedRecords: number;
  orphanedPayments: number;
  deletedPayments: number;
  reconciledBalances: number;
  dailyFinancialsFixed: number;
}

export interface StudentPayment {
  id: string;
  amount?: number;
  amountPaid?: number;
  value?: number;
  type?: string;
  category?: string;
  purpose?: string;
  memo?: string;
  date?: string;
  createdAt?: string;
  receiptNo?: string;
  studentUid?: string;
  studentID?: string;
  studentId?: string;
  studentName?: string;
  receivedFrom?: string;
  paidBy?: string;
  academicYear?: string;
  term?: string;
  studentFeeRecordId?: string;
  _category?: string;
  [key: string]: any;
}

export interface StudentRecord {
  id: string;
  data: any;
  ref: any;
}
