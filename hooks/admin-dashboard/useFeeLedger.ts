import { useState, useEffect, useMemo } from "react";
import {
    collection,
    doc,
    getDocsFromServer,
    onSnapshot,
    query,
    where,
    orderBy,
    writeBatch,
    increment,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";
import moment from "moment";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useToast } from "../../contexts/ToastContext";
import { sendNotification } from "../../src/services/notificationService";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { sortClasses } from "../../lib/classHelpers";
import { propagateArrears } from "../../utils/financeUtils";

export const useFeeLedger = (initialStudentUid?: string, initialYear?: string, initialTerm?: string) => {
    const { appUser } = useAuth();
    const { showToast } = useToast();
    const acadConfig = useAcademicConfig();

    const isSuperAdmin = [
        "admin", "proprietor", "proprietress", "manager", "headmaster",
        "headmistress", "administrator", "director", "accountant", "bursar",
        "super admin", "superadmin"
    ].includes(appUser?.adminRole?.toLowerCase().trim() || "");

    const canManageFees = isSuperAdmin ||
        appUser?.permissions?.["manage-fees"] === "full" ||
        appUser?.permissions?.["manage-fees"] === "edit";

    const [classes, setClasses] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedYear, setSelectedYear] = useState(initialYear || "");
    const [selectedTerm, setSelectedTerm] = useState(initialTerm || "Term 1");
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedStudentUid, setSelectedStudentUid] = useState(initialStudentUid || "");

    const [record, setRecord] = useState<any>(null);
    const [collectionTransactions, setCollectionTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingStudents, setFetchingStudents] = useState(false);
    const [fetchingRecord, setFetchingRecord] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showFullHistory, setShowFullHistory] = useState(false);

    // Reset history toggle when filters change to ensure term-specific focus
    useEffect(() => {
        setShowFullHistory(false);
    }, [selectedYear, selectedTerm, selectedStudentUid]);

    // Sync with global academic config if not provided
    useEffect(() => {
        if (!acadConfig.loading) {
            if (!selectedYear) setSelectedYear(initialYear || acadConfig.academicYear);
            if (!selectedTerm) setSelectedTerm(initialTerm || acadConfig.currentTerm);
        }
    }, [acadConfig, initialYear, initialTerm]);

    // Load classes
    useEffect(() => {
        const initClasses = async () => {
            try {
                const snap = await getDocsFromServer(collection(db, "classes"));
                let list = snap.docs.map((d) => ({
                    id: d.id,
                    name: (d.data() as any).name || d.id,
                }));
                list = sortClasses(list);
                setClasses(list);
                if (list.length > 0 && !selectedClassId) setSelectedClassId(list[0].id);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        initClasses();
    }, []);

    // Load students when class changes
    useEffect(() => {
        if (!selectedClassId) return;
        const loadStudents = async () => {
            setFetchingStudents(true);
            try {
                const q = query(
                    collection(db, "users"),
                    where("role", "==", "student"),
                    where("classId", "==", selectedClassId),
                    where("status", "in", ["active", "pending_activation"]),
                    orderBy("__name__"),
                );
                const snap = await getDocsFromServer(q);
                const list = snap.docs
                    .map((d) => {
                        const data = d.data() as any;
                        return {
                            uid: d.id,
                            name: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Student",
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));
                setStudents(list);
                if (!selectedStudentUid && list.length > 0) setSelectedStudentUid(list[0].uid);
            } catch (error) {
                console.error(error);
            } finally {
                setFetchingStudents(false);
            }
        };
        loadStudents();
    }, [selectedClassId]);

    // Listen to record and transactions
    useEffect(() => {
        if (!selectedStudentUid) {
            setRecord(null);
            setCollectionTransactions([]);
            return;
        }

        setFetchingRecord(true);
        const cleanYear = (selectedYear || "").replace(/\//g, "-");
        const cleanTerm = (selectedTerm || "").replace(/\s/g, "");
        const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;

        const unsubRecord = onSnapshot(doc(db, "studentFeeRecords", recordId), (snap) => {
            setRecord(snap.exists() ? snap.data() : null);
        });

        let q;
        if (showFullHistory) {
            q = query(
                collection(db, "feePayments"),
                where("studentUid", "==", selectedStudentUid)
            );
        } else {
            if (!selectedYear || !selectedTerm) {
                setCollectionTransactions([]);
                setFetchingRecord(false);
                return;
            }
            q = query(
                collection(db, "feePayments"),
                where("studentUid", "==", selectedStudentUid),
                where("academicYear", "==", selectedYear),
                where("term", "==", selectedTerm)
            );
        }

        const unsubTransactions = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setCollectionTransactions(list);
            setFetchingRecord(false);
        });

        return () => {
            unsubRecord();
            unsubTransactions();
        };
    }, [selectedStudentUid, selectedYear, selectedTerm, showFullHistory]);

    const allTransactions = useMemo(() => {
        const collectionList = collectionTransactions;
        const recordList = record?.payments || [];
        const merged = [...collectionList];
        const existingIds = new Set<string>(collectionList.map((t: any) => String(t.receiptNo || t.id)));

        recordList.forEach((p: any) => {
            const id = String(p.receiptNo || p.id);
            if (id && id !== 'undefined' && !existingIds.has(id)) {
                merged.push({ ...p, id: id });
            }
        });

        // If not in full history mode, ensure the ledger list matches the record summary
        if (!showFullHistory) {
            // STRICT FILTERING: Only transactions belonging to THIS specific term/year
            const termTransactions = merged.filter((t: any) =>
                t.academicYear === selectedYear && t.term === selectedTerm
            );

            if (record) {
                const categories = [
                    { key: 'tuition', paid: record.amountPaid || 0 },
                    { key: 'pta', paid: record.ptaPaid || 0 },
                    { key: 'maintenance', paid: record.maintenancePaid || 0 },
                    { key: 'admission', paid: record.admissionPaid || 0 },
                    { key: 'books', paid: record.booksPaid || 0 },
                    { key: 'uniform', paid: record.uniformPaid || 0 },
                    { key: 'other', paid: record.otherPaid || 0 },
                ];

                categories.forEach(cat => {
                    const currentCatSum = termTransactions.reduce((sum: number, t: any) => {
                        const type = (t.type || "tuition").toLowerCase();
                        const method = (t.method || "").toLowerCase();
                        const receivedFrom = (t.receivedFrom || "").toLowerCase();

                        const isPayment = (
                            !(method === "bulk charge" || method === "system billing" || receivedFrom === "system billing" || method.includes("bill")) &&
                            (type.endsWith("_payment") || type === "tuition" || type === "tuition_credit")
                        );

                        const category = type.replace("_payment", "").replace("_credit", "");
                        return (category === cat.key && isPayment) ? sum + (Number(t.amount) || 0) : sum;
                    }, 0);

                    if (cat.paid > currentCatSum + 0.01) {
                        termTransactions.push({
                            id: `adjustment-${cat.key}`,
                            amount: cat.paid - currentCatSum,
                            type: cat.key === 'tuition' ? 'tuition' : `${cat.key}_payment`,
                            receiptNo: `ADJ-${cat.key.toUpperCase()}`,
                            date: record.createdAt || moment().format("YYYY-MM-DD"),
                            academicYear: selectedYear,
                            term: selectedTerm,
                            receivedFrom: "Historical Record",
                            method: "Migration",
                            isAdjustment: true,
                        });
                    }
                });
            }

            return termTransactions.sort((a: any, b: any) => {
                const dateA = a.date || a.createdAt || 0;
                const dateB = b.date || b.createdAt || 0;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
        }

        return merged.sort((a: any, b: any) => {
            const dateA = a.date || a.createdAt || 0;
            const dateB = b.date || b.createdAt || 0;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }, [collectionTransactions, record, showFullHistory, selectedYear, selectedTerm]);

    const handleLogPayment = async (amountStr: string, receivedFrom: string, paymentMethod: string, paymentDate?: Date) => {
        if (!canManageFees) {
            showToast({ message: "You do not have permission to record payments.", type: "error" });
            return;
        }
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0 || !selectedStudentUid || !receivedFrom.trim()) {
            showToast({ message: "Please fill all payment details.", type: "error" });
            return;
        }

        setSaving(true);
        try {
            const cleanYear = selectedYear.replace(/\//g, "-");
            const cleanTerm = selectedTerm.replace(/\s/g, "");
            const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;
            const batch = writeBatch(db);

            const effectivePaymentDate = paymentDate || new Date();
            const dateStr = moment(effectivePaymentDate).format("YYYY-MM-DD");

            let studentName = record?.studentName;
            let classId = record?.classId || selectedClassId;
            let className = record?.className;
            let studentSnap: any = null;

            if (!studentName) {
                const s = students.find((x) => x.uid === selectedStudentUid);
                studentName = s?.name || "Student";
            }
            if (!className) {
                const c = classes.find((x) => x.id === classId);
                className = c?.name || "Class";
            }

            const tuitionArrears = record?.arrears || 0;
            const tuitionBill = record?.termBill || 0;
            const tuitionDiscount = record?.discount || 0;
            const tuitionPaid = record?.amountPaid || 0;
            const tuitionDue = tuitionArrears + tuitionBill - tuitionDiscount - tuitionPaid;

            let effectiveArrears = tuitionArrears;
            // Always fetch studentSnap to get latest balances
            const q = query(collection(db, "users"), where("__name__", "==", selectedStudentUid));
            studentSnap = await getDocsFromServer(q);
            if (!studentSnap.empty && !record) {
                effectiveArrears = (studentSnap.docs[0].data() as any).walletBalance || 0;
            }

            let remainingAmount = amount;
            let tuitionContribution = 0;
            const currentTuitionDue = record ? tuitionDue : effectiveArrears;

            const userData = (studentSnap && !studentSnap.empty) ? (studentSnap.docs[0].data() as any) : {};
            const ptaBalance = record?.ptaBalance !== undefined ? record.ptaBalance : (userData.ptaBalance || 0);
            const maintenanceBalance = record?.maintenanceBalance !== undefined ? record.maintenanceBalance : (userData.maintenanceBalance || 0);
            const admissionBalance = record?.admissionBalance !== undefined ? record.admissionBalance : (userData.admissionBalance || 0);
            const booksBalance = record?.booksBalance !== undefined ? record.booksBalance : (userData.booksBalance || 0);
            const uniformBalance = record?.uniformBalance !== undefined ? record.uniformBalance : (userData.uniformBalance || 0);
            const otherBalance = record?.otherBalance !== undefined ? record.otherBalance : (userData.otherBalance || 0);

            if (remainingAmount > 0) {
                tuitionContribution = Math.min(remainingAmount, Math.max(0, currentTuitionDue));
                remainingAmount -= tuitionContribution;
            }

            if (tuitionContribution > 0) {
                const serial = `RC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const entry = {
                    amount: tuitionContribution,
                    method: paymentMethod,
                    receivedFrom: receivedFrom.trim(),
                    updatedBy: appUser?.adminRole || "Admin",
                    adminUid: appUser?.uid || "unknown",
                    createdAt: new Date().toISOString(),
                    receiptNo: serial,
                    date: dateStr,
                    studentUid: selectedStudentUid,
                    studentName: studentName,
                    classId: classId,
                    className: className,
                    academicYear: selectedYear,
                    term: selectedTerm,
                    type: "tuition",
                };

                if (!record) {
                    batch.set(doc(db, "studentFeeRecords", recordId), {
                        studentUid: selectedStudentUid,
                        studentName: studentName,
                        classId: classId,
                        className: className,
                        academicYear: selectedYear,
                        term: selectedTerm,
                        termBill: 0,
                        arrears: effectiveArrears,
                        amountPaid: tuitionContribution,
                        ptaBalance: ptaBalance,
                        maintenanceBalance: maintenanceBalance,
                        admissionBalance: admissionBalance,
                        booksBalance: booksBalance,
                        uniformBalance: uniformBalance,
                        otherBalance: otherBalance,
                        balance: (effectiveArrears - tuitionContribution) + ptaBalance + maintenanceBalance + admissionBalance + booksBalance + uniformBalance + otherBalance,
                        totalPayable: effectiveArrears + ptaBalance + maintenanceBalance + admissionBalance + booksBalance + uniformBalance + otherBalance,
                        payments: [entry],
                        editCount: 0,
                        createdAt: serverTimestamp(),
                        lastUpdated: serverTimestamp(),
                    }, { merge: true });
                } else {
                    batch.update(doc(db, "studentFeeRecords", recordId), {
                        amountPaid: increment(tuitionContribution),
                        balance: increment(-tuitionContribution),
                        payments: arrayUnion(entry),
                        lastUpdated: serverTimestamp(),
                    });
                }
                batch.set(doc(db, "feePayments", serial), entry);
            }

            if (remainingAmount > 0) {
                const isolatedTargets = [
                    { key: 'pta', balance: ptaBalance, field: 'ptaBalance', paidField: 'ptaPaid' },
                    { key: 'maintenance', balance: maintenanceBalance, field: 'maintenanceBalance', paidField: 'maintenancePaid' },
                    { key: 'admission', balance: admissionBalance, field: 'admissionBalance', paidField: 'admissionPaid' },
                    { key: 'books', balance: booksBalance, field: 'booksBalance', paidField: 'booksPaid' },
                    { key: 'uniform', balance: uniformBalance, field: 'uniformBalance', paidField: 'uniformPaid' },
                    { key: 'other', balance: otherBalance, field: 'otherBalance', paidField: 'otherPaid' },
                ];

                for (const target of isolatedTargets) {
                    if (remainingAmount <= 0) break;
                    if (target.balance > 0) {
                        const allocation = Math.min(remainingAmount, target.balance);
                        const subSerial = `RC-${target.key.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                        const subEntry = {
                            amount: allocation,
                            method: paymentMethod,
                            receivedFrom: receivedFrom.trim(),
                            updatedBy: appUser?.adminRole || "Admin",
                            adminUid: appUser?.uid || "unknown",
                            createdAt: new Date().toISOString(),
                            receiptNo: subSerial,
                            date: dateStr,
                            studentUid: selectedStudentUid,
                            studentName: studentName,
                            classId: classId,
                            className: className,
                            academicYear: selectedYear,
                            term: selectedTerm,
                            type: `${target.key}_payment`,
                        };
                        batch.set(doc(db, "feePayments", subSerial), subEntry);
                        batch.update(doc(db, "studentFeeRecords", recordId), {
                            [target.field]: increment(-allocation),
                            [target.paidField]: increment(allocation),
                            balance: increment(-allocation),
                            payments: arrayUnion(subEntry),
                            lastUpdated: serverTimestamp(),
                        });
                        batch.update(doc(db, "users", selectedStudentUid), { [target.field]: increment(-allocation) });
                        remainingAmount -= allocation;
                    }
                }

                if (remainingAmount > 0) {
                  // Additional waterfall for other categories
                  const qP = query(
                    collection(db, "feePayments"),
                    where("studentUid", "==", selectedStudentUid),
                    where("academicYear", "==", selectedYear),
                    where("term", "==", selectedTerm),
                  );
                  const snapP = await getDocsFromServer(qP);
                  const payments = snapP.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
                  const categoryMap: Record<string, { billed: number; paid: number }> = {};
                  payments.forEach((p) => {
                    const type = p.type || "other";
                    const category = type.replace("_payment", "");
                    const isPayment = type.endsWith("_payment");
                    if (!categoryMap[category]) categoryMap[category] = { billed: 0, paid: 0 };
                    if (isPayment) categoryMap[category].paid += p.amount;
                    else if (!['tuition', 'pta', 'maintenance', 'admission', 'books', 'uniform', 'other'].includes(type)) categoryMap[category].billed += p.amount;
                  });
                  const categories = Object.keys(categoryMap).filter((cat) => !['tuition', 'pta', 'maintenance', 'admission', 'books', 'uniform', 'other'].includes(cat));
                  for (const cat of categories) {
                    if (remainingAmount <= 0) break;
                    const due = categoryMap[cat].billed - categoryMap[cat].paid;
                    if (due > 0) {
                        const allocation = Math.min(remainingAmount, due);
                        const subSerial = `RC-${cat.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                        const subEntry = {
                            amount: allocation,
                            method: paymentMethod,
                            receivedFrom: receivedFrom.trim(),
                            updatedBy: appUser?.adminRole || "Admin",
                            adminUid: appUser?.uid || "unknown",
                            createdAt: new Date().toISOString(),
                            receiptNo: subSerial,
                            date: dateStr,
                            studentUid: selectedStudentUid,
                            studentName: studentName,
                            classId: classId,
                            className: className,
                            academicYear: selectedYear,
                            term: selectedTerm,
                            type: `${cat}_payment`,
                        };
                        batch.set(doc(db, "feePayments", subSerial), subEntry);
                        batch.update(doc(db, "studentFeeRecords", recordId), {
                            amountPaid: increment(allocation),
                            balance: increment(-allocation),
                            payments: arrayUnion(subEntry),
                            lastUpdated: serverTimestamp(),
                        });
                        remainingAmount -= allocation;
                    }
                  }
                }

                if (remainingAmount > 0) {
                    const creditSerial = `RC-CR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                    const creditEntry = {
                        amount: remainingAmount,
                        method: paymentMethod,
                        receivedFrom: receivedFrom.trim(),
                        updatedBy: appUser?.adminRole || "Admin",
                        adminUid: appUser?.uid || "unknown",
                        createdAt: new Date().toISOString(),
                        receiptNo: creditSerial,
                        date: dateStr,
                        studentUid: selectedStudentUid,
                        studentName: studentName,
                        classId: classId,
                        className: className,
                        academicYear: selectedYear,
                        term: selectedTerm,
                        type: "tuition_credit",
                    };
                    batch.update(doc(db, "studentFeeRecords", recordId), {
                        amountPaid: increment(remainingAmount),
                        balance: increment(-remainingAmount),
                        payments: arrayUnion(creditEntry),
                        lastUpdated: serverTimestamp(),
                    });
                    batch.set(doc(db, "feePayments", creditSerial), creditEntry);
                    remainingAmount = 0;
                }
            }

            batch.update(doc(db, "users", selectedStudentUid), { walletBalance: increment(-amount) });
            await batch.commit();

            // Propagate balance change to future terms
            propagateArrears(selectedStudentUid, selectedYear, selectedTerm, -amount, 'payment');

            try {
                await sendNotification({
                    recipientId: selectedStudentUid,
                    senderId: appUser?.uid || "admin",
                    senderName: "School Finance",
                    title: "Fee Payment Received - Thank You!",
                    body: `Thank you! We've received a payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} for ${studentName}. We appreciate your promptness!`,
                    type: "payment",
                    data: { studentUid: selectedStudentUid, amount, academicYear: selectedYear, term: selectedTerm }
                });
            } catch (notifErr) { console.error("Failed to send payment notification:", notifErr); }

            showToast({ message: "Payment recorded and allocated successfully.", type: "success" });
            return true;
        } catch (error) {
            console.error(error);
            showToast({ message: "Failed to record payment.", type: "error" });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleRevertPayment = async (payment: any) => {
        if (!canManageFees) {
            showToast({ message: "You do not have permission to revert transactions.", type: "error" });
            return;
        }
        setDeleting(true);
        try {
            const cleanYear = selectedYear.replace(/\//g, "-");
            const cleanTerm = selectedTerm.replace(/\s/g, "");
            const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;
            const batch = writeBatch(db);
            const amount = Number(payment.amount) || 0;
            const isPayment = (payment.type || "tuition").toLowerCase().endsWith("_payment") || (payment.type || "tuition").toLowerCase() === "tuition";

            if (isPayment) {
                batch.update(doc(db, "studentFeeRecords", recordId), { amountPaid: increment(-amount), balance: increment(amount) });
                const type = (payment.type || "").toLowerCase();
                if (type === 'pta_payment' || type === 'pta') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { ptaBalance: increment(amount), ptaPaid: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { ptaBalance: increment(amount) });
                } else if (type === 'maintenance_payment' || type === 'maintenance') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { maintenanceBalance: increment(amount), maintenancePaid: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { maintenanceBalance: increment(amount) });
                } else if (type === 'admission_payment' || type === 'admission') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { admissionBalance: increment(amount), admissionPaid: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { admissionBalance: increment(amount) });
                } else if (type === 'books_payment' || type === 'books') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { booksBalance: increment(amount), booksPaid: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { booksBalance: increment(amount) });
                } else if (type === 'uniform_payment' || type === 'uniform') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { uniformBalance: increment(amount), uniformPaid: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { uniformBalance: increment(amount) });
                } else if (type === 'other_payment' || type === 'other') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { otherBalance: increment(amount), otherPaid: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { otherBalance: increment(amount) });
                }
                batch.update(doc(db, "users", selectedStudentUid), { walletBalance: increment(amount) });
            } else {
                batch.update(doc(db, "studentFeeRecords", recordId), { balance: increment(-amount) });
                const type = (payment.type || "").toLowerCase();
                if (type === 'pta') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { ptaBalance: increment(-amount), ptaBill: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { ptaBalance: increment(-amount), ptaBill: increment(-amount) });
                } else if (type === 'maintenance') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { maintenanceBalance: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { maintenanceBalance: increment(-amount) });
                } else if (type === 'admission') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { admissionBalance: increment(-amount), admissionBill: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { admissionBalance: increment(-amount), admissionFeeBill: increment(-amount) });
                } else if (type === 'books') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { booksBalance: increment(-amount), booksBill: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { booksBalance: increment(-amount), booksBill: increment(-amount) });
                } else if (type === 'uniform') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { uniformBalance: increment(-amount), uniformBill: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { uniformBalance: increment(-amount), uniformBill: increment(-amount) });
                } else if (type === 'other') {
                    batch.update(doc(db, "studentFeeRecords", recordId), { otherBalance: increment(-amount), otherBill: increment(-amount) });
                    batch.update(doc(db, "users", selectedStudentUid), { otherBalance: increment(-amount), otherBill: increment(-amount) });
                }
                batch.update(doc(db, "users", selectedStudentUid), { walletBalance: increment(-amount) });
            }

            batch.update(doc(db, "studentFeeRecords", recordId), { payments: arrayRemove(payment) });
            if (payment.receiptNo) batch.delete(doc(db, "feePayments", payment.receiptNo));
            await batch.commit();

            // Propagate balance reversal to future terms
            const propagationAmount = isPayment ? amount : -amount;
            const type = (payment.type || "tuition").toLowerCase();
            const category = type.replace("_payment", "").replace("_credit", "");
            const pType = isPayment ? 'payment' : 'bill';
            propagateArrears(selectedStudentUid, selectedYear, selectedTerm, propagationAmount, pType, category === 'tuition' ? undefined : category);

            showToast({ message: "Transaction deleted and balance reverted.", type: "success" });
        } catch (error) {
            console.error(error);
            showToast({ message: "Failed to delete transaction.", type: "error" });
        } finally {
            setDeleting(false);
        }
    };

    const rawSummary = useMemo(() => {
        const summary: Record<string, { billed: number; paid: number }> = {
            tuition: { billed: Math.max(0, (record?.termBill || 0) - (record?.discount || 0)), paid: 0 },
        };

        if (record?.arrears > 0) {
            summary["arrears"] = { billed: record.arrears, paid: 0 };
        }

        allTransactions.forEach((t: any) => {
            const type = (t.type || "tuition").toLowerCase();
            const method = (t.method || "").toLowerCase();
            const receivedFrom = (t.receivedFrom || "").toLowerCase();

            const isPayment = (
                !(method === "bulk charge" || method === "system billing" || receivedFrom === "system billing" || method.includes("bill")) &&
                (type.endsWith("_payment") || type === "tuition" || type === "tuition_credit")
            );

            let category = type.replace("_payment", "").replace("_credit", "");
            if (type === "other") category = (t.otherCategory || "other").toLowerCase();

            if (!summary[category]) summary[category] = { billed: 0, paid: 0 };

            if (isPayment) {
                if (category === "tuition" && summary["arrears"]) {
                    let amt = t.amount || 0;
                    const toArrears = Math.min(amt, summary["arrears"].billed - summary["arrears"].paid);
                    summary["arrears"].paid += toArrears;
                    summary["tuition"].paid += (amt - toArrears);
                } else {
                    summary[category].paid += t.amount || 0;
                }
            } else {
                // If it's not a payment, it's a bill/charge
                summary[category].billed += t.amount || 0;
            }
        });

        if (record) {
            const isolated = [
                { key: 'pta', bill: (record.ptaBill || 0), paid: record.ptaPaid },
                { key: 'maintenance', bill: (record.maintenanceBill || 0), paid: record.maintenancePaid },
                { key: 'admission', bill: (record.admissionBill || 0), paid: record.admissionPaid },
                { key: 'books', bill: (record.booksBill || 0), paid: record.booksPaid },
                { key: 'uniform', bill: (record.uniformBill || 0), paid: record.uniformPaid },
            ];
            isolated.forEach(cat => {
                if (!summary[cat.key]) summary[cat.key] = { billed: 0, paid: 0 };
                summary[cat.key].billed = Math.max(summary[cat.key].billed, cat.bill || 0);
                summary[cat.key].paid = Math.max(summary[cat.key].paid, cat.paid || 0);
            });

            // Special handling for tuition/arrears match with record.amountPaid
            const totalTuitionPaidInSummary = summary.tuition.paid + (summary.arrears?.paid || 0);
            if (record.amountPaid > totalTuitionPaidInSummary) {
                let diff = record.amountPaid - totalTuitionPaidInSummary;
                if (summary.arrears) {
                    const extraToArrears = Math.min(diff, summary.arrears.billed - summary.arrears.paid);
                    summary.arrears.paid += extraToArrears;
                    diff -= extraToArrears;
                }
                summary.tuition.paid += diff;
            }

            const specificOtherBilled = Object.entries(summary)
                .filter(([k]) => !['tuition', 'pta', 'maintenance', 'admission', 'books', 'uniform', 'other', 'arrears'].includes(k))
                .reduce((sum, [_, v]) => sum + v.billed, 0);
            const unnamedOtherBill = Math.max(0, (record.otherBill || 0) - specificOtherBilled);
            if (unnamedOtherBill > 0 || record.otherPaid > 0) {
                if (!summary['other']) summary['other'] = { billed: 0, paid: 0 };
                summary['other'].billed = Math.max(summary['other'].billed, unnamedOtherBill);
                summary['other'].paid = Math.max(summary['other'].paid, record.otherPaid || 0);
            }
        }
        return summary;
    }, [allTransactions, record]);

    const categorySummary = useMemo(() => {
        const filtered: Record<string, { billed: number; paid: number }> = {};
        Object.entries(rawSummary).forEach(([cat, vals]) => {
            if (vals.billed > 0 || vals.paid > 0) filtered[cat] = vals;
        });
        return filtered;
    }, [rawSummary]);

    const totals = useMemo(() => {
        const billed = Object.values(categorySummary).reduce((acc, curr: any) => acc + curr.billed, 0);
        const paid = Object.values(categorySummary).reduce((acc, curr: any) => acc + curr.paid, 0);
        return { totalBilled: billed, totalPaid: paid, totalBalance: billed - paid };
    }, [categorySummary]);

    return {
        classes, students, selectedYear, setSelectedYear, selectedTerm, setSelectedTerm,
        selectedClassId, setSelectedClassId, selectedStudentUid, setSelectedStudentUid,
        record, allTransactions, loading: loading || acadConfig.loading, fetchingStudents,
        fetchingRecord, saving, deleting, handleLogPayment, handleRevertPayment,
        categorySummary, totals, canManageFees, showFullHistory, setShowFullHistory, availableYears: useMemo(() => {
            const start = 2024;
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let y = start; y <= currentYear + 3; y++) years.push(`${y}/${y + 1}`);
            if (acadConfig.academicYear && !years.includes(acadConfig.academicYear)) years.push(acadConfig.academicYear);
            return Array.from(new Set(years)).sort().reverse();
        }, [acadConfig.academicYear])
    };
};
