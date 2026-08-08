import React from "react";
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";

interface AcademicReportPreviewProps {
    primary: string;
    schoolLogo: any;
    reportType: string;
    studentName: string;
    className: string;
    classIdState: string;
    academicYearState: string;
    overallPosition: string;
    attendance: string;
    isFullReport: boolean;
    subjectsData: any[];
    TRS: string | number;
    TAS: string | number;
    AGGREGATE: string | number;
    isPreschool: boolean;
    conduct: string;
    attitude: string;
    interest: string;
    physicalDev: any;
    preschoolAssessments: Record<string, string>;
    teacherRemarks: string;
    adminRemarks: string;
    nextTermBegins: string;
    promotedTo: string;
    adminSig: any;
    generating: boolean;
    generatePDF: () => void;
    refreshing?: boolean;
    refresh?: () => void;
}

export const AcademicReportPreview: React.FC<AcademicReportPreviewProps> = ({
    primary,
    schoolLogo,
    reportType,
    studentName,
    className,
    classIdState,
    academicYearState,
    overallPosition,
    attendance,
    isFullReport,
    subjectsData,
    TRS,
    TAS,
    AGGREGATE,
    isPreschool,
    conduct,
    attitude,
    interest,
    physicalDev,
    preschoolAssessments,
    teacherRemarks,
    adminRemarks,
    nextTermBegins,
    promotedTo,
    adminSig,
    generating,
    generatePDF,
    refreshing,
    refresh,
}) => {
    return (
        <ScrollView
            contentContainerStyle={{ padding: 15 }}
            refreshControl={
                refresh && (
                    <RefreshControl
                        refreshing={refreshing || false}
                        onRefresh={refresh}
                        colors={[primary]}
                        tintColor={primary}
                    />
                )
            }
        >
            <Animatable.View animation="fadeInUp" duration={600} style={styles.paper}>
                {/* Letterhead */}
                <View style={styles.paperLetterhead}>
                    <Image source={schoolLogo} style={styles.paperLogo} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.paperSchoolName}>{SCHOOL_CONFIG.fullName}</Text>
                        <Text style={styles.paperReportType}>{reportType.toUpperCase()} PROGRESS REPORT</Text>
                        <Text style={styles.paperSchoolInfo}>{SCHOOL_CONFIG.hotline} | {SCHOOL_CONFIG.email}</Text>
                    </View>
                </View>

                <View style={styles.paperDivider} />

                <View style={styles.paperInfoGrid}>
                    <View style={styles.paperInfoItem}>
                        <Text style={styles.paperInfoLabel}>STUDENT:</Text>
                        <Text style={styles.paperInfoValue}>{studentName || "N/A"}</Text>
                    </View>
                    <View style={styles.paperInfoItem}>
                        <Text style={styles.paperInfoLabel}>CLASS:</Text>
                        <Text style={styles.paperInfoValue}>{className || classIdState}</Text>
                    </View>
                    <View style={styles.paperInfoItem}>
                        <Text style={styles.paperInfoLabel}>YEAR:</Text>
                        <Text style={styles.paperInfoValue}>{academicYearState}</Text>
                    </View>
                    <View style={styles.paperInfoItem}>
                        <Text style={styles.paperInfoLabel}>POSITION:</Text>
                        <Text style={styles.paperInfoValue}>{overallPosition}</Text>
                    </View>
                    <View style={styles.paperInfoItem}>
                        <Text style={styles.paperInfoLabel}>ATTENDANCE:</Text>
                        <Text style={styles.paperInfoValue}>{attendance || "N/A"}</Text>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.paperTable}>
                    <View style={styles.paperTableHeader}>
                        <Text style={[styles.paperHeaderCell, { flex: 2, textAlign: "left" }]}>SUBJECT</Text>
                        {isFullReport && (
                            <>
                                <Text style={styles.paperHeaderCell}>CLS</Text>
                                <Text style={styles.paperHeaderCell}>EXM</Text>
                            </>
                        )}
                        <Text style={styles.paperHeaderCell}>TOT</Text>
                        <Text style={styles.paperHeaderCell}>GRD</Text>
                        <Text style={[styles.paperHeaderCell, { flex: 1.5 }]}>REMARK</Text>
                    </View>
                    {subjectsData.length === 0 ? (
                        <View style={{ padding: 20, alignItems: "center" }}>
                            <Text style={{ color: "#94A3B8" }}>No records found</Text>
                        </View>
                    ) : (
                        subjectsData.map((s, i) => (
                            <View key={i} style={[styles.paperTableRow, i % 2 !== 0 && { backgroundColor: "#F8FAFC" }]}>
                                <Text style={[styles.paperCell, { flex: 2, textAlign: "left", fontWeight: "800" }]}>{s.subject}</Text>
                                {isFullReport && (
                                    <>
                                        <Text style={styles.paperCell}>{isNaN(Number(s.classScore)) ? s.classScore : Number(s.classScore).toFixed(0)}</Text>
                                        <Text style={styles.paperCell}>{isNaN(Number(s.examsScore)) ? s.examsScore : Number(s.examsScore).toFixed(0)}</Text>
                                    </>
                                )}
                                <Text style={[styles.paperCell, { fontWeight: "900", color: primary }]}>{isNaN(Number(s.total)) ? s.total : Number(s.total).toFixed(1)}</Text>
                                <Text style={[styles.paperCell, { fontWeight: "700" }]}>{s.grade}</Text>
                                <Text style={[styles.paperCell, { flex: 1.5, fontSize: 8 }]}>{s.remark}</Text>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.paperSummaryRow}>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.paperSummaryLabel, { fontSize: 9 }]}>
                            TRS: <Text style={{ color: "#1E293B" }}>{TRS}</Text> | TAS: <Text style={{ color: "#1E293B" }}>{TAS}</Text>
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                            <Text style={styles.paperSummaryLabel}>OVERALL AGGREGATE:</Text>
                            <Text style={styles.paperSummaryValue}>{AGGREGATE}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.paperRemarksSection}>
                    {isFullReport && !isPreschool && (
                        <>
                            <Text style={styles.paperSectionTitle}>BEHAVIORAL RATINGS</Text>
                            <Text style={styles.paperRemarkLine}>
                                Conduct: <Text style={{ fontWeight: "700" }}>{conduct}</Text> |
                                Attitude: <Text style={{ fontWeight: "700" }}>{attitude}</Text> |
                                Interest: <Text style={{ fontWeight: "700" }}>{interest}</Text>
                            </Text>
                        </>
                    )}


                    <Text style={[styles.paperSectionTitle, { marginTop: 10 }]}>TEACHER'S REMARKS</Text>
                    <Text style={styles.paperRemarkText}>{teacherRemarks || "Satisfactory performance."}</Text>

                    <Text style={[styles.paperSectionTitle, { marginTop: 10 }]}>ADMIN REMARKS</Text>
                    <Text style={styles.paperRemarkText}>{adminRemarks || "Keep up the hard work."}</Text>

                    <View style={styles.paperNextTerm}>
                        <Text style={styles.paperNextTermLabel}>NEXT TERM BEGINS:</Text>
                        <Text style={styles.paperNextTermVal}>{nextTermBegins || "TBA"}</Text>
                    </View>

                    {promotedTo ? (
                        <View style={[styles.paperNextTerm, { marginTop: 5 }]}>
                            <Text style={styles.paperNextTermLabel}>PROMOTED TO:</Text>
                            <Text style={[styles.paperNextTermVal, { color: "#10b981" }]}>{promotedTo}</Text>
                        </View>
                    ) : null}

                    <View style={styles.paperSigRow}>
                        <View style={{ flex: 1 }} />
                        <View style={styles.paperSigItem}>
                            {adminSig ? (
                                <Image
                                    source={typeof adminSig === 'string' ? { uri: adminSig } : adminSig}
                                    style={styles.paperSigImg}
                                />
                            ) : (
                                <View style={styles.paperSigSpace} />
                            )}
                            <View style={styles.paperSigLine} />
                            <Text style={styles.paperSigLabel}>Head of Institution</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: primary }]} onPress={generatePDF} disabled={generating}>
                    {generating ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <SVGIcon name="download" size={20} color="#fff" />
                            <Text style={styles.downloadBtnText}>Generate Official PDF</Text>
                        </>
                    )}
                </TouchableOpacity>
            </Animatable.View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    paper: {
        backgroundColor: "#fff",
        padding: 20,
        borderRadius: 4,
        ...SHADOWS.medium,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    paperLetterhead: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
    paperLogo: { width: 50, height: 50, marginRight: 15 },
    paperSchoolName: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
    paperSchoolInfo: { fontSize: 8, fontWeight: "600", color: "#64748B", marginTop: 2 },
    paperReportType: { fontSize: 10, fontWeight: "800", color: "#64748B", marginTop: 2 },
    paperDivider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
    paperInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 15 },
    paperInfoItem: { width: "47%", marginBottom: 5 },
    paperInfoLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8" },
    paperInfoValue: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
    paperTable: { borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 15 },
    paperTableHeader: { flexDirection: "row", backgroundColor: "#1E293B", borderBottomWidth: 1, borderColor: "#E2E8F0" },
    paperTableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#F1F5F9" },
    paperCell: { flex: 1, padding: 8, fontSize: 10, textAlign: "center", color: "#475569" },
    paperHeaderCell: { flex: 1, padding: 8, fontSize: 10, textAlign: "center", color: "#fff", fontWeight: "900" },
    paperSummaryRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 15 },
    paperSummaryLabel: { fontSize: 10, fontWeight: "900", color: "#64748B" },
    paperSummaryValue: { fontSize: 18, fontWeight: "900", color: "#ef4444" },
    paperRemarksSection: { borderTopWidth: 1, borderColor: "#E2E8F0", paddingTop: 15, marginBottom: 15 },
    paperSectionTitle: { fontSize: 9, fontWeight: "900", color: "#1E293B", textDecorationLine: "underline", marginBottom: 5 },
    paperRemarkLine: { fontSize: 11, color: "#475569" },
    paperRemarkText: { fontSize: 11, color: "#475569", fontStyle: "italic" },
    paperNextTerm: { flexDirection: "row", marginTop: 10, gap: 5 },
    paperNextTermLabel: { fontSize: 10, fontWeight: "900" },
    paperNextTermVal: { fontSize: 10, fontWeight: "700", color: "#2e86de" },
    paperSigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 20 },
    paperSigItem: { flex: 1, alignItems: "center" },
    paperSigImg: { width: "100%", height: 80, resizeMode: "contain" },
    paperSigSpace: { height: 80 },
    paperSigLine: { width: "100%", height: 1, backgroundColor: "#1E293B", marginVertical: 4 },
    paperSigLabel: { fontSize: 8, fontWeight: "800", color: "#64748B" },
    downloadBtn: { flexDirection: "row", padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
    downloadBtnText: { color: "#fff", fontWeight: "900", marginLeft: 10, fontSize: 14 },
});
