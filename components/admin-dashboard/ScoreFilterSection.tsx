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
              <View style={[styles.lockedIcon, { backgroundColor: primary + "10" }]}>
                <SVGIcon name="calendar" size={16} color={primary} />
              </View>
              <View>
                <Text style={styles.miniLabelStatic}>ACADEMIC YEAR</Text>
                <Text style={[styles.lockedVal, { color: primary }]}>{selectedYear || "---"}</Text>
              </View>
            </View>
            <View style={styles.lockedConfigItem}>
              <View style={[styles.lockedIcon, { backgroundColor: "#F59E0B15" }]}>
                <SVGIcon name="time" size={16} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.miniLabelStatic}>CURRENT TERM</Text>
                <Text style={[styles.lockedVal, { color: "#F59E0B" }]}>{term || "---"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.reportTypeRow}>
            {(["Mid-Term", "End of Term", "Mock Exams"] as ReportType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeChip,
                  selectedReportType === type && { backgroundColor: primary, borderColor: primary }
                ]}
                onPress={() => setSelectedReportType(type)}
              >
                <Text style={[
                  styles.typeChipText,
                  selectedReportType === type && { color: "#fff" }
                ]}>
                  {type === "End of Term" ? "Final" : type === "Mid-Term" ? "Mid" : "Mock"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.pickerGrid}>
            <View style={styles.pickerBox}>
              <Text style={styles.floatingLabel}>TARGET CLASS</Text>
              <View style={styles.pickerWrapper}>
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

            <View style={styles.pickerBox}>
              <Text style={styles.floatingLabel}>SUBJECT</Text>
              <View style={styles.pickerWrapper}>
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
                        label={s.name}
                        value={s.name}
                      />
                    ))
                  ) : (
                    <Picker.Item label="None" value="" />
                  )}
                </Picker>
              </View>
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
    marginTop: 16,
  },
  lockedConfigRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedConfigItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  lockedIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniLabelStatic: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  lockedVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  reportTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  pickerBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingTop: 16,
    height: 60,
  },
  pickerWrapper: {
    height: 40,
    marginTop: -4,
    justifyContent: 'center',
  },
  floatingLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94A3B8",
    position: "absolute",
    top: 10,
    left: 12,
    zIndex: 10,
    letterSpacing: 0.8,
  },
  picker: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: '800',
    ...Platform.select({
      web: {
        height: 35,
        backgroundColor: "transparent",
        borderWidth: 0,
        outlineStyle: "none",
        paddingHorizontal: 12
      },
      android: {
        height: 45,
        width: '100%',
        marginLeft: 0
      }
    }),
  } as any,
  loadBtn: {
    height: 52,
    borderRadius: 16,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
});
