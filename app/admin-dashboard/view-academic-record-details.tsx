import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { AcademicReportPreview } from "../../components/admin-dashboard/AcademicReportPreview";
import { useAcademicRecordDetails, ReportType } from "../../hooks/admin-dashboard/useAcademicRecordDetails";

export default function ViewAcademicRecordDetails() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const reportType = (params.reportType as ReportType) || "End of Term";

    const {
        loading,
        generating,
        studentName,
        className,
        subjectsData,
        adminRemarks,
        teacherRemarks,
        conduct,
        attitude,
        interest,
        promotedTo,
        nextTermBegins,
        attendance,
        adminSig,
        overallPosition,
        isPreschool,
        preschoolAssessments,
        physicalDev,
        primary,
        schoolLogo,
        isFullReport,
        TRS,
        TAS,
        AGGREGATE,
        generatePDF,
        classIdState,
        academicYearState
    } = useAcademicRecordDetails();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <SVGIcon name="chevron-left" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Academic Record Preview</Text>
                <TouchableOpacity
                    onPress={generatePDF}
                    style={[styles.downloadHeaderBtn, { backgroundColor: primary }]}
                    disabled={generating}
                >
                    {generating ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <SVGIcon name="download" size={18} color="#fff" />
                            <Text style={styles.downloadHeaderText}>PDF</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primary} />
                </View>
            ) : (
                <AcademicReportPreview
                    primary={primary}
                    schoolLogo={schoolLogo}
                    reportType={reportType}
                    studentName={studentName}
                    className={className}
                    classIdState={classIdState}
                    academicYearState={academicYearState}
                    overallPosition={overallPosition}
                    attendance={attendance}
                    isFullReport={isFullReport}
                    subjectsData={subjectsData}
                    TRS={TRS}
                    TAS={TAS}
                    AGGREGATE={AGGREGATE}
                    isPreschool={isPreschool}
                    conduct={conduct}
                    attitude={attitude}
                    interest={interest}
                    physicalDev={physicalDev}
                    preschoolAssessments={preschoolAssessments}
                    teacherRemarks={teacherRemarks}
                    adminRemarks={adminRemarks}
                    nextTermBegins={nextTermBegins}
                    promotedTo={promotedTo}
                    adminSig={adminSig}
                    generating={generating}
                    generatePDF={generatePDF}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F1F5F9" },
    navBar: {
        height: 65,
        backgroundColor: "#fff",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderColor: "#E2E8F0",
    },
    backBtn: { padding: 8 },
    navTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    downloadHeaderBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    downloadHeaderText: { color: "#fff", fontWeight: "800", fontSize: 12 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
