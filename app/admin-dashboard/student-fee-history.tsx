import { Picker } from "@react-native-picker/picker";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDocsFromServer,
    increment,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { sortClasses } from "../../lib/classHelpers";
import { useAuth } from "../../contexts/AuthContext";
import { sendNotification } from "../../src/services/notificationService";
import { useToast } from "../../contexts/ToastContext";

const { width } = Dimensions.get("window");

export default function StudentFeeHistoryScreen() {
  const { appUser } = useAuth();
  const params = useLocalSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const acadConfig = useAcademicConfig();

  const isSuperAdmin = appUser?.role === "admin" || [
    "admin",
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
  ].includes(appUser?.adminRole?.toLowerCase().trim() || "");

  const canManageFees = isSuperAdmin ||
    appUser?.permissions?.["manage-fees"] === "full" ||
    appUser?.permissions?.["manage-fees"] === "edit";

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
  const [saving, setSaving] = useState(false);

  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "school"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const availableYears = useMemo(() => {
    const start = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = start; y <= currentYear + 3; y++) {
      years.push(`${y}/${y + 1}`);
    }
    if (acadConfig.academicYear && !years.includes(acadConfig.academicYear)) {
      years.push(acadConfig.academicYear);
    }
    return Array.from(new Set(years)).sort().reverse();
  }, [acadConfig.academicYear]);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentUid, setSelectedStudentUid] = useState(
    (params.studentId as string) || "",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const [record, setRecord] = useState<any>(null);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [fetchingRecord, setFetchingRecord] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(
        (params.academicYear as string) || acadConfig.academicYear,
      );
      setSelectedTerm((params.term as string) || acadConfig.currentTerm);
    }
  }, [acadConfig, params.academicYear, params.term]);

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
        if (list.length > 0) setSelectedClassId(list[0].id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    initClasses();
  }, []);

  const handleLogPayment = async () => {
    if (!canManageFees) {
      showToast({
        message: "You do not have permission to record payments.",
        type: "error",
      });
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudentUid || !receivedFrom.trim()) {
      showToast({ message: "Please fill all payment details.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const cleanYear = selectedYear.replace(/\//g, "-");
      const cleanTerm = selectedTerm.replace(/\s+/g, "");
      const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;
      const batch = writeBatch(db);

      let studentName = record?.studentName;
      let classId = record?.classId || selectedClassId;
      let className = record?.className;

      if (!studentName) {
        const s = students.find((x) => x.uid === selectedStudentUid);
        studentName = s?.name || "Student";
      }
      if (!className) {
        const c = classes.find((x) => x.id === classId);
        className = c?.name || "Class";
      }

      // Calculate Tuition balance
      const tuitionArrears = record?.arrears || 0;
      const tuitionBill = record?.termBill || 0;
      const tuitionDiscount = record?.discount || 0;
      const tuitionPaid = record?.amountPaid || 0;
      const tuitionDue =
        tuitionArrears + tuitionBill - tuitionDiscount - tuitionPaid;

      let effectiveArrears = tuitionArrears;
      if (!record) {
        // Fetch current walletBalance as arrears if no record exists for this term yet
        const q = query(
          collection(db, "users"),
          where("__name__", "==", selectedStudentUid),
        );
        const studentSnap = await getDocsFromServer(q);
        if (!studentSnap.empty) {
          effectiveArrears = (studentSnap.docs[0].data() as any).walletBalance || 0;
        }
      }

      let remainingAmount = amount;
      let tuitionContribution = 0;

      const currentTuitionDue = record ? tuitionDue : effectiveArrears;

      // New: isolated balances
      const ptaBalance = record?.ptaBalance || 0;
      const maintenanceBalance = record?.maintenanceBalance || 0;
      const admissionBalance = record?.admissionBalance || 0;
      const booksBalance = record?.booksBalance || 0;
      const uniformBalance = record?.uniformBalance || 0;
      const otherBalance = record?.otherBalance || 0;

      if (remainingAmount > 0) {
        tuitionContribution = Math.min(
          remainingAmount,
          Math.max(0, currentTuitionDue),
        );
        remainingAmount -= tuitionContribution;
      }

      // 1. Record Tuition Payment (if any)
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
          date: moment().format("YYYY-MM-DD"),
          studentUid: selectedStudentUid,
          studentName: studentName,
          classId: classId,
          className: className,
          academicYear: selectedYear,
          term: selectedTerm,
          type: "tuition",
        };

        if (!record) {
          batch.set(
            doc(db, "studentFeeRecords", recordId),
            {
              studentUid: selectedStudentUid,
              studentName: studentName,
              classId: classId,
              className: className,
              academicYear: selectedYear,
              term: selectedTerm,
              termBill: 0,
              arrears: effectiveArrears,
              amountPaid: tuitionContribution,
              balance: (effectiveArrears - tuitionContribution) + ptaBalance + maintenanceBalance + admissionBalance + booksBalance + uniformBalance,
              totalPayable: effectiveArrears + ptaBalance + maintenanceBalance + admissionBalance + booksBalance + uniformBalance,
              payments: [entry],
              editCount: 0,
              createdAt: serverTimestamp(),
              lastUpdated: serverTimestamp(),
            },
            { merge: true },
          );
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

      // 2. Waterfall Allocation for Overpayment
      if (remainingAmount > 0) {
        // Targeted allocations for isolated balances first
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
              date: moment().format("YYYY-MM-DD"),
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

            // Update user document for specific balance
            batch.update(doc(db, "users", selectedStudentUid), {
              [target.field]: increment(-allocation),
            });

            remainingAmount -= allocation;
          }
        }

        if (remainingAmount > 0) {
          const q = query(
            collection(db, "feePayments"),
            where("studentUid", "==", selectedStudentUid),
            where("academicYear", "==", selectedYear),
            where("term", "==", selectedTerm),
          );
          const snap = await getDocsFromServer(q);
          const payments = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

          const categoryMap: Record<string, { billed: number; paid: number }> = {};
          payments.forEach((p) => {
            const type = p.type || "other";
            const category = type.replace("_payment", "");
            const isPayment = type.endsWith("_payment");

            if (!categoryMap[category]) categoryMap[category] = { billed: 0, paid: 0 };
            if (isPayment) categoryMap[category].paid += p.amount;
            else if (!['tuition', 'pta', 'maintenance', 'admission'].includes(type)) categoryMap[category].billed += p.amount;
          });

          const categories = Object.keys(categoryMap).filter((cat) => !['tuition', 'pta', 'maintenance', 'admission'].includes(cat));

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
                date: moment().format("YYYY-MM-DD"),
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

        // 3. If still remaining, add to tuition as credit
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
            date: moment().format("YYYY-MM-DD"),
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

      batch.update(doc(db, "users", selectedStudentUid), {
        walletBalance: increment(-amount),
      });

      await batch.commit();

      // Send client-side notification to parent
      try {
        await sendNotification({
          recipientId: selectedStudentUid,
          senderId: appUser?.uid || "admin",
          senderName: "School Finance",
          title: "Fee Payment Received",
          body: `A payment of ${SCHOOL_CONFIG.currencySymbol}${amount.toLocaleString()} has been recorded for ${studentName}.`,
          type: "payment",
          data: {
            studentUid: selectedStudentUid,
            amount,
            academicYear: selectedYear,
            term: selectedTerm
          }
        });
      } catch (notifErr) {
        console.error("Failed to send payment notification:", notifErr);
      }

      setPaymentAmount("");
      setReceivedFrom("");
      setPaymentModalVisible(false);
      showToast({
        message: "Payment recorded and allocated successfully.",
        type: "success",
      });
    } catch (error) {
      console.error(error);
      showToast({ message: "Failed to record payment.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

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
              name:
                `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
                "Student",
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setStudents(list);
        if (!selectedStudentUid && list.length > 0)
          setSelectedStudentUid(list[0].uid);
      } catch (error) {
        console.error(error);
      } finally {
        setFetchingStudents(false);
      }
    };
    loadStudents();
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedStudentUid || !selectedYear || !selectedTerm) {
      setRecord(null);
      setAllTransactions([]);
      return;
    }
    setFetchingRecord(true);
    const cleanYear = selectedYear.replace(/\//g, "-");
    const cleanTerm = selectedTerm.replace(/\s/g, "");
    const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;

    // Listen to the main fee record
    const unsubRecord = onSnapshot(
      doc(db, "studentFeeRecords", recordId),
      (snap) => {
        setRecord(snap.exists() ? snap.data() : null);
      },
    );

    // Listen to all feePayments for this student across categories for this period
    const q = query(
      collection(db, "feePayments"),
      where("studentUid", "==", selectedStudentUid),
      where("academicYear", "==", selectedYear),
      where("term", "==", selectedTerm)
    );

    const unsubTransactions = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllTransactions(list.sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setFetchingRecord(false);
    });

    return () => {
      unsubRecord();
      unsubTransactions();
    };
  }, [selectedStudentUid, selectedYear, selectedTerm]);

  const filteredPayments = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return allTransactions.filter(
      (p: any) =>
        p.receiptNo?.toLowerCase().includes(lowerQuery) ||
        p.receivedFrom?.toLowerCase().includes(lowerQuery) ||
        p.amount.toString().includes(lowerQuery) ||
        p.type?.toLowerCase().includes(lowerQuery),
    );
  }, [allTransactions, searchQuery]);

  const categorySummary = useMemo(() => {
    const summary: Record<string, { billed: number; paid: number }> = {
      tuition: { billed: (record?.termBill || 0) + (record?.arrears || 0) - (record?.discount || 0), paid: 0 },
      pta: { billed: 0, paid: 0 },
      maintenance: { billed: 0, paid: 0 },
      admission: { billed: 0, paid: 0 },
      books: { billed: 0, paid: 0 },
      uniform: { billed: 0, paid: 0 },
      other: { billed: 0, paid: 0 },
    };

    // Fill initial values from record for isolated fields
    if (record) {
      summary.pta.billed = (record.ptaBill || 0);
      summary.pta.paid = (record.ptaPaid || 0);
      summary.maintenance.billed = (record.maintenanceBill || record.maintenanceBalance + (record.maintenancePaid || 0) || 0);
      summary.maintenance.paid = (record.maintenancePaid || 0);
      summary.admission.billed = (record.admissionBill || record.admissionBalance + (record.admissionPaid || 0) || 0);
      summary.admission.paid = (record.admissionPaid || 0);
      summary.books.billed = (record.booksBill || record.booksBalance + (record.booksPaid || 0) || 0);
      summary.books.paid = (record.booksPaid || 0);
      summary.uniform.billed = (record.uniformBill || record.uniformBalance + (record.uniformPaid || 0) || 0);
      summary.uniform.paid = (record.uniformPaid || 0);
      summary.other.billed = (record.otherBill || record.otherBalance + (record.otherPaid || 0) || 0);
      summary.other.paid = (record.otherPaid || 0);
    }

    allTransactions.forEach((t: any) => {
      const type = t.type?.toLowerCase() || "tuition";
      const isPayment = type.endsWith("_payment") || type === "tuition";
      const category = type.replace("_payment", "");

      if (!summary[category]) summary[category] = { billed: 0, paid: 0 };

      if (isPayment) {
        summary[category].paid += t.amount || 0;
      } else {
        // It's a bill (charge)
        summary[category].billed += t.amount || 0;
      }
    });

    // Filter out categories with 0 billed AND 0 paid
    return Object.fromEntries(
      Object.entries(summary).filter(([_, vals]) => vals.billed > 0 || vals.paid > 0)
    );
  }, [allTransactions, record]);

  const handleDeletePayment = (payment: any) => {
    if (!canManageFees) {
      showToast({
        message: "You do not have permission to revert transactions.",
        type: "error",
      });
      return;
    }

    const performDelete = async () => {
      setDeleting(true);
      try {
        const cleanYear = selectedYear.replace(/\//g, "-");
        const cleanTerm = selectedTerm.replace(/\s/g, "");
        const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;

        const batch = writeBatch(db);
        const amount = Number(payment.amount) || 0;
        const isPayment = (payment.type || "tuition").toLowerCase().endsWith("_payment") || (payment.type || "tuition").toLowerCase() === "tuition";

        if (isPayment) {
          // Reverting a payment INCREASES the debt (walletBalance)
          batch.update(doc(db, "studentFeeRecords", recordId), {
            amountPaid: increment(-amount),
            balance: increment(amount),
          });

          // Handle isolated category reversions
          const type = (payment.type || "").toLowerCase();
          if (type === 'pta_payment') {
            batch.update(doc(db, "studentFeeRecords", recordId), { ptaBalance: increment(amount), ptaPaid: increment(-amount) });
            batch.update(doc(db, "users", selectedStudentUid), { ptaBalance: increment(amount) });
          } else if (type === 'maintenance_payment') {
            batch.update(doc(db, "studentFeeRecords", recordId), { maintenanceBalance: increment(amount), maintenancePaid: increment(-amount) });
            batch.update(doc(db, "users", selectedStudentUid), { maintenanceBalance: increment(amount) });
          } else if (type === 'admission_payment') {
            batch.update(doc(db, "studentFeeRecords", recordId), { admissionBalance: increment(amount), admissionPaid: increment(-amount) });
            batch.update(doc(db, "users", selectedStudentUid), { admissionBalance: increment(amount) });
          } else if (type === 'books_payment') {
            batch.update(doc(db, "studentFeeRecords", recordId), { booksBalance: increment(amount), booksPaid: increment(-amount) });
            batch.update(doc(db, "users", selectedStudentUid), { booksBalance: increment(amount) });
          } else if (type === 'uniform_payment') {
            batch.update(doc(db, "studentFeeRecords", recordId), { uniformBalance: increment(amount), uniformPaid: increment(-amount) });
            batch.update(doc(db, "users", selectedStudentUid), { uniformBalance: increment(amount) });
          } else if (type === 'other_payment') {
            batch.update(doc(db, "studentFeeRecords", recordId), { otherBalance: increment(amount), otherPaid: increment(-amount) });
            batch.update(doc(db, "users", selectedStudentUid), { otherBalance: increment(amount) });
          }

          batch.update(doc(db, "users", selectedStudentUid), {
            walletBalance: increment(amount),
          });
        } else {
          // Reverting a bill (charge) DECREASES the debt (walletBalance)
          batch.update(doc(db, "studentFeeRecords", recordId), {
            balance: increment(-amount),
          });

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

          batch.update(doc(db, "users", selectedStudentUid), {
            walletBalance: increment(-amount),
          });
        }

        // If it was explicitly in the record's payments array, remove it
        batch.update(doc(db, "studentFeeRecords", recordId), {
          payments: arrayRemove(payment),
        });

        // Also delete from feePayments collection if serial exists
        if (payment.receiptNo) {
          batch.delete(doc(db, "feePayments", payment.receiptNo));
        }

        await batch.commit();
        showToast({
          message: "Transaction deleted and balance reverted.",
          type: "success",
        });
      } catch (error) {
        console.error(error);
        showToast({
          message: "Failed to delete transaction.",
          type: "error",
        });
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this transaction? The student's balance will be adjusted automatically.",
      );
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Revert Payment",
        "Are you sure you want to delete this transaction? The student's balance will be adjusted automatically.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ],
      );
    }
  };

  const generatePDF = async () => {
    if (!record) return;
    try {
      // Attempt to embed the school badge (local asset) as base64 so it appears in the PDF
      let logoDataUrl = "";
      try {
        const asset = Asset.fromModule(schoolLogo as any);
        await asset.downloadAsync();
        const localUri = asset.localUri || asset.uri;
        if (localUri) {
          const ext = localUri.split(".").pop()?.toLowerCase() || "png";
          const mime =
            ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const b64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: "base64",
          });
          logoDataUrl = `data:${mime};base64,${b64}`;
        }
      } catch (e) {
        console.warn("Failed to embed logo for PDF:", e);
      }

      const logoImgHtml = logoDataUrl
        ? `<img src="${logoDataUrl}" style="width:80px;height:80px;object-fit:contain;margin-bottom:10px"/>`
        : "";

      const totalBalanceAcrossCategories = Object.values(categorySummary).reduce((acc, curr: any) => acc + (curr.billed - curr.paid), 0);

      const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica'; padding: 20px; color: #1E293B; background: #fff; }
            .receipt-paper { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative; }
            .letterhead { display:flex; flex-direction: column; align-items:center; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .school-name { font-size: 22px; font-weight: bold; text-transform: uppercase; margin: 0; }
            .contact { font-size: 10px; margin: 2px 0; }
            .title { text-align: center; font-size: 16px; font-weight: 900; text-decoration: underline; margin: 15px 0; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
            .label { font-weight: bold; }

            .summary-box { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
            .summary-item { flex: 1; min-width: 140px; background: #fff; padding: 10px; border: 1px solid #edf2f7; border-radius: 6px; }
            .summary-label { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
            .summary-row { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 2px; }
            .summary-val { font-weight: 700; color: #1e293b; }

            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 8px; font-size: 10px; text-align: left; background: #f1f5f9; }
            td { padding: 8px; font-size: 10px; border-bottom: 1px dashed #eee; }

            .totals { margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
            .total-row { display: flex; justify-content: flex-end; gap: 20px; margin-bottom: 5px; font-size: 12px; }
            .grand-total { font-size: 14px; font-weight: bold; border-top: 1px double #000; padding-top: 5px; margin-top: 5px; }
            .footer { margin-top: 40px; text-align: center; font-size: 9px; font-style: italic; color: #666; }
            .stamp { position: absolute; bottom: 60px; right: 40px; width: 100px; height: 100px; border: 2px solid rgba(0,0,0,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: rotate(-15deg); font-size: 10px; color: rgba(0,0,0,0.1); font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="receipt-paper">
            <div class="letterhead">
              ${logoImgHtml}
              <div>
                <h1 class="school-name">${SCHOOL_CONFIG.fullName}</h1>
                <p class="contact">${SCHOOL_CONFIG.address}</p>
                <p class="contact">TEL: ${SCHOOL_CONFIG.hotline} | EMAIL: ${SCHOOL_CONFIG.email}</p>
              </div>
            </div>
            
            <div class="title">OFFICIAL FEE STATEMENT</div>
            
            <div class="info-row"><span class="label">STUDENT:</span><span>${record.studentName}</span></div>
            <div class="info-row"><span class="label">CLASS:</span><span>${record.className || "N/A"}</span></div>
            <div class="info-row"><span class="label">PERIOD:</span><span>${record.term} ${record.academicYear}</span></div>
            <div class="info-row"><span class="label">DATE:</span><span>${moment().format("DD/MM/YYYY")}</span></div>

            <div class="summary-box">
              ${Object.entries(categorySummary)
                .map(
                  ([cat, vals]: any) => `
                <div class="summary-item">
                  <div class="summary-label">${cat}</div>
                  <div class="summary-row"><span>Billed:</span><span class="summary-val">₵${vals.billed.toFixed(2)}</span></div>
                  <div class="summary-row"><span>Paid:</span><span class="summary-val" style="color: green">₵${vals.paid.toFixed(2)}</span></div>
                  <div class="summary-row" style="border-top: 1px solid #eee; margin-top: 4px; padding-top: 4px;">
                    <span>Bal:</span>
                    <span class="summary-val" style="color: ${vals.billed - vals.paid > 0 ? "#ef4444" : "#10b981"}">
                      ₵${(vals.billed - vals.paid).toFixed(2)}
                    </span>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>

            <table>
              <thead>
                <tr>
                  <th>DATE / TYPE</th>
                  <th>REF / PAYEE</th>
                  <th>PROCESSED BY</th>
                  <th style="text-align:right">AMOUNT (₵)</th>
                </tr>
              </thead>
              <tbody>
                ${allTransactions
                  .map(
                    (p: any) => `
                  <tr>
                    <td>
                      <div style="font-weight:bold">${moment(p.createdAt).format("DD/MM/YY")}</div>
                      <div style="font-size:8px; color:#666">${(p.type || "tuition").toUpperCase()}</div>
                    </td>
                    <td>
                      <div style="font-weight:bold">${p.receiptNo || "RC-" + String(p.createdAt).slice(-6)}</div>
                      <div style="font-size:8px; color:#666">${p.receivedFrom || "Self"}</div>
                    </td>
                    <td>${p.updatedBy || "Admin"}</td>
                    <td style="text-align:right; font-weight:bold">₵ ${Number(p.amount).toFixed(2)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row"><span>TUITION ARREARS:</span><span>₵ ${record.arrears?.toFixed(2)}</span></div>
              <div class="total-row"><span>TUITION TERM BILL:</span><span>₵ ${record.termBill?.toFixed(2)}</span></div>
              <div class="total-row"><span>TUITION DISCOUNT:</span><span style="color: blue">- ₵ ${(record.discount || 0).toFixed(2)}</span></div>
              <div class="total-row"><span>TUITION PAID:</span><span style="color: green">- ₵ ${categorySummary.tuition.paid.toFixed(2)}</span></div>
              <div class="total-row" style="border-top: 1px solid #eee; padding-top: 5px;">
                <span style="font-weight:bold">TUITION BALANCE:</span>
                <span style="font-weight:bold">₵ ${(categorySummary.tuition.billed - categorySummary.tuition.paid).toFixed(2)}</span>
              </div>
              <div class="total-row grand-total">
                <span>NET SETTLEMENT DUE:</span>
                <span style="color: ${totalBalanceAcrossCategories > 0 ? "#ef4444" : "#10b981"}">₵ ${totalBalanceAcrossCategories.toFixed(2)}</span>
              </div>
            </div>

            <div class="stamp">OFFICIAL STAMP</div>

            <div class="footer">
              This is a computer-generated document. No signature required.<br/>
              Thank you for your prompt payment.
            </div>
          </div>
        </body>
      </html>
    `;

      const { uri } = await Print.printToFileAsync({ html });
      const fileName = `Fee_Receipt_${record.studentName.replace(/\s+/g, "_")}_${moment().format("DDMMYY")}.pdf`;

      if (Platform.OS !== "web") {
        // Move to a permanent-ish location with a nice name
        const newUri = (FileSystem as any).cacheDirectory + fileName;
        await FileSystem.copyAsync({ from: uri, to: newUri });

        if (Platform.OS === "android") {
          // On Android, we can try to save it to a public folder or just share it
          // Sharing is often the only way without extra permissions,
          // but we can at least ensure the dialog title is clear.
          await Sharing.shareAsync(newUri, {
            mimeType: "application/pdf",
            dialogTitle: "Download Fee Receipt",
            UTI: "com.adobe.pdf",
          });
        } else {
          // iOS sharing dialog includes "Save to Files"
          await Sharing.shareAsync(newUri, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
          });
        }
      } else {
        // Force download on web instead of just opening
        const link = document.createElement("a");
        link.href = uri;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("PDF generation failed", err);
      showToast({ message: "Could not generate PDF receipt", type: "error" });
    }
  };

  if (loading || acadConfig.loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View
        style={StyleSheet.flatten([
          styles.navBar,
          { backgroundColor: primary },
        ])}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <SVGIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Fee Ledger</Text>
        <TouchableOpacity
          onPress={() => setPaymentModalVisible(true)}
          disabled={!selectedStudentUid}
          style={styles.paymentIcon}
        >
          <SVGIcon
            name="cash"
            size={24}
            color={selectedStudentUid ? "#fff" : "rgba(255,255,255,0.3)"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={generatePDF}
          disabled={!record}
          style={styles.printIcon}
        >
          <SVGIcon
            name="download"
            size={24}
            color={record ? "#fff" : "rgba(255,255,255,0.3)"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient colors={[primary, secondary]} style={styles.filterCard}>
          <View style={styles.pickerRow}>
            <View style={styles.pickerBox}>
              <Text style={styles.pickerLabel}>
                YEAR {selectedYear === acadConfig.academicYear ? "(CUR)" : ""}
              </Text>
              <Picker
                selectedValue={selectedYear}
                onValueChange={setSelectedYear}
                style={StyleSheet.flatten([
                  styles.picker,
                  Platform.OS === "web" &&
                    ({
                      color: "#000",
                      backgroundColor: "#fff",
                      height: 40,
                      borderRadius: 10,
                      marginTop: 15,
                    } as any),
                ])}
                dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
              >
                {availableYears.map((y) => (
                  <Picker.Item key={y} label={y} value={y} color="#000" />
                ))}
              </Picker>
            </View>
            <View
              style={StyleSheet.flatten([styles.pickerBox, { marginLeft: 10 }])}
            >
              <Text style={styles.pickerLabel}>
                TERM {selectedTerm === acadConfig.currentTerm ? "(CUR)" : ""}
              </Text>
              <Picker
                selectedValue={selectedTerm}
                onValueChange={setSelectedTerm}
                style={StyleSheet.flatten([
                  styles.picker,
                  Platform.OS === "web" &&
                    ({
                      color: "#000",
                      backgroundColor: "#fff",
                      height: 40,
                      borderRadius: 10,
                      marginTop: 15,
                    } as any),
                ])}
                dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
              >
                <Picker.Item label="Term 1" value="Term 1" color="#000" />
                <Picker.Item label="Term 2" value="Term 2" color="#000" />
                <Picker.Item label="Term 3" value="Term 3" color="#000" />
              </Picker>
            </View>
          </View>

          <View style={[styles.pickerRow, { marginTop: 10 }]}>
            <View style={styles.pickerBox}>
              <Text style={styles.pickerLabel}>CLASS</Text>
              <Picker
                selectedValue={selectedClassId}
                onValueChange={setSelectedClassId}
                style={StyleSheet.flatten([
                  styles.picker,
                  Platform.OS === "web" &&
                    ({
                      color: "#000",
                      backgroundColor: "#fff",
                      height: 40,
                      borderRadius: 10,
                      marginTop: 15,
                    } as any),
                ])}
                dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
              >
                {classes.map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.id} color="#000" />
                ))}
              </Picker>
            </View>
            <View
              style={StyleSheet.flatten([styles.pickerBox, { marginLeft: 10 }])}
            >
              <Text style={styles.pickerLabel}>STUDENT</Text>
              <Picker
                selectedValue={selectedStudentUid}
                onValueChange={setSelectedStudentUid}
                style={StyleSheet.flatten([
                  styles.picker,
                  Platform.OS === "web" &&
                    ({
                      color: "#000",
                      backgroundColor: "#fff",
                      height: 40,
                      borderRadius: 10,
                      marginTop: 15,
                    } as any),
                ])}
                dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
              >
                {fetchingStudents ? (
                  <Picker.Item label="Loading..." value="" color="#000" />
                ) : (
                  students.map((s) => (
                    <Picker.Item key={s.uid} label={s.name} value={s.uid} color="#000" />
                  ))
                )}
              </Picker>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search serial or payee..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <SVGIcon name="search" size={20} color="#fff" />
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {fetchingRecord || deleting ? (
            <ActivityIndicator
              size="large"
              color={primary}
              style={{ marginTop: 50 }}
            />
          ) : record ? (
            <Animatable.View
              animation="fadeInUp"
              duration={600}
              style={styles.receiptPaper}
            >
              {/* Background Watermark moved to top of stack */}
              <View style={styles.watermark} pointerEvents="none">
                <SVGIcon
                  name="checkmark-done-circle"
                  size={120}
                  color="rgba(0,0,0,0.02)"
                />
              </View>

              {/* Receipt Header */}
              <View style={styles.paperHeader}>
                <Image
                  source={schoolLogo}
                  style={styles.paperLogo}
                  resizeMode="contain"
                />
                <View style={styles.paperSchoolInfo}>
                  <Text style={styles.paperSchoolName}>
                    {SCHOOL_CONFIG.fullName}
                  </Text>
                  <Text style={styles.paperContact}>
                    {SCHOOL_CONFIG.address}
                  </Text>
                  <Text style={styles.paperContact}>
                    TEL: {SCHOOL_CONFIG.hotline} | {SCHOOL_CONFIG.email}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />
              <Text style={styles.receiptTitle}>OFFICIAL RECEIPT</Text>

              {/* Student Info */}
              <View style={styles.paperInfoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>STUDENT:</Text>
                  <Text style={styles.infoValue}>{record.studentName}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>CLASS:</Text>
                  <Text style={styles.infoValue}>
                    {record.className || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>PERIOD:</Text>
                  <Text style={styles.infoValue}>
                    {record.term} • {record.academicYear}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>DATE:</Text>
                  <Text style={styles.infoValue}>
                    {moment().format("DD/MM/YYYY")}
                  </Text>
                </View>
              </View>

              {/* Category Summary */}
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>CATEGORY BREAKDOWN</Text>
                <View style={styles.summaryGrid}>
                {Object.entries(categorySummary).map(([cat, vals]: any) => (
                  <View key={cat} style={styles.summaryCard}>
                    <Text style={styles.catLabel}>{cat.toUpperCase()}</Text>
                    <View style={styles.catRow}>
                      <Text style={styles.catSub}>Billed:</Text>
                      <Text style={styles.catVal}>₵{vals.billed.toFixed(2)}</Text>
                    </View>
                    <View style={styles.catRow}>
                      <Text style={styles.catSub}>Paid:</Text>
                      <Text style={[styles.catVal, { color: "#10B981" }]}>₵{vals.paid.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.catRow, { borderTopWidth: 1, borderTopColor: "#eee", marginTop: 4, paddingTop: 4 }]}>
                      <Text style={styles.catSub}>Bal:</Text>
                      <Text style={[styles.catVal, { color: (vals.billed - vals.paid) > 0 ? "#EF4444" : "#10B981" }]}>
                        ₵{(vals.billed - vals.paid).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              </View>

              {/* Payments Table */}
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 1.2 }]}>DATE / TYPE</Text>
                  <Text style={[styles.th, { flex: 1.5 }]}>
                    REF / PAYEE
                  </Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                    AMOUNT
                  </Text>
                  <Text style={[styles.th, { width: 40, textAlign: "center" }]}>
                    DEL
                  </Text>
                </View>
                {filteredPayments.map((p: any, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.td}>
                        {moment(p.createdAt).format("DD/MM/YY")}
                      </Text>
                      <Text style={[styles.tdRef, { color: COLORS.primary, fontWeight: '800' }]}>
                        {(p.type || "tuition").toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.tdRef}>
                        {p.receiptNo || "RC-" + String(p.createdAt).slice(-6)}
                      </Text>
                      <Text style={styles.tdPayee}>
                        {p.receivedFrom || "Self"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.td,
                        {
                          flex: 1,
                          textAlign: "right",
                          fontWeight: "900",
                          color: (p.type || "tuition").toLowerCase().endsWith("_payment") || (p.type || "tuition").toLowerCase() === "tuition" ? "#10B981" : "#EF4444"
                        },
                      ]}
                    >
                      {((p.type || "tuition").toLowerCase().endsWith("_payment") || (p.type || "tuition").toLowerCase() === "tuition") ? "-" : "+"}₵{Number(p.amount).toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeletePayment(p)}
                      style={styles.deleteBtn}
                      activeOpacity={0.6}
                    >
                      <SVGIcon name="trash" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Totals Section */}
              <View style={styles.totalsSection}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>ARREARS B/F:</Text>
                  <Text style={styles.totalsValue}>
                    ₵ {record.arrears?.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>TERM BILL:</Text>
                  <Text style={styles.totalsValue}>
                    ₵ {record.termBill?.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>DISCOUNT:</Text>
                  <Text style={[styles.totalsValue, { color: "#3B82F6" }]}>
                    - ₵ {(record.discount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>TOTAL PAID:</Text>
                  <Text style={[styles.totalsValue, { color: "#10B981" }]}>
                    - ₵ {record.amountPaid?.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>BALANCE DUE:</Text>
                  <Text style={styles.grandTotalValue}>
                    ₵ {record.balance?.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Paper Footer content */}
              <View style={styles.paperFooter}>
                <Text style={styles.footerText}>
                  Computer generated. Reverting transactions updates balances
                  instantly.
                </Text>
                <Text style={styles.copyrightText}>
                  © {moment().year()} {SCHOOL_CONFIG.fullName}
                </Text>
              </View>
            </Animatable.View>
          ) : (
            selectedStudentUid && (
              <View style={styles.emptyState}>
                <SVGIcon name="alert-circle" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No record found</Text>
                <Text style={styles.emptySub}>
                  No financial data for the selected period.
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <View style={styles.paymentModal}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalStudentName}>
                Record Payment
              </Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.closeRound}
              >
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={styles.modalInputs}>
                <TextInput
                  style={styles.pillInput}
                  placeholder="Amount (₵)"
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholderTextColor="#64748B"
                />
                <TextInput
                  style={styles.pillInput}
                  placeholder="Received From"
                  value={receivedFrom}
                  onChangeText={setReceivedFrom}
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={styles.methodGrid}>
                {["Cash", "Cheque", "Momo", "E-cash"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodBtn,
                      paymentMethod === m && { backgroundColor: primary },
                    ]}
                    onPress={() => setPaymentMethod(m as any)}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        paymentMethod === m && { color: "#fff" },
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primary }]}
                onPress={handleLogPayment}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E2E8F0" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  navBar: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  navTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  backIcon: { width: 40 },
  printIcon: { width: 40, alignItems: "flex-end" },
  paymentIcon: { width: 40, alignItems: "flex-end", marginRight: 10 },
  scrollContent: { paddingBottom: 40 },
  filterCard: {
    padding: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  pickerRow: { flexDirection: "row" },
  pickerBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  pickerLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "rgba(255,255,255,0.8)",
    marginLeft: 5,
  },
  picker: { color: "#fff", height: 40 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginTop: 15,
    height: 45,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  mainContent: { padding: 15 },
  receiptPaper: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 25,
    ...SHADOWS.medium,
    minHeight: 600,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
  },
  paperHeader: {
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 15,
  },
  paperLogo: { width: 60, height: 60, marginBottom: 10 },
  paperSchoolInfo: { flex: 1, alignItems: "center" },
  paperSchoolName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    textTransform: "uppercase",
    textAlign: "center",
  },
  paperContact: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  divider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
  receiptTitle: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 2,
    marginBottom: 20,
  },
  paperInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 25,
  },
  infoItem: { width: "48%" },
  infoLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8" },
  infoValue: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  summaryContainer: { marginBottom: 25, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryTitle: { fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 10, letterSpacing: 1 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { flex: 1, minWidth: '30%', backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  catLabel: { fontSize: 8, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  catSub: { fontSize: 8, color: '#94A3B8', fontWeight: '600' },
  catVal: { fontSize: 9, fontWeight: '700', color: '#1E293B' },
  tableContainer: { marginBottom: 25 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: "#000",
    paddingVertical: 8,
  },
  th: { fontSize: 10, fontWeight: "900", color: "#1E293B" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  td: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  tdRef: { fontSize: 9, color: "#94A3B8", marginTop: 2 },
  tdPayee: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  tdAdmin: { fontSize: 9, color: "#64748B", marginTop: 2, fontStyle: "italic" },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  totalsSection: { borderTopWidth: 1, borderTopColor: "#000", paddingTop: 15 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginBottom: 6,
  },
  totalsLabel: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  totalsValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
    width: 100,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  grandTotalLabel: { fontSize: 12, fontWeight: "900", color: "#1E293B" },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.primary,
    width: 100,
    textAlign: "right",
  },
  paperFooter: { marginTop: 50, alignItems: "center" },
  footerText: {
    fontSize: 9,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "center",
  },
  copyrightText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#CBD5E1",
    marginTop: 4,
  },
  watermark: {
    position: "absolute",
    bottom: 40,
    right: 20,
    opacity: 0.5,
    zIndex: -1,
  },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#475569",
    marginTop: 15,
  },
  emptySub: { fontSize: 13, color: "#94A3B8", marginTop: 5 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "flex-end",
  },
  paymentModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    padding: 30,
    maxHeight: "90%",
  },
  modalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 35,
  },
  modalStudentName: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  closeRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  modalInputs: { gap: 15, marginBottom: 30 },
  pillInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  methodGrid: { flexDirection: "row", gap: 10, marginBottom: 30 },
  methodBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  methodText: { fontSize: 12, fontWeight: "800", color: "#64748B" },
  saveBtn: {
    height: 64,
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
