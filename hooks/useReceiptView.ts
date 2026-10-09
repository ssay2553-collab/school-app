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
import { normalizeCategory, isPaymentEntry, calculateFeeBreakdown, getCategoryDisplayName } from './admin-dashboard/finance-cleanup/utils';

interface UseReceiptViewProps {
    type: string | string[];
    studentId: string | string[];
    year: string | string[];
    term: string | string[];
    paymentId: string | string[];
}

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
                    const recordData = rDoc.exists() ? rDoc.data() : null;
                    if (recordData) setRecord(recordData);

                    // Fetch transactions for this period from feePayments collection
                    const q = query(
                        collection(db, "feePayments"),
                        where("studentUid", "==", studentId),
                        where("academicYear", "==", year),
                        where("term", "==", term),
                    );
                    const tSnap = await getDocs(q);
                    const collectionList = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

                    // Merge embedded payments from record.payments if not already present
                    const recordList = recordData?.payments || [];
                    const merged = [...collectionList];
                    const existingIds = new Set<string>(collectionList.map((t: any) => String(t.receiptNo || t.id)));

                    recordList.forEach((p: any) => {
                        const id = String(p.receiptNo || p.id);
                        if (id && id !== 'undefined' && !existingIds.has(id)) {
                            merged.push({ ...p, id: id });
                        }
                    });

                    // Strict filtering for this term/year
                    const termTransactions = merged.filter((t: any) =>
                        t.academicYear === year && t.term === term
                    );

                    const hasRealCollectionPayments = collectionList.some((t: any) =>
                        t.academicYear === year && t.term === term && isPaymentEntry(t)
                    );

                    if (recordData && !hasRealCollectionPayments) {
                        const categories = [
                            { key: 'tuition', paid: recordData.amountPaid || 0 },
                            { key: 'pta', paid: recordData.ptaPaid || 0 },
                            { key: 'maintenance', paid: recordData.maintenancePaid || 0 },
                            { key: 'admission', paid: recordData.admissionPaid || 0 },
                            { key: 'books', paid: recordData.booksPaid || 0 },
                            { key: 'uniform', paid: recordData.uniformPaid || 0 },
                        ];

                        categories.forEach(cat => {
                            const currentCatSum = termTransactions.reduce((sum: number, t: any) => {
                                const isPayment = isPaymentEntry(t);
                                const category = normalizeCategory(t);
                                return (category === cat.key && isPayment) ? sum + (Number(t.amount) || 0) : sum;
                            }, 0);

                            if (cat.paid > currentCatSum + 0.01) {
                                termTransactions.push({
                                    id: `adjustment-${cat.key}`,
                                    amount: cat.paid - currentCatSum,
                                    type: cat.key === 'tuition' ? 'tuition' : `${cat.key}_payment`,
                                    receiptNo: `ADJ-${cat.key.toUpperCase()}`,
                                    date: recordData.createdAt || moment().format("YYYY-MM-DD"),
                                    academicYear: year,
                                    term: term,
                                    receivedFrom: "Historical Record",
                                    method: "Migration",
                                    isAdjustment: true,
                                });
                            }
                        });
                    }

                    setAllTransactions(termTransactions);
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
        return getCategoryDisplayName(rawType, otherCategory);
    };

    const { categorySummary, totals } = useMemo(() => {
        if (type !== "bill") {
            return {
                categorySummary: [],
                totals: { billed: 0, paid: 0, balance: 0 },
            };
        }
        return calculateFeeBreakdown(record, allTransactions);
    }, [record, allTransactions, type]);

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
