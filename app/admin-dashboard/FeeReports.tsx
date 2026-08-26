import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import moment from "moment";
import {
  collection,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { VIBE } from "../../constants/admin-dashboard/ManageFeesStyles";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { generateFeeReportPDF } from "../../utils/pdfGenerator";
import { getSchoolLogo } from "../../constants/Logos";
import { useRef } from "react";

export default function FeeReports() {
  const { appUser } = useAuth();
  const { classId, academicYear, term } = useLocalSearchParams<{
    classId: string;
    academicYear: string;
    term: string;
  }>();
  const router = useRouter();

  // Access control
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
    "admin",
    "super admin",
    "superadmin",
  ].includes(currentUserRole);
  const feePermission = appUser?.permissions?.["manage-fees"] || "deny";
  const canView =
    isSuperAdmin ||
    feePermission === "full" ||
    feePermission === "view" ||
    feePermission === "edit";

  const [loading, setLoading] = useState(true);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (appUser && !canView && isMounted.current) {
      if (!isNavigating.current) {
        isNavigating.current = true;
        router.replace("/admin-dashboard");
      }
    }
  }, [appUser, canView]);

  useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [classId, academicYear, term, canView]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const classesSnap = await getDocsFromServer(collection(db, "classes"));
      const classesList = classesSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.id,
      }));
      setClasses(classesList);

      // 2. Fetch Students
      let q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("status", "in", ["active", "pending_activation"]),
      );
      if (classId !== "all") {
        q = query(q, where("classId", "==", classId));
      }
      const studentsSnap = await getDocsFromServer(q);
      const students = studentsSnap.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
      }));

      // 3. Fetch Fee Records
      const studentIds = students.map((s) => s.uid);
      const feeRecords: any[] = [];
      if (studentIds.length > 0 && academicYear && term) {
        // Chunking because "in" query has limit
        const chunks = [];
        for (let i = 0; i < studentIds.length; i += 10) {
          chunks.push(studentIds.slice(i, i + 10));
        }

        const feeSnaps = await Promise.all(
          chunks.map((chunk) =>
            getDocsFromServer(
              query(
                collection(db, "studentFeeRecords"),
                where("studentUid", "in", chunk),
                where("academicYear", "==", academicYear),
                where("term", "==", term),
              ),
            ),
          ),
        );

        feeSnaps.forEach((snap) => {
          snap.docs.forEach((doc) => feeRecords.push(doc.data()));
        });
      }

      // 4. Merge Data
      const merged = students.map((s: any) => {
        const record = feeRecords.find((r) => r.studentUid === s.uid);
        const className =
          classesList.find((c) => c.id === s.classId)?.name || "Unknown Class";

        // Extract tuition and other term charges
        const termBill = record?.termBill || 0;
        const ptaBill = record?.ptaBill || 0;
        const maintenanceBill = record?.maintenanceBill || 0;
        const admissionBill = record?.admissionBill || 0;
        const booksBill = record?.booksBill || 0;
        const uniformBill = record?.uniformBill || 0;
        const otherBill = record?.otherBill || 0;

        // Arrears is either from the term record or the current wallet balance if no record exists yet
        const arrears = record ? (record.arrears || 0) : (s.walletBalance || 0);
        const discount = record?.discount || 0;

        // Sum up all payments made this term
        const tuitionPaid = record?.amountPaid || 0;
        const ptaPaid = record?.ptaPaid || 0;
        const maintenancePaid = record?.maintenancePaid || 0;
        const admissionPaid = record?.admissionPaid || 0;
        const booksPaid = record?.booksPaid || 0;
        const uniformPaid = record?.uniformPaid || 0;
        const otherPaid = record?.otherPaid || 0;

        const totalPayable = arrears + termBill + ptaBill + maintenanceBill + admissionBill + booksBill + uniformBill + otherBill;
        const totalPaid = tuitionPaid + ptaPaid + maintenancePaid + admissionPaid + booksPaid + uniformPaid + otherPaid;

        // Calculate balance for display consistency (Payable - Discount - Paid)
        const balance = totalPayable - discount - totalPaid;

        return {
          uid: s.uid,
          fullName:
            `${s.profile?.firstName || ""} ${s.profile?.lastName || ""}`.trim() ||
            "Student",
          studentID: s.profile?.studentID || "N/A",
          className,
          termBill,
          arrears,
          discount,
          amountPaid: totalPaid,
          totalPayable,
          balance,
        };
      });

      if (isMounted.current) {
        setStudentsData(merged);
      }
    } catch (error) {
      if (isMounted.current) console.error("Error fetching report data:", error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    studentsData.forEach((s) => {
      if (!groups[s.className]) groups[s.className] = [];
      groups[s.className].push(s);
    });
    // Sort students by name in each group
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.fullName.localeCompare(b.fullName));
    });
    // Sort groups by class name
    const sortedGroups: Record<string, any[]> = {};
    Object.keys(groups)
      .sort()
      .forEach((key) => {
        sortedGroups[key] = groups[key];
      });
    return sortedGroups;
  }, [studentsData]);

  const schoolTotals = useMemo(() => {
    return studentsData.reduce(
      (acc, s) => ({
        payable: acc.payable + (s.totalPayable || 0),
        discount: acc.discount + (s.discount || 0),
        paid: acc.paid + (s.amountPaid || 0),
        balance: acc.balance + (s.balance || 0),
      }),
      { payable: 0, discount: 0, paid: 0, balance: 0 },
    );
  }, [studentsData]);

  const generatePDF = async () => {
    if (studentsData.length === 0) return;

    try {
      await generateFeeReportPDF(
        {
          academicYear: academicYear || "",
          term: term || "",
          groupedData: groupedData,
          schoolTotals: schoolTotals,
          currencySymbol: SCHOOL_CONFIG.currencySymbol,
        },
        SCHOOL_CONFIG.fullName,
        SCHOOL_CONFIG.hotline,
        SCHOOL_CONFIG.email,
        SCHOOL_CONFIG.address,
        SCHOOL_CONFIG.motto,
        getSchoolLogo(SCHOOL_CONFIG.schoolId),
      );
    } catch (error) {
      console.error("PDF Generation Error:", error);
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
          <Text style={styles.headerTitle}>Financial Reports</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={fetchData} style={styles.backBtn}>
              <SVGIcon name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.reportInfo}>
          <Text style={styles.reportSub}>
            {academicYear} • {term}
          </Text>
          <Text style={styles.reportClass}>
            {classId === "all"
              ? "All Classes"
              : classes.find((c) => c.id === classId)?.name || "Loading..."}
          </Text>
        </View>
        <TouchableOpacity onPress={generatePDF} style={styles.downloadButton}>
          <SVGIcon name="download" size={18} color={VIBE.primary} />
          <Text style={styles.downloadText}>Download PDF Report</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={VIBE.primary} />
          <Text style={styles.loaderText}>Compiling financial data...</Text>
        </View>
      ) : studentsData.length === 0 ? (
        <View style={styles.emptyState}>
          <SVGIcon name="document-text" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No data found for this selection</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll}>
            {Object.entries(groupedData).map(([className, students]) => {
              const classTotals = students.reduce(
                (acc, s) => ({
                  payable: acc.payable + (s.totalPayable || 0),
                  discount: acc.discount + (s.discount || 0),
                  paid: acc.paid + (s.amountPaid || 0),
                  balance: acc.balance + (s.balance || 0),
                }),
                { payable: 0, discount: 0, paid: 0, balance: 0 },
              );

              return (
                <View key={className} style={styles.classSection}>
                  <View style={styles.classHeader}>
                    <Text style={styles.className}>{className}</Text>
                    <Text style={styles.studentCount}>
                      {students.length} Students
                    </Text>
                  </View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.cell, { flex: 2 }]}>Student</Text>
                    <Text style={[styles.cell, styles.textRight]}>Payable</Text>
                    <Text style={[styles.cell, styles.textRight]}>Disc</Text>
                    <Text style={[styles.cell, styles.textRight]}>Paid</Text>
                    <Text style={[styles.cell, styles.textRight]}>Bal</Text>
                  </View>
                  {students.map((s, idx) => (
                    <View
                      key={s.uid}
                      style={[
                        styles.tableRow,
                        idx % 2 === 1 && styles.alternateRow,
                      ]}
                    >
                      <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>
                        {s.fullName}
                      </Text>
                      <Text style={[styles.cell, styles.textRight]}>
                        ₵{s.totalPayable?.toFixed(0)}
                      </Text>
                      <Text style={[styles.cell, styles.textRight]}>
                        ₵{s.discount?.toFixed(0)}
                      </Text>
                      <Text style={[styles.cell, styles.textRight]}>
                        ₵{s.amountPaid?.toFixed(0)}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          styles.textRight,
                          {
                            color: s.balance > 0 ? VIBE.danger : VIBE.success,
                            fontWeight: "bold",
                          },
                        ]}
                      >
                        ₵{s.balance?.toFixed(0)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.classTotalRow}>
                    <Text style={[styles.cell, { flex: 2, fontWeight: "800" }]}>
                      TOTAL
                    </Text>
                    <Text
                      style={[styles.cell, styles.textRight, styles.totalText]}
                    >
                      ₵{classTotals.payable.toFixed(0)}
                    </Text>
                    <Text
                      style={[styles.cell, styles.textRight, styles.totalText]}
                    >
                      ₵{classTotals.discount.toFixed(0)}
                    </Text>
                    <Text
                      style={[styles.cell, styles.textRight, styles.totalText]}
                    >
                      ₵{classTotals.paid.toFixed(0)}
                    </Text>
                    <Text
                      style={[styles.cell, styles.textRight, styles.totalText]}
                    >
                      ₵{classTotals.balance.toFixed(0)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* School Summary Section */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>School-wide Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Payable</Text>
                  <Text style={styles.summaryValue}>₵{schoolTotals.payable.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Discount</Text>
                  <Text style={styles.summaryValue}>₵{schoolTotals.discount.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Paid</Text>
                  <Text style={[styles.summaryValue, { color: VIBE.success }]}>₵{schoolTotals.paid.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Balance</Text>
                  <Text style={[styles.summaryValue, { color: VIBE.danger }]}>₵{schoolTotals.balance.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingTop: Platform.OS === "ios" ? 10 : 15,
    paddingBottom: 25,
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
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginTop: 15,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  downloadText: {
    color: VIBE.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: {
    marginTop: 15,
    fontSize: 14,
    color: VIBE.muted,
    fontWeight: "600",
  },
  scroll: { flex: 1 },
  classSection: {
    marginTop: 20,
    backgroundColor: "#fff",
    marginHorizontal: 15,
    borderRadius: 15,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classHeader: {
    padding: 15,
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  className: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  studentCount: { fontSize: 12, fontWeight: "600", color: VIBE.muted },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  alternateRow: { backgroundColor: "#F8FAFC" },
  cell: { fontSize: 12, color: "#334155", fontWeight: "500", flex: 1 },
  textRight: { textAlign: "right" },
  classTotalRow: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  totalText: { fontWeight: "800", color: "#1E293B" },
  summaryCard: {
    margin: 15,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginTop: 25,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 15,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  summaryItem: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 16,
    color: "#94A3B8",
    fontWeight: "700",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: VIBE.primary + "10",
  },
  retryText: { color: VIBE.primary, fontWeight: "800" },
});
