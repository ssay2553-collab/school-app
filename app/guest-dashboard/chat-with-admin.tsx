import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { AuthUser, db } from "../../firebaseConfig";

interface Message {
  sender: "guest" | "admin";
  text: string;
  timestamp: any;
}

export default function GuestChat() {
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const primary = SCHOOL_CONFIG.primaryColor;

  useEffect(() => {
    const initChat = async () => {
      try {
        const user = await AuthUser(true);
        if (!user) return;

        const q = query(
          collection(db, "guestTickets"),
          where("guestUid", "==", user.uid),
          where("status", "==", "open"),
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          setTicketId(existing.docs[0].id);
        } else {
          const newTicketRef = doc(collection(db, "guestTickets"));
          await setDoc(newTicketRef, {
            id: newTicketRef.id,
            guestUid: user.uid,
            guestName: "Guest-" + user.uid.substring(0, 4),
            status: "open",
            createdAt: serverTimestamp(),
            claimedByUid: null,
          });

          await addDoc(
            collection(db, "guestTickets", newTicketRef.id, "messages"),
            {
              sender: "admin",
              text: "Hello! Our management team has been notified and will respond to your inquiry soon. Thank you for your patience.",
              timestamp: serverTimestamp(),
            },
          );

          setTicketId(newTicketRef.id);
        }
      } catch (error) {
        console.error("Chat Init Error:", error);
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    const unsub = onSnapshot(
      query(
        collection(db, "guestTickets", ticketId, "messages"),
        orderBy("timestamp", "asc"),
      ),
      (snap) => {
        setMessages(snap.docs.map((d) => d.data() as Message));
        setTimeout(
          () => scrollRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      },
    );
    return unsub;
  }, [ticketId]);

  const sendMessage = async () => {
    if (!input.trim() || !ticketId) return;
    const msg = input.trim();
    setInput("");
    try {
      await addDoc(collection(db, "guestTickets", ticketId, "messages"), {
        sender: "guest",
        text: msg,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Send Error:", e);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inquiry Support</Text>
      </View>

      <ScrollView
        style={styles.msgList}
        ref={scrollRef}
        contentContainerStyle={{ padding: 15 }}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.sender === "guest"
                ? [styles.guest, { backgroundColor: primary }]
                : styles.admin,
            ]}
          >
            <Text
              style={[
                styles.msgText,
                { color: m.sender === "guest" ? "#fff" : "#1E293B" },
              ]}
            >
              {m.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Message support..."
          placeholderTextColor="#94A3B8"
          value={input}
          onChangeText={setInput}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={[styles.send, { backgroundColor: primary }]}
          disabled={!input.trim()}
        >
          <SVGIcon name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  msgList: { flex: 1 },
  bubble: {
    padding: 14,
    borderRadius: 20,
    marginVertical: 6,
    maxWidth: "85%",
    ...SHADOWS.small,
  },
  guest: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  admin: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 15, fontWeight: "500", lineHeight: 20 },
  inputBar: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 25,
    paddingHorizontal: 20,
    height: 48,
    fontSize: 15,
    color: "#1E293B",
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
});
