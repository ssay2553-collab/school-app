import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  addDoc
} from "firebase/firestore";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../components/SVGIcon";
import { SCHOOL_CONFIG } from "../constants/Config";
import { SHADOWS } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { db } from "../firebaseConfig";
import { copyToClipboard } from "../utils/copyToClipboard";

import Constants from "expo-constants";

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const { width } = Dimensions.get("window");

export default function AISearch() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const primary = SCHOOL_CONFIG.primaryColor;
  const LIMIT = 10; // 10 searches per day

  useEffect(() => {
    if (appUser?.uid) {
      fetchDailyUsage();
    }
  }, [appUser?.uid]);

  const getStartOfDay = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  };

  const fetchDailyUsage = async () => {
    try {
      const startOfDay = getStartOfDay();
      const q = query(
        collection(db, "ai_searches"),
        where("userId", "==", appUser?.uid),
        where("createdAt", ">=", Timestamp.fromDate(startOfDay))
      );
      const snap = await getDocs(q);
      setWeeklyCount(snap.size);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async () => {
    if (!queryText.trim()) return;
    if (!GEMINI_API_KEY) {
      showToast({ message: "Search service not configured.", type: "error" });
      return;
    }

    if (weeklyCount >= LIMIT) {
      showToast({ message: `You've used your ${LIMIT} free AI searches for today.`, type: "info" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const prompt = `You are an educational assistant for the ${SCHOOL_CONFIG.name} app.
      Answer this question clearly and concisely for a student or teacher: ${queryText}`;

      const response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        setResult(text);
        // Log the search
        await addDoc(collection(db, "ai_searches"), {
          userId: appUser?.uid,
          role: appUser?.role,
          query: queryText,
          createdAt: Timestamp.now()
        });
        setWeeklyCount(prev => prev + 1);
      } else {
        throw new Error("No response from AI");
      }
    } catch (e) {
      showToast({ message: "Could not complete search. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const ok = await copyToClipboard(result);
    if (ok) {
      showToast({ message: "Response copied to clipboard! 📋", type: "success" });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, "#1E293B"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Fact Finder</Text>
          <View style={styles.usageBadge}>
             <Text style={styles.usageText}>{LIMIT - weeklyCount} Left</Text>
          </View>
        </View>
        <Text style={styles.headerDesc}>Ask me anything about your studies or school subjects!</Text>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Type your question here..."
            placeholderTextColor="#94A3B8"
            multiline
            value={queryText}
            onChangeText={setQueryText}
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: primary }]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.searchBtnText}>Ask AI</Text>
                <SVGIcon name="sparkles" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <Animatable.View animation="fadeInUp" style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <SVGIcon name="bulb" size={20} color={primary} />
                <Text style={[styles.resultTitle, { color: primary }]}>AI Response</Text>
              </View>
              <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                <SVGIcon name="copy-outline" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.resultText}>{result}</Text>
          </Animatable.View>
        )}

        {loading && (
            <View style={styles.loadingState}>
                <Animatable.Text
                    animation="pulse"
                    iterationCount="infinite"
                    style={styles.loadingMsg}
                >
                    Consulting the knowledge base...
                </Animatable.Text>
            </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  usageBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  usageText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  headerDesc: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 10, fontWeight: "500" },
  scrollContent: { padding: 20 },
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginTop: -40,
    ...SHADOWS.medium,
  },
  input: {
    fontSize: 16,
    color: "#1E293B",
    minHeight: 100,
    textAlignVertical: "top",
    fontWeight: "500",
  },
  searchBtn: {
    flexDirection: "row",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    gap: 10,
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  resultTitle: { fontSize: 14, fontWeight: "900", textTransform: "uppercase" },
  copyBtn: { padding: 5, borderRadius: 8, backgroundColor: "#F1F5F9" },
  resultText: { fontSize: 16, color: "#334155", lineHeight: 24, fontWeight: "500" },
  loadingState: { padding: 40, alignItems: "center" },
  loadingMsg: { color: "#94A3B8", fontWeight: "600", fontSize: 14 },
});
