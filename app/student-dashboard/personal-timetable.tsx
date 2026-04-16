import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useRouter } from "expo-router";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CACHE_KEY = "personal_timetable_cache";

interface TimetableEntry {
  subject: string;
  time: string;
}

interface PersonalTimetableData {
  [day: string]: {
    morning: TimetableEntry[];
    evening: TimetableEntry[];
  };
}

const PersonalTimetable = () => {
  const { appUser } = useAuth();
  const router = useRouter();
  const [timetable, setTimetable] = useState<PersonalTimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Monday");

  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState<"morning" | "evening">("morning");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [tempSubject, setTempSubject] = useState("");
  const [tempTime, setTempTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        Alert.alert("Notifications", "Please enable notifications to get study reminders! 🔔");
      }
    })();
  }, []);

  const scheduleAllNotifications = async (data: PersonalTimetableData) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const dayMap: { [key: string]: number } = {
        Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6, Saturday: 7,
      };

      for (const day of DAYS) {
        const expoDayIndex = dayMap[day];
        const entries = [...data[day].morning, ...data[day].evening];

        for (const entry of entries) {
          if (!entry.time || !entry.subject) continue;
          const [hours, minutes] = entry.time.split(":").map(Number);
          let notifyHours = hours;
          let notifyMinutes = minutes - 5;
          if (notifyMinutes < 0) { notifyMinutes += 60; notifyHours -= 1; if (notifyHours < 0) notifyHours += 23; }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Study Time! 📚: ${entry.subject}`,
              body: `Your session starts at ${entry.time}. Let's go! ✨`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              weekday: expoDayIndex,
              hour: notifyHours,
              minute: notifyMinutes,
              repeats: true,
            },
          });
        }
      }
    } catch (e) {
      console.warn("Notification scheduling failed:", e);
    }
  };

  const fetchTimetable = useCallback(async () => {
    if (!appUser?.uid) return;
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setTimetable(parsed);
        setLoading(false);
      }

      const timetableRef = doc(db, "personal_timetables", appUser.uid);
      const unsubscribe = onSnapshot(timetableRef, (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data() as PersonalTimetableData;
          setTimetable(remoteData);
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remoteData));
          scheduleAllNotifications(remoteData);
        } else if (!cached) {
          const initialData: PersonalTimetableData = {};
          DAYS.forEach((day) => { initialData[day] = { morning: [], evening: [] }; });
          setTimetable(initialData);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (error) {
      setLoading(false);
    }
  }, [appUser?.uid]);

  useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

  const handleSave = async (updatedData: PersonalTimetableData) => {
    if (!appUser?.uid) return;
    setSaving(true);
    try {
      const timetableRef = doc(db, "personal_timetables", appUser.uid);
      await setDoc(timetableRef, updatedData);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
      setTimetable(updatedData);
      await scheduleAllNotifications(updatedData);
      Alert.alert("All Set! ✅", "Your study plan is updated and reminders are set!");
    } catch (error) {
      Alert.alert("Oops!", "Could not save your plan right now.");
    } finally {
      setSaving(false);
    }
  };

  const openModal = (mode: "morning" | "evening", index: number | null = null) => {
    setEditMode(mode);
    setEditIndex(index);
    if (index !== null && timetable) {
      const entry = timetable[selectedDay][mode][index];
      setTempSubject(entry.subject);
      const [h, m] = entry.time.split(":").map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      setTempTime(d);
    } else {
      setTempSubject("");
      const now = new Date(); now.setSeconds(0, 0);
      setTempTime(now);
    }
    setModalVisible(true);
  };

  const saveEntry = () => {
    if (!tempSubject.trim()) return Alert.alert("Wait!", "What subject are we studying?");
    if (!timetable) return;
    const timeString = `${tempTime.getHours().toString().padStart(2, "0")}:${tempTime.getMinutes().toString().padStart(2, "0")}`;
    const updatedData = { ...timetable };
    const dayData = { ...updatedData[selectedDay] };
    const list = [...dayData[editMode]];
    if (editIndex !== null) { list[editIndex] = { subject: tempSubject, time: timeString }; }
    else { if (list.length >= 2) return Alert.alert("Whoa!", "Let's stick to 2 subjects for now!"); list.push({ subject: tempSubject, time: timeString }); }
    dayData[editMode] = list;
    updatedData[selectedDay] = dayData;
    handleSave(updatedData);
    setModalVisible(false);
  };

  const deleteEntry = (mode: "morning" | "evening", index: number) => {
    if (!timetable) return;
    Alert.alert("Delete Plan?", "Are you sure you want to remove this?", [
      { text: "No", style: "cancel" },
      { text: "Yes, Delete", style: "destructive", onPress: () => {
        const updatedData = { ...timetable };
        const list = [...updatedData[selectedDay][mode]];
        list.splice(index, 1);
        updatedData[selectedDay][mode] = list;
        handleSave(updatedData);
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const currentDayData = timetable?.[selectedDay] || { morning: [], evening: [] };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Study Plan 🗓️</Text>
          <Text style={styles.subtitle}>Plan your morning and evening sessions!</Text>
        </View>
      </View>

      <View style={{ marginBottom: 15 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {DAYS.map((day) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, selectedDay === day && styles.activeDayTab]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayTabText, selectedDay === day && styles.activeDayTabText]}>{day.substring(0, 3)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Morning Session ☀️" icon="sunny" color="#F59E0B" entries={currentDayData.morning} onAdd={() => openModal("morning")} onEdit={(idx: number) => openModal("morning", idx)} onDelete={(idx: number) => deleteEntry("morning", idx)} />
        <Section title="Evening Session 🌙" icon="moon" color="#818CF8" entries={currentDayData.evening} onAdd={() => openModal("evening")} onEdit={(idx: number) => openModal("evening", idx)} onDelete={(idx: number) => deleteEntry("evening", idx)} />
        <View style={{ height: 40 }} />
      </ScrollView>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#fff" />
          <Text style={{ color: "#fff", marginTop: 10, fontWeight: 'bold' }}>Setting reminders... 🔔</Text>
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Subject 📚</Text>
            <TextInput style={styles.input} placeholder="e.g. Mathematics" placeholderTextColor="#94A3B8" value={tempSubject} onChangeText={setTempSubject} />
            {Platform.OS === 'web' ? (
              <View style={styles.timePickerBtn}>
                <SVGIcon name="time" size={20} color={COLORS.primary} />
                <input
                  type="time"
                  value={`${tempTime.getHours().toString().padStart(2, "0")}:${tempTime.getMinutes().toString().padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    const newDate = new Date(tempTime);
                    newDate.setHours(h, m);
                    setTempTime(newDate);
                  }}
                  style={{
                    marginLeft: 15,
                    fontSize: 18,
                    fontWeight: "bold",
                    color: COLORS.primary,
                    border: 'none',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                />
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowTimePicker(true)}>
                  <SVGIcon name="time" size={20} color={COLORS.primary} />
                  <Text style={styles.timePickerText}>
                    {tempTime.getHours().toString().padStart(2, "0")}:{tempTime.getMinutes().toString().padStart(2, "0")}
                  </Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={tempTime}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(e, d) => {
                      setShowTimePicker(false);
                      if (d) setTempTime(d);
                    }}
                  />
                )}
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveEntry}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function Section({ title, icon, color, entries, onAdd, onEdit, onDelete }: any) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={icon} size={22} color={color} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {entries.length < 2 && (
          <TouchableOpacity onPress={onAdd} style={styles.addButton}>
            <SVGIcon name="add-circle" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
      {entries.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>No subjects planned yet!</Text></View>
      ) : (
        entries.map((item: any, index: number) => (
          <View key={index} style={[styles.entryCard, { borderLeftColor: color }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entrySubject}>{item.subject}</Text>
              <View style={styles.timeRow}>
                <Ionicons name="alarm-outline" size={14} color="#64748B" />
                <Text style={styles.entryTime}>{item.time}</Text>
              </View>
            </View>
            <View style={styles.entryActions}>
              <TouchableOpacity onPress={() => onEdit(index)} style={styles.actionBtn}><SVGIcon name="pencil" size={18} color={COLORS.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(index)} style={styles.actionBtn}><SVGIcon name="trash" size={18} color="#EF4444" /></TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15, ...SHADOWS.small },
  title: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B", fontWeight: '600', marginTop: 2 },
  dayTab: { paddingHorizontal: 20, paddingVertical: 10, marginRight: 10, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", ...SHADOWS.small },
  activeDayTab: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayTabText: { fontWeight: "bold", color: "#64748B" },
  activeDayTabText: { color: "#fff" },
  content: { padding: 20 },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  addButton: { padding: 5 },
  entryCard: { backgroundColor: "#fff", padding: 20, borderRadius: 20, flexDirection: "row", alignItems: "center", marginBottom: 12, ...SHADOWS.medium, borderLeftWidth: 5 },
  entrySubject: { fontSize: 18, fontWeight: "bold", color: "#0F172A" },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
  entryTime: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  entryActions: { flexDirection: "row", gap: 10 },
  actionBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  emptyCard: { padding: 30, alignItems: "center", backgroundColor: "rgba(241, 245, 249, 0.5)", borderRadius: 20, borderStyle: "dashed", borderWidth: 2, borderColor: "#E2E8F0" },
  emptyText: { color: "#94A3B8", fontWeight: "600" },
  savingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, ...SHADOWS.large },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#0F172A", marginBottom: 20, textAlign: "center" },
  input: { backgroundColor: "#F1F5F9", padding: 15, borderRadius: 15, fontSize: 16, marginBottom: 20, fontWeight: '600' },
  timePickerBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", padding: 15, borderRadius: 15, marginBottom: 30 },
  timePickerText: { marginLeft: 15, fontSize: 18, fontWeight: "bold", color: COLORS.primary },
  modalButtons: { flexDirection: "row", gap: 15 },
  modalCancel: { flex: 1, padding: 18, borderRadius: 15, alignItems: "center", backgroundColor: '#F1F5F9' },
  cancelText: { color: "#64748B", fontWeight: "bold", fontSize: 16 },
  modalSave: { flex: 1, padding: 18, borderRadius: 15, alignItems: "center", backgroundColor: COLORS.primary },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});

export default PersonalTimetable;
