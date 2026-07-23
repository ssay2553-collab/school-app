import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { SHADOWS } from "../../constants/theme";

type ReportType = "End of Term" | "Mid-Term" | "Mock Exams";

interface SubjectInfo {
  name: string;
  status: string;
  reportType: ReportType;
  hasBehavioral?: boolean;
}

interface ScoreFilterSectionProps {
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  selectedYear: string;
  term: string;
  selectedReportType: ReportType;
  setSelectedReportType: (type: ReportType) => void;
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  classes: { id: string; name: string }[];
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  subjects: SubjectInfo[];
  loadSubmission: () => void;
  listLoading: boolean;
  recordId: string | null;
  primary: string;
}

export const ScoreFilterSection = ({
  showFilters,
  setShowFilters,
  selectedYear,
  term,
  selectedReportType,
  setSelectedReportType,
  selectedClassId,
  setSelectedClassId,
  classes,
  selectedSubject,
  setSelectedSubject,
  subjects,
  loadSubmission,
  listLoading,
  recordId,
  primary,
}: ScoreFilterSectionProps) => {
  return (
    <Animatable.View animation="fadeInDown" style={styles.filterSection}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setShowFilters(!showFilters)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: primary + "10" }]}>
          <SVGIcon name="funnel" size={18} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Filter Records</Text>
          {!showFilters && recordId && (
            <Text style={styles.filterSummary} numberOfLines={1}>
              {classes.find((c) => c.id === selectedClassId)?.name || selectedClassId} • {selectedSubject}
            </Text>
          )}
        </View>
        <View style={styles.chevronBox}>
          <SVGIcon
            name={showFilters ? "chevron-up" : "chevron-down"}
            size={20}
            color="#94A3B8"
          />
        </View>
      </TouchableOpacity>

      {showFilters && (
        <Animatable.View animation="fadeIn" duration={400} style={styles.expandedContent}>
          <View style={styles.lockedConfigRow}>
            <View style={styles.lockedConfigItem}>
              <Text style={styles.miniLabel}>ACADEMIC YEAR</Text>
              <View style={styles.lockedBadge}>
                <Text style={[styles.lockedBadgeText, { color: primary }]}>
                  {selectedYear || "---"}
                </Text>
              </View>
            </View>
            <View style={styles.lockedConfigItem}>
              <Text style={styles.miniLabel}>CURRENT TERM</Text>
              <View style={styles.lockedBadge}>
                <Text style={[styles.lockedBadgeText, { color: primary }]}>{term || "---"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.pickerGrid}>
            <View style={styles.pickerBox}>
              <Text style={styles.miniLabel}>REPORT TYPE</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedReportType}
                  onValueChange={(v) => setSelectedReportType(v as ReportType)}
                  style={styles.picker}
                  dropdownIconColor={primary}
                >
                  <Picker.Item label="End of Term" value="End of Term" />
                  <Picker.Item label="Mid-Term" value="Mid-Term" />
                  <Picker.Item label="Mock Exams" value="Mock Exams" />
                </Picker>
              </View>
            </View>

            <View style={styles.pickerBox}>
              <Text style={styles.miniLabel}>TARGET CLASS</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedClassId}
                  onValueChange={setSelectedClassId}
                  style={styles.picker}
                  dropdownIconColor={primary}
                >
                  {classes.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={[styles.pickerBox, { width: "100%", marginTop: 12 }]}>
            <Text style={styles.miniLabel}>SUBJECT SUBMISSION</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSubject}
                onValueChange={setSelectedSubject}
                style={styles.picker}
                dropdownIconColor={primary}
              >
                {subjects.length > 0 ? (
                  subjects.map((s) => (
                    <Picker.Item
                      key={s.name}
                      label={`${s.name} (${s.status.toUpperCase()})`}
                      value={s.name}
                    />
                  ))
                ) : (
                  <Picker.Item label="No Submissions Found" value="" />
                )}
              </Picker>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loadBtn, { backgroundColor: primary }]}
            onPress={() => {
              loadSubmission();
              setShowFilters(false);
            }}
            disabled={listLoading}
          >
            {listLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.loadBtnText}>Load Records</Text>
                <SVGIcon
                  name="cloud-download"
                  size={18}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              </View>
            )}
          </TouchableOpacity>
        </Animatable.View>
      )}
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  filterSection: {
    padding: 16,
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandedContent: {
    marginTop: 8,
  },
  filterSummary: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  pickerGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  lockedConfigRow: { flexDirection: "row", gap: 12, marginBottom: 0, marginTop: 12 },
  lockedConfigItem: { flex: 1 },
  lockedBadge: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 48,
    justifyContent: "center",
  },
  lockedBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  pickerBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingTop: 20,
    overflow: 'hidden'
  },
  pickerContainer: {
    height: 40,
    justifyContent: 'center'
  },
  miniLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    position: "absolute",
    top: 8,
    left: 15,
    zIndex: 10,
    letterSpacing: 0.5,
  },
  picker: {
    color: "#1E293B",
    fontSize: 14,
    fontWeight: '700',
    ...Platform.select({
      web: {
        height: 40,
        backgroundColor: "transparent",
        borderWidth: 0,
        outlineStyle: "none",
        paddingHorizontal: 10
      },
      android: {
        height: 40,
      }
    }),
  } as any,
  loadBtn: {
    height: 52,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
