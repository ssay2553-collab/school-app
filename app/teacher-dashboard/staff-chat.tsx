import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    addDoc,
    collection,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
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
import * as Animatable from "react-native-animatable";
import { AudioPlayer } from "../../components/AudioPlayer";
import MessageBubble from "../../components/MessageBubble";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, storage } from "../../firebaseConfig";
import useUnreadCounts from "../../hooks/useUnreadCounts";

const QUICK_EMOJIS = [
  "😀",
  "😂",
  "👍",
  "🙌",
  "🔥",
  "✨",
  "📚",
  "🎓",
  "💡",
  "✅",
];

interface StaffMember {
  uid: string;
  fullName: string;
  role: "admin" | "teacher";
  adminRole?: string;
  email: string;
  profileImage?: string;
}

interface Message {
  id: string;
  text?: string;
  fileUrl?: string;
  senderId: string;
  createdAt: any;
  type: "text" | "audio";
}

const generateChatId = (uid1: string, uid2: string) =>
  [uid1, uid2].sort().join("_");

export default function StaffChat() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<"list" | "chat">("list");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [webRecorder, setWebRecorder] = useState<any | null>(null);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const webChunksRef = React.useRef<any[]>([]);
  const [showEmojis, setShowEmojis] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isFirstLoad = useRef(true);
  const messagesLenRef = useRef(0);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const { registerDirectChat, markChatRead, unregisterDirectChat } =
    useUnreadCounts();

  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  const playSound = async (type: "sent" | "received") => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      const soundFile =
        type === "sent"
          ? require("../../assets/message_sent.mp3")
          : require("../../assets/message_received.mp3");
      const { sound } = await Audio.Sound.createAsync(soundFile);
      soundRef.current = sound;
      await sound.playAsync();
    } catch (e) {
      console.log("Audio error:", e);
    }
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("role", "in", ["admin", "teacher"]),
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              fullName:
                `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
                "Staff Member",
              role: data.role,
              adminRole: data.adminRole,
              email: data.profile?.email || "",
              profileImage: data.profile?.profileImage,
            } as StaffMember;
          })
          .filter((s) => s.uid !== appUser?.uid);
        setStaff(list);
        setFilteredStaff(list);
      } catch (e) {
        console.error("Error fetching staff:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [appUser?.uid]);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredStaff(
      staff.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.adminRole && s.adminRole.toLowerCase().includes(q)),
      ),
    );
  }, [searchQuery, staff]);

  useEffect(() => {
    if (!chatId) return;
    registerDirectChat(chatId);
    markChatRead("direct", chatId);

    const q = query(
      collection(db, "directMessages", chatId, "messages"),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Message)
        .reverse();

      if (!isFirstLoad.current && msgs.length > messagesLenRef.current) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== appUser?.uid) {
          playSound("received");
          markChatRead("direct", chatId);
        }
      }

      setMessages(msgs);
      messagesLenRef.current = msgs.length;
      isFirstLoad.current = false;
    });

    return () => {
      unsub();
      unregisterDirectChat(chatId);
    };
  }, [chatId]);

  const handleSelectStaff = (member: StaffMember) => {
    setSelectedStaff(member);
    setChatId(generateChatId(appUser!.uid, member.uid));
    setStage("chat");
    isFirstLoad.current = true;
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          Alert.alert(
            "Unsupported",
            "Audio recording is not supported in this browser.",
          );
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        webChunksRef.current = [];
        const MediaRec =
          (window as any).MediaRecorder || (global as any).MediaRecorder;
        if (!MediaRec) {
          Alert.alert("Unsupported", "MediaRecorder not available.");
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const mediaRecorder = new MediaRec(stream);
        mediaRecorder.ondataavailable = (ev: any) => {
          if (ev.data && ev.data.size > 0) webChunksRef.current.push(ev.data);
        };
        mediaRecorder.start();
        setWebStream(stream);
        setWebRecorder(mediaRecorder);
        setRecording({ web: true });
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(recording);
    } catch (e) {
      console.error(e);
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    try {
      setUploading(true);

      if (Platform.OS === "web") {
        if (!webRecorder) return;
        webRecorder.stop();
        await new Promise((r) => setTimeout(r, 200));
        const blob = new Blob(webChunksRef.current, { type: "audio/webm" });
        webChunksRef.current = [];
        const audioRef = ref(
          storage,
          `chats/staff/${chatId}/${Date.now()}.webm`,
        );
        await uploadBytes(audioRef, blob);
        const audioUrl = await getDownloadURL(audioRef);
        await addDoc(collection(db, "directMessages", chatId!, "messages"), {
          type: "audio",
          fileUrl: audioUrl,
          senderId: appUser!.uid,
          createdAt: serverTimestamp(),
        });
        playSound("sent");
        setRecording(null);
        if (webStream) {
          webStream.getTracks().forEach((t) => t.stop());
          setWebStream(null);
        }
        setWebRecorder(null);
        setUploading(false);
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;

      const blob = await (await fetch(uri)).blob();
      const audioRef = ref(storage, `chats/staff/${chatId}/${Date.now()}.m4a`);
      await uploadBytes(audioRef, blob);
      const audioUrl = await getDownloadURL(audioRef);

      await addDoc(collection(db, "directMessages", chatId!, "messages"), {
        type: "audio",
        fileUrl: audioUrl,
        senderId: appUser!.uid,
        createdAt: serverTimestamp(),
      });
      playSound("sent");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to send voice message");
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !chatId) return;
    const text = input.trim();
    setInput("");
    setShowEmojis(false);
    try {
      await addDoc(collection(db, "directMessages", chatId, "messages"), {
        type: "text",
        text,
        senderId: appUser!.uid,
        createdAt: serverTimestamp(),
      });
      playSound("sent");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to send message");
    }
  };

  const addEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  if (stage === "chat" && selectedStaff) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
        >
          <View
            style={[styles.chatHeader, { borderBottomColor: primary + "20" }]}
          >
            <TouchableOpacity
              onPress={() => setStage("list")}
              style={styles.backBtn}
            >
              <SVGIcon name="arrow-back" size={24} color={primary} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.chatHeaderTitle}>
                {selectedStaff.fullName}
              </Text>
              <Text style={[styles.headerSub, { color: primary }]}>
                {selectedStaff.role === "admin"
                  ? selectedStaff.adminRole || "Admin"
                  : "Teacher"}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isYou={item.senderId === appUser?.uid}
              >
                {item.type === "text" && (
                  <Text
                    style={[
                      styles.msgText,
                      item.senderId === appUser?.uid
                        ? { color: "#fff" }
                        : { color: "#1E293B" },
                    ]}
                  >
                    {item.text}
                  </Text>
                )}
                {item.type === "audio" && <AudioPlayer url={item.fileUrl!} />}
              </MessageBubble>
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
              setShowEmojis(false);
            }}
            showsVerticalScrollIndicator={false}
          />

          {showEmojis && (
            <Animatable.View
              animation="fadeInUp"
              duration={300}
              style={styles.emojiContainer}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {QUICK_EMOJIS.map((emoji, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => addEmoji(emoji)}
                    style={styles.emojiBtn}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animatable.View>
          )}

          <View style={styles.inputArea}>
            {uploading && (
              <ActivityIndicator
                size="small"
                color={primary}
                style={{ marginBottom: 8 }}
              />
            )}
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={() => {
                  setShowEmojis(!showEmojis);
                  if (!showEmojis) Keyboard.dismiss();
                }}
                style={styles.emojiToggle}
              >
                <SVGIcon
                  name={showEmojis ? "keypad" : "happy-outline"}
                  size={26}
                  color={primary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPressIn={startRecording}
                onPressOut={stopRecordingAndSend}
                style={[styles.iconBtn, recording && styles.recordingBtn]}
              >
                <SVGIcon
                  name={recording ? "mic" : "mic-outline"}
                  size={22}
                  color={recording ? "#fff" : primary}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder="Type your message..."
                value={input}
                onChangeText={setInput}
                multiline
                onFocus={() => setShowEmojis(false)}
              />
              <TouchableOpacity
                onPress={handleSendMessage}
                style={[styles.sendBtn, { backgroundColor: primary }]}
                disabled={!input.trim()}
              >
                <SVGIcon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[primary, "#1E293B"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtnHeader}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitleMain}>Staff Directory</Text>
          <SVGIcon name="people" size={24} color={secondary} />
        </View>

        <View style={styles.searchContainer}>
          <SVGIcon name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff members..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>

      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <Animatable.View animation="fadeInUp" delay={index * 50}>
            <TouchableOpacity
              style={styles.staffCard}
              onPress={() => handleSelectStaff(item)}
            >
              <View
                style={[styles.avatar, { backgroundColor: primary + "10" }]}
              >
                <Text style={[styles.avatarText, { color: primary }]}>
                  {item.fullName.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffName}>{item.fullName}</Text>
                <View style={styles.roleRow}>
                  <Text
                    style={[
                      styles.roleText,
                      { color: item.role === "admin" ? "#EF4444" : primary },
                    ]}
                  >
                    {item.role === "admin"
                      ? item.adminRole || "Admin"
                      : "Teacher"}
                  </Text>
                </View>
              </View>
              <SVGIcon name="chatbubble-ellipses" size={20} color={primary} />
            </TouchableOpacity>
          </Animatable.View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyCenter}>
            <SVGIcon name="people" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No staff members found.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerGradient: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitleMain: { fontSize: 22, fontWeight: "900", color: "#fff" },
  backBtnHeader: { padding: 5 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "500",
  },
  listContent: { padding: 16 },
  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 12,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { fontSize: 20, fontWeight: "900" },
  staffName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  roleRow: { marginTop: 2 },
  roleText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyCenter: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyText: { color: "#94A3B8", marginTop: 15, fontWeight: "600" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    ...SHADOWS.small,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  chatHeaderTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  headerSub: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  messagesContainer: { padding: 20 },
  msgText: { fontSize: 15, lineHeight: 22 },
  emojiContainer: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  emojiBtn: { padding: 8, marginRight: 10 },
  emojiText: { fontSize: 24 },
  inputArea: {
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingBottom: Platform.OS === "ios" ? 25 : 20,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  emojiToggle: { padding: 5 },
  textInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: "#1E293B",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingBtn: { backgroundColor: "#EF4444" },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
