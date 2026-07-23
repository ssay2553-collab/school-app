import moment from "moment";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { ReportType } from "../../hooks/admin-dashboard/useViewAcademicRecords";

// Guarded import for native-only library
const DateTimePicker =
  Platform.OS !== "web"
    ? require("@react-native-community/datetimepicker").default
    : null;

interface AcademicFilterCardProps {
  selectedYear: string;
  setSelectedYear: (y: string) => void;
  availableYears: string[];
  acadConfig: any;
  term: string;
  setTerm: (t: any) => void;
  selectedReportType: ReportType;
  setSelectedReportType: (t: ReportType) => void;
  classes: any[];
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  availableSubjects: string[];
  selectedSubject: string;
  setSelectedSubject: (s: string) => void;
  fetchingSubjects: boolean;
  listLoading: boolean;
  loadData: () => void;
  primary: string;
  globalNextTermBegins: string;
  setGlobalNextTermBegins: (v: string) => void;
  globalPromotedTo: string;
  setGlobalPromotedTo: (v: string) => void;
  showGlobalNextTermPicker: boolean;
  setShowGlobalNextTermPicker: (v: boolean) => void;
}

export const AcademicFilterCard = ({
  selectedYear,
  setSelectedYear,
  availableYears,
  acadConfig,
  term,
  setTerm,
  selectedReportType,
  setSelectedReportType,
  classes,
  selectedClassId,
  setSelectedClassId,
  availableSubjects,
  selectedSubject,
  setSelectedSubject,
  fetchingSubjects,
  listLoading,
  loadData,
  primary,
  globalNextTermBegins,
  setGlobalNextTermBegins,
  globalPromotedTo,
  setGlobalPromotedTo,
  showGlobalNextTermPicker,
  setShowGlobalNextTermPicker,
}: AcademicFilterCardProps) => {
  return (
    <Animatable.View animation="fadeInDown" style={styles.filterCard}>
      <Text style={styles.sectionLabel}>LEDGER SCOPE</Text>

      <Text style={styles.bubbleLabel}>
        ACADEMIC YEAR {selectedYear === acadConfig.academicYear && "(CURRENT)"}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bubbleRow}
      >
        {availableYears.map((y) => (
          <TouchableOpacity
            key={y}
            onPress={() => setSelectedYear(y)}
            style={[
              styles.bubble,
              selectedYear === y && {
                backgroundColor: primary,
                borderColor: primary,
              },
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                selectedYear === y && { color: "#fff" },
              ]}
            >
              {y}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.bubbleLabel}>
        TERM {term === acadConfig.currentTerm && "(CURRENT)"}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bubbleRow}
      >
        {["Term 1", "Term 2", "Term 3"].map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTerm(t as any)}
            style={[
              styles.bubble,
              term === t && {
                backgroundColor: primary,
                borderColor: primary,
              },
            ]}
          >
            <Text style={[styles.bubbleText, term === t && { color: "#fff" }]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.bubbleLabel}>REPORT TYPE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bubbleRow}
      >
        {(["End of Term", "Mid-Term", "Mock Exams"] as ReportType[]).map(
          (type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setSelectedReportType(type)}
              style={[
                styles.bubble,
                selectedReportType === type && {
                  backgroundColor: primary,
                  borderColor: primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  selectedReportType === type && { color: "#fff" },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      <Text style={styles.bubbleLabel}>CLASSROOM</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bubbleRow}
      >
        {classes.map((cls) => (
          <TouchableOpacity
            key={cls.id}
            onPress={() => setSelectedClassId(cls.id)}
            style={[
              styles.bubble,
              selectedClassId === cls.id && {
                backgroundColor: primary,
                borderColor: primary,
              },
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                selectedClassId === cls.id && { color: "#fff" },
              ]}
            >
              {cls.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedClassId && availableSubjects.length > 0 && (
        <>
          <Text style={styles.bubbleLabel}>APPROVED SUBJECTS</Text>
          <View style={styles.subjectSelectBox}>
            {fetchingSubjects ? (
              <ActivityIndicator color={primary} size="small" />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bubbleRow}
              >
                {availableSubjects.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubject(sub)}
                    style={[
                      styles.subBubble,
                      selectedSubject === sub && {
                        backgroundColor: "#f0f9ff",
                        borderColor: primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subBubbleText,
                        selectedSubject === sub && {
                          color: primary,
                          fontWeight: "bold",
                        },
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </>
      )}

      {selectedClassId && availableSubjects.length === 0 && !fetchingSubjects && (
        <View style={styles.noApprovedBox}>
          <SVGIcon name="alert-circle" size={20} color="#94A3B8" />
          <Text style={styles.noApprovedText}>
            No approved records for this selection.
          </Text>
        </View>
      )}

      <View style={styles.configSection}>
        <View style={styles.configGrid}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bubbleLabel}>NEXT TERM BEGINS (GLOBAL)</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={
                  moment(globalNextTermBegins, "Do MMM, YYYY").isValid()
                    ? moment(globalNextTermBegins, "Do MMM, YYYY").format("YYYY-MM-DD")
                    : ""
                }
                onChange={(e) => {
                  const date = e.target.value;
                  if (date) {
                    setGlobalNextTermBegins(moment(date).format("Do MMM, YYYY"));
                  }
                }}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  fontSize: 14,
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "#F8FAFC",
                  color: "#1E293B",
                  fontWeight: "600",
                  height: 48,
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.configInput}
                onPress={() => setShowGlobalNextTermPicker(true)}
              >
                <Text
                  style={{
                    color: globalNextTermBegins ? "#1E293B" : "#94A3B8",
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {globalNextTermBegins || "Tap to select"}
                </Text>
              </TouchableOpacity>
            )}

            {showGlobalNextTermPicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={
                  moment(globalNextTermBegins, "Do MMM, YYYY").isValid()
                    ? moment(globalNextTermBegins, "Do MMM, YYYY").toDate()
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={(event: any, selectedDate?: Date) => {
                  setShowGlobalNextTermPicker(false);
                  if (selectedDate) {
                    setGlobalNextTermBegins(
                      moment(selectedDate).format("Do MMM, YYYY"),
                    );
                  }
                }}
              />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.bubbleLabel}>PROMOTED TO (GLOBAL)</Text>
            <TextInput
              style={styles.configInput}
              placeholder="e.g. Basic 5"
              value={globalPromotedTo}
              onChangeText={setGlobalPromotedTo}
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={loadData}
        disabled={listLoading || !selectedSubject}
        style={[
          styles.searchBtn,
          { backgroundColor: primary },
          (!selectedSubject || listLoading) && { opacity: 0.6 },
        ]}
      >
        {listLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.btnRow}>
            <Text style={styles.searchBtnText}>View Ledger</Text>
            <SVGIcon name="arrow-forward" color="#fff" size={20} />
          </View>
        )}
      </TouchableOpacity>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  filterCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 25,
    padding: 20,
    ...SHADOWS.medium,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  bubbleLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 8,
    marginTop: 5,
  },
  bubbleRow: { paddingBottom: 12, gap: 10 },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bubbleText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  subjectSelectBox: { minHeight: 60, justifyContent: "center" },
  subBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 5,
  },
  subBubbleText: { fontSize: 13, color: "#64748B" },
  noApprovedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  noApprovedText: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  configSection: {
    marginTop: 10,
    marginBottom: 5,
  },
  configGrid: {
    flexDirection: "row",
    gap: 12,
  },
  configInput: {
    height: 48,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    justifyContent: "center",
  },
  searchBtn: {
    height: 56,
    borderRadius: 18,
    marginTop: 15,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 15,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  bulkBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
