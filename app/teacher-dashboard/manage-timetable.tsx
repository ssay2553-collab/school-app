import { Picker } from "@react-native-picker/picker";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Modal,
  FlatList,
  BackHandler,
  Alert
} from "react-native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { useToast } from "../../contexts/ToastContext";
import { useRouter } from "expo-router";
import { GES_SUBJECTS, CAMBRIDGE_SUBJECTS, MONTESSORI_SUBJECTS, COMMON_ACTIVITIES } from "../../constants/Curriculum";
import SVGIcon from "../../components/SVGIcon";
import { useManageTimetable, Period } from "../../hooks/teacher-dashboard/useManageTimetable";
import DateTimePicker from "@react-native-community/datetimepicker";
import moment from "moment";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SUBJECT_COLORS: Record<string, string> = {
  "Mathematics": "#E0F2FE", "English": "#FEE2E2", "Science": "#DCFCE7",
  "Social Studies": "#FEF9C3", "Computing": "#F3E8FF", "RME": "#FFEDD5",
  "Creative Arts": "#FAE8FF", "French": "#F1F5F9", "History": "#FEF3C7",
  "Career Technology": "#E0E7FF", "Break": "#F1F5F9", "Lunch": "#F1F5F9",
  "Physical Education": "#ECFDF5", "ICT": "#E0F2FE", "Biology": "#DCFCE7",
  "Chemistry": "#FEF9C3", "Physics": "#F3E8FF", "Economics": "#FFEDD5",
  "Business Studies": "#E0E7FF", "Geography": "#ECFDF5", "DEFAULT": "#F8FAFC"
};

const getSubjectColor = (subject: string) => SUBJECT_COLORS[subject] || SUBJECT_COLORS.DEFAULT;

const COLUMN_WIDTH = 150;
const DAY_COLUMN_WIDTH = 100;

export default function CreateLessonTimetable() {
  const router = useRouter();
  const { showToast } = useToast();

  const {
    classes,
    selectedClass,
    setSelectedClass,
    curriculum,
    setCurriculum,
    timetableDays,
    numColumns,
    setNumColumns,
    loadingClasses,
    loadingData,
    saving,
    updatePeriod,
    updateColumnPeriod,
    saveTimetable,
    customSubjects,
  } = useManageTimetable();

  const [pickerModal, setPickerModal] = useState<{ day: string; col: number } | null>(null);
  const [timeModal, setTimeModal] = useState<{ col: number; type: "start" | "end" } | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  const brandColor = COLORS.brandPrimary || COLORS.primary || "#2e86de";
  const neutralDark = "#1E293B";

  const availableSubjects = useMemo(() => {
    let list = GES_SUBJECTS;
    if (curriculum === "Cambridge") list = CAMBRIDGE_SUBJECTS;
    else if (curriculum === "Montessori") list = MONTESSORI_SUBJECTS;

    return [...new Set([...list, ...COMMON_ACTIVITIES, ...customSubjects])].sort();
  }, [curriculum, customSubjects]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/teacher-dashboard");
    return true;
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => sub.remove();
  }, [handleBack]);

  const renderSubjectPicker = () => {
    if (!pickerModal) return null;
    const { day, col } = pickerModal;
    const currentSubject = timetableDays[day]?.[col]?.subject || "";

    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Activity</Text>
              <TouchableOpacity onPress={() => setPickerModal(null)}>
                <SVGIcon name="close" size={24} color={neutralDark} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableSubjects}
              keyExtractor={item => item}
              contentContainerStyle={{ padding: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.subjectItem, currentSubject === item && { backgroundColor: brandColor + "15", borderColor: brandColor }]}
                  onPress={() => {
                    updatePeriod(day, col, { subject: item });
                    setPickerModal(null);
                  }}
                >
                  <View style={[styles.colorDot, { backgroundColor: getSubjectColor(item) === "#F8FAFC" ? brandColor : getSubjectColor(item) }]} />
                  <Text style={[styles.subjectItemText, currentSubject === item && { color: brandColor, fontWeight: "700" }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setTimeModal(null);
    if (date && timeModal) {
      const timeString = moment(date).format("hh:mm A");
      updateColumnPeriod(timeModal.col, timeModal.type === "start" ? { startTime: timeString } : { endTime: timeString });
    }
  };

  const handleWebTimeChange = (col: number, type: "start" | "end", val: string) => {
    // val is in "HH:mm" 24h format from <input type="time">
    if (!val) return;
    const [h, m] = val.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    const timeString = moment(date).format("hh:mm A");
    updateColumnPeriod(col, type === "start" ? { startTime: timeString } : { endTime: timeString });
  };

  const openTimePicker = (col: number, type: "start" | "end") => {
    const currentPeriod = timetableDays["Monday"]?.[col];
    const timeVal = type === "start" ? currentPeriod?.startTime : currentPeriod?.endTime;

    let d = new Date();
    if (timeVal) {
      const [time, modifier] = timeVal.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
    }
    setTempTime(d);
    setTimeModal({ col, type });
  };

  if (loadingClasses) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColor} />
        <Text style={{ marginTop: 10, color: neutralDark }}>Fetching Classes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: brandColor }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Timetable</Text>
        <TouchableOpacity onPress={saveTimetable} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <SVGIcon name="save" size={24} color="#fff" />}
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>SELECT CLASS</Text>
              <Picker
                selectedValue={selectedClass}
                onValueChange={(val) => setSelectedClass(val)}
                style={styles.picker}
              >
                {classes.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
              </Picker>
            </View>
          </View>
          <View style={{ width: 120 }}>
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>PERIODS</Text>
              <Picker
                selectedValue={numColumns}
                onValueChange={(v) => setNumColumns(v)}
                style={styles.picker}
              >
                {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <Picker.Item key={n} label={n.toString()} value={n} />)}
              </Picker>
            </View>
          </View>
        </View>
      </View>

      {loadingData ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={brandColor} />
          <Text style={{ marginTop: 10 }}>Loading Timetable...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header Row */}
              <View style={styles.gridHeader}>
                <View style={[styles.gridCell, { width: DAY_COLUMN_WIDTH, backgroundColor: "#F1F5F9", height: 110 }]}>
                  <Text style={styles.gridHeaderText}>DAY</Text>
                </View>
                {Array.from({ length: numColumns }).map((_, i) => {
                  const firstDayPeriod = timetableDays["Monday"]?.[i];

                  // Convert "10:30 AM" to "10:30" (24h) for web input
                  const getWebTimeValue = (timeStr?: string) => {
                    if (!timeStr) return "";
                    try {
                      const [time, modifier] = timeStr.split(' ');
                      let [hours, minutes] = time.split(':').map(Number);
                      if (modifier === 'PM' && hours < 12) hours += 12;
                      if (modifier === 'AM' && hours === 12) hours = 0;
                      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    } catch (e) { return ""; }
                  };

                  return (
                    <View key={i} style={[styles.gridCell, { width: COLUMN_WIDTH, backgroundColor: "#F1F5F9", height: 110 }]}>
                      <Text style={styles.gridHeaderText}>PERIOD {i + 1}</Text>
                      <View style={styles.timeControlRow}>
                        {Platform.OS === 'web' ? (
                          <View style={{ gap: 4, alignItems: 'center' }}>
                            <input
                              type="time"
                              value={getWebTimeValue(firstDayPeriod?.startTime)}
                              onChange={(e) => handleWebTimeChange(i, "start", e.target.value)}
                              style={webTimeStyles}
                            />
                            <Text style={{fontSize: 10, color: "#94A3B8"}}>-</Text>
                            <input
                              type="time"
                              value={getWebTimeValue(firstDayPeriod?.endTime)}
                              onChange={(e) => handleWebTimeChange(i, "end", e.target.value)}
                              style={webTimeStyles}
                            />
                          </View>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.timeInputBtn}
                              onPress={() => openTimePicker(i, "start")}
                            >
                              <Text style={styles.timeInputText}>{firstDayPeriod?.startTime || "Start"}</Text>
                            </TouchableOpacity>
                            <Text style={{fontSize: 10, color: "#94A3B8"}}>-</Text>
                            <TouchableOpacity
                              style={styles.timeInputBtn}
                              onPress={() => openTimePicker(i, "end")}
                            >
                              <Text style={styles.timeInputText}>{firstDayPeriod?.endTime || "End"}</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {DAYS.map(day => (
                  <View key={day} style={styles.gridRow}>
                    <View style={[styles.gridCell, { width: DAY_COLUMN_WIDTH, backgroundColor: "#fff" }]}>
                      <Text style={styles.dayText}>{day.substring(0, 3).toUpperCase()}</Text>
                    </View>
                    {Array.from({ length: numColumns }).map((_, i) => {
                      const period = timetableDays[day]?.[i] || { subject: "" };
                      const bgColor = getSubjectColor(period.subject);
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[styles.gridCell, { width: COLUMN_WIDTH, backgroundColor: bgColor }]}
                          onPress={() => setPickerModal({ day, col: i })}
                        >
                          <Text style={[styles.periodText, !period.subject && { color: "#94A3B8" }]} numberOfLines={2}>
                            {period.subject || "Select Activity"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Subject Grouping (based on {curriculum} curriculum)</Text>
            <View style={styles.legendGrid}>
              {availableSubjects.slice(0, 6).map(s => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: getSubjectColor(s) }]} />
                  <Text style={styles.legendText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
      {renderSubjectPicker()}

      <TouchableOpacity
        style={[styles.saveFab, { backgroundColor: brandColor }]}
        onPress={saveTimetable}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.fabContent}>
            <Text style={styles.saveFabText}>SAVE TIMETABLE & SET REMINDERS</Text>
            <SVGIcon name="checkmark-done" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {timeModal && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.timePickerContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Set {timeModal.type === "start" ? "Start" : "End"} Time</Text>
                  <TouchableOpacity onPress={() => setTimeModal(null)}>
                    <Text style={{color: brandColor, fontWeight: '700'}}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempTime}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={tempTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    ...SHADOWS.medium,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  backBtn: { padding: 5 },
  controls: { padding: 15, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  controlRow: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 10, fontWeight: "900", color: "#64748B", position: 'absolute', top: 12, left: 12, zIndex: 1 },
  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    minHeight: 65,
    justifyContent: 'center',
    paddingTop: 12,
    position: 'relative'
  },
  picker: { height: 45, width: "100%", marginLeft: -10 },
  gridHeader: { flexDirection: "row" },
  gridRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  gridCell: {
    height: 80,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
  },
  gridHeaderText: { fontSize: 11, fontWeight: "900", color: "#64748B" },
  dayText: { fontSize: 13, fontWeight: "900", color: "#1E293B" },
  periodText: { fontSize: 12, fontWeight: "700", textAlign: "center", color: "#1E293B" },
  timeControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8
  },
  timeInputBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 60,
    alignItems: 'center'
  },
  timeInputText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B'
  },
  timePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 20
  },
  legend: { padding: 15, backgroundColor: "#F1F5F9" },
  legendTitle: { fontSize: 10, fontWeight: "900", color: "#64748B", marginBottom: 10, textTransform: "uppercase" },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", width: "45%" },
  legendColor: { width: 12, height: 12, borderRadius: 3, marginRight: 6, borderWidth: 1, borderColor: "#E2E8F0" },
  legendText: { fontSize: 11, color: "#475569", fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 25, borderTopRightRadius: 25, height: "60%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  subjectItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  subjectItemText: { fontSize: 15, color: "#475569", fontWeight: "600" },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  saveFab: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.large,
    elevation: 5,
  },
  fabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  saveFabText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
});

const webTimeStyles = {
  border: '1px solid #E2E8F0',
  borderRadius: '4px',
  padding: '2px 4px',
  fontSize: '10px',
  fontWeight: '700',
  color: '#1E293B',
  fontFamily: 'inherit',
  width: '80px',
  textAlign: 'center' as const
};
