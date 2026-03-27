// app/student-dashboard/create-note.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { addDoc, collection, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useRouter, useLocalSearchParams } from "expo-router";
import SVGIcon from "../../components/SVGIcon";

export default function CreateNote() {
  const router = useRouter();
  const { category } = useLocalSearchParams();

  const auth = getAuth();
  const user = auth.currentUser;
  const db = getFirestore();

  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const saveNote = async () => {
    if (!topic.trim() || !content.trim()) {
      Alert.alert("INPUT_ERROR", "All data fields must be populated.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "student_notes"), {
        uid: user?.uid,
        subject: category,
        title: topic,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: true,
      });

      Alert.alert("DATA_COMMITTED", "Knowledge entry successfully added to matrix.");
      router.back();
    } catch (error) {
      console.log(error);
      Alert.alert("CRITICAL_FAILURE", "Failed to commit data to central server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0F172A", "#1E293B"]} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={20} color="#38BDF8" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>LOG_ENTRY_INITIALIZATION</Text>
          <Text style={styles.headerSubtitle}>SECTOR: {category?.toString().toUpperCase() || "GENERAL"}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ENTRY_TOPIC</Text>
          <TextInput
            placeholder="ENTER_TOPIC_IDENTIFIER"
            placeholderTextColor="#475569"
            value={topic}
            onChangeText={setTopic}
            style={styles.topicInput}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>DATA_BODY</Text>
          <TextInput
            placeholder="COMMENCE_DATA_STREAM_INPUT..."
            placeholderTextColor="#475569"
            value={content}
            onChangeText={setContent}
            style={styles.contentInput}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveNote} disabled={loading}>
          <LinearGradient colors={["#38BDF8", "#1D4ED8"]} style={styles.btnGradient}>
            <Text style={styles.saveText}>{loading ? "PROCESSING..." : "COMMIT_TO_MATRIX"}</Text>
            <SVGIcon name="checkmark-done-circle" size={20} color="#0F172A" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)' },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#F8FAFC", letterSpacing: 2 },
  headerSubtitle: { fontSize: 10, color: "#38BDF8", fontWeight: 'bold', letterSpacing: 1 },
  content: { flex: 1, padding: 20 },
  inputGroup: { marginBottom: 25 },
  label: { fontSize: 9, color: "#38BDF8", fontWeight: "900", marginBottom: 10, letterSpacing: 1 },
  topicInput: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 15,
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  contentInput: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    padding: 20,
    height: 300,
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600'
  },
  saveBtn: {
    height: 60,
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 10,
  },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  saveText: { color: "#0F172A", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});
