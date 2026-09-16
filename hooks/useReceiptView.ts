import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, query, collection, where, getDocs, deleteDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useRouter } from 'expo-router';
import { Alert, Platform } from 'react-native';
import moment from 'moment';
import { SCHOOL_CONFIG } from '../constants/Config';
import { getSchoolLogo } from '../constants/Logos';
import { generateFeeReceiptPDF, generateFeeStatementPDF } from '../utils/pdfGenerator';
import Constants from 'expo-constants';
import { COLORS } from '../constants/theme';
import { normalizeCategory, isPaymentEntry } from './admin-dashboard/finance-cleanup/utils';

interface UseReceiptViewProps {
    type: string | string[];
    studentId: string | string[];
    year: string | string[];
    term: string | string[];
    paymentId: string | string[];
}

const nameMap: Record<string, string> = {
    tuition: "Tuition Fees",
    pta: "PTA Dues",
    maintenance: "Maintenance Fee",
    admission: "Admission Fee",
    books: "Books Fee",
    uniform: "Uniform Fee",
    other: "Other Charges",
    arrears: "Arrears / Previous Balance",
    tuition_payment: "Tuition Payment",
    pta_payment: "PTA Dues Payment",
    maintenance_payment: "Maintenance Fee Payment",
    admission_payment: "Admission Fee Payment",
    books_payment: "Books Payment",
    uniform_payment: "Uniform Payment",
    other_payment: "Other Charges Payment",
    tuition_credit: "Tuition Credit / Overpayment",
};

export const useReceiptView = ({ type, studentId, year, term, paymentId }: UseReceiptViewProps) => {
    const { appUser } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [record, setRecord] = useState<any>(null);
    const [payment, setPayment] = useState<any>(null);
    const [studentData, setStudentData] = useState<any>(null);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);

    const schoolId = (Constants.expoConfig?.extra?.schoolId || "school").toLowerCase();
    const schoolLogo = getSchoolLogo(schoolId);
    const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
    const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

    useEffect(() => {
        const fetchData = async () => {
            if (!studentId) return;
            setLoading(true);
            try {
                // Fetch Student Data
                const sDoc = await getDoc(doc(db, "users", studentId as string));
                if (sDoc.exists()) setStudentData(sDoc.data());

                if (type === "bill") {
                    const cleanYear = (year as string).replace(/\//g, "-");
                    const cleanTerm = (term as string).replace(/\s/g, "");
                    const recordId = `${studentId}_${cleanYear}_${cleanTerm}`;
                    const rDoc = await getDoc(doc(db, "studentFeeRecords", recordId));
                    if (rDoc.exists()) setRecord(rDoc.data());

                    // Also fetch transactions for this period to ensure breakdown is accurate
                    const q = query(
                        collection(db, "feePayments"),
                        where("studentUid", "==", studentId),
                        where("academicYear", "==", year),
                        where("term", "==", term),
                    );
                    const tSnap = await getDocs(q);
                    setAllTransactions(
                        tSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                    );
                } else if (type === "payment" && paymentId) {
                    const pDoc = await getDoc(
                        doc(db, "feePayments", paymentId as string),
                    );
                    if (pDoc.exists()) setPayment(pDoc.data());
                }
            } catch (err) {
                console.error("Error fetching receipt data:", err);
                showToast({ message: "Failed to load receipt details", type: "error" });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [type, studentId, year, term, paymentId]);

    const formatType = (rawType: string, otherCategory?: string) => {
        if (otherCategory) return otherCategory;
        if (!rawType) return "Fee Payment";
        const normalized = rawType.toLowerCase();
        if (nameMap[normalized]) return nameMap[normalized];
        return normalized
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    const categorySummary = useMemo(() => {
        if (type !== "bill") return [];

        const summary: Record<string, { billed: number; paid: number }> = {
            tuition: { billed: 0, paid: 0 },
        };

        if (record?.arrears && Number(record.arrears) !== 0) {
            summary["arrears"] = { billed: Number(record.arrears), paid: 0 };
        }

        const waterfallPool: any[] = [];

        allTransactions.forEach((t: any) => {
            const isPayment = isPaymentEntry(t);
            const category = normalizeCategory(t);

            if (!summary[category]) summary[category] = { billed: 0, paid: 0 };

            if (isPayment) {
                if (category === "tuition") {
                    waterfallPool.push(Number(t.amount) || 0);
                } else {
                    summary[category].paid += Number(t.amount) || 0;
                }
            } else {
                summary[category].billed += Number(t.amount) || 0;
            }
        });

        // Add hardcoded records from the database doc
        if (record) {
            const baseTuitionBilled = Math.max(0, (Number(record.termBill) || 0) - (Number(record.discount) || 0));
            summary["tuition"].billed = Math.max(summary["tuition"].billed, baseTuitionBilled);

            const isolated = [
                { key: "pta", bill: record.ptaBill || 0, paid: record.ptaPaid || 0 },
                { key: "maintenance", bill: record.maintenanceBill || 0, paid: record.maintenancePaid || 0 },
                { key: "admission", bill: record.admissionBill || 0, paid: record.admissionPaid || 0 },
                { key: "books", bill: record.booksBill || 0, paid: record.booksPaid || 0 },
                { key: "uniform", bill: record.uniformBill || 0, paid: record.uniformPaid || 0 },
            ];

            isolated.forEach((cat) => {
                if (!summary[cat.key]) summary[cat.key] = { billed: 0, paid: 0 };
                summary[cat.key].billed = Math.max(summary[cat.key].billed, Number(cat.bill) || 0);
                // We don't Math.max the paid here because the waterfall handles it,
                // but we should respect the base documents that were already split
            });
        }

        // Virtual Waterfall for display (Matched with useFeeLedger.ts)
        let totalGeneralPool = waterfallPool.reduce((a, b) => a + b, 0);

        // 1. Settle Arrears first
        if (summary["arrears"] && totalGeneralPool > 0) {
            const toArrears = Math.min(totalGeneralPool, summary["arrears"].billed);
            summary["arrears"].paid += toArrears;
            totalGeneralPool -= toArrears;
        }

        // 2. Settle Tuition Bill
        const tuitionToPay = Math.min(totalGeneralPool, summary["tuition"].billed);
        summary["tuition"].paid += tuitionToPay;
        totalGeneralPool -= tuitionToPay;

        // 3. Settle Isolated Categories in Order
        const displayWaterfallOrder = ['admission', 'pta', 'maintenance', 'books', 'uniform'];
        displayWaterfallOrder.forEach(cat => {
            if (summary[cat] && totalGeneralPool > 0) {
                const due = Math.max(0, summary[cat].billed - summary[cat].paid);
                const settle = Math.min(totalGeneralPool, due);
                summary[cat].paid += settle;
                totalGeneralPool -= settle;
            }
        });

        // 4. Settle Dynamic Categories (Exams, Mocks, etc)
        Object.keys(summary).forEach(cat => {
            if (!['tuition', 'arrears', ...displayWaterfallOrder].includes(cat) && totalGeneralPool > 0) {
                const due = Math.max(0, summary[cat].billed - summary[cat].paid);
                const settle = Math.min(totalGeneralPool, due);
                summary[cat].paid += settle;
                totalGeneralPool -= settle;
            }
        });

        // 5. Remaining goes to Tuition (as credit)
        if (totalGeneralPool > 0) {
            summary["tuition"].paid += totalGeneralPool;
        }

        // Return all items with non-zero billed or paid
        return Object.entries(summary)
            .filter(([_, vals]) => Math.abs(vals.billed) >= 0.01 || Math.abs(vals.paid) >= 0.01)
            .sort(([a], [b]) => {
                if (a === 'arrears') return -1;
                if (b === 'arrears') return 1;
                if (a === 'tuition') return -1;
                if (b === 'tuition') return 1;
                return a.localeCompare(b);
            })
            .map(([cat, vals]) => ({
                id: cat,
                name: nameMap[cat] || cat.toUpperCase(),
                billed: vals.billed,
                paid: vals.paid,
                balance: vals.billed - vals.paid,
            }));
    }, [record, allTransactions, type]);

    const totals = useMemo(() => {
        if (type !== "bill") return { billed: 0, paid: 0, balance: 0 };

        const totalBilled = categorySummary.reduce((acc, curr) => acc + curr.billed, 0);
        const totalPaid = categorySummary.reduce((acc, curr) => acc + curr.paid, 0);

        const netBalance = totalBilled - totalPaid;

        return { billed: totalBilled, paid: totalPaid, balance: netBalance };
    }, [categorySummary, type]);

    const handleDelete = async () => {
        if (appUser?.role !== "admin") return;

        const isBill = type === "bill";
        const title = isBill ? "Delete Bill?" : "Delete Payment?";
        const message = isBill
            ? "This will remove the term record and reset all balances for this period. Are you sure?"
            : "This will remove the payment and update the student's debt balance. This cannot be undone.";

        const proceedDelete = async () => {
            setLoading(true);
            try {
                if (isBill) {
                    const cleanYear = (year as string).replace(/\//g, "-");
                    const cleanTerm = (term as string).replace(/\s/g, "");
                    const recordId = `${studentId}_${cleanYear}_${cleanTerm}`;
                    await deleteDoc(doc(db, "studentFeeRecords", recordId));
                    showToast({
                        message: "Bill record deleted successfully",
                        type: "success",
                    });
                } else {
                    // Atomic transaction to delete payment and revert balance
                    await runTransaction(db, async (transaction) => {
                        const pDocRef = doc(db, "feePayments", paymentId as string);
                        const pSnap = await transaction.get(pDocRef);
                        if (!pSnap.exists()) throw "Payment not found";

                        const pData = pSnap.data();
                        const amt = Number(pData.amount) || 0;
                        const pType = (pData.type || "tuition").toLowerCase();
                        const cleanYear = (pData.academicYear as string).replace(
                            /\//g,
                            "-",
                        );
                        const cleanTerm = (pData.term as string).replace(/\s/g, "");
                        const recordId = `${studentId}_${cleanYear}_${cleanTerm}`;

                        // 1. Revert Global Wallet Balance
                        const userRef = doc(db, "users", studentId as string);
                        transaction.update(userRef, {
                            walletBalance: increment(amt),
                        });

                        // 2. Revert Term Record Balance
                        const rRef = doc(db, "studentFeeRecords", recordId);
                        const rSnap = await transaction.get(rRef);

                        if (rSnap.exists()) {
                            const updateData: any = {};
                            if (
                                pType === "tuition" ||
                                pType === "tuition_payment" ||
                                pType === "tuition_credit"
                            ) {
                                updateData.amountPaid = increment(-amt);
                                updateData.balance = increment(amt);
                            } else {
                                const cat = pType.replace("_payment", "");
                                updateData[`${cat}Paid`] = increment(-amt);
                                updateData[`${cat}Balance`] = increment(amt);
                            }
                            transaction.update(rRef, updateData);
                        }

                        // 3. Delete the actual payment
                        transaction.delete(pDocRef);
                    });
                    showToast({
                        message: "Payment deleted and balance reverted",
                        type: "success",
                    });
                }
                router.back();
            } catch (err) {
                console.error("Delete error:", err);
                showToast({ message: "Failed to delete record", type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                await proceedDelete();
            }
        } else {
            Alert.alert(title, message, [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: proceedDelete,
                },
            ]);
        }
    };

    const generatePDF = async () => {
        const sName = studentData
            ? `${studentData.profile?.firstName || ""} ${studentData.profile?.lastName || ""}`.trim()
            : "Student";

        try {
            if (type === "bill") {
                await generateFeeStatementPDF(
                    {
                        studentName: sName,
                        studentClass: studentData?.className || "N/A",
                        academicYear: (year || record?.academicYear) as string,
                        term: (term || record?.term) as string,
                        categorySummary: categorySummary.map((i) => ({
                            name: i.name,
                            billed: i.billed,
                            paid: i.paid,
                            balance: i.balance,
                        })),
                        totals: {
                            billed: totals.billed,
                            paid: totals.paid,
                            balance: totals.balance,
                        },
                        discount: Number(record?.discount) || 0,
                        currencySymbol: SCHOOL_CONFIG.currencySymbol,
                    },
                    SCHOOL_CONFIG.fullName,
                    SCHOOL_CONFIG.hotline,
                    SCHOOL_CONFIG.email,
                    SCHOOL_CONFIG.address,
                    SCHOOL_CONFIG.motto,
                    getSchoolLogo(SCHOOL_CONFIG.schoolId),
                );
            } else if (payment) {
                await generateFeeReceiptPDF(
                    {
                        studentName: sName,
                        studentClass: studentData?.className || "N/A",
                        academicYear: (year || record?.academicYear) as string,
                        term: (term || record?.term) as string,
                        receiptNo: payment.receiptNo || paymentId,
                        date: moment(payment.createdAt || payment.timestamp?.toDate()).format(
                            "DD/MM/YYYY hh:mm A",
                        ),
                        category: formatType(payment.type, payment.otherCategory),
                        amount: Number(payment.amount) || 0,
                        method: payment.method || "CASH",
                        receivedFrom: payment.receivedFrom || "SELF",
                        processedBy: payment.updatedBy || "ADMIN",
                        currencySymbol: SCHOOL_CONFIG.currencySymbol,
                    },
                    SCHOOL_CONFIG.fullName,
                    SCHOOL_CONFIG.hotline,
                    SCHOOL_CONFIG.email,
                    SCHOOL_CONFIG.address,
                    SCHOOL_CONFIG.motto,
                    getSchoolLogo(SCHOOL_CONFIG.schoolId),
                );
            }
        } catch (e) {
            console.error("PDF generation error:", e);
            showToast({ message: "Failed to generate PDF", type: "error" });
        }
    };

    return {
        loading,
        record,
        payment,
        studentData,
        categorySummary,
        totals,
        handleDelete,
        generatePDF,
        formatType,
        schoolLogo,
        primary,
        secondary,
        appUser,
    };
};
