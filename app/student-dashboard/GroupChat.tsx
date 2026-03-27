import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    addDoc,
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
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
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

const QUICK_EMOJIS = ["😀", "😂", "👍", "🙌", "🔥", "✨", "📚", "🎓", "💡", "✅"];

export default function GroupChat() {
  const { groupId, groupName } = useLocalSearchParams();
  const { appUser } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!groupId) return;
    const q = query(
      collection(db, "studentGroups", groupId as string, "messages"),
      orderBy("timestamp", "asc"),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
        setMessages(snap.docs.map((d) => d.data()));
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }, (error) => {
        console.error("Group Chat Listener Error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, [groupId]);

  const sendMessage = async () => {
    if (!input.trim() || !appUser || !groupId) return;
    const text = input.trim();
    setInput("");
    setShowEmojis(false);
    try {
      await addDoc(
        collection(db, "studentGroups", groupId as string, "messages"),
        {
          senderId: appUser.uid,
          senderName: `${appUser.profile?.firstName ?? ""} ${appUser.profile?.lastName ?? ""}`,
          text,
          timestamp: serverTimestamp(),
        },
      );
    } catch (e) {
      console.error("Send Message Error:", e);
    }
  };

  const addEmoji = (emoji: string) => { setInput((prev) => prev + emoji); };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{groupName || "Group Chat"} 💬</Text>
            <Text style={styles.headerSub}>Learning together!</Text>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <SVGIcon name="information-circle" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.chatArea}>
          <ScrollView
            ref={scrollRef}
            style={styles.msgList}
            contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            onScrollBeginDrag={() => { Keyboard.dismiss(); setShowEmojis(false); }}
          >
            {messages.map((m, i) => {
              const isMe = m.senderId === appUser?.uid;
              return (
                <Animatable.View
                  key={i}
                  animation={isMe ? "fadeInRight" : "fadeInLeft"}
                  duration={400}
                  style={[styles.bubbleWrapper, isMe ? styles.meWrapper : styles.othersWrapper]}
                >
                  {!isMe && <Text style={styles.senderName}>{m.senderName}</Text>}
                  <View style={[styles.bubble, isMe ? [styles.me, { backgroundColor: COLORS.primary }] : styles.others]}>
                    <Text style={[styles.msgText, { color: isMe ? "#fff" : "#1E293B" }]}>{m.text}</Text>
                  </View>
                </Animatable.View>
              );
            })}
          </ScrollView>
        </View>

        {showEmojis && (
          <Animatable.View animation="fadeInUp" duration={300} style={styles.emojiContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {QUICK_EMOJIS.map((emoji, index) => (
                <TouchableOpacity key={index} onPress={() => addEmoji(emoji)} style={styles.emojiBtn}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animatable.View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={() => { setShowEmojis(!showEmojis); if (!showEmojis) Keyboard.dismiss(); }} style={styles.emojiToggle}>
            <Ionicons name={showEmojis ? "keypad" : "happy-outline"} size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            onFocus={() => setShowEmojis(false)}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendBtn, { backgroundColor: COLORS.primary }, !input.trim() && { opacity: 0.5 }]}
            disabled={!input.trim()}
          >
            <SVGIcon name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    ...SHADOWS.small,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 15 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  headerSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  headerAction: { padding: 5 },
  chatArea: { flex: 1 },
  msgList: { flex: 1 },
  bubbleWrapper: { marginVertical: 6, maxWidth: "85%" },
  meWrapper: { alignSelf: "flex-end" },
  othersWrapper: { alignSelf: "flex-start" },
  bubble: { padding: 12, paddingHorizontal: 16, borderRadius: 20, ...SHADOWS.small },
  me: { borderBottomRightRadius: 4 },
  others: { backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#F1F5F9" },
  msgText: { fontSize: 15, lineHeight: 22 },
  senderName: { fontSize: 11, fontWeight: "800", marginBottom: 4, marginLeft: 10, color: COLORS.primary },
  emojiContainer: { backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 15, borderTopWidth: 1, borderColor: "#F1F5F9" },
  emojiBtn: { padding: 8, marginRight: 10 },
  emojiText: { fontSize: 24 },
  inputBar: { flexDirection: "row", padding: 12, alignItems: "center", backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E2E8F0" },
  emojiToggle: { padding: 5, marginRight: 5 },
  input: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 25, paddingHorizontal: 18, paddingVertical: 10, maxHeight: 100, fontSize: 15, color: "#0F172A" },
  sendBtn: { width: 48, height: 48, borderRadius: 24, marginLeft: 10, justifyContent: "center", alignItems: "center", ...SHADOWS.medium },
});
