import { Picker } from "@react-native-picker/picker";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    arrayUnion,
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
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
import { useToast } from "../../contexts/ToastContext";
import { db, storage } from "../../firebaseConfig";
import { sortClasses } from "../../lib/classHelpers";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

interface ChatMessage {
  id: string;
  type: "text" | "audio";
  text?: string;
  fileUrl?: string;
  sender: "admin" | "parent";
  createdAt: number;
}

interface Parent {
  uid: string;
  fullName: string;
  email: string;
  pushToken?: string;
  childrenClassIds?: string[];
  children?: { name: string; classId: string }[];
}

export default function ChatWithParent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { appUser } = useAuth();
  const [parents, setParents] = useState<Parent[]>([]);
  const [filteredParents, setFilteredParents] = useState<Parent[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [searchQuery, setSearchBar] = useState("");

  const [selected, setSelected] = useState<Parent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState<any | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [webRecorder, setWebRecorder] = useState<any | null>(null);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const webChunksRef = React.useRef<any[]>([]);
  const webBlobRef = React.useRef<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const isFirstLoad = useRef(true);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const playSound = async (type: "sent" | "received") => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
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

  // Load parents and classes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Classes for filtering
        const classesSnap = await getDocsCacheFirst(
          collection(db, "classes") as any,
        );
        const classList = classesSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setClasses(sortClasses(classList));

        // 2. Fetch Students to link parents to children names
        const studentsSnap = await getDocs(
          query(collection(db, "users"), where("role", "==", "student")),
        );
        const studentMap: Record<string, { name: string; classId: string }> =
          {};
        studentsSnap.docs.forEach((doc) => {
          const data = doc.data();
          studentMap[doc.id] = {
            name: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim(),
            classId: data.classId,
          };
        });

        // 3. Fetch Parents
        const q = query(collection(db, "users"), where("role", "==", "parent"));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data();
          const childrenIds = data.childrenIds || [];
          const childrenData = childrenIds
            .map((id: string) => studentMap[id])
            .filter(Boolean);

          return {
            uid: d.id,
            fullName:
              `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
              "Parent",
            email: data.profile?.email || "No email",
            pushToken: data.pushToken,
            childrenClassIds: childrenData.map((c: any) => c.classId),
            children: childrenData,
          };
        });
        setParents(list);
        setFilteredParents(list);
      } catch (error) {
        console.error("Error fetching chat data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filtering Logic
  useEffect(() => {
    let result = parents;
    if (selectedClassId !== "all") {
      result = result.filter((p) =>
        p.childrenClassIds?.includes(selectedClassId),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.children?.some((c) => c.name.toLowerCase().includes(q)),
      );
    }
    setFilteredParents(result);
  }, [selectedClassId, searchQuery, parents]);

  // Real-time chat listener
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }

    isFirstLoad.current = true;
    const chatRef = doc(db, "chats", selected.uid);
    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const newMessages = snap.data().messages || [];

        if (
          !isFirstLoad.current &&
          newMessages.length > messagesRef.current.length
        ) {
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.sender === "parent") {
            playSound("received");
          }
        }

        const limitedMessages = newMessages.slice(-20);
        setMessages(limitedMessages);
        isFirstLoad.current = false;
      } else {
        setMessages([]);
      }
    });

    return unsub;
  }, [selected]);

  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showToast({ message: "Audio recording is not supported in this browser.", type: "error" });
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        webChunksRef.current = [];
        const MediaRec =
          (window as any).MediaRecorder || (global as any).MediaRecorder;
        if (!MediaRec) {
          showToast({ message: "MediaRecorder is not available in this environment.", type: "error" });
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
        setPreviewUri(null);
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
      setPreviewUri(null);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      if (Platform.OS === "web") {
        if (!webRecorder) return;
        webRecorder.stop();
        // allow ondataavailable to flush
        await new Promise((r) => setTimeout(r, 200));
        const blob = new Blob(webChunksRef.current, { type: "audio/webm" });
        webChunksRef.current = [];
        webBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUri(url);
        setRecording(null);
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setPreviewUri(uri);
    } catch (err) {
      console.error(err);
    }
  };

  const sendVoiceMessage = async () => {
    if ((!previewUri && !webBlobRef.current) || !selected) return;
    try {
      setUploading(true);
      let blob: Blob | null = null;
      if (Platform.OS === "web") {
        blob = webBlobRef.current;
      } else if (previewUri) {
        blob = await (await fetch(previewUri)).blob();
      }
      if (!blob) return;
      const ext = Platform.OS === "web" ? "webm" : "m4a";
      const audioRef = ref(
        storage,
        `chats/${selected.uid}/${Date.now()}.${ext}`,
      );
      await uploadBytes(audioRef, blob);
      const audioUrl = await getDownloadURL(audioRef);
      await sendMessage({ type: "audio", fileUrl: audioUrl });
      setPreviewUri(null);
      if (webStream) {
        webStream.getTracks().forEach((t) => t.stop());
        setWebStream(null);
      }
      webBlobRef.current = null;
    } catch (err) {
      console.error(err);
      showToast({ message: "Failed to upload audio", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async ({
    type = "text",
    text,
    fileUrl,
  }: {
    type?: "text" | "audio";
    text?: string;
    fileUrl?: string;
  }) => {
    if (!selected) return;
    if (type === "text" && !text?.trim()) return;
    if (type === "audio" && !fileUrl) return;

    const msg: any = {
      id: Date.now().toString(),
      type,
      sender: "admin",
      createdAt: Date.now(),
    };

    if (type === "text") msg.text = text!.trim();
    if (type === "audio") msg.fileUrl = fileUrl;

    const currentInput = input;
    if (type === "text") setInput("");

    try {
      const chatRef = doc(db, "chats", selected.uid);
      await setDoc(
        chatRef,
        {
          messages: arrayUnion(msg),
          lastUpdated: Date.now(),
          lastMessageFrom: "admin",
          parentUid: selected.uid, // Ensure parent can find the chat
          parentName: selected.fullName,
        },
        { merge: true },
      );
      playSound("sent");
    } catch (err) {
      console.error("Send error", err);
      if (type === "text") setInput(currentInput);
      showToast({ message: "Failed to send message", type: "error" });
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  if (!selected) {
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
            <Text style={styles.headerTitleMain}>Parent Relations</Text>
            <SVGIcon name="chatbubble-ellipses" size={24} color={secondary} />
          </View>

          <View style={styles.searchContainer}>
            <SVGIcon name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by parent or student name..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchBar}
            />
          </View>

          <View style={styles.filterRow}>
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerLabel}>FILTER BY CLASS</Text>
              <View style={styles.pickerInner}>
                <Picker
                  selectedValue={selectedClassId}
                  onValueChange={setSelectedClassId}
                  style={styles.picker}
                  dropdownIconColor="#fff"
                >
                  <Picker.Item
                    label="All Classes"
                    value="all"
                    color="#94A3B8"
                  />
                  {classes.map((c) => (
                    <Picker.Item
                      key={c.id}
                      label={c.name}
                      value={c.id}
                      color="#000"
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </LinearGradient>

        <FlatList
          data={filteredParents}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <Animatable.View animation="fadeInUp" delay={index * 50}>
              <TouchableOpacity
                style={styles.parentCard}
                onPress={() => setSelected(item)}
              >
                <View
                  style={[styles.avatar, { backgroundColor: primary + "10" }]}
                >
                  <Text style={[styles.avatarText, { color: primary }]}>
                    {item.fullName.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.parentName}>{item.fullName}</Text>
                  <View style={styles.childrenRow}>
                    <SVGIcon name="school" size={12} color="#94A3B8" />
                    <Text style={styles.childrenText}>
                      {item.children?.map((c) => c.name).join(", ") ||
                        "No linked students"}
                    </Text>
                  </View>
                </View>
                <SVGIcon name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            </Animatable.View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyCenter}>
              <SVGIcon name="people" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No matching parents found.</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => setSelected(null)}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color={primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.chatHeaderTitle}>{selected.fullName}</Text>
            <Text style={styles.headerSub}>Parent</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              Alert.alert("Parent Info", `Email: ${selected.email}`)
            }
          >
            <View
              style={[styles.infoIcon, { backgroundColor: primary + "10" }]}
            >
              <SVGIcon name="information-circle" size={24} color={primary} />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.messagesContainer,
            { paddingBottom: 160 },
          ]}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyCenterChat}>
              <SVGIcon name="chatbubbles" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTextChat}>
                Start a conversation with this parent.
              </Text>
            </View>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isYou={m.sender === "admin"}
              >
                {m.type === "text" && m.text && (
                  <Text
                    style={[
                      styles.msgText,
                      m.sender === "admin"
                        ? { color: "#fff" }
                        : { color: "#1E293B" },
                    ]}
                  >
                    {m.text}
                  </Text>
                )}
                {m.type === "audio" && m.fileUrl && (
                  <AudioPlayer url={m.fileUrl} />
                )}
              </MessageBubble>
            ))
          )}
        </ScrollView>

        <View style={styles.inputArea}>
          {uploading && (
            <ActivityIndicator
              size="small"
              color={primary}
              style={{ marginBottom: 8 }}
            />
          )}
          {previewUri ? (
            <Animatable.View
              animation="slideInUp"
              duration={300}
              style={styles.previewContainer}
            >
              <TouchableOpacity onPress={() => setPreviewUri(null)}>
                <SVGIcon name="close-circle" size={32} color="#EF4444" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <AudioPlayer url={previewUri} />
              </View>
              <TouchableOpacity
                onPress={sendVoiceMessage}
                style={[styles.sendVoiceBtn, { backgroundColor: primary }]}
              >
                <SVGIcon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </Animatable.View>
          ) : (
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={recording ? stopRecording : startRecording}
                style={[styles.iconBtn, recording && styles.recordingBtn]}
              >
                <SVGIcon
                  name={recording ? "square" : "mic"}
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
              />

              <TouchableOpacity
                onPress={() => sendMessage({ text: input })}
                style={[styles.sendBtn, { backgroundColor: primary }]}
                disabled={!input.trim()}
              >
                <SVGIcon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "500",
  },
  filterRow: { marginBottom: 5 },
  pickerWrapper: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 15,
    height: 55,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  pickerLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#fff",
    position: "absolute",
    top: 6,
    left: 12,
    zIndex: 1,
  },
  pickerInner: { marginTop: 10 },
  picker: {
    color: "#fff",
    backgroundColor: "transparent",
    ...Platform.select({
      web: {
        outlineWidth: 0,
        borderStyle: "none",
        paddingHorizontal: 10,
      } as any,
    }),
  },
  listContent: { padding: 16, paddingBottom: 40 },
  parentCard: {
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
  parentName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  childrenRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 5,
  },
  childrenText: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  parentEmail: { fontSize: 12, color: "#64748B", marginTop: 2 },
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
    borderBottomColor: "#F1F5F9",
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
  headerSub: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesContainer: { padding: 20, paddingBottom: 160 },
  msgText: { fontSize: 15, lineHeight: 22 },
  emptyCenterChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 150,
  },
  emptyTextChat: {
    color: "#94A3B8",
    marginTop: 15,
    textAlign: "center",
    fontSize: 14,
  },
  inputArea: {
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingBottom: Platform.OS === "ios" ? 25 : 20,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 20,
  },
  sendVoiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
