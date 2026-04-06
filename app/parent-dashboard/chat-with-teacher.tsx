import { Audio } from "expo-av";
import {
    addDoc,
    collection,
    documentId,
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
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, storage } from "../../firebaseConfig";
import useUnreadCounts from "../../hooks/useUnreadCounts";

type Child = {
  uid: string;
  profile: { firstName: string; lastName: string };
  classId: string;
};
type Teacher = {
  uid: string;
  profile: { firstName: string; lastName: string; phone: string };
  pushToken?: string;
};
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

export default function ParentChatWithTeacher() {
  const { appUser } = useAuth();
  const [stage, setStage] = useState<
    "select_child" | "select_teacher" | "chat"
  >("select_child");
  const [children, setChildren] = useState<Child[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const isFirstLoad = useRef(true);
  const soundRef = useRef<Audio.Sound | null>(null);
  const messagesLenRef = useRef<number>(0);
  const appUserUidRef = useRef<string | undefined>(appUser?.uid);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  useEffect(() => {
    appUserUidRef.current = appUser?.uid;
  }, [appUser?.uid]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const playNotificationSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/notification.mp3"),
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log("Audio error:", error);
    }
  };

  useEffect(() => {
    const fetchParentData = async () => {
      if (!appUser || appUser.role !== "parent") return;
      try {
        const childUids = appUser.childrenIds || [];
        if (childUids.length > 0) {
          const q = query(
            collection(db, "users"),
            where(documentId(), "in", childUids),
          );
          const snap = await getDocs(q);
          const list = snap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((s: any) => s.role === "student") as Child[];
          setChildren(list);
          if (list.length === 1) handleSelectChild(list[0]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchParentData();
  }, [appUser]);

  const handleSelectChild = async (child: Child) => {
    setSelectedChild(child);
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "teacher"),
        where("classes", "array-contains", child.classId),
      );
      const snap = await getDocs(q);
      setTeachers(
        snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as Teacher[],
      );
      setStage("select_teacher");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeacher = (t: Teacher) => {
    setSelectedTeacher(t);
    setChatId(generateChatId(appUser!.uid, t.uid));
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
      const msgs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];
      const sorted = msgs.reverse();

      const prevLen = messagesLenRef.current;
      if (!isFirstLoad.current && sorted.length > prevLen) {
        const last = sorted[sorted.length - 1];
        if (last && last.senderId !== appUserUidRef.current)
          playNotificationSound();
      }
      setMessages(sorted);
      messagesLenRef.current = sorted.length;
      isFirstLoad.current = false;
    });
    return () => unsubscribe();
  }, [chatId]);

  const { registerDirectChat, markChatRead, unregisterDirectChat } =
    useUnreadCounts();
  useEffect(() => {
    if (!chatId) return;
    registerDirectChat(chatId);
    markChatRead("direct", chatId);
    return () => {
      unregisterDirectChat(chatId);
    };
  }, [chatId]);

  const startRecording = async () => {
    try {
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
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setPreviewUri(uri);
    } catch (err) {
      console.error(err);
    }
  };

  const sendVoiceMessage = async () => {
    if (!previewUri || !chatId) return;
    try {
      setUploading(true);
      const blob = await (await fetch(previewUri)).blob();
      const audioRef = ref(storage, `chats/${chatId}/${Date.now()}.m4a`);
      await uploadBytes(audioRef, blob);
      const audioUrl = await getDownloadURL(audioRef);
      await sendMessage({ type: "audio", fileUrl: audioUrl });
      setPreviewUri(null);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to upload audio");
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    await sendMessage({ type: "text", text: messageText.trim() });
    setMessageText("");
  };

  const sendMessage = async ({
    type,
    text,
    fileUrl,
  }: {
    type: "text" | "audio";
    text?: string;
    fileUrl?: string;
  }) => {
    if (!chatId) return;
    await addDoc(collection(db, "directMessages", chatId, "messages"), {
      text: text || null,
      fileUrl: fileUrl || null,
      senderId: appUser!.uid,
      createdAt: serverTimestamp(),
      type,
    });
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  if (stage === "chat" && selectedTeacher) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#fff" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
      >
        <View style={[styles.chatHeader, { backgroundColor: primary }]}>
          <TouchableOpacity onPress={() => setStage("select_teacher")}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.chatHeaderText}>
            {selectedTeacher.profile.firstName}{" "}
            {selectedTeacher.profile.lastName}
          </Text>
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
              {item.type === "text" && item.text && (
                <Text
                  style={{
                    fontSize: 15,
                    color: item.senderId === appUser?.uid ? "#fff" : "#1E293B",
                  }}
                >
                  {item.text}
                </Text>
              )}
              {item.type === "audio" && item.fileUrl && (
                <AudioPlayer url={item.fileUrl} />
              )}
            </MessageBubble>
          )}
          contentContainerStyle={{ padding: 10, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
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
          {previewUri ? (
            <Animatable.View
              animation="slideInUp"
              duration={300}
              style={styles.previewContainer}
            >
              <TouchableOpacity onPress={() => setPreviewUri(null)}>
                <SVGIcon name="close-circle" size={28} color={COLORS.danger} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <AudioPlayer url={previewUri} />
              </View>
              <TouchableOpacity onPress={sendVoiceMessage}>
                <SVGIcon name="send" size={24} color={primary} />
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
                  size={24}
                  color={recording ? "#fff" : COLORS.gray}
                />
              </TouchableOpacity>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type your message..."
                style={styles.input}
                multiline
              />
              <TouchableOpacity
                onPress={handleSendMessage}
                style={[
                  styles.sendBtn,
                  { backgroundColor: primary },
                  !messageText.trim() && styles.sendBtnDisabled,
                ]}
                disabled={!messageText.trim()}
              >
                <SVGIcon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { color: primary }]}>
        {stage === "select_child" ? "Select Student" : "Select Teacher"}
      </Text>
      <FlatList
        data={(stage === "select_child" ? children : teachers) as any}
        renderItem={({ item }: any) => (
          <TouchableOpacity
            style={styles.listItem}
            onPress={() =>
              stage === "select_child"
                ? handleSelectChild(item)
                : handleSelectTeacher(item)
            }
          >
            <Text style={styles.listItemText}>
              {item.profile.firstName} {item.profile.lastName}
            </Text>
            <SVGIcon name="chevron-forward" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  listItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...SHADOWS.small,
  },
  listItemText: { fontSize: 16, fontWeight: "600" },
  chatHeader: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatHeaderText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  inputArea: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#fff",
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
    color: "#1E293B",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: COLORS.gray + "50" },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingBtn: { backgroundColor: "#EF4444" },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 8,
  },
});
