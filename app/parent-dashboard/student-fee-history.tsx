import { Picker } from "@react-native-picker/picker";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
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
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db } from "../../firebaseConfig";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";

const { width } = Dimensions.get("window");

export default function StudentFeeHistory() {
  const { studentId: paramStudentId } = useLocalSearchParams();
  const router = useRouter();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "afahjoy"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);

  const [loading, setLoading] = useState(true);
  const [fetchingRecord, setFetchingRecord] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(
    (paramStudentId as string) || "",
  );

  const [record, setRecord] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

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

  // Sync with global academic config
  useEffect(() => {
    if (!acadConfig.loading) {
      setSelectedYear(acadConfig.academicYear);
      setSelectedTerm(acadConfig.currentTerm);
    }
  }, [acadConfig]);

  useEffect(() => {
    if (!appUser || appUser.role !== "parent") return;
    const fetchChildren = async () => {
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
        if (list.length > 0) setSelectedChildId((prev) => prev || list[0].id);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchChildren();
  }, [appUser]);

  useEffect(() => {
    if (!selectedChildId) return;
    const loadStudentData = async () => {
      const studentDoc = await getDoc(doc(db, "users", selectedChildId));
      if (studentDoc.exists()) setStudentData(studentDoc.data() as any);
    };
    loadStudentData();
  }, [selectedChildId]);

  useEffect(() => {
    if (!selectedChildId || !selectedYear || !selectedTerm) return;
    setFetchingRecord(true);
    const cleanYear = selectedYear.replace(/\//g, "-");
    const cleanTerm = selectedTerm.replace(/\s/g, "");
    const recordId = `${selectedChildId}_${cleanYear}_${cleanTerm}`;
    const unsub = onSnapshot(doc(db, "studentFeeRecords", recordId), (snap) => {
      setRecord(snap.exists() ? (snap.data() as any) : null);
      setFetchingRecord(false);
    });
    return () => unsub();
  }, [selectedChildId, selectedYear, selectedTerm]);

  const generatePDF = async () => {
    if (!record || !studentData) return;

    // Attempt to embed logo
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

    const sName =
      `${studentData.profile?.firstName || ""} ${studentData.profile?.lastName || ""}`.trim();
    const html = `
       <html>
        <head>
          <style>
            body { font-family: 'Helvetica'; padding: 30px; color: #1E293B; background: #fff; }
            .receipt-container { max-width: 800px; margin: 0 auto; border: 2px solid #eee; padding: 40px; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${primary}; padding-bottom: 20px; display: flex; flex-direction: column; align-items: center; }
            .school-name { font-size: 28px; font-weight: 900; color: ${primary}; margin-bottom: 5px; text-transform: uppercase; }
            .school-motto { font-size: 14px; font-style: italic; color: #64748B; margin-bottom: 10px; }
            .school-contact { font-size: 12px; color: #94A3B8; line-height: 1.5; }
            .receipt-title { font-size: 22px; margin-top: 30px; font-weight: 900; color: ${secondary}; text-align: center; letter-spacing: 3px; text-decoration: underline; }
            .info-section { display: flex; justify-content: space-between; margin: 40px 0; padding: 20px; background: #F8FAFC; border-radius: 10px; }
            .info-column { flex: 1; }
            .info-label { font-weight: 800; color: #64748B; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 5px; }
            .info-value { font-size: 15px; font-weight: 700; color: #1E293B; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th { border-bottom: 2px solid #eee; padding: 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748B; }
            td { border-bottom: 1px solid #f5f5f5; padding: 15px; font-size: 13px; font-weight: 600; }
            .summary-box { margin-top: 40px; float: right; width: 300px; padding: 20px; background: #fdfdfd; border: 1px solid #eee; }
            .summary-item { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .grand-total { border-top: 2px solid ${primary}; padding-top: 15px; margin-top: 15px; font-size: 18px; font-weight: 900; color: ${primary}; }
            .footer { margin-top: 100px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px dashed #eee; padding-top: 30px; clear: both; }
            .stamp-box { margin-top: 50px; width: 150px; height: 150px; border: 2px dashed #eee; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #eee; border-radius: 50%; float: left; transform: rotate(-15deg); }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              ${logoImgHtml}
              <div class="school-name">${SCHOOL_CONFIG.fullName}</div>
              <div class="school-motto">${SCHOOL_CONFIG.motto}</div>
              <div class="school-contact">${SCHOOL_CONFIG.address}<br/>TEL: ${SCHOOL_CONFIG.hotline} | EMAIL: ${SCHOOL_CONFIG.email}</div>
            </div>
            
            <div class="receipt-title">OFFICIAL RECEIPT</div>
            
            <div class="info-section">
              <div class="info-column">
                <span class="info-label">Student Details</span>
                <div class="info-value">${sName}</div>
                <div style="font-size: 13px; color: #64748B;">ID: ${selectedChildId.slice(-8).toUpperCase()}</div>
              </div>
              <div class="info-column" style="text-align: right;">
                <span class="info-label">Academic Period</span>
                <div class="info-value">${record.term} | ${record.academicYear}</div>
                <div style="font-size: 13px; color: #64748B;">Class: ${record.className || "N/A"}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Transaction Date</th>
                  <th>Reference #</th>
                  <th>Received From</th>
                  <th style="text-align:right">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                ${(record.payments || [])
                  .map(
                    (p: any) => `
                  <tr>
                    <td>${moment(p.createdAt).format("DD/MM/YYYY")}</td>
                    <td>${p.receiptNo || "RC-" + String(p.createdAt).slice(-6)}</td>
                    <td>${p.receivedFrom || "Self"}</td>
                    <td style="text-align:right">₵ ${Number(p.amount).toFixed(2)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>

            <div class="stamp-box">OFFICIAL SCHOOL STAMP</div>

            <div class="summary-box">
              <div class="summary-item"><span>Arrears B/F:</span><span>₵ ${record.arrears?.toFixed(2)}</span></div>
              <div class="summary-item"><span>Current Term Bill:</span><span>₵ ${record.termBill?.toFixed(2)}</span></div>
              <div class="summary-item"><span>Total Paid:</span><span style="color: #10B981;">- ₵ ${record.amountPaid?.toFixed(2)}</span></div>
              <div class="summary-item grand-total"><span>BALANCE DUE:</span><span>₵ ${record.balance?.toFixed(2)}</span></div>
            </div>

            <div class="footer">
              <p>This is a computer generated document. No signature required.<br/>
              &copy; ${moment().year()} ${SCHOOL_CONFIG.fullName} | System powered by EduEaze</p>
            </div>
          </div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const fileName = `Fee_Statement_${sName.replace(/\s+/g, "_")}_${moment().format("DDMMYY")}.pdf`;

      if (Platform.OS !== "web") {
        // Move to a permanent-ish location with a nice name before sharing
        const newUri = (FileSystem as any).documentDirectory + fileName;
        await FileSystem.copyAsync({ from: uri, to: newUri });
        await Sharing.shareAsync(newUri, {
          mimeType: "application/pdf",
          dialogTitle: "Download Fee Statement",
          UTI: "com.adobe.pdf",
        });
      } else {
        // Force download on web
        const link = document.createElement("a");
        link.href = uri;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      showToast({ message: "Could not generate PDF statement", type: "error" });
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
      <LinearGradient colors={[primary, secondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>Financial Statement</Text>
            <Text style={styles.headerSub}>Transaction Ledger</Text>
          </View>
          <TouchableOpacity onPress={generatePDF} disabled={!record}>
            <SVGIcon
              name="cloud-download"
              size={24}
              color={!record ? "rgba(255,255,255,0.3)" : "#fff"}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <View style={[styles.pickerBox, { flex: 1.2 }]}>
            <Text style={styles.miniLabel}>
              ACADEMIC YEAR{" "}
              {selectedYear === acadConfig.academicYear ? "(CURRENT)" : ""}
            </Text>
            <Picker
              selectedValue={selectedYear}
              onValueChange={setSelectedYear}
              style={[
                styles.picker,
                Platform.OS === "web" &&
                  ({
                    color: "#fff",
                    backgroundColor: "transparent",
                    outline: "none",
                    border: "none",
                  } as any),
              ]}
              dropdownIconColor="#fff"
            >
              {availableYears.map((y) => (
                <Picker.Item
                  key={y}
                  label={y}
                  value={y}
                  color={Platform.OS === "web" ? "#000" : "#0F172A"}
                />
              ))}
            </Picker>
          </View>
          <View style={[styles.pickerBox, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.miniLabel}>
              TERM {selectedTerm === acadConfig.currentTerm ? "(CURRENT)" : ""}
            </Text>
            <Picker
              selectedValue={selectedTerm}
              onValueChange={setSelectedTerm}
              style={[
                styles.picker,
                Platform.OS === "web" &&
                  ({
                    color: "#fff",
                    backgroundColor: "transparent",
                    outline: "none",
                    border: "none",
                  } as any),
              ]}
              dropdownIconColor="#fff"
            >
              <Picker.Item
                label="Term 1"
                value="Term 1"
                color={Platform.OS === "web" ? "#000" : "#0F172A"}
              />
              <Picker.Item
                label="Term 2"
                value="Term 2"
                color={Platform.OS === "web" ? "#000" : "#0F172A"}
              />
              <Picker.Item
                label="Term 3"
                value="Term 3"
                color={Platform.OS === "web" ? "#000" : "#0F172A"}
              />
            </Picker>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {children.length > 1 && (
          <View style={styles.selectorWrapper}>
            <Text style={styles.sectionLabel}>SELECT CHILD</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorScroll}
            >
              {children.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedChildId(c.id)}
                  style={[
                    styles.childChip,
                    selectedChildId === c.id && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                >
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

        {fetchingRecord ? (
          <ActivityIndicator color={primary} style={{ marginTop: 40 }} />
        ) : record ? (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.receiptPaper}
          >
            {/* Visual Receipt UI */}
            <View style={styles.paperHeader}>
              <Image
                source={schoolLogo}
                style={styles.paperLogo}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.receiptSchoolName, { color: primary }]}>
                  {SCHOOL_CONFIG.fullName}
                </Text>
                <Text style={styles.receiptMotto}>{SCHOOL_CONFIG.motto}</Text>
              </View>
            </View>

            <View style={styles.paperDivider} />
            <Text style={styles.receiptTitleText}>OFFICIAL RECEIPT</Text>

            <View style={styles.paperInfoGrid}>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>STUDENT:</Text>
                <Text style={styles.paperInfoValue}>{record.studentName}</Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>CLASS:</Text>
                <Text style={styles.paperInfoValue}>
                  {record.className || "N/A"}
                </Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>PERIOD:</Text>
                <Text style={styles.paperInfoValue}>
                  {record.term} • {record.academicYear}
                </Text>
              </View>
              <View style={styles.paperInfoItem}>
                <Text style={styles.paperInfoLabel}>DATE:</Text>
                <Text style={styles.paperInfoValue}>
                  {moment().format("DD/MM/YYYY")}
                </Text>
              </View>
            </View>

            {/* Table */}
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1 }]}>DATE</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>REF #</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                  AMOUNT
                </Text>
              </View>

              {(record.payments || []).length === 0 ? (
                <Text style={styles.noPayments}>No transactions recorded</Text>
              ) : (
                record.payments.map((p: any, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.td, { flex: 1 }]}>
                      {moment(p.createdAt).format("DD/MM/YY")}
                    </Text>
                    <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={1}>
                      {p.receiptNo || "RC-" + String(p.createdAt).slice(-6)}
                    </Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>
                      ₵{Number(p.amount).toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Summary */}
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
                <Text style={[styles.grandTotalValue, { color: primary }]}>
                  ₵ {record.balance?.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.paperFooter}>
              <Text style={styles.footerNote}>
                Computer generated. No signature required.
              </Text>
              <Text style={styles.footerCopyright}>
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

            <TouchableOpacity
              onPress={generatePDF}
              style={[styles.printBtn, { backgroundColor: primary }]}
            >
              <SVGIcon name="download" size={24} color="#fff" />
              <Text style={styles.printBtnText}>Download Official PDF</Text>
            </TouchableOpacity>
          </Animatable.View>
        ) : (
          selectedChildId && (
            <View style={styles.emptyContainer}>
              <SVGIcon name="alert-circle" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No record found</Text>
              <Text style={styles.emptySub}>
                No financial data exists for this student in {selectedTerm}{" "}
                {selectedYear}.
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingBottom: 25,
    ...SHADOWS.medium,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: Platform.OS === "ios" ? 10 : 40,
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
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
  logoMini: { width: 32, height: 32 },
  filterRow: { flexDirection: "row", paddingHorizontal: 25, gap: 10 },
  pickerBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    height: 60,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 5,
  },
  picker: { height: 40, color: "#fff", marginLeft: -10, marginTop: 15 },
  miniLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(255,255,255,0.8)",
    position: "absolute",
    top: 8,
    left: 14,
    zIndex: 1,
    letterSpacing: 0.5,
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

  // Real Receipt UI Styles
  receiptPaper: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 25,
    ...SHADOWS.medium,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    minHeight: 600,
    position: "relative",
  },
  paperHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  paperLogo: { width: 50, height: 50, marginRight: 15 },
  receiptSchoolName: {
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  receiptMotto: { fontSize: 10, fontStyle: "italic", color: "#64748B" },
  paperDivider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
  receiptTitleText: {
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
  paperInfoItem: { width: "48%" },
  paperInfoLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8" },
  paperInfoValue: { fontSize: 11, fontWeight: "700", color: "#1E293B" },

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
  },
  td: { fontSize: 11, fontWeight: "600", color: "#475569" },
  noPayments: {
    textAlign: "center",
    padding: 20,
    color: "#94A3B8",
    fontSize: 12,
    fontStyle: "italic",
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
    width: 100,
    textAlign: "right",
  },

  paperFooter: { marginTop: 50, alignItems: "center" },
  footerNote: { fontSize: 9, color: "#94A3B8", fontStyle: "italic" },
  footerCopyright: {
    fontSize: 9,
    fontWeight: "800",
    color: "#CBD5E1",
    marginTop: 4,
  },

  printBtn: {
    marginTop: 30,
    height: 60,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    ...SHADOWS.medium,
  },
  printBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  watermark: { position: "absolute", bottom: 100, right: 20, opacity: 0.5 },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#475569",
    marginTop: 15,
  },
  emptySub: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
});
