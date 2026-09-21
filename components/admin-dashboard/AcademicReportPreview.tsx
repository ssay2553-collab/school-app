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
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import SVGIcon from "../SVGIcon";
import { EndOfTermPreview } from "./reports/EndOfTermPreview";
import { MockPreview } from "./reports/MockPreview";
import { AssessmentPreview } from "./reports/AssessmentPreview";

interface AcademicReportPreviewProps {
  primary: string;
  schoolLogo: any;
  reportType: string;
  studentName: string;
  className: string;
  classIdState: string;
  academicYearState: string;
  termState: string;
  reportNumber?: number;
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
  isReportApproved?: boolean;
  generating?: boolean;
  generatePDF?: () => void;
  refreshing?: boolean;
  refresh?: () => void;
  hideDownload?: boolean;
}

export const AcademicReportPreview: React.FC<AcademicReportPreviewProps> = (props) => {
  const {
    primary,
    schoolLogo,
    reportType,
    isReportApproved = false,
    generating,
    generatePDF,
    refreshing,
    refresh,
    hideDownload = false,
  } = props;

  const renderContent = () => {
    if (reportType === "End of Term") {
      return <EndOfTermPreview {...props} />;
    } else if (reportType === "Mock Exams") {
      return <MockPreview {...props} />;
    } else {
      return <AssessmentPreview {...props} />;
    }
  };

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
        {/* Draft Watermark */}
        {!isReportApproved && (
          <View style={styles.watermarkContainer} pointerEvents="none">
            <Text style={styles.watermarkText}>DRAFT</Text>
          </View>
        )}

        {/* Letterhead */}
        <View style={styles.paperLetterhead}>
          {schoolLogo && (
            <Image
              source={schoolLogo}
              style={styles.paperLogo}
              resizeMode="contain"
            />
          )}
          <View style={styles.paperSchoolInfoContainer}>
            <Text style={[styles.paperSchoolName, { color: primary }]}>
              {SCHOOL_CONFIG.fullName.toUpperCase()}
            </Text>
            {SCHOOL_CONFIG.motto && (
              <Text style={styles.paperSchoolMotto}>
                "{SCHOOL_CONFIG.motto}"
              </Text>
            )}
            <Text style={styles.paperSchoolInfo}>{SCHOOL_CONFIG.address}</Text>
            <Text style={styles.paperSchoolContact}>
              {SCHOOL_CONFIG.hotline ? `Tel: ${SCHOOL_CONFIG.hotline}` : ""}
              {SCHOOL_CONFIG.hotline && SCHOOL_CONFIG.email ? "  |  " : ""}
              {SCHOOL_CONFIG.email ? `Email: ${SCHOOL_CONFIG.email}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.headerSeparatorContainer}>
          <View
            style={[styles.headerSeparatorPrimary, { backgroundColor: primary }]}
          />
          <View
            style={[
              styles.headerSeparatorSecondary,
              { backgroundColor: "#fb7185" },
            ]}
          />
        </View>

        {renderContent()}

        {!hideDownload && (
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: primary }]}
            onPress={generatePDF}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <SVGIcon name="download" size={20} color="#fff" />
                <Text style={styles.downloadBtnText}>
                  Generate Official PDF
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
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
    position: "relative",
    overflow: "hidden",
  },
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    transform: [{ rotate: "-35deg" }],
  },
  watermarkText: {
    fontSize: 120,
    fontWeight: "900",
    color: "rgba(226, 232, 240, 0.4)",
    letterSpacing: 10,
  },
  paperLetterhead: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  paperLogo: { width: 80, height: 80, marginBottom: 8 },
  paperSchoolInfoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  paperSchoolName: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  paperSchoolMotto: {
    fontSize: 10,
    fontStyle: "italic",
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  paperSchoolInfo: {
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
    textAlign: "center",
  },
  paperSchoolContact: {
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
    textAlign: "center",
  },
  headerSeparatorContainer: {
    marginBottom: 15,
  },
  headerSeparatorPrimary: {
    height: 2,
    width: "100%",
  },
  headerSeparatorSecondary: {
    height: 1,
    width: "100%",
    marginTop: 2,
  },
  downloadBtn: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "900",
    marginLeft: 10,
    fontSize: 14,
  },
});
