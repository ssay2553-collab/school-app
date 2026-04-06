import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    limitToLast,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import MessageBubble from "../../components/MessageBubble";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

export default function AdminGuestChat() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);

  const soundRef = useRef<Audio.Sound | null>(null);
  const isFirstLoad = useRef(true);
  const messagesLenRef = useRef<number>(0);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const playSound = async (type: "sent" | "received") => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
      }
      const soundFile =
        type === "sent"
          ? require("../../assets/message_sent.mp3")
          : require("../../assets/message_received.mp3");

      const { sound } = await Audio.Sound.createAsync(soundFile);
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log("Audio error:", error);
    }
  };

  useEffect(() => {
    const ticketsRef = collection(db, "guestTickets");
    const q = query(ticketsRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const allTickets = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as any[];

        const filtered = allTickets.filter((t) => {
          if (t.status !== "handled" || !t.handledAt) return true;
          const handledTime = t.handledAt.toDate
            ? t.handledAt.toDate().getTime()
            : new Date(t.handledAt).getTime();
          const now = new Date().getTime();
          const diffMinutes = (now - handledTime) / (1000 * 60);
          return diffMinutes < 30;
        });

        setTickets(filtered);
        setLoading(false);
      },
      (error) => {
        console.error("Tickets Listener Error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeTicketId) {
      setMessages([]);
      messagesLenRef.current = 0;
      return;
    }
    isFirstLoad.current = true;
    const messagesRef = collection(
      db,
      "guestTickets",
      activeTicketId,
      "messages",
    );
    const q = query(messagesRef, orderBy("timestamp", "asc"), limitToLast(20));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const newMsgs = snap.docs.map((d) => d.data());
        const prevLen = messagesLenRef.current;
        if (!isFirstLoad.current && newMsgs.length > prevLen) {
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg?.sender === "guest") {
            playSound("received");
          }
        }
        setMessages(newMsgs);
        messagesLenRef.current = newMsgs.length;
        isFirstLoad.current = false;
        setTimeout(
          () => scrollRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      },
      (error) => {
        console.error("Messages Listener Error:", error);
      },
    );
    return unsub;
  }, [activeTicketId]);

  const claimTicket = async (ticketId: string) => {
    if (!appUser) return;
    const ticketRef = doc(db, "guestTickets", ticketId);
    try {
      await updateDoc(ticketRef, {
        claimedByUid: appUser.uid,
        claimedByRole: appUser.adminRole || "Admin",
        status: "open",
      });
      setActiveTicketId(ticketId);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not claim ticket");
    }
  };

  const markAsHandled = async () => {
    if (!activeTicketId) return;
    Alert.alert(
      "Resolve Ticket",
      "This will mark the inquiry as handled. It will be cleared from your list in 30 minutes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Handled",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "guestTickets", activeTicketId), {
                status: "handled",
                handledAt: serverTimestamp(),
              });
              setActiveTicketId(null);
              Alert.alert("Success", "Ticket resolved.");
            } catch {
              Alert.alert("Error", "Failed to update status.");
            }
          },
        },
      ],
    );
  };

  const sendMessage = async () => {
    if (!activeTicketId || !input.trim() || !appUser) return;
    const ticket = tickets.find((t) => t.id === activeTicketId);
    if (!ticket) return;
    if (ticket.claimedByUid && ticket.claimedByUid !== appUser.uid) {
      Alert.alert(
        "Locked",
        `This ticket is handled by ${ticket.claimedByRole}`,
      );
      return;
    }
    const textToSend = input.trim();
    setInput("");
    try {
      const messagesRef = collection(
        db,
        "guestTickets",
        activeTicketId,
        "messages",
      );
      await addDoc(messagesRef, {
        sender: "admin",
        text: textToSend,
        timestamp: serverTimestamp(),
      });
      playSound("sent");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Message failed to send.");
    }
  };

  const activeTicket = useMemo(
    () => tickets.find((t) => t.id === activeTicketId),
    [activeTicketId, tickets],
  );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Guest Inquiries</Text>
          <Text style={styles.headerSubtitle}>Real-time support tickets</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
      >
        <View style={styles.ticketListContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ticketList}
          >
            {tickets.map((t) => {
              const isSelected = activeTicketId === t.id;
              const isMine = t.claimedByUid === appUser?.uid;
              const isHandled = t.status === "handled";
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.ticketBtn,
                    isSelected && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                    isHandled &&
                      !isSelected && { opacity: 0.6, borderStyle: "dotted" },
                  ]}
                  onPress={() => setActiveTicketId(t.id)}
                >
                  <View style={styles.ticketHeader}>
                    <Text
                      style={[
                        styles.ticketBtnText,
                        isSelected && { color: "#fff" },
                      ]}
                    >
                      {t.guestName}
                    </Text>
                    {isHandled && (
                      <SVGIcon
                        name="checkmark-done-circle"
                        size={16}
                        color={isSelected ? "#fff" : COLORS.success}
                      />
                    )}
                  </View>
                  {t.claimedByUid ? (
                    <Text
                      style={[
                        styles.claimStatus,
                        isSelected && { color: "#eee" },
                      ]}
                    >
                      {isMine ? "Handling" : t.claimedByRole}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => claimTicket(t.id)}
                      style={[styles.claimButton, { backgroundColor: primary }]}
                    >
                      <Text style={styles.claimButtonText}>Claim</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.chatArea}>
          {activeTicketId && activeTicket?.status !== "handled" && (
            <TouchableOpacity
              style={[styles.resolveBtn, { backgroundColor: primary }]}
              onPress={markAsHandled}
            >
              <SVGIcon name="checkmark-done-circle" size={20} color="#fff" />
              <Text style={styles.resolveBtnText}>Mark as Handled</Text>
            </TouchableOpacity>
          )}

          <ScrollView
            style={styles.messagesContainer}
            contentContainerStyle={{
              flexGrow: 1,
              padding: 15,
              paddingBottom: 160,
            }}
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
            }}
            keyboardShouldPersistTaps="handled"
          >
            {!activeTicketId ? (
              <View style={styles.noSelection}>
                <View
                  style={[
                    styles.noSelectionCircle,
                    { backgroundColor: primary + "10" },
                  ]}
                >
                  <SVGIcon
                    name="chatbubble-ellipses"
                    size={64}
                    color={primary}
                  />
                </View>
                <Text style={styles.noSelectionText}>
                  Select an inquiry to start chatting
                </Text>
              </View>
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  isYou={msg.sender === "admin"}
                />
              ))
            )}
          </ScrollView>
        </View>

        {activeTicketId && activeTicket?.status !== "handled" && (
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Type your response..."
              style={styles.input}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity
              onPress={sendMessage}
              style={[
                styles.sendButton,
                { backgroundColor: primary },
                !input.trim() && { opacity: 0.5 },
              ]}
              disabled={!input.trim()}
            >
              <SVGIcon name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#0F172A" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  ticketListContainer: {
    paddingVertical: 15,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  ticketList: { paddingHorizontal: 10 },
  ticketBtn: {
    backgroundColor: "#fff",
    padding: 12,
    marginRight: 10,
    borderRadius: 16,
    minWidth: 130,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketBtnText: { fontWeight: "bold", fontSize: 14, color: "#1E293B" },
  claimStatus: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "600",
  },
  claimButton: {
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  claimButtonText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  chatArea: { flex: 1 },
  resolveBtn: {
    flexDirection: "row",
    padding: 12,
    margin: 15,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  resolveBtnText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 13,
  },
  messagesContainer: { flex: 1 },
  noSelection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },
  noSelectionCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  noSelectionText: { color: "#64748B", fontSize: 16, fontWeight: "600" },
  inputContainer: {
    flexDirection: "row",
    padding: 15,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#fff",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 35 : 20,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: "#0F172A",
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
});
