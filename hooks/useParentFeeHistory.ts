import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebaseConfig";
import { useFeeLedger } from "./admin-dashboard/useFeeLedger";
import { isPaymentEntry } from "./admin-dashboard/finance-cleanup/utils";

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
    const rawEntries = feeLedger.allTransactions.map((payment: any, index: number) => {
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

      const isPayment = isPaymentEntry(payment);

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
    });

    const groupedMap = new Map<string, any>();
    const nonPaymentEntries: any[] = [];

    rawEntries.forEach((entry: any) => {
      if (!entry._isPayment) {
        nonPaymentEntries.push(entry);
        return;
      }

      const groupKey = entry.paymentGroupId || `${entry.date}_${entry._receivedFrom}_${entry._method}`;
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          ...entry,
          _totalAmount: Number(entry.amount) || 0,
          _splitItems: [entry],
        });
      } else {
        const group = groupedMap.get(groupKey);
        group._totalAmount += Number(entry.amount) || 0;
        group._splitItems.push(entry);
      }
    });

    const combinedPayments = Array.from(groupedMap.values()).map((group: any) => {
      const isMulti = group._splitItems.length > 1;
      return {
        ...group,
        amount: group._totalAmount,
        _title: isMulti ? "PAYMENT" : group._title,
        receiptNo: group.paymentGroupId || group.receiptNo,
        _isPayment: true,
      };
    });

    return combinedPayments.sort((a: any, b: any) => {
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
    const lastPayment = paymentLedgerEntries.find((p: any) => p._isPayment);

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
