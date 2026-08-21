import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebaseConfig";
import { useFeeLedger } from "./admin-dashboard/useFeeLedger";

export const useParentFeeHistory = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { appUser } = useAuth();

  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(
    (params.studentId as string) || "",
  );

  const feeLedger = useFeeLedger(
    selectedChildId,
    (params.academicYear as string) || "",
    (params.term as string) || "",
  );

  const fetchChildren = async () => {
    if (!appUser || appUser.role !== "parent") return;
    const ids = appUser.childrenIds || [];
    if (ids.length === 0) return;
    try {
      const q = query(
        collection(db, "users"),
        where(documentId(), "in", ids.slice(0, 30)),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: `${(d.data() as any).profile?.firstName || ""} ${(d.data() as any).profile?.lastName || ""}`.trim(),
      }));
      setChildren(list);
      if (!selectedChildId && list.length > 0)
        setSelectedChildId(list[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, [appUser]);

  const paymentLedgerEntries = useMemo(() => {
    return feeLedger.allTransactions
      .map((payment: any, index: number) => {
        const timestampValue =
          payment.date ||
          payment.createdAt ||
          payment.timestamp?.toDate?.() ||
          payment.paymentDate ||
          payment.timestamp;
        const parsedDate = moment(timestampValue);
        const installmentSource =
          payment.installmentLabel ||
          payment.installmentName ||
          payment.installment ||
          payment.installmentNo ||
          payment.installmentNumber;
        const installmentLabel =
          installmentSource !== undefined && installmentSource !== ""
            ? String(installmentSource)
            : payment.isInstallment || payment.paymentPlan
              ? `Installment ${index + 1}`
              : null;

        const method = (payment.method || payment.paymentMethod || "").toLowerCase();
        const type = (payment.type || "").toLowerCase();
        const receivedFrom = (payment.receivedFrom || "").toLowerCase();

        const isPayment = (
          !(method === "bulk charge" || method === "system billing" || receivedFrom === "system billing" || method.includes("bill")) &&
          (type.endsWith("_payment") || type === "tuition" || type === "tuition_credit")
        );

        return {
          ...payment,
          _isPayment: isPayment,
          _title:
            payment.otherCategory?.toUpperCase() ||
            payment.type
              ?.replace("_payment", "")
              .replace("_", " ")
              .toUpperCase() ||
            "PAYMENT",
          _installmentLabel: installmentLabel,
          _displayDate: parsedDate.isValid()
            ? parsedDate.format("MMM DD, YYYY")
            : "Pending",
          _displayTime: parsedDate.isValid() ? parsedDate.format("h:mm A") : "",
          _method: payment.method || payment.paymentMethod || "Cash",
          _receivedFrom:
            payment.receivedFrom ||
            payment.paidBy ||
            payment.customerName ||
            "School account",
        };
      })
      .filter((entry: any) => entry._isPayment)
      .sort((a: any, b: any) => {
        const aTime = new Date(
          a.date || a.createdAt || a.timestamp?.toDate?.() || 0,
        ).getTime();
        const bTime = new Date(
          b.date || b.createdAt || b.timestamp?.toDate?.() || 0,
        ).getTime();
        return bTime - aTime;
      });
  }, [feeLedger.allTransactions]);

  const ledgerSummary = useMemo(() => {
    const totalPaid = feeLedger.totals.totalPaid;
    const lastPayment = paymentLedgerEntries[0];

    return {
      totalPaid,
      lastPaymentDate: lastPayment?._displayDate || "No payments yet",
    };
  }, [paymentLedgerEntries, feeLedger.totals.totalPaid]);

  const handleBack = () => router.back();

  return {
    ...feeLedger,
    router,
    children,
    selectedChildId,
    setSelectedChildId,
    paymentLedgerEntries,
    ledgerSummary,
    handleBack,
  };
};
