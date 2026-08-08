import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    collection,
    documentId,
    getDocs,
    query,
    where,
    orderBy
} from "firebase/firestore";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

export default function PaymentReceipts() {
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  const fetchChildren = async () => {
    if (!appUser || appUser.role !== "parent") return;
    const ids = appUser.childrenIds || [];
    if (ids.length === 0) {
        setLoading(false);
        return;
    }
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
    } finally {
        setLoading(false);
    }
  };

  const fetchPayments = async () => {
    if (!selectedChildId) return;
    setRefreshing(true);
    try {
      const q = query(
        collection(db, "feePayments"),
        where("studentUid", "==", selectedChildId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
        .filter((t: any) => {
          const type = (t.type || "tuition").toLowerCase();
          const method = (t.method || "").toLowerCase();
          const receivedFrom = (t.receivedFrom || "").toLowerCase();

          // STRICT PAYMENT IDENTIFICATION (Aligns with reconciler.ts and receipt-view.tsx)
          return (
            !(
              method === "bulk charge" ||
              method === "system billing" ||
              receivedFrom === "system billing" ||
              method.includes("bill")
            ) &&
            (type.endsWith("_payment") ||
              type === "tuition" ||
              type === "tuition_credit" ||
              (!["pta", "maintenance", "admission", "books", "uniform", "other"].includes(type) &&
                method !== "bulk charge"))
          );
        })
        .map((t: any) => ({
          ...t,
          _displayDate: moment(t.createdAt || t.timestamp?.toDate()).format(
            "MMM DD, YYYY",
          ),
          _displayTime: moment(t.createdAt || t.timestamp?.toDate()).format(
            "h:mm A",
          ),
          _title: (t.otherCategory || t.type || "Payment")
            .replace("_payment", "")
            .replace("_", " ")
            .toUpperCase(),
        }));
      setPayments(list);
    } catch (e) {
      console.error("Error fetching payments:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, [appUser]);

  useEffect(() => {
    fetchPayments();
  }, [selectedChildId]);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>Payment Receipts</Text>
            <Text style={styles.headerSub}>All Transaction Records</Text>
          </View>
          <TouchableOpacity
            onPress={fetchPayments}
            style={styles.headerRight}
            activeOpacity={0.7}
          >
            <SVGIcon name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchPayments}
            colors={[primary]}
          />
        }
      >
        {children.length > 1 && (
          <View style={styles.selectorWrapper}>
            <Text style={styles.sectionLabel}>SELECT CHILD</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorScroll}
            >
              {children.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedChildId(c.id)}
                  style={[
                    styles.childChip,
                    { flexDirection: 'row', alignItems: 'center' },
                    selectedChildId === c.id && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                >
                  <SVGIcon
                    name="person"
                    size={14}
                    color={selectedChildId === c.id ? "#fff" : "#64748B"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.childChipText,
                      selectedChildId === c.id && { color: "#fff" },
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.historyContainer}>
          {refreshing && payments.length === 0 ? (
            <ActivityIndicator color={primary} style={{ marginTop: 40 }} />
          ) : payments.length > 0 ? (
            payments.map((payment, idx) => (
              <Animatable.View
                key={payment.id}
                animation="fadeInUp"
                delay={idx * 50}
              >
                <TouchableOpacity
                  style={styles.paymentCard}
                  onPress={() => {
                    router.push({
                      pathname: "/shared/receipt-view",
                      params: {
                        type: "payment",
                        studentId: selectedChildId,
                        paymentId: payment.id,
                        year: payment.academicYear,
                        term: payment.term,
                      },
                    });
                  }}
                >
                  <View style={styles.paymentLead}>
                    <View style={styles.iconCircle}>
                      <SVGIcon name="receipt" size={20} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.paymentLabel}>{payment._title}</Text>
                        <View style={styles.periodBadge}>
                            <Text style={styles.periodBadgeText}>{payment.academicYear} • {payment.term}</Text>
                        </View>
                      </View>
                      <Text style={styles.paymentDate}>
                        {payment._displayDate} • {payment._displayTime}
                      </Text>
                      <Text style={styles.paymentMeta}>
                        {payment.method || "Cash"} • #{payment.receiptNo || "N/A"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.paymentTail}>
                    <Text style={styles.paymentValue}>
                      {SCHOOL_CONFIG.currencySymbol}{Number(payment.amount || 0).toFixed(2)}
                    </Text>
                    <SVGIcon name="chevron-forward" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              </Animatable.View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <SVGIcon name="receipt" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Receipts Found</Text>
              <Text style={styles.emptySub}>
                When you make payments, your digital receipts will appear here automatically.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingBottom: 25,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    ...SHADOWS.medium,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scrollContent: { padding: 20 },
  selectorWrapper: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 12,
    letterSpacing: 1,
  },
  selectorScroll: { gap: 10 },
  childChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  childChipText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  historyContainer: { marginTop: 10 },
  paymentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  paymentLead: { flexDirection: "row", alignItems: "center", gap: 15, flex: 1 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  paymentLabel: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  paymentDate: { fontSize: 11, color: "#64748B", marginTop: 2 },
  paymentMeta: { fontSize: 10, color: "#94A3B8", marginTop: 2 },
  paymentTail: { flexDirection: "row", alignItems: "center", gap: 8 },
  paymentValue: { fontSize: 15, fontWeight: "900", color: "#10B981" },
  periodBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  periodBadgeText: { fontSize: 8, fontWeight: "800", color: "#64748B" },
  emptyContainer: { alignItems: "center", marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#475569", marginTop: 15 },
  emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center", marginTop: 8, lineHeight: 18 },
});
