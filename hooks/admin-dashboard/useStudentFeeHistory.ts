import { useLocalSearchParams, useRouter } from "expo-router";
import moment from "moment";
import { useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { useFeeLedger } from "./useFeeLedger";

export const useStudentFeeHistory = () => {
  const params = useLocalSearchParams();
  const router = useRouter();

  const feeLedger = useFeeLedger(
    (params.studentId as string) || "",
    (params.academicYear as string) || "",
    (params.term as string) || "",
  );

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "Cash" | "Cheque" | "E-cash" | "Momo"
  >("Cash");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPayments = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return feeLedger.allTransactions.filter(
      (p: any) =>
        p.receiptNo?.toLowerCase().includes(lowerQuery) ||
        p.receivedFrom?.toLowerCase().includes(lowerQuery) ||
        p.amount.toString().includes(lowerQuery) ||
        p.type?.toLowerCase().includes(lowerQuery),
    );
  }, [feeLedger.allTransactions, searchQuery]);

  const paymentLedgerEntries = useMemo(() => {
    return filteredPayments
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
  }, [filteredPayments]);

  const ledgerSummary = useMemo(() => {
    const totalPaid = feeLedger.totals.totalPaid;
    const lastPayment = paymentLedgerEntries[0];

    return {
      totalPaid,
      lastPaymentDate: lastPayment?._displayDate || "No payments yet",
    };
  }, [paymentLedgerEntries, feeLedger.totals.totalPaid]);

  const onLogPayment = async () => {
    const success = await feeLedger.handleLogPayment(
      paymentAmount,
      receivedFrom,
      paymentMethod,
      paymentDate,
    );
    if (success) {
      setPaymentAmount("");
      setReceivedFrom("");
      setPaymentDate(new Date());
      setPaymentModalVisible(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/admin-dashboard/ManageFees");
    }
  };

  const onRevertPayment = (payment: any) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this transaction? The student's balance will be adjusted automatically.",
      );
      if (confirmed) {
        feeLedger.handleRevertPayment(payment);
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
            onPress: () => feeLedger.handleRevertPayment(payment),
          },
        ],
      );
    }
  };

  return {
    ...feeLedger,
    router,
    paymentModalVisible,
    setPaymentModalVisible,
    paymentAmount,
    setPaymentAmount,
    receivedFrom,
    setReceivedFrom,
    paymentDate,
    setPaymentDate,
    showDatePicker,
    setShowDatePicker,
    paymentMethod,
    setPaymentMethod,
    searchQuery,
    setSearchQuery,
    paymentLedgerEntries,
    ledgerSummary,
    onLogPayment,
    handleBack,
    onRevertPayment,
  };
};
