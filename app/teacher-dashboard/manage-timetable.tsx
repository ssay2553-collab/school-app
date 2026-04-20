import { Picker } from "@react-native-picker/picker";
import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
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
  BackHandler
} from "react-native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";
import { useRouter } from "expo-router";
import { sortClasses } from "../../lib/classHelpers";
import { GES_SUBJECTS, CAMBRIDGE_SUBJECTS, COMMON_ACTIVITIES, CurriculumType } from "../../constants/Curriculum";
import SVGIcon from "../../components/SVGIcon";

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

type Period = { id: string; subject: string; startTime: string; endTime: string; isCustom: boolean; };
type ClassData = { id: string; name: string; curriculum?: CurriculumType };

// Robust ID generation for Android stability
function generateId() { return Date.now().toString() + Math.random().toString(36).substring(2, 9); }

const COLUMN_WIDTH = 150;
const DAY_COLUMN_WIDTH = 100;

export default function CreateLessonTimetable() {
  const router = useRouter();
  const mounted = useRef(true);
  const { appUser } = useAuth();

  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [curriculum, setCurriculum] = useState<CurriculumType>("GES");
  const [timetableDays, setTimetableDays] = useState<Record<string, Period[]>>({});
  const [numColumns, setNumColumns] = useState(6);
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pickerModal, setPickerModal] = useState<{ day: string; col: number } | null>(null);

  const brandColor = COLORS.brandPrimary || COLORS.primary || "#2e86de";
  const neutralDark = "#1E293B";

  const availableSubjects = useMemo(() => {
    const list = curriculum === "GES" ? GES_SUBJECTS : CAMBRIDGE_SUBJECTS;
    return [...new Set([...list, ...COMMON_ACTIVITIES, ...customSubjects])].sort();
  }, [curriculum, customSubjects]);

  const canEdit = useMemo(() => {
    if (!appUser) return false;
    const role = (appUser.role || "").toLowerCase();
    const adminRole = (appUser.adminRole || "").toLowerCase();
    const adminRoles = ["admin", "headmaster", "proprietor", "secretary", "assistant", "ceo"];
    const isFullAdmin = adminRoles.some(r => role.includes(r) || adminRole.includes(r));
    if (isFullAdmin) return true;
    return appUser.classTeacherOf === selectedClass;
  }, [appUser, selectedClass]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
  }, [router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  const loadClasses = useCallback(async (forceRefresh = false) => {
    try {
      setLoadingClasses(true);
      const snap = forceRefresh 
        ? await getDocsFromServer(collection(db, "classes"))
        : await getDocsCacheFirst(collection(db, "classes") as any);
        
      const list: ClassData[] = snap.docs.map((d) => ({ 
        id: d.id, 
        name: d.data()?.name || d.id, 
        curriculum: d.data()?.curriculum 
      }));
      const sorted = sortClasses(list);
      
      if (!mounted.current) return;
      setClasses(sorted);
      
      if (!selectedClass) {
        if (appUser?.classTeacherOf && sorted.find(c => c.id === appUser.classTeacherOf)) {
          setSelectedClass(appUser.classTeacherOf);
        } else if (sorted.length > 0) {
          setSelectedClass(sorted[0].id);
        }
      }
    } catch (e) { 
      console.error("Load Classes Error:", e); 
    } finally { 
      if (mounted.current) setLoadingClasses(false); 
    }
  }, [appUser?.classTeacherOf]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const loadTimetable = useCallback(async () => {
    if (!selectedClass) return;
    
    const cls = classes.find(c => c.id === selectedClass);
    if (cls?.curriculum) setCurriculum(cls.curriculum);

    try {
      setLoadingData(true);
      const ref = doc(db, "timetables", selectedClass);
      let snap;
      try { snap = await getDocFromCache(ref); } catch { snap = await getDocFromServer(ref); }
      
      if (!snap.exists()) {
        if (mounted.current) { 
          setTimetableDays({}); 
          setNumColumns(6); 
        }
        return;
      }

      const data = snap.data();
      const days = data?.timetableDays || {};
      let maxCols = 6;
      Object.values(days).forEach((pArr: any) => { 
        if (Array.isArray(pArr) && pArr.length > maxCols) maxCols = pArr.length; 
      });

      if (mounted.current) {
        setTimetableDays(days);
        setNumColumns(maxCols);
        if (data.curriculum) setCurriculum(data.curriculum);
      }
    } catch (e) { 
      console.error("Load Timetable Error:", e);
      if (mounted.current) setTimetableDays({}); 
    } finally { 
      if (mounted.current) setLoadingData(false); 
    }
  }, [selectedClass, classes]);

  useEffect(() => { 
    if (selectedClass) loadTimetable(); 
  }, [selectedClass, loadTimetable]);

  const fetchCustomSubjects = useCallback(async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "teacher"));
      const snap = await getDocs(q);
      const subjects = new Set<string>();
      
      snap.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.subjects)) {
          data.subjects.forEach((s: string) => {
            if (s && !GES_SUBJECTS.includes(s) && !CAMBRIDGE_SUBJECTS.includes(s) && !COMMON_ACTIVITIES.includes(s)) {
              subjects.add(s);
            }
          });
        }
      });
      
      setCustomSubjects(Array.from(subjects));
    } catch (e) {
      console.error("Error fetching custom subjects:", e);
    }
  }, []);

  useEffect(() => {
    fetchCustomSubjects();
  }, [fetchCustomSubjects]);

  const updateCell = (day: string, colIndex: number, updates: Partial<Period>) => {
    if (!canEdit) return;
    setTimetableDays(prev => {
      const currentDayPeriods = [...(prev[day] || [])];
      while (currentDayPeriods.length <= colIndex) {
        currentDayPeriods.push({ id: generateId(), subject: "", startTime: "", endTime: "", isCustom: false });
      }
      currentDayPeriods[colIndex] = { ...currentDayPeriods[colIndex], ...updates };
      return { ...prev, [day]: currentDayPeriods };
    });
  };

  const syncColumnTime = (colIndex: number, startTime: string, endTime: string) => {
    if (!canEdit) return;
    setTimetableDays(prev => {
      const newState = { ...prev };
      DAYS.forEach(day => {
        const periods = [...(newState[day] || [])];
        while (periods.length <= colIndex) {
          periods.push({ id: generateId(), subject: "", startTime: "", endTime: "", isCustom: false });
        }
        periods[colIndex] = { ...periods[colIndex], startTime, endTime };
        newState[day] = periods;
      });
      return newState;
    });
  };

  async function save() {
    if (!canEdit || !selectedClass) return;
    try {
      setSaving(true);
      const ref = doc(db, "timetables", selectedClass);
      await setDoc(ref, { 
        timetableDays, 
        numColumns, 
        curriculum,
        updatedAt: serverTimestamp() 
      }, { merge: true });
      if (Platform.OS === 'web') alert("Weekly timetable updated successfully.");
      else Alert.alert("Saved", "Weekly timetable updated successfully.");
    } catch (e) { 
      if (Platform.OS === 'web') alert("Could not save timetable.");
      else Alert.alert("Error", "Could not save timetable."); 
    } finally { if (mounted.current) setSaving(false); }
  }

  const renderTableCell = (day: string, colIndex: number) => {
    const period = timetableDays[day]?.[colIndex] || { subject: "", isCustom: false };
    const subject = period.subject || "";
    const bgColor = getSubjectColor(subject);
    
    return (
      <TouchableOpacity 
        key={`${day}-${colIndex}`} 
        style={[styles.tableCell, { backgroundColor: bgColor }]}
        onPress={() => canEdit && setPickerModal({ day, col: colIndex })}
        disabled={!canEdit}
      >
        <View style={styles.cellContent}>
          <Text style={styles.cellSubjectText} numberOfLines={2}>
            {subject || "---"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderColumnHeader = (index: number) => {
    // Safety check for array access
    const refPeriod = timetableDays["Monday"]?.[index] || { startTime: "", endTime: "" };
    return (
      <View key={`header-${index}`} style={styles.columnHeader}>
        <View style={styles.columnHeaderTop}>
          <Text style={styles.columnHeaderText}>Period {index + 1}</Text>
          {canEdit && (
            <TouchableOpacity onPress={() => {
                const performDelete = () => {
                    setTimetableDays(prev => {
                        const newState = {...prev};
                        DAYS.forEach(d => { if(newState[d]) newState[d].splice(index, 1); });
                        return newState;
                    });
                    setNumColumns(prev => Math.max(0, prev - 1));
                };

                if (Platform.OS === 'web') {
                    if (window.confirm("Remove this period?")) performDelete();
                } else {
                    Alert.alert("Delete", "Remove this period?", [{text: "No"}, {text: "Yes", onPress: performDelete}]);
                }
            }}>
              <SVGIcon name="trash" size={14} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
        <TextInput 
          editable={canEdit} 
          style={styles.timeInput} 
          placeholder="Start" 
          value={refPeriod.startTime || ""} 
          onChangeText={(t) => syncColumnTime(index, t, refPeriod.endTime || "")} 
          placeholderTextColor="#94A3B8"
        />
        <TextInput 
          editable={canEdit} 
          style={styles.timeInput} 
          placeholder="End" 
          value={refPeriod.endTime || ""} 
          onChangeText={(t) => syncColumnTime(index, refPeriod.startTime || "", t)} 
          placeholderTextColor="#94A3B8"
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}><SVGIcon name="arrow-back" size={24} color={brandColor} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: neutralDark }]}>Timetable Creator</Text>
          <Text style={styles.subtitle}>{canEdit ? "Editing Mode" : "Viewing Mode"}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Select Classroom</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingRight: 20 }}>
          {classes.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, selectedClass === c.id && { backgroundColor: brandColor, borderColor: brandColor }]} onPress={() => setSelectedClass(c.id)}>
              <Text style={[styles.chipText, selectedClass === c.id && { color: "#fff" }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Curriculum Scope</Text></View>
        <View style={styles.curriculumRow}>
            <TouchableOpacity 
                style={[styles.curriculumBtn, curriculum === "GES" && { backgroundColor: brandColor, borderColor: brandColor }]}
                onPress={() => setCurriculum("GES")}
            >
                <Text style={[styles.curriculumBtnText, curriculum === "GES" && { color: '#fff' }]}>GES (National)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.curriculumBtn, curriculum === "Cambridge" && { backgroundColor: brandColor, borderColor: brandColor }]}
                onPress={() => setCurriculum("Cambridge")}
            >
                <Text style={[styles.curriculumBtnText, curriculum === "Cambridge" && { color: '#fff' }]}>Cambridge (IGCSE)</Text>
            </TouchableOpacity>
        </View>

        {loadingData || !selectedClass ? <ActivityIndicator size="large" color={brandColor} style={{ marginTop: 50 }} /> : (
          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                <View style={styles.tableRow}>
                  <View style={[styles.dayColumnHeader, { width: DAY_COLUMN_WIDTH }]}><Text style={styles.dayHeaderText}>Day \ Period</Text></View>
                  {Array.from({ length: numColumns }).map((_, i) => renderColumnHeader(i))}
                  {canEdit && <TouchableOpacity style={styles.addColumnBtn} onPress={() => setNumColumns(p => p+1)}><SVGIcon name="add-circle" size={24} color={brandColor} /></TouchableOpacity>}
                </View>
                {DAYS.map((day) => (
                  <View key={day} style={styles.tableRow}>
                    <View style={[styles.dayCell, { width: DAY_COLUMN_WIDTH }]}><Text style={styles.dayText}>{day}</Text></View>
                    {Array.from({ length: numColumns }).map((_, i) => renderTableCell(day, i))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* REPLACED MANY PICKERS WITH SINGLE MODAL LIST FOR STABILITY */}
      <Modal visible={!!pickerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.pickerSheet}>
                <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Select Subject</Text>
                    <TouchableOpacity onPress={() => setPickerModal(null)}><SVGIcon name="close" size={24} color="#64748B" /></TouchableOpacity>
                </View>
                <FlatList
                    data={["---", ...availableSubjects]}
                    keyExtractor={item => item}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={styles.subjectOption} 
                            onPress={() => {
                                if (pickerModal) updateCell(pickerModal.day, pickerModal.col, { subject: item === "---" ? "" : item });
                                setPickerModal(null);
                            }}
                        >
                            <Text style={[styles.optionText, item === "---" && { color: '#94A3B8' }]}>{item}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>
        </View>
      </Modal>

      {canEdit && !loadingData && selectedClass !== "" && (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: brandColor }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <><Text style={styles.saveBtnText}>Save Full Timetable</Text><SVGIcon name="cloud-done" size={20} color="#fff" style={{ marginLeft: 10 }} /></>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", padding: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", marginRight: 15, ...SHADOWS.small },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  sectionHeader: { paddingHorizontal: 20, marginTop: 15, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 },
  chipScroll: { paddingLeft: 20, marginBottom: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: "#fff", marginRight: 10, borderWidth: 1, borderColor: "#E2E8F0", ...SHADOWS.small },
  chipText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  curriculumRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  curriculumBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#fff' },
  curriculumBtnText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  tableWrapper: { paddingHorizontal: 10, marginBottom: 30 },
  tableRow: { flexDirection: 'row' },
  dayColumnHeader: { height: 90, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  dayHeaderText: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  columnHeader: { width: COLUMN_WIDTH, height: 90, padding: 8, backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  columnHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  columnHeaderText: { fontSize: 11, fontWeight: '900', color: '#1E293B' },
  timeInput: { backgroundColor: '#fff', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, fontSize: 10, marginBottom: 2, borderWidth: 1, borderColor: '#CBD5E1', color: '#1E293B' },
  dayCell: { height: 60, justifyContent: 'center', paddingLeft: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#fff' },
  dayText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  tableCell: { width: COLUMN_WIDTH, height: 60, borderLeftWidth: 1, borderLeftColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cellContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 4 },
  cellSubjectText: { fontSize: 11, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  addColumnBtn: { width: 60, justifyContent: 'center', alignItems: 'center' },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9", ...SHADOWS.large },
  saveBtn: { height: 60, borderRadius: 18, flexDirection: "row", justifyContent: "center", alignItems: "center", ...SHADOWS.medium },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerSheet: { backgroundColor: '#fff', width: '100%', maxWidth: 400, borderRadius: 25, maxHeight: '80%', padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  subjectOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#475569', textAlign: 'center' }
});
