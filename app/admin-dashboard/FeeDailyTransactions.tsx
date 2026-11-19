import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import moment from "moment";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { VIBE, styles as feeStyles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

export default function FeeDailyTransactions() {
  const { appUser } = useAuth();
  const router = useRouter();
  const acadConfig = useAcademicConfig();
  const params = useLocalSearchParams<{ academicYear?: string; term?: string }>();

  const academicYear = params.academicYear || acadConfig.academicYear || "";
  const term = params.term || acadConfig.currentTerm || "";

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchDailyPayments(selectedDate, academicYear, term);
  }, [selectedDate, academicYear, term]);

  const fetchDailyPayments = async (date: Date, year?: string, termStr?: string) => {
    if (!isMounted.current) return;
    setLoading(true);
    try {
      const dateString = moment(date).format("YYYY-MM-DD");
      let q = query(collection(db, "feePayments"), where("date", "==", dateString));

      if (year && year !== "all") {
        q = query(q, where("academicYear", "==", year));
      }
      if (termStr && termStr !== "all") {
        q = query(q, where("term", "==", termStr));
      }

      const snap = await getDocs(q as any);
      if (!isMounted.current) return;
      const payments = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      payments.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setDailyPayments(payments);
    } catch (error) {
      console.error("Error fetching daily payments:", error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[VIBE.primary, "#4F46E5"]} style={styles.header}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => {
              if (isNavigating.current) return;
              isNavigating.current = true;
              router.back();
            }}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Transactions</Text>
          <TouchableOpacity
            onPress={() => fetchDailyPayments(selectedDate, academicYear, term)}
            style={styles.backBtn}
          >
            <SVGIcon name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.reportInfo}>
          <Text style={styles.reportSub}>
            {academicYear} • {term}
          </Text>
          <Text style={styles.reportClass}>
            {moment(selectedDate).format("DD MMMM, YYYY")}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.bodyContent}>
        <View style={feeStyles.dateSelector}>
          <SVGIcon name="calendar" size={20} color={VIBE.primary} />
          {Platform.OS === "web" ? (
            <input
              type="date"
              value={moment(selectedDate).format("YYYY-MM-DD")}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(new Date(e.target.value));
                }
              }}
              style={{
                flex: 1,
                border: "none",
                background: "none",
                fontSize: 16,
                fontWeight: "700",
                color: VIBE.text,
                outline: "none",
              }}
            />
          ) : (
            <>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={feeStyles.dateText}>
                  {moment(selectedDate).format("DD MMMM, YYYY")}
                </Text>
              </TouchableOpacity>
              {showDatePicker && DateTimePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={(event: any, date?: Date) => {
                    setShowDatePicker(false);
                    if (date) setSelectedDate(date);
                  }}
                />
              )}
            </>
          )}
        </View>

        <View style={feeStyles.dailyTotalCard}>
          <Text style={feeStyles.dailyTotalLabel}>TOTAL COLLECTED</Text>
          <Text style={feeStyles.dailyTotalValue}>
            ₵
            {dailyPayments
              .reduce((acc, p) => acc + (p.amount || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={VIBE.primary} />
            <Text style={styles.loaderText}>Loading transactions...</Text>
          </View>
        ) : (
          <FlatList
            data={dailyPayments}
            keyExtractor={(item) => item.id || item.receiptNo}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item }) => (
              <View style={feeStyles.dailyPaymentItem}>
                <View style={{ flex: 1 }}>
                  <Text style={feeStyles.dailyStudentName}>
                    {item.studentName}
                  </Text>
                  <Text style={feeStyles.dailyStudentClass}>
                    {item.className} • {item.method}
                  </Text>
                  <Text style={feeStyles.dailyReceipt}>
                    {item.receiptNo} • {moment(item.createdAt).format("LT")}
                  </Text>
                </View>
                <Text style={feeStyles.dailyAmount}>
                  ₵{(item.amount || 0).toFixed(2)}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={feeStyles.emptyWrap}>
                <SVGIcon name="cash-outline" size={48} color={VIBE.muted} />
                <Text style={feeStyles.emptyText}>No transactions found for this date</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingTop: Platform.OS === "ios" ? 10 : 15,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "900", color: "#fff" },
  reportInfo: { alignItems: "center" },
  reportSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
  },
  reportClass: { fontSize: 20, fontWeight: "900", color: "#fff", marginTop: 4 },
  bodyContent: { flex: 1, padding: 15 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: {
    marginTop: 15,
    fontSize: 14,
    color: VIBE.muted,
    fontWeight: "600",
  },
});
