import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
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

  useEffect(() => {
    if (appUser && !canView) {
      router.replace("/admin-dashboard");
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

        const termBill = record?.termBill || 0;
        const arrears = record?.arrears || 0;
        const discount = record?.discount || 0;
        const amountPaid = record?.amountPaid || 0;
        const totalPayable = arrears + termBill;
        const balance = s.walletBalance || 0;

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
          amountPaid,
          totalPayable,
          balance,
        };
      });

      setStudentsData(merged);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
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
    const ITEMS_PER_PAGE = 35; // Increased to maximize page usage
    const pages: any[] = [];

    const schoolTotalPayable = studentsData.reduce((acc, s) => acc + s.totalPayable, 0);
    const schoolTotalPaid = studentsData.reduce((acc, s) => acc + s.amountPaid, 0);
    const schoolTotalBalance = studentsData.reduce((acc, s) => acc + s.balance, 0);
    const schoolTotalDiscount = studentsData.reduce((acc, s) => acc + s.discount, 0);

    Object.entries(groupedData).forEach(([className, students]) => {
      const classTotalPayable = students.reduce(
        (acc, s) => acc + s.totalPayable,
        0,
      );
      const classTotalPaid = students.reduce((acc, s) => acc + s.amountPaid, 0);
      const classTotalBalance = students.reduce((acc, s) => acc + s.balance, 0);
      const classTotalDiscount = students.reduce(
        (acc, s) => acc + s.discount,
        0,
      );

      for (let i = 0; i < students.length; i += ITEMS_PER_PAGE) {
        pages.push({
          className,
          students: students.slice(i, i + ITEMS_PER_PAGE),
          isFirstChunk: i === 0,
          isLastChunk: i + ITEMS_PER_PAGE >= students.length,
          startIndex: i,
          classTotals: {
            payable: classTotalPayable,
            paid: classTotalPaid,
            balance: classTotalBalance,
            discount: classTotalDiscount,
          },
        });
      }
    });

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 100% !important;
              overflow: visible !important;
              display: block !important;
              background-color: white;
            }
            body {
              font-family: 'Helvetica', sans-serif;
              color: #333;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page {
              padding: 20mm;
              width: 210mm;
              min-height: 297mm;
              box-sizing: border-box;
              display: block;
              page-break-after: always;
              page-break-inside: avoid;
              overflow: visible !important;
              position: relative;
            }
            /* Avoid empty page at the end */
            .page:last-child {
              page-break-after: avoid;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid ${VIBE.primary};
              padding-bottom: 10px;
            }
            .school-name {
              margin: 0;
              color: ${VIBE.primary};
              font-size: 20pt;
              font-weight: bold;
            }
            .report-title {
              margin: 5px 0;
              font-size: 14pt;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .report-meta {
              font-size: 10pt;
              color: #888;
              margin-bottom: 10px;
            }

            h3 {
              margin-top: 10px;
              background: #f0f4ff;
              padding: 8pt;
              border-left: 5px solid ${VIBE.primary};
              font-size: 12pt;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 9pt;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 6pt;
              text-align: left;
            }
            th {
              background-color: #f8fafc;
              font-weight: bold;
              color: #475569;
              text-transform: uppercase;
            }

            .currency { text-align: right; font-family: monospace; }
            .total-row { font-weight: bold; background-color: #f1f5f9; }
            .balance-debt { color: ${VIBE.danger}; font-weight: bold; }
            .balance-cleared { color: ${VIBE.success}; }

            .footer {
              margin-top: 20mm;
              padding-top: 10pt;
              font-size: 9pt;
              text-align: center;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
            }

            @media print {
              .page {
                margin: 0;
                border: none;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          ${pages
            .map(
              (page, idx) => `
            <div class="page">
              <div class="header">
                <div class="school-name">${SCHOOL_CONFIG.fullName}</div>
                <div class="report-title">Student Fee Status Report</div>
                <div class="report-meta">
                  Academic Year: ${academicYear} | Term: ${term}<br/>
                  Generated on: ${new Date().toLocaleDateString()} | Page ${idx + 1} of ${pages.length}
                </div>
              </div>

              <h3>Class: ${page.className} ${!page.isFirstChunk ? "(Cont.)" : ""}</h3>
              <table>
                <thead>
                  <tr>
                    <th style="width: 30px;">#</th>
                    <th>Student Name</th>
                    <th>ID</th>
                    <th class="currency">Payable</th>
                    <th class="currency">Discount</th>
                    <th class="currency">Paid</th>
                    <th class="currency">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${page.students
                    .map(
                      (s: any, sIdx: number) => `
                    <tr>
                      <td>${page.startIndex + sIdx + 1}</td>
                      <td>${s.fullName}</td>
                      <td>${s.studentID}</td>
                      <td class="currency">₵${s.totalPayable.toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        },
                      )}</td>
                      <td class="currency">₵${s.discount.toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        },
                      )}</td>
                      <td class="currency">₵${s.amountPaid.toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        },
                      )}</td>
                      <td class="currency ${s.balance > 0 ? "balance-debt" : "balance-cleared"}">
                        ₵${s.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
                ${
                  page.isLastChunk
                    ? `
                <tfoot>
                  <tr class="total-row">
                    <td colspan="3">Class Totals (${page.className})</td>
                    <td class="currency">₵${page.classTotals.payable.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                      },
                    )}</td>
                    <td class="currency">₵${page.classTotals.discount.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                      },
                    )}</td>
                    <td class="currency">₵${page.classTotals.paid.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                      },
                    )}</td>
                    <td class="currency">₵${page.classTotals.balance.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                      },
                    )}</td>
                  </tr>
                </tfoot>
                `
                    : ""
                }
              </table>

              <div class="footer">
                <p>${SCHOOL_CONFIG.fullName} - Financial Services</p>
                <p>This is a computer generated document.</p>
              </div>
            </div>
          `,
            )
            .join("")}

            <div class="page">
              <div class="header">
                <div class="school-name">${SCHOOL_CONFIG.fullName}</div>
                <div class="report-title">School Financial Summary</div>
                <div class="report-meta">
                  Academic Year: ${academicYear} | Term: ${term}<br/>
                  Generated on: ${new Date().toLocaleDateString()}
                </div>
              </div>

              <div style="margin-top: 40px;">
                <h3 style="background: ${VIBE.primary}; color: white; border: none; padding: 12px;">OVERALL SCHOOL SUMMARY</h3>
                <table style="font-size: 14px; margin-top: 20px;">
                  <thead>
                    <tr>
                      <th style="background: #f1f5f9;">Financial Category</th>
                      <th class="currency" style="background: #f1f5f9;">Total Amount (₵)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="padding: 15px;">Total Fees Payable</td>
                      <td class="currency" style="padding: 15px;">₵${schoolTotalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding: 15px;">Total Discounts Granted</td>
                      <td class="currency" style="padding: 15px;">₵${schoolTotalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding: 15px;">Total Amount Paid</td>
                      <td class="currency" style="padding: 15px; color: ${VIBE.success}; font-weight: bold;">₵${schoolTotalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding: 15px;">Total Outstanding Balance</td>
                      <td class="currency" style="padding: 15px; color: ${VIBE.danger}; font-weight: bold;">₵${schoolTotalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="footer">
                <p>${SCHOOL_CONFIG.fullName} - Financial Services</p>
                <p>This is a computer generated document.</p>
              </div>
            </div>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }
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
            onPress={() => router.back()}
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
