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
    collection,
    doc,
    increment,
    onSnapshot,
    orderBy,
    query,
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
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

const { width } = Dimensions.get("window");

export default function StudentFeeHistoryScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const acadConfig = useAcademicConfig();

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
        const snap = await getDocsCacheFirst(collection(db, "classes") as any);
        let list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
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

  useEffect(() => {
    if (!selectedClassId) return;
    const loadStudents = async () => {
      setFetchingStudents(true);
      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("classId", "==", selectedClassId),
          orderBy("__name__"),
        );
        const snap = await getDocsCacheFirst(q as any);
        const list = snap.docs
          .map((d) => ({
            uid: d.id,
            name:
              `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim() ||
              "Student",
          }))
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
      return;
    }
    setFetchingRecord(true);
    const cleanYear = selectedYear.replace(/\//g, "-");
    const cleanTerm = selectedTerm.replace(/\s/g, "");
    const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;
    const unsubscribe = onSnapshot(
      doc(db, "studentFeeRecords", recordId),
      (snap) => {
        setRecord(snap.exists() ? snap.data() : null);
        setFetchingRecord(false);
      },
    );
    return () => unsubscribe();
  }, [selectedStudentUid, selectedYear, selectedTerm]);

  const filteredPayments = useMemo(() => {
    if (!record?.payments) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return record.payments.filter(
      (p: any) =>
        p.receiptNo?.toLowerCase().includes(lowerQuery) ||
        p.receivedFrom?.toLowerCase().includes(lowerQuery) ||
        p.amount.toString().includes(lowerQuery),
    );
  }, [record, searchQuery]);

  const handleDeletePayment = (payment: any) => {
    Alert.alert(
      "Revert Payment",
      "Are you sure you want to delete this transaction? The student's balance will be adjusted automatically.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const cleanYear = selectedYear.replace(/\//g, "-");
              const cleanTerm = selectedTerm.replace(/\s/g, "");
              const recordId = `${selectedStudentUid}_${cleanYear}_${cleanTerm}`;

              const batch = writeBatch(db);
              batch.update(doc(db, "studentFeeRecords", recordId), {
                amountPaid: increment(-payment.amount),
                balance: increment(payment.amount),
                payments: arrayRemove(payment),
              });
              batch.update(doc(db, "users", selectedStudentUid), {
                walletBalance: increment(payment.amount),
              });

              await batch.commit();
              Alert.alert(
                "Success",
                "Transaction deleted and balance reverted.",
              );
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Failed to delete transaction.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
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

      const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica'; padding: 20px; color: #1E293B; background: #fff; }
            .receipt-paper { max-width: 700px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative; }
            .letterhead { display:flex; flex-direction: column; align-items:center; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .school-name { font-size: 22px; font-weight: bold; text-transform: uppercase; margin: 0; }
            .contact { font-size: 10px; margin: 2px 0; }
            .title { text-align: center; font-size: 16px; font-weight: 900; text-decoration: underline; margin: 15px 0; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
            .label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 8px; font-size: 10px; text-align: left; }
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
            
            <div class="title">OFFICIAL RECEIPT</div>
            
            <div class="info-row"><span class="label">STUDENT:</span><span>${record.studentName}</span></div>
            <div class="info-row"><span class="label">CLASS:</span><span>${record.className || "N/A"}</span></div>
            <div class="info-row"><span class="label">PERIOD:</span><span>${record.term} ${record.academicYear}</span></div>
            <div class="info-row"><span class="label">DATE:</span><span>${moment().format("DD/MM/YYYY")}</span></div>

            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>REF #</th>
                  <th>PAYEE</th>
                  <th>PROCESSED BY</th>
                  <th style="text-align:right">AMOUNT (₵)</th>
                </tr>
              </thead>
              <tbody>
                ${(record.payments || [])
                  .map(
                    (p: any) => `
                  <tr>
                    <td>${moment(p.createdAt).format("DD/MM/YY")}</td>
                    <td>${p.receiptNo || "RC-" + String(p.createdAt).slice(-6)}</td>
                    <td>${p.receivedFrom || "Self"}</td>
                    <td>${p.updatedBy || "Admin"}</td>
                    <td style="text-align:right">${Number(p.amount).toFixed(2)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row"><span>ARREARS B/F:</span><span>₵ ${record.arrears?.toFixed(2)}</span></div>
              <div class="total-row"><span>TERM BILL:</span><span>₵ ${record.termBill?.toFixed(2)}</span></div>
              <div class="total-row"><span>TOTAL PAID:</span><span style="color: green">- ₵ ${record.amountPaid?.toFixed(2)}</span></div>
              <div class="total-row grand-total"><span>BALANCE DUE:</span><span>₵ ${record.balance?.toFixed(2)}</span></div>
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
      Alert.alert("Error", "Could not generate PDF receipt");
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

              {/* Payments Table */}
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 1.2 }]}>DATE / SERIAL</Text>
                  <Text style={[styles.th, { flex: 1.5 }]}>
                    PAYEE / PROCESSED BY
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
                      <Text style={styles.tdRef}>
                        {p.receiptNo || "RC-" + String(p.createdAt).slice(-6)}
                      </Text>
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.tdPayee}>
                        {p.receivedFrom || "Self"}
                      </Text>
                      <Text style={styles.tdAdmin}>
                        {p.updatedBy || "Admin"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.td,
                        { flex: 1, textAlign: "right", fontWeight: "900" },
                      ]}
                    >
                      ₵{Number(p.amount).toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeletePayment(p)}
                      style={styles.deleteBtn}
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

              <View style={styles.paperFooter}>
                <Text style={styles.footerText}>
                  Computer generated. Reverting transactions updates balances
                  instantly.
                </Text>
                <Text style={styles.copyrightText}>
                  © {moment().year()} {SCHOOL_CONFIG.fullName}
                </Text>
              </View>

              <View style={styles.watermark}>
                <SVGIcon
                  name="checkmark-done-circle"
                  size={120}
                  color="rgba(0,0,0,0.02)"
                />
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
  deleteBtn: { width: 40, alignItems: "center", justifyContent: "center" },
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
  watermark: { position: "absolute", bottom: 40, right: 20, opacity: 0.5 },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#475569",
    marginTop: 15,
  },
  emptySub: { fontSize: 13, color: "#94A3B8", marginTop: 5 },
});
