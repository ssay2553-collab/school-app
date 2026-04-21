import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import SVGIcon from '../../components/SVGIcon';
import { COLORS, SHADOWS } from '../../constants/theme';
import { SCHOOL_CONFIG } from '../../constants/Config';
import * as Animatable from 'react-native-animatable';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import { useToast } from '../../contexts/ToastContext';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

import Constants from "expo-constants";

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

export default function AILessonPlanner() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const primary = SCHOOL_CONFIG.primaryColor;

  const teacherSubjects = appUser?.subjects || [];

  const [loading, setLoading] = useState(false);
  const [weeklyUsage, setWeeklyUsage] = useState<Record<string, number>>({});
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [editingField, setEditingField] = useState<{ key: string; title: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [form, setForm] = useState({
    subject: teacherSubjects.length === 1 ? teacherSubjects[0] : '',
    strand: '',
    topic: '',
    classLevel: '',
    duration: '60 mins',
  });

  // Handle navigation back
  const handleBack = useCallback(() => {
    if (generatedPlan) {
      setGeneratedPlan(null);
      return true;
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/teacher-dashboard");
      }
      return true;
    }
  }, [generatedPlan, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backHandler.remove();
  }, [handleBack]);

  useEffect(() => {
    if (appUser?.uid) {
      fetchWeeklyUsage();
      fetchClasses();
    }
  }, [appUser?.uid]);

  const fetchClasses = async () => {
    if (!appUser?.classes || appUser.classes.length === 0) return;
    try {
      const q = query(
        collection(db, "classes"),
        where("__name__", "in", appUser.classes)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, name: (doc.data() as any).name }));
      setAvailableClasses(list);

      if (list.length === 1) {
        setForm(prev => ({ ...prev, classLevel: list[0].id }));
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = now.getDate() - day;
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  };

  const fetchWeeklyUsage = async () => {
    if (!appUser?.uid) return;
    try {
      const startOfWeek = getStartOfWeek();
      const q = query(
        collection(db, 'ai_generations'),
        where('userId', '==', appUser.uid),
        where('createdAt', '>=', Timestamp.fromDate(startOfWeek))
      );
      const querySnapshot = await getDocs(q);

      const usage: Record<string, number> = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        usage[data.subject] = (usage[data.subject] || 0) + 1;
      });
      setWeeklyUsage(usage);
    } catch (error) {
      console.error("Error fetching usage:", error);
    }
  };

  const handleGenerate = async () => {
    if (!GEMINI_API_KEY) {
        showToast({ message: "AI generation is not configured. Please contact support.", type: "error" });
        return;
    }

    if (!form.subject || !form.strand || !form.topic || !form.classLevel || !form.duration) {
      showToast({ message: "Please fill in all details.", type: "error" });
      return;
    }

    const selectedClassName = availableClasses.find(c => c.id === form.classLevel)?.name || form.classLevel;

    const currentUsage = weeklyUsage[form.subject] || 0;
    if (currentUsage >= 3) {
      showToast({ message: `You have reached your limit of 3 generations for ${form.subject} this week.`, type: "error" });
      return;
    }

    setLoading(true);

    const prompt = `
      Act as an expert teacher. Generate a simple, practical lesson plan for:
      Subject: ${form.subject}
      Class: ${selectedClassName}
      Strand: ${form.strand}
      Sub-strand (Topic): ${form.topic}
      Duration: ${form.duration}

      The lesson must be suitable for the class level. Avoid long explanations.
      Use clear bullet points.

      Return ONLY a JSON object with these keys:
      - objectives (array of strings)
      - introduction (array of strings)
      - teachingActivities (array of strings)
      - materials (array of strings)
      - classActivities (array of strings)
      - assessment (array of strings)
      - conclusion (array of strings)
      - homework (array of strings)
    `;

    try {
      const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      const parsedPlan = JSON.parse(rawText);
      setGeneratedPlan(parsedPlan);

      // Track usage in Firestore
      await addDoc(collection(db, 'ai_generations'), {
        userId: appUser?.uid,
        subject: form.subject,
        createdAt: serverTimestamp(),
      });

      fetchWeeklyUsage(); // Update UI
    } catch (error) {
      console.error("AI Error:", error);
      showToast({ message: "Could not generate plan. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!generatedPlan) return;

    try {
      setLoading(true);
      const selectedClassName = availableClasses.find(c => c.id === form.classLevel)?.name || form.classLevel;

      await addDoc(collection(db, 'pedagogy_vault'), {
        userId: appUser?.uid,
        schoolId: SCHOOL_CONFIG.schoolId,
        subject: form.subject,
        topic: form.topic,
        strand: form.strand,
        classLevel: selectedClassName,
        duration: form.duration,
        plan: generatedPlan,
        createdAt: serverTimestamp(),
      });
      showToast({ message: "Lesson plan saved to the Pedagogy Vault.", type: "success" });
    } catch (error) {
      console.error("Save error:", error);
      showToast({ message: "Could not save to vault.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (key: string, title: string) => {
    const currentItems = generatedPlan[key] || [];
    setEditingField({ key, title });
    setEditValue(currentItems.join('\n'));
  };

  const saveEdit = () => {
    if (editingField) {
      const newLines = editValue.split('\n').filter(line => line.trim() !== '');
      setGeneratedPlan({
        ...generatedPlan,
        [editingField.key]: newLines
      });
      setEditingField(null);
    }
  };

  const renderSection = (title: string, items: string[], icon: string, key: string) => {
    return (
      <Animatable.View animation="fadeInUp" style={styles.resultSection}>
        <View style={styles.sectionTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <SVGIcon name={icon} size={20} color={primary} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <TouchableOpacity onPress={() => openEditor(key, title)}>
            <SVGIcon name="create-outline" size={18} color={primary} />
          </TouchableOpacity>
        </View>
        {(items || []).map((item, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={[styles.bullet, { color: primary }]}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </Animatable.View>
    );
  };

  const remaining = 3 - (weeklyUsage[form.subject] || 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>AI Lesson Planner 🪄</Text>
          <Text style={styles.subtitle}>Smart assistance for busy teachers</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.formCard}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Select Subject</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.subject}
                    onValueChange={(v) => setForm({ ...form, subject: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Choose..." value="" />
                    {teacherSubjects.map((s: string) => (
                      <Picker.Item key={s} label={s} value={s} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.label}>Select Class</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.classLevel}
                    onValueChange={(v) => setForm({ ...form, classLevel: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Choose..." value="" />
                    {availableClasses.map((c) => (
                      <Picker.Item key={c.id} label={c.name} value={c.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            {form.subject ? (
              <View style={styles.usageTip}>
                <Text style={styles.usageTipText}>
                  Weekly allowance for {form.subject}: <Text style={{fontWeight:'900', color: remaining > 0 ? primary : COLORS.error}}>{remaining}/3 remaining</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Strand</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Diversity of Matter"
              value={form.strand}
              onChangeText={(v) => setForm({ ...form, strand: v })}
            />

            <Text style={styles.label}>Sub-strand (Topic)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Living and Non-living things"
              value={form.topic}
              onChangeText={(v) => setForm({ ...form, topic: v })}
            />

            <Text style={styles.label}>Duration</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 60 mins"
              value={form.duration}
              onChangeText={(v) => setForm({ ...form, duration: v })}
            />

            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: primary, opacity: remaining <= 0 ? 0.6 : 1 }]}
              onPress={handleGenerate}
              disabled={loading || remaining <= 0}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <SVGIcon name="sparkles" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Lesson Plan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {generatedPlan && (
            <View style={styles.resultsContainer}>
              <View style={styles.resultHeader}>
                <View>
                  <Text style={styles.resultMainTitle}>Plan for {form.topic}</Text>
                  <Text style={styles.resultMeta}>
                    {availableClasses.find(c => c.id === form.classLevel)?.name || form.classLevel} • {form.duration}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setGeneratedPlan(null)}>
                  <Text style={{ color: COLORS.error, fontWeight: '700' }}>Clear</Text>
                </TouchableOpacity>
              </View>

              <View style={isLargeScreen ? styles.resultsGrid : null}>
                {renderSection("1. Lesson Objectives", generatedPlan.objectives, "flag-outline", "objectives")}
                {renderSection("2. Introduction", generatedPlan.introduction, "sunny-outline", "introduction")}
                {renderSection("3. Teaching & Learning Activities", generatedPlan.teachingActivities, "list-outline", "teachingActivities")}
                {renderSection("4. Teaching Materials/Resources", generatedPlan.materials, "briefcase-outline", "materials")}
                {renderSection("5. Class Activities", generatedPlan.classActivities, "bicycle-outline", "classActivities")}
                {renderSection("6. Assessment", generatedPlan.assessment, "help-circle-outline", "assessment")}
                {renderSection("7. Conclusion", generatedPlan.conclusion, "checkmark-circle-outline", "conclusion")}
                {renderSection("8. Homework/Assignment", generatedPlan.homework, "book-outline", "homework")}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primary }]}
                onPress={handleSaveToVault}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <SVGIcon name="cloud-upload-outline" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save to Pedagogy Vault</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!editingField}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingField?.title}</Text>
              <TouchableOpacity onPress={() => setEditingField(null)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>One point per line</Text>
            <TextInput
              style={styles.editorInput}
              multiline
              value={editValue}
              onChangeText={setEditValue}
              placeholder="Type each point on a new line..."
            />
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: primary }]}
              onPress={saveEdit}
            >
              <Text style={styles.modalSaveBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 25,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  usageTip: {
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  usageTipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 20,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  generateBtn: {
    flexDirection: 'row',
    height: 55,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...SHADOWS.medium,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  resultsContainer: {
    gap: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  resultMainTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  resultMeta: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  resultSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: isLargeScreen ? (width - 60) / 2 : '100%',
    marginBottom: isLargeScreen ? 0 : 20,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 10,
  },
  bullet: {
    fontSize: 18,
    marginRight: 10,
    marginTop: -2,
  },
  listText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    height: 55,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...SHADOWS.medium,
    marginTop: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  modalHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 15,
    fontWeight: '600',
  },
  editorInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 20,
    fontSize: 16,
    color: '#1E293B',
    textAlignVertical: 'top',
    fontWeight: '500',
  },
  modalSaveBtn: {
    height: 55,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...SHADOWS.medium,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
