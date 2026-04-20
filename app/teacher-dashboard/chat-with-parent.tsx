import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    BackHandler,
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
import { sortClasses } from "../../lib/classHelpers";

type TeacherClass = { id: string; name: string };
type Student = { uid: string; fullName: string };
type Parent = { uid: string; fullName: string; email: string; phone: string };
type Message = {
  id: string;
  text?: string;
  fileUrl?: string;
  senderId: string;
  createdAt: any;
  type: "text" | "audio";
};

const generateChatId = (uid1: string, uid2: string) =>
  [uid1, uid2].sort().join("_");

export default function TeacherChatWithParent() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<
    "select_class" | "select_student" | "select_parent" | "chat"
  >("select_class");

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);

  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [webRecorder, setWebRecorder] = useState<any | null>(null);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const webChunksRef = React.useRef<any[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const isFirstLoad = useRef(true);
  const soundRef = useRef<Audio.Sound | null>(null);
  const messagesLenRef = useRef<number>(0);

  const handleBack = useCallback(() => {
    if (stage === "chat") {
      setStage("select_parent");
      setChatId(null);
    } else if (stage === "select_parent") {
      setStage("select_student");
      setSelectedParent(null);
    } else if (stage === "select_student") {
      setStage("select_class");
      setSelectedStudent(null);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/teacher-dashboard");
      }
    }
    return true;
  }, [stage, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => backHandler.remove();
  }, [handleBack]);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

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
    const fetchTeacherClasses = async () => {
      if (!appUser) return;
      try {
        const teacherSnap = await getDoc(doc(db, "users", appUser.uid));
        const classIds = teacherSnap.data()?.classes || [];
        if (classIds.length > 0) {
          const q = query(
            collection(db, "classes"),
            where("__name__", "in", classIds),
          );
          const snap = await getDocs(q);
          const list = snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
          }));
          setTeacherClasses(sortClasses(list));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherClasses();
  }, [appUser]);

  const handleSelectClass = async (cls: TeacherClass) => {
    setSelectedClass(cls);
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", cls.id),
      );
      const snap = await getDocs(q);
      setStudents(
        snap.docs.map((d) => ({
          uid: d.id,
          fullName:
            `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
        })),
      );
      setStage("select_student");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "parent"),
        where("childrenIds", "array-contains", student.uid),
      );
      const snap = await getDocs(q);
      setParents(
        snap.docs.map((d) => ({
          uid: d.id,
          fullName:
            `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
          email: d.data().profile?.email || "",
          phone: d.data().profile?.phone || "",
        })),
      );
      setStage("select_parent");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectParent = (parent: Parent) => {
    setSelectedParent(parent);
    setChatId(generateChatId(appUser!.uid, parent.uid));
    setStage("chat");
    isFirstLoad.current = true;
  };

  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "directMessages", chatId, "messages"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Message)
        .reverse();
      if (!isFirstLoad.current && msgs.length > messagesLenRef.current) {
        if (msgs[msgs.length - 1].senderId !== appUser?.uid)
          playSound("received");
      }
      setMessages(msgs);
      messagesLenRef.current = msgs.length;
      isFirstLoad.current = false;
    });
    return () => unsubscribe();
  }, [chatId, appUser?.uid]);

  const { registerDirectChat, markChatRead, unregisterDirectChat } =
    useUnreadCounts();
  useEffect(() => {
    if (!chatId) return;
    registerDirectChat(chatId);
    markChatRead("direct", chatId);
    return () => unregisterDirectChat(chatId);
  }, [chatId]);

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        // Web fallback using MediaRecorder / getUserMedia
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
          Alert.alert(
            "Unsupported",
            "MediaRecorder is not available in this environment.",
          );
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
        // set a sentinel recording object for UI
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
      Alert.alert("Error", "Failed to start recording.");
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    try {
      setUploading(true);

      if (Platform.OS === "web") {
        // stop the media recorder and assemble blob
        if (!webRecorder) return;
        webRecorder.stop();
        // wait briefly for onstop to populate chunks (ondataavailable already pushed them)
        await new Promise((r) => setTimeout(r, 200));
        const blob = new Blob(webChunksRef.current, { type: "audio/webm" });
        // clear chunks
        webChunksRef.current = [];

        const audioRef = ref(
          storage,
          `chats/parents/${chatId}/${Date.now()}.webm`,
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

        // cleanup
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
      const audioRef = ref(
        storage,
        `chats/parents/${chatId}/${Date.now()}.m4a`,
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
    try {
      await addDoc(collection(db, "directMessages", chatId, "messages"), {
        type: "text",
        text,
        senderId: appUser!.uid,
        createdAt: serverTimestamp(),
      });
      playSound("sent");
    } catch {
      Alert.alert("Error", "Message failed to send.");
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  if (stage === "chat" && selectedParent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
        >
          <View style={[styles.chatHeader, { backgroundColor: primary }]}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.chatBackBtn}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.chatUserInfo}>
              <Text style={styles.chatUserName}>{selectedParent.fullName}</Text>
              <Text style={styles.chatUserStatus}>Parent Account</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Parent Contact",
                  `Phone: ${selectedParent.phone}\nEmail: ${selectedParent.email}`,
                )
              }
            >
              <SVGIcon name="information-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
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
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          <View
            style={[
              styles.inputArea,
              { paddingBottom: Platform.OS === "android" ? 12 : 20 },
            ]}
          >
            {uploading && (
              <ActivityIndicator
                size="small"
                color={primary}
                style={{ marginBottom: 8 }}
              />
            )}
            <View style={styles.inputRow}>
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
                value={input}
                onChangeText={setInput}
                placeholder="Type your message..."
                placeholderTextColor="#94A3B8"
                multiline
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

  const listData =
    stage === "select_class"
      ? teacherClasses
      : stage === "select_student"
        ? students
        : parents;
  const stageTitle =
    stage === "select_class"
      ? "Select Class"
      : stage === "select_student"
        ? "Select Student"
        : "Select Parent";
  const stageSub =
    stage === "select_class"
      ? "Choose a classroom to begin"
      : stage === "select_student"
        ? `Students in ${selectedClass?.name}`
        : `Guardians of ${selectedStudent?.fullName}`;
  const stageIcon =
    stage === "select_class"
      ? "school"
      : stage === "select_student"
        ? "people"
        : "person";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[primary, "#1E293B"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{stageTitle}</Text>
            <Text style={styles.headerSubtitle}>{stageSub}</Text>
          </View>
          <SVGIcon name={stageIcon} size={24} color={secondary} />
        </View>
      </LinearGradient>
      <FlatList
        data={listData as any}
        keyExtractor={(item, index) => item.id || item.uid || index.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <Animatable.View animation="fadeInUp" delay={index * 50}>
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => {
                if (stage === "select_class") handleSelectClass(item);
                else if (stage === "select_student") handleSelectStudent(item);
                else handleSelectParent(item);
              }}
            >
              <View
                style={[
                  styles.listIconBox,
                  { backgroundColor: primary + "10" },
                ]}
              >
                <SVGIcon
                  name={stage === "select_class" ? "school" : "person"}
                  size={20}
                  color={primary}
                />
              </View>
              <Text style={styles.listItemText}>
                {item.name || item.fullName}
              </Text>
              <SVGIcon name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          </Animatable.View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyCenter}>
            <SVGIcon name="chatbubbles" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No entries found.</Text>
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: 15 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  listContent: { padding: 20 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  listIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  listItemText: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1E293B" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    ...SHADOWS.medium,
  },
  chatBackBtn: { padding: 5 },
  chatUserInfo: { flex: 1, alignItems: "center" },
  chatUserName: { fontSize: 18, fontWeight: "800", color: "#fff" },
  chatUserStatus: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  inputArea: {
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  textInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
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
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 150,
  },
  emptyText: { color: "#94A3B8", marginTop: 15, fontWeight: "600" },
});
