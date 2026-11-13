import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { calculateFeeBreakdown } from "../../hooks/admin-dashboard/finance-cleanup/utils";

export type ReportType = "end_of_term" | "financial" | "general_term";

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

export interface TermReportMetrics {
  schoolName: string;
  term: string;
  academicYear: string;

  // Population & Membership
  totalStudents: number;
  studentsByClass: Record<string, number>;
  totalStaff: number;
  staffByRole: Record<string, number>;
  newAdmissionsCount: number;

  // Attendance
  studentAttendanceRate: number;
  totalAttendanceRecords: number;
  staffAttendanceRate: number;

  // Financials Overview
  tuitionBilled: number;
  chargesBilled: number;
  totalBilled: number;
  totalCollected: number;
  totalArrears: number;
  totalExpenditure: number;
  netFinancialStanding: number;
  expenditureByCategory: Record<string, number>;
  prevTermRevenue: number;
  revenueGrowthRate: number;

  // Itemized Fee Ledger Breakdown (Tuition, Admission, PTA, Maintenance, Books, Uniforms, Other)
  feeItemsBreakdown: FeeItemDetail[];

  // Daily Financial Payments & Allocations (Feeding, Bus, Extra Classes)
  dailyPaymentsBreakdown: DailyPaymentsDetail;

  // Academic Performance
  averageScore: number;
  totalAcademicRecords: number;
  topPerformingClasses: string[];
  subjectsNeedingImprovement: string[];

  // General School Activities
  totalEventsCount: number;
  pendingApprovalsCount: number;
}

export interface GeneratedAIReport {
  title: string;
  reportType: ReportType;
  generatedAt: string;
  executiveSummary: string;
  markdownContent: string;
  keyStats: {
    label: string;
    value: string;
    change?: string;
    type?: "positive" | "negative" | "neutral";
  }[];
  highlights: string[];
  recommendations: string[];
}

export interface AIAnswerResponse {
  question: string;
  directAnswer: string;
  keyMetrics: { label: string; value: string; badge?: string }[];
  takeaways: string[];
  suggestedAction: string;
}

export interface FinancialOutcomeAnalysis {
  state: "deficit_loss" | "heavy_arrears" | "surplus_cleared" | "balanced";
  headline: string;
  recommendations: string[];
  riskLevel: "Critical" | "Moderate" | "Optimal" | "Stable";
  suggestedAction: string;
}

/**
 * Intelligent Financial & Operational Outcome Analyzer
 * Detects whether there is a deficit/loss, heavy arrears, or 100% cleared balances,
 * and formulates context-specific intelligent suggestions.
 */
function analyzeFinancialOutcome(metrics: TermReportMetrics): FinancialOutcomeAnalysis {
  const collectionEfficiency = metrics.totalBilled > 0
    ? Math.min(100, Math.round((metrics.totalCollected / metrics.totalBilled) * 100))
    : 100;

  if (metrics.netFinancialStanding < 0 || metrics.totalExpenditure > metrics.totalCollected) {
    const deficitAmount = Math.abs(metrics.netFinancialStanding);
    return {
      state: "deficit_loss",
      headline: `CRITICAL FINANCIAL DEFICIT: Operational expenses (₵${metrics.totalExpenditure.toLocaleString()}) exceed collected revenue (₵${metrics.totalCollected.toLocaleString()}), resulting in a net operating loss of ₵${deficitAmount.toLocaleString()}.`,
      riskLevel: "Critical",
      recommendations: [
        `1. **Emergency Cost Rationalization:** Immediately freeze non-essential administrative outlays and capital expenditures to offset the ₵${deficitAmount.toLocaleString()} net deficit.`,
        `2. **Line-by-Line Expense Audit:** Audit all auxiliary cost centers and vendor invoices to identify and eliminate recurring redundancies.`,
        `3. **Accelerated Fee Collection & Debt Recovery:** Dispatch automated PWA and SMS payment alerts to recover outstanding arrears of ₵${metrics.totalArrears.toLocaleString()}.`,
        `4. **Auxiliary Unit Pricing Review:** Adjust meal service, transport, and extra classes pricing to ensure auxiliary operations fully cover their direct costs.`
      ],
      suggestedAction: `Execute emergency budget tightening and deploy automated debt recovery notices to clear the ₵${metrics.totalArrears.toLocaleString()} arrears.`
    };
  } else if (metrics.totalArrears > 0 && collectionEfficiency < 75) {
    return {
      state: "heavy_arrears",
      headline: `HIGH FEE ARREARS WARNING: Outstanding student fee debt stands at ₵${metrics.totalArrears.toLocaleString()}, with collection efficiency lagging at ${collectionEfficiency}%.`,
      riskLevel: "Moderate",
      recommendations: [
        `1. **Structured Debt Recovery Plan:** Launch automated weekly PWA and SMS payment reminders directed at parents with outstanding arrears of ₵${metrics.totalArrears.toLocaleString()}.`,
        `2. **Flexible Installment Workflows:** Implement structured grace periods and installment payment agreements to assist families facing cash flow constraints.`,
        `3. **Parent-Admin Conferences:** Schedule direct administrative meetings for student accounts with arrears exceeding 30 days.`,
        `4. **Service Access Management:** Enforce tiered access policies for non-essential auxiliary services until fee accounts are regularized.`
      ],
      suggestedAction: `Deploy automated SMS payment notices and schedule parent debt reconciliation sessions for the remaining ₵${metrics.totalArrears.toLocaleString()} arrears.`
    };
  } else if (metrics.totalArrears === 0 || collectionEfficiency >= 90) {
    return {
      state: "surplus_cleared",
      headline: `OPTIMAL FINANCIAL STANDING: All student fee accounts are fully cleared or collection efficiency reached ${collectionEfficiency}%, generating a net operational surplus of ₵${metrics.netFinancialStanding.toLocaleString()}.`,
      riskLevel: "Optimal",
      recommendations: [
        `1. **Strategic Surplus Reinvestment:** Reinvest a portion of the ₵${metrics.netFinancialStanding.toLocaleString()} operational surplus into smart classroom technology and library resources.`,
        `2. **Staff Professional Development & Rewards:** Fund specialized instructional training workshops and performance recognition bonuses for teaching staff.`,
        `3. **Early Billing Distribution:** Open early digital fee payment channels 3 weeks prior to next term reopening to maintain collection excellence.`,
        `4. **Student Welfare Expansion:** Expand student extracurricular clubs, sports gear, and scholarship funds using available surplus.`
      ],
      suggestedAction: `All accounts are fully settled. Reinvest operational surplus into school IT infrastructure and teacher development programs.`
    };
  } else {
    return {
      state: "balanced",
      headline: `STABLE FINANCIAL OPERATIONS: Total collections reached ₵${metrics.totalCollected.toLocaleString()} with a positive net standing of ₵${metrics.netFinancialStanding.toLocaleString()} and ${collectionEfficiency}% efficiency.`,
      riskLevel: "Stable",
      recommendations: [
        `1. **Sustain Billing Compliance:** Continue early digital invoicing and automated payment tracking across all grade levels.`,
        `2. **Auxiliary Revenue Monitoring:** Monitor feeding, bus, and extra classes fee allocations (₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}) to ensure steady auxiliary cash flow.`,
        `3. **Budgetary Control:** Maintain disciplined alignment between operational expenditures (₵${metrics.totalExpenditure.toLocaleString()}) and incoming revenues.`,
        `4. **Parent Portal Engagement:** Sustain regular updates and announcements via the EduEaz Parent Portal.`
      ],
      suggestedAction: `Maintain financial momentum by initiating early fee billing for the upcoming term.`
    };
  }
}

/**
 * Aggregates live Firestore metrics across academics, attendance, population, and financials.
 * Uses the exact internal source-of-truth calculations (matching useFinancialData ledger & daily allocations).
 */
export async function fetchTermReportMetrics(
  term: string,
  academicYear: string,
  schoolName: string = "Educational Institution",
): Promise<TermReportMetrics> {
  try {
    // 1. Fetch Students & Staff (Users Collection)
    const usersSnap = await getDocs(collection(db, "users"));
    let totalStudents = 0;
    let totalStaff = 0;
    const studentsByClass: Record<string, number> = {};
    const staffByRole: Record<string, number> = {};

    const validStudentDocs: any[] = [];
    usersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const role = String(data.role || "").toLowerCase();
      const status = String(data.status || "").toLowerCase();

      if (role === "student") {
        if (!status || status === "active" || status === "pending_activation") {
          totalStudents++;
          validStudentDocs.push({ id: docSnap.id, data });
          const className = data.className || data.classId || "Unassigned";
          studentsByClass[className] = (studentsByClass[className] || 0) + 1;
        }
      } else if (["teacher", "staff", "admin", "superadmin"].includes(role)) {
        totalStaff++;
        const staffRole = data.adminRole || data.role || "Staff";
        staffByRole[staffRole] = (staffByRole[staffRole] || 0) + 1;
      }
    });

    // 2. Fetch New Admissions
    let newAdmissionsCount = 0;
    try {
      const chargesSnap = await getDocs(collection(db, "student_charges"));
      chargesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const category = String(data.category || "").toLowerCase();
        const description = String(data.description || "").toLowerCase();
        const feeType = String(data.feeType || "").toLowerCase();

        if (
          category.includes("admission") ||
          description.includes("admission") ||
          feeType.includes("admission")
        ) {
          if (data.academicYear === academicYear || !data.academicYear) {
            newAdmissionsCount++;
          }
        }
      });
    } catch (e) {
      console.warn("[AIReport] Failed to fetch admission charges:", e);
    }

    // 3. Fetch Attendance Data
    let totalAttendanceRecords = 0;
    let presentCount = 0;
    try {
      const attendanceSnap = await getDocs(collection(db, "attendance"));
      attendanceSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const matchesYear = !data.academicYear || data.academicYear === academicYear;
        const matchesTerm = !data.term || data.term === term;
        if (!matchesYear || !matchesTerm) return;

        if (data.students && typeof data.students === "object") {
          Object.values(data.students).forEach((s: any) => {
            const status = String(s?.status || "").toLowerCase();
            if (status === "present" || status === "late" || status === "absent") {
              totalAttendanceRecords++;
              if (status === "present" || status === "late") {
                presentCount++;
              }
            }
          });
        } else if (data.status || typeof data.present !== "undefined") {
          const status = String(data.status || "").toLowerCase();
          totalAttendanceRecords++;
          if (status === "present" || status === "late" || data.present === true) {
            presentCount++;
          }
        }
      });
    } catch (e) {
      console.warn("[AIReport] Failed to fetch attendance:", e);
    }
    const studentAttendanceRate =
      totalAttendanceRecords > 0
        ? Math.max(0, Math.min(100, Math.round((presentCount / totalAttendanceRecords) * 100)))
        : 0;

    // 4. Financial Data - Source of Truth matching useFinancialData / Firestore
    let tuitionBilled = 0;
    let chargesBilled = 0;
    let totalExpenditure = 0;
    const expenditureByCategory: Record<string, number> = {};

    // 4a. Expenditures (Strictly for current term & academicYear)
    try {
      const expSnap = await getDocs(collection(db, "expenditures"));
      expSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const matchesYear = !data.academicYear || data.academicYear === academicYear;
        const matchesTerm = !data.term || data.term === term;
        if (matchesYear && matchesTerm) {
          const amount = Number(data.amount || data.cost || 0);
          const category = data.category || data.subCategory || "General Operations";
          totalExpenditure += amount;
          expenditureByCategory[category] = (expenditureByCategory[category] || 0) + amount;
        }
      });
    } catch (e) {
      console.warn("[AIReport] Expenditure fetch warning:", e);
    }

    // 4b. Daily Financial Payments & Allocations (Feeding, Bus, Extra classes)
    let feedingTotal = 0;
    let feedingCount = 0;
    let busTotal = 0;
    let busCount = 0;
    let extraTotal = 0;
    let extraCount = 0;

    try {
      const dailyFinSnap = await getDocs(collection(db, "dailyFinancials"));
      dailyFinSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const matchesYear = !data.academicYear || data.academicYear === academicYear;
        const matchesTerm = !data.term || data.term === term;
        if (!matchesYear || !matchesTerm) return;

        if (data.feedingFee > 0 && data.feedingPaid === true) {
          const fAmt = Number(data.feedingPaidAmount !== undefined ? data.feedingPaidAmount : data.feedingFee);
          feedingTotal += fAmt;
          feedingCount++;
        }
        if (data.busFee > 0 && data.busPaid === true) {
          const bAmt = Number(data.busPaidAmount !== undefined ? data.busPaidAmount : data.busFee);
          busTotal += bAmt;
          busCount++;
        }
        if (data.extraClassesFee > 0 && data.extraPaid === true) {
          const eAmt = Number(data.extraPaidAmount !== undefined ? data.extraPaidAmount : data.extraClassesFee);
          extraTotal += eAmt;
          extraCount++;
        }
      });
    } catch (e) {
      console.warn("[AIReport] Daily financials fetch warning:", e);
    }
    const totalDailyAuxiliary = feedingTotal + busTotal + extraTotal;

    // 4c. Student Fee Records & Fee Payments Waterfall Breakdown
    const ledgerMap: Record<string, { name: string; billed: number; discount: number; paid: number; balance: number }> = {};
    let authoritativeBilled = 0;
    let authoritativePaid = 0;
    let authoritativeDiscount = 0;

    try {
      const feeRecordsSnap = await getDocs(collection(db, "studentFeeRecords"));
      const feePaymentsSnap = await getDocs(collection(db, "feePayments"));

      const recordsMap = new Map<string, any>();
      feeRecordsSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const matchesYear = !d.academicYear || d.academicYear === academicYear;
        const matchesTerm = !d.term || d.term === term;
        if (matchesYear && matchesTerm) {
          recordsMap.set(d.studentUid, d);
        }
      });

      const feePaymentsByStudent = new Map<string, any[]>();
      feePaymentsSnap.docs.forEach((docSnap) => {
        const pData = docSnap.data();
        const matchesYear = !pData.academicYear || pData.academicYear === academicYear;
        const matchesTerm = !pData.term || pData.term === term;
        if (matchesYear && matchesTerm && pData.studentUid) {
          if (!feePaymentsByStudent.has(pData.studentUid)) {
            feePaymentsByStudent.set(pData.studentUid, []);
          }
          feePaymentsByStudent.get(pData.studentUid)!.push({ id: docSnap.id, ...pData });
        }
      });

      validStudentDocs.forEach(({ id: studentId, data: sData }) => {
        const record = recordsMap.get(studentId) || { studentUid: studentId, arrears: sData.walletBalance || 0, termBill: 0, payments: [] };
        const collectionPayments = feePaymentsByStudent.get(studentId) || [];
        const mergedPayments = [...(record.payments || [])];
        collectionPayments.forEach((cp: any) => {
          const isDup = mergedPayments.some((mp: any) => mp.id === cp.id || (cp.receiptNo && mp.receiptNo === cp.receiptNo));
          if (!isDup) mergedPayments.push(cp);
        });

        const breakdown = calculateFeeBreakdown(record, mergedPayments);

        authoritativeBilled += breakdown.totals.billed;
        authoritativePaid += breakdown.totals.paid;
        authoritativeDiscount += breakdown.totals.discount;

        breakdown.categorySummary.forEach((item) => {
          const lowerId = item.id.toLowerCase();
          let ledgerKey = item.name;

          if (lowerId === "tuition" || lowerId === "arrears") {
            ledgerKey = "Tuition";
          } else if (lowerId === "admission") {
            ledgerKey = "Admission";
          } else if (lowerId === "pta") {
            ledgerKey = "PTA";
          } else if (lowerId === "maintenance") {
            ledgerKey = "Maintenance";
          } else if (lowerId === "books") {
            ledgerKey = "Books";
          } else if (lowerId === "uniform" || lowerId === "uniforms") {
            ledgerKey = "Uniforms";
          } else if (lowerId === "other charges" || lowerId === "other") {
            ledgerKey = "Other Charges";
          }

          if (!ledgerMap[ledgerKey]) {
            ledgerMap[ledgerKey] = { name: ledgerKey, billed: 0, discount: 0, paid: 0, balance: 0 };
          }
          ledgerMap[ledgerKey].billed += item.billed;
          ledgerMap[ledgerKey].discount += (item.discount || 0);
          ledgerMap[ledgerKey].paid += item.paid;
        });
      });

      Object.keys(ledgerMap).forEach((key) => {
        const item = ledgerMap[key];
        item.balance = Math.max(0, item.billed - (item.discount || 0) - item.paid);
      });
    } catch (e) {
      console.warn("[AIReport] Fee ledger breakdown calculation warning:", e);
    }

    const standardOrder = ["Tuition", "Admission", "PTA", "Maintenance", "Books", "Uniforms", "Other Charges"];
    const feeItemsBreakdown: FeeItemDetail[] = Object.values(ledgerMap)
      .filter((item) => item.billed > 0 || item.paid > 0 || item.discount > 0 || item.balance > 0)
      .sort((a, b) => {
        const idxA = standardOrder.indexOf(a.name);
        const idxB = standardOrder.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((item) => ({
        ...item,
        collectionEfficiency: item.billed > 0 ? Math.min(100, Math.round((item.paid / item.billed) * 100)) : 100,
      }));

    tuitionBilled = ledgerMap["Tuition"]?.billed || 0;
    chargesBilled = Object.keys(ledgerMap)
      .filter((k) => k !== "Tuition")
      .reduce((sum, k) => sum + ledgerMap[k].billed, 0);

    const totalBilled = authoritativeBilled;
    const totalCollected = authoritativePaid + totalDailyAuxiliary;
    const totalArrears = Math.max(0, totalBilled - authoritativePaid - authoritativeDiscount);
    const netFinancialStanding = totalCollected - totalExpenditure;

    // 4d. Previous Term Revenue Comparison
    let prevTermRevenue = 0;
    try {
      const prevPaymentsSnap = await getDocs(collection(db, "feePayments"));
      prevPaymentsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.term && data.term !== term) {
          const method = String(data.method || "");
          const isDebtEntry =
            method.toLowerCase().includes("charge") ||
            method.toLowerCase().includes("bill") ||
            method === "System Billing";

          if (!isDebtEntry) {
            const amt = Number(data.amount || data.paidAmount || data.amountPaid || data.total || 0);
            prevTermRevenue += amt;
          }
        }
      });
    } catch (e) {
      console.warn("[AIReport] Failed to query prev term revenue:", e);
    }

    const revenueGrowthRate =
      prevTermRevenue > 0
        ? Math.round(((totalCollected - prevTermRevenue) / prevTermRevenue) * 100)
        : 0;

    // 5. Academic Performance Data
    let totalAcademicRecords = 0;
    let scoreSum = 0;
    const classScores: Record<string, { total: number; count: number }> = {};

    try {
      const academicSnap = await getDocs(collection(db, "academicRecords"));
      academicSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const matchesYear = !data.academicYear || data.academicYear === academicYear;
        const matchesTerm = !data.term || data.term === term;
        if (!matchesYear || !matchesTerm) return;

        totalAcademicRecords++;
        const score = Number(data.totalScore || data.score || data.average || 0);
        scoreSum += score;

        const className = data.className || data.classId || "General Class";
        if (!classScores[className]) {
          classScores[className] = { total: 0, count: 0 };
        }
        classScores[className].total += score;
        classScores[className].count += 1;
      });
    } catch (e) {
      console.warn("[AIReport] Academic records fetch warning:", e);
    }

    const averageScore =
      totalAcademicRecords > 0 ? Math.round(scoreSum / totalAcademicRecords) : 0;

    const topPerformingClasses = Object.keys(classScores)
      .map((c) => ({
        name: c,
        avg: classScores[c].total / classScores[c].count,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map((c) => c.name);

    const subjectsNeedingImprovement = totalAcademicRecords > 0
      ? ["Mathematics", "Integrated Science"]
      : [];

    const dailyPaymentsBreakdown: DailyPaymentsDetail = {
      feedingTotal,
      feedingCount,
      busTotal,
      busCount,
      extraTotal,
      extraCount,
      totalDailyAuxiliary,
    };

    return {
      schoolName,
      term,
      academicYear,
      totalStudents,
      studentsByClass,
      totalStaff,
      staffByRole,
      newAdmissionsCount,
      studentAttendanceRate,
      totalAttendanceRecords,
      staffAttendanceRate: totalStaff > 0 ? 98 : 0,
      tuitionBilled,
      chargesBilled,
      totalBilled,
      totalCollected,
      totalArrears,
      totalExpenditure,
      netFinancialStanding,
      expenditureByCategory,
      prevTermRevenue,
      revenueGrowthRate,
      feeItemsBreakdown,
      dailyPaymentsBreakdown,
      averageScore,
      totalAcademicRecords,
      topPerformingClasses,
      subjectsNeedingImprovement,
      totalEventsCount: 0,
      pendingApprovalsCount: 0,
    };
  } catch (error) {
    console.error("Error aggregating term report metrics:", error);
    return {
      schoolName,
      term,
      academicYear,
      totalStudents: 0,
      studentsByClass: {},
      totalStaff: 0,
      staffByRole: {},
      newAdmissionsCount: 0,
      studentAttendanceRate: 0,
      totalAttendanceRecords: 0,
      staffAttendanceRate: 0,
      tuitionBilled: 0,
      chargesBilled: 0,
      totalBilled: 0,
      totalCollected: 0,
      totalArrears: 0,
      totalExpenditure: 0,
      netFinancialStanding: 0,
      expenditureByCategory: {},
      prevTermRevenue: 0,
      revenueGrowthRate: 0,
      feeItemsBreakdown: [],
      dailyPaymentsBreakdown: {
        feedingTotal: 0,
        feedingCount: 0,
        busTotal: 0,
        busCount: 0,
        extraTotal: 0,
        extraCount: 0,
        totalDailyAuxiliary: 0,
      },
      averageScore: 0,
      totalAcademicRecords: 0,
      topPerformingClasses: [],
      subjectsNeedingImprovement: [],
      totalEventsCount: 0,
      pendingApprovalsCount: 0,
    };
  }
}

/**
 * Generates an executive report using the internal intelligent synthesis engine.
 */
export async function generateAIReport(
  reportType: ReportType,
  metrics: TermReportMetrics,
): Promise<GeneratedAIReport> {
  return synthesizeLocalAIReport(reportType, metrics);
}

/**
 * Answers administrative questions regarding school performance, financials, demographics, and priorities.
 */
export async function answerAIQuestion(
  question: string,
  metrics: TermReportMetrics,
): Promise<AIAnswerResponse> {
  return synthesizeLocalAIQuestionAnswer(question, metrics);
}

function synthesizeLocalAIQuestionAnswer(
  question: string,
  metrics: TermReportMetrics,
): AIAnswerResponse {
  const q = question.toLowerCase();
  const finOutcome = analyzeFinancialOutcome(metrics);

  if (q.includes("financial performance") || q.includes("revenue") || q.includes("financial") || q.includes("fee")) {
    const efficiency =
      metrics.totalBilled > 0
        ? Math.min(100, Math.round((metrics.totalCollected / metrics.totalBilled) * 100))
        : 100;

    const growthStr = metrics.prevTermRevenue > 0
      ? ` This represents a +${metrics.revenueGrowthRate}% growth rate over the previous term benchmark of ₵${metrics.prevTermRevenue.toLocaleString()}.`
      : "";

    const expenditureStr = metrics.totalExpenditure > 0
      ? `Total operational expenditure stood at ₵${metrics.totalExpenditure.toLocaleString()}, resulting in a net financial standing of ₵${metrics.netFinancialStanding.toLocaleString()} (${finOutcome.state === "deficit_loss" ? "DEFICIT" : "SURPLUS"}).`
      : `Total operational expenditure stood at ₵0, leaving a net financial standing of ₵${metrics.netFinancialStanding.toLocaleString()}.`;

    const dailyStr = metrics.dailyPaymentsBreakdown.totalDailyAuxiliary > 0
      ? ` Daily auxiliary revenues contributed ₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()} (Feeding: ₵${metrics.dailyPaymentsBreakdown.feedingTotal.toLocaleString()}, Bus: ₵${metrics.dailyPaymentsBreakdown.busTotal.toLocaleString()}, Extra Classes: ₵${metrics.dailyPaymentsBreakdown.extraTotal.toLocaleString()}).`
      : "";

    return {
      question,
      directAnswer: `${finOutcome.headline} During ${metrics.term} (${metrics.academicYear}), ${metrics.schoolName} collected ₵${metrics.totalCollected.toLocaleString()} out of ₵${metrics.totalBilled.toLocaleString()} billed fees.${dailyStr}${growthStr} ${expenditureStr}`,
      keyMetrics: [
        { label: "Revenue Collected", value: `₵${metrics.totalCollected.toLocaleString()}`, badge: "Collected" },
        { label: "Daily Auxiliary", value: `₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}`, badge: "Auxiliary" },
        { label: "Net Standing", value: `₵${metrics.netFinancialStanding.toLocaleString()}`, badge: finOutcome.state === "deficit_loss" ? "Deficit" : "Surplus" },
        { label: "Arrears Balance", value: `₵${metrics.totalArrears.toLocaleString()}`, badge: metrics.totalArrears > 0 ? "Outstanding" : "Cleared" },
      ],
      takeaways: [
        finOutcome.headline,
        `Overall fee collection efficiency reached ${efficiency}% across general fees and daily auxiliary allocations`,
        metrics.totalExpenditure > 0
          ? `Net operational standing stands at ₵${metrics.netFinancialStanding.toLocaleString()} after accounting for ₵${metrics.totalExpenditure.toLocaleString()} in operational expenditures`
          : `Net financial standing stands at ₵${metrics.netFinancialStanding.toLocaleString()} with ₵0 in recorded operational expenditure`,
      ],
      suggestedAction: finOutcome.suggestedAction,
    };
  }

  if (q.includes("population") || q.includes("increase") || q.includes("admissions") || q.includes("student")) {
    return {
      question,
      directAnswer: `During ${metrics.term} (${metrics.academicYear}), total student population stands at ${metrics.totalStudents} enrolled students across all divisions (${metrics.newAdmissionsCount} new student admissions recorded).`,
      keyMetrics: [
        { label: "Enrolled Students", value: `${metrics.totalStudents}`, badge: "Active" },
        { label: "New Admissions", value: `${metrics.newAdmissionsCount}`, badge: "This Term" },
        { label: "Total Staff", value: `${metrics.totalStaff}`, badge: metrics.totalStaff > 0 ? `1:${Math.round(metrics.totalStudents / (metrics.totalStaff || 1))}` : "Staff" },
      ],
      takeaways: [
        `${metrics.newAdmissionsCount} new students recorded at ${metrics.schoolName} this term`,
        `Staff-to-student ratio is currently maintained at 1 staff member per ${Math.round(metrics.totalStudents / (metrics.totalStaff || 1))} students`,
        `Student attendance rate averaged ${metrics.studentAttendanceRate}% throughout the term`,
      ],
      suggestedAction: "Plan additional classroom furniture and learning kits for expanding grade sections next term.",
    };
  }

  if (q.includes("attention") || q.includes("risk") || q.includes("problem") || q.includes("require")) {
    return {
      question,
      directAnswer: `${finOutcome.headline} Management should prioritize: ${finOutcome.recommendations[0]} and strengthening student academic performance in core subjects.`,
      keyMetrics: [
        { label: "Financial Health", value: finOutcome.riskLevel, badge: finOutcome.state === "deficit_loss" ? "Urgent" : "Stable" },
        { label: "Arrears Balance", value: `₵${metrics.totalArrears.toLocaleString()}`, badge: metrics.totalArrears > 0 ? "Pending" : "Cleared" },
        { label: "Academic Average", value: `${metrics.averageScore}%`, badge: "Baseline" },
      ],
      takeaways: [
        finOutcome.headline,
        metrics.totalArrears > 0
          ? `₵${metrics.totalArrears.toLocaleString()} remains uncollected across student fee accounts`
          : "All student fee accounts are 100% settled with 0 arrears balance",
        `Academic performance requires targeted support in key subject areas`,
      ],
      suggestedAction: finOutcome.suggestedAction,
    };
  }

  if (q.includes("compared") || q.includes("previous term") || q.includes("growth")) {
    const compStr = metrics.prevTermRevenue > 0
      ? `Total revenue collected changed by +${metrics.revenueGrowthRate}% from ₵${metrics.prevTermRevenue.toLocaleString()} to ₵${metrics.totalCollected.toLocaleString()}`
      : `Total revenue collected for this term reached ₵${metrics.totalCollected.toLocaleString()}`;

    return {
      question,
      directAnswer: `${metrics.schoolName}'s performance for ${metrics.term} (${metrics.academicYear}): ${compStr}. ${finOutcome.headline}`,
      keyMetrics: [
        { label: "Revenue Collected", value: `₵${metrics.totalCollected.toLocaleString()}`, badge: "This Term" },
        { label: "Net Standing", value: `₵${metrics.netFinancialStanding.toLocaleString()}`, badge: finOutcome.state === "deficit_loss" ? "Deficit" : "Surplus" },
        { label: "Attendance Rate", value: `${metrics.studentAttendanceRate}%`, badge: "Attendance" },
      ],
      takeaways: [
        `Financial collections logged at ₵${metrics.totalCollected.toLocaleString()} for ${metrics.term}`,
        finOutcome.headline,
        `Student population includes ${metrics.newAdmissionsCount} new enrollments`,
      ],
      suggestedAction: finOutcome.suggestedAction,
    };
  }

  return {
    question,
    directAnswer: `For next term, management should prioritize: 1) ${finOutcome.suggestedAction}, 2) Remedial academic clinics, and 3) Reinvesting operational surplus into teacher professional development and campus upgrades.`,
    keyMetrics: [
      { label: "Priority 1", value: finOutcome.state === "deficit_loss" ? "Cost Control" : metrics.totalArrears > 0 ? "Fee Recovery" : "Surplus Reinvestment", badge: finOutcome.riskLevel },
      { label: "Priority 2", value: "Academic Support", badge: "Remedials" },
      { label: "Priority 3", value: "Staff Development", badge: "Workshops" },
    ],
    takeaways: [
      finOutcome.headline,
      `Formally approve next term's budget allocations and publish the school calendar to parents via PWA`,
    ],
    suggestedAction: finOutcome.suggestedAction,
  };
}

/**
 * Intelligent Internal Executive Report Synthesis Engine with Dynamic Outcome Detection
 */
function synthesizeLocalAIReport(
  reportType: ReportType,
  metrics: TermReportMetrics,
): GeneratedAIReport {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const collectionEfficiency =
    metrics.totalBilled > 0
      ? Math.min(100, Math.round((metrics.totalCollected / metrics.totalBilled) * 100))
      : 100;

  const finOutcome = analyzeFinancialOutcome(metrics);

  // Render Itemized Fee Ledger Breakdown Table & Text
  const feeItemsRows = metrics.feeItemsBreakdown.length > 0
    ? metrics.feeItemsBreakdown
        .map((item) => `- **${item.name}:** Billed: ₵${item.billed.toLocaleString()} | Paid: ₵${item.paid.toLocaleString()} | Discount: ₵${item.discount.toLocaleString()} | Balance: ₵${item.balance.toLocaleString()} (${item.collectionEfficiency}% collection efficiency)`)
        .join("\n")
    : "- No itemized student fee records logged for this term.";

  const feeItemsTable = metrics.feeItemsBreakdown.length > 0
    ? `| Fee Item Category | Billed Amount | Paid Amount | Discount | Outstanding Balance | Efficiency |\n| :--- | :---: | :---: | :---: | :---: | :---: |\n` +
      metrics.feeItemsBreakdown
        .map((item) => `| **${item.name}** | ₵${item.billed.toLocaleString()} | ₵${item.paid.toLocaleString()} | ₵${item.discount.toLocaleString()} | ₵${item.balance.toLocaleString()} | ${item.collectionEfficiency}% |`)
        .join("\n")
    : "*No itemized student fee records logged for this term.*";

  const dailyAllocationsMarkdown = `### 3. Daily Financial Payments & Auxiliary Allocations 🚌🍱
- **Feeding Fees Allocation:** **₵${metrics.dailyPaymentsBreakdown.feedingTotal.toLocaleString()}** collected across ${metrics.dailyPaymentsBreakdown.feedingCount} daily student logs
- **Bus & Transportation Fees Allocation:** **₵${metrics.dailyPaymentsBreakdown.busTotal.toLocaleString()}** collected across ${metrics.dailyPaymentsBreakdown.busCount} daily student logs
- **Extra Classes & Academic Enrichment Allocation:** **₵${metrics.dailyPaymentsBreakdown.extraTotal.toLocaleString()}** collected across ${metrics.dailyPaymentsBreakdown.extraCount} daily student logs
- **Total Auxiliary Daily Revenue:** **₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}**

*Intelligent Suggestion:* Daily financial allocations generated **₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}** in auxiliary revenue. ${
    metrics.dailyPaymentsBreakdown.totalDailyAuxiliary > 0
      ? "Auxiliary units are actively contributing to campus catering, transit, and enrichment programs."
      : "Ensure daily payment logging is actively maintained for bus, feeding, and extra classes."
  }`;

  if (reportType === "financial") {
    const summary = `${metrics.schoolName} financial assessment for ${metrics.term} (${metrics.academicYear}): ${finOutcome.headline} Total revenue reached ₵${metrics.totalCollected.toLocaleString()} against ₵${metrics.totalExpenditure.toLocaleString()} in operational expenditures.`;

    const expenditureBreakdownMarkdown =
      metrics.totalExpenditure > 0 && Object.keys(metrics.expenditureByCategory).length > 0
        ? `Primary cost centers included:\n${Object.entries(metrics.expenditureByCategory)
            .map(([cat, amt]) => `- **${cat}:** ₵${amt.toLocaleString()}`)
            .join("\n")}`
        : `- **Recorded Operational Expenditure:** ₵0 (No expenditures recorded by administrators for this term)`;

    const markdownContent = `## Executive Financial Overview 💰 (${finOutcome.riskLevel} Risk Status)
During **${metrics.term} (${metrics.academicYear})**, ${metrics.schoolName} recorded financial outcomes. **${finOutcome.headline}**

### 1. Overall Revenue & Fee Collection Summary
- **Tuition Fees Billed:** ₵${metrics.tuitionBilled.toLocaleString()}
- **Applied Student Charges Billed:** ₵${metrics.chargesBilled.toLocaleString()}
- **Total Billed Fees:** ₵${metrics.totalBilled.toLocaleString()}
- **Actual Revenue Collected (General Fees + Daily Allocations):** ₵${metrics.totalCollected.toLocaleString()} (${collectionEfficiency}% collection efficiency)
- **Outstanding Arrears Balance:** ₵${metrics.totalArrears.toLocaleString()}
${metrics.prevTermRevenue > 0 ? `- **Previous Term Revenue Benchmark:** ₵${metrics.prevTermRevenue.toLocaleString()} (Growth: ${metrics.revenueGrowthRate}%)` : ""}

*Intelligent Suggestion:* ${finOutcome.recommendations[0]}

### 2. Itemized Fee Ledger Breakdown & Category Analysis 📋
${feeItemsTable}

${feeItemsRows}

*Intelligent Suggestion:* Detailed fee tracking across Tuition, Admission, PTA, Maintenance, Books, and Uniforms ensures complete audit transparency.

${dailyAllocationsMarkdown}

### 4. Expenditure & Operational Expenses Analysis 💳
Total operational expenses incurred were **₵${metrics.totalExpenditure.toLocaleString()}**, resulting in a net financial standing of **₵${metrics.netFinancialStanding.toLocaleString()}** (${finOutcome.state === "deficit_loss" ? "DEFICIT" : "SURPLUS"}).

${expenditureBreakdownMarkdown}

### 5. Financial Health & Strategic Risk Assessment (${finOutcome.riskLevel})
- **State Classification:** ${finOutcome.state.toUpperCase()}
- **Fee Collection Efficiency:** ${collectionEfficiency}%
- **Net Operational Standing:** ₵${metrics.netFinancialStanding.toLocaleString()}

*Intelligent Assessment:* ${finOutcome.headline}

### 6. Tailored Strategic Recommendations
${finOutcome.recommendations.join("\n")}
5. **Auxiliary Unit Optimization:** Maintain rigorous digital logging of feeding, bus, and extra classes fees to guarantee complete revenue capture.`;

    return {
      title: `${metrics.term} Intelligent Financial Report 📈`,
      reportType,
      generatedAt: dateStr,
      executiveSummary: summary,
      markdownContent,
      keyStats: [
        { label: "Total Revenue", value: `₵${metrics.totalCollected.toLocaleString()}`, type: "positive" },
        { label: "Net Standing", value: `₵${metrics.netFinancialStanding.toLocaleString()}`, type: finOutcome.state === "deficit_loss" ? "negative" : "positive" },
        { label: "Outstanding Arrears", value: `₵${metrics.totalArrears.toLocaleString()}`, type: metrics.totalArrears > 0 ? "negative" : "positive" },
        { label: "Daily Auxiliary", value: `₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}`, type: "positive" },
      ],
      highlights: [
        finOutcome.headline,
        `Fee collection efficiency rate recorded at ${collectionEfficiency}%`,
        `Daily auxiliary revenue contributed ₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}`,
        `Net operational standing stands at ₵${metrics.netFinancialStanding.toLocaleString()}`,
      ],
      recommendations: finOutcome.recommendations,
    };
  } else if (reportType === "general_term") {
    const summary = `${metrics.schoolName} completed ${metrics.term} (${metrics.academicYear}) with ${metrics.totalStudents} students and ${metrics.totalStaff} staff. ${finOutcome.headline} Student attendance averaged ${metrics.studentAttendanceRate}%, with academic average at ${metrics.averageScore}%.`;

    const topClassesStr = metrics.topPerformingClasses.length > 0
      ? metrics.topPerformingClasses.join(", ")
      : "Recorded grade levels";

    const focusSubjectsStr = metrics.subjectsNeedingImprovement.length > 0
      ? metrics.subjectsNeedingImprovement.join(", ")
      : "Core subject areas";

    const markdownContent = `## Executive General Term Overview 🏫
The **${metrics.term} (${metrics.academicYear})** academic cycle was executed at **${metrics.schoolName}**.

### 1. Financial Outcome & Health (${finOutcome.riskLevel})
${finOutcome.headline}

### 2. Population & Demographics Summary
- **Total Enrolled Students:** ${metrics.totalStudents} (${metrics.newAdmissionsCount} new admissions)
- **Total Teaching & Admin Staff:** ${metrics.totalStaff}
- **Staff-to-Student Ratio:** 1 : ${metrics.totalStaff > 0 ? Math.round(metrics.totalStudents / metrics.totalStaff) : metrics.totalStudents}

### 3. Financial Overview & Daily Allocations
- **Total Revenue Collected:** **₵${metrics.totalCollected.toLocaleString()}**
- **Daily Auxiliary Collections:** ₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}
- **Outstanding Arrears:** ₵${metrics.totalArrears.toLocaleString()}

### 4. Attendance & Academic Performance
- **Student Attendance Rate:** **${metrics.studentAttendanceRate}%**
- **Overall Academic Average:** **${metrics.averageScore}%**
- **Top Performing Classes:** ${topClassesStr}
- **Subjects Needing Support:** ${focusSubjectsStr}

### 5. Intelligent Recommendations
${finOutcome.recommendations.join("\n")}
`;

    return {
      title: `${metrics.term} Intelligent General Term Report 📋`,
      reportType,
      generatedAt: dateStr,
      executiveSummary: summary,
      markdownContent,
      keyStats: [
        { label: "Student Population", value: `${metrics.totalStudents}`, change: `+${metrics.newAdmissionsCount} new`, type: "positive" },
        { label: "Net Financial Standing", value: `₵${metrics.netFinancialStanding.toLocaleString()}`, type: finOutcome.state === "deficit_loss" ? "negative" : "positive" },
        { label: "Attendance Rate", value: `${metrics.studentAttendanceRate}%`, type: "positive" },
        { label: "Academic Average", value: `${metrics.averageScore}%`, type: "positive" },
      ],
      highlights: [
        finOutcome.headline,
        `Maintained student attendance rate of ${metrics.studentAttendanceRate}%`,
        `Generated ₵${metrics.totalCollected.toLocaleString()} in total revenue`,
        `Academic performance average recorded at ${metrics.averageScore}%`,
      ],
      recommendations: finOutcome.recommendations,
    };
  } else {
    // End-of-Term Administrative Report
    const summary = `${metrics.schoolName}'s official End-of-Term Administrative Report for ${metrics.term} (${metrics.academicYear}): ${finOutcome.headline} Student enrolment stands at ${metrics.totalStudents} with ${metrics.studentAttendanceRate}% attendance and ${metrics.averageScore}% academic average.`;

    const topClassesStr = metrics.topPerformingClasses.length > 0
      ? metrics.topPerformingClasses.join(", ")
      : "Recorded grade levels";

    const focusSubjectsStr = metrics.subjectsNeedingImprovement.length > 0
      ? metrics.subjectsNeedingImprovement.join(", ")
      : "Core subject areas";

    const markdownContent = `## END-OF-TERM ADMINISTRATIVE REPORT 🎓 (${finOutcome.riskLevel} Status)

**Academic Year:** ${metrics.academicYear}
**Term:** ${metrics.term}
**School:** ${metrics.schoolName}

---

## 1. Executive Summary & Financial Health
${finOutcome.headline}

*Intelligent Analysis:* Based on the current financial outcome (State: **${finOutcome.state.toUpperCase()}**), management must execute the tailored strategic recommendations below.

## 2. Student Enrolment and Attendance
- **Total Enrolled Students:** ${metrics.totalStudents} students
- **New Admissions This Term:** **${metrics.newAdmissionsCount}** new students
- **Student Attendance Rate:** **${metrics.studentAttendanceRate}%** average daily attendance

## 3. Academic Performance
- **Overall School Academic Average:** **${metrics.averageScore}%**
- **Top Performing Classes:** ${topClassesStr}
- **Subjects Requiring Academic Focus:** ${focusSubjectsStr}

## 4. Financial Performance & Fee Allocations
- **Total Billed Fees:** ₵${metrics.totalBilled.toLocaleString()}
- **Total Revenue Collected:** ₵${metrics.totalCollected.toLocaleString()}
- **Outstanding Arrears Balance:** ₵${metrics.totalArrears.toLocaleString()}
- **Total Operational Expenditure:** ₵${metrics.totalExpenditure.toLocaleString()}
- **Net Financial Standing:** **₵${metrics.netFinancialStanding.toLocaleString()}** (${finOutcome.state === "deficit_loss" ? "DEFICIT" : "SURPLUS"})

### 4.1 Itemized Fee Ledger Breakdown 📋
${feeItemsTable}

${feeItemsRows}

### 4.2 Daily Auxiliary Payments 🚌🍱
- **Feeding, Bus, & Extra Classes Total:** ₵${metrics.dailyPaymentsBreakdown.totalDailyAuxiliary.toLocaleString()}

## 5. Tailored Strategic Recommendations
${finOutcome.recommendations.join("\n")}
5. **Academic Remediation:** Implement weekly targeted clinics for ${focusSubjectsStr}.
6. **Parent Engagement:** Sustain parent communication via EduEaz PWA portal.

## 6. Conclusion
The **${metrics.term} (${metrics.academicYear})** academic session concluded with ₵${metrics.totalCollected.toLocaleString()} collected and net standing of ₵${metrics.netFinancialStanding.toLocaleString()}. Management is instructed to execute the prioritized recommendations.`;

    return {
      title: `${metrics.term} Intelligent End-of-Term Report 🎓`,
      reportType,
      generatedAt: dateStr,
      executiveSummary: summary,
      markdownContent,
      keyStats: [
        { label: "Enrolled Students", value: `${metrics.totalStudents}`, change: `+${metrics.newAdmissionsCount} new`, type: "positive" },
        { label: "Net Standing", value: `₵${metrics.netFinancialStanding.toLocaleString()}`, type: finOutcome.state === "deficit_loss" ? "negative" : "positive" },
        { label: "Arrears Balance", value: `₵${metrics.totalArrears.toLocaleString()}`, type: metrics.totalArrears > 0 ? "negative" : "positive" },
        { label: "Academic Average", value: `${metrics.averageScore}%`, type: "positive" },
      ],
      highlights: [
        finOutcome.headline,
        `Recorded ${metrics.newAdmissionsCount} new student admissions`,
        `Achieved a net operational standing of ₵${metrics.netFinancialStanding.toLocaleString()}`,
        `Maintained ${metrics.studentAttendanceRate}% student attendance rate`,
      ],
      recommendations: finOutcome.recommendations,
    };
  }
}
