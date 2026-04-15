import { Audio } from "expo-av";
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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useRef, useState } from "react";
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
import { AudioPlayer } from "../../components/AudioPlayer";
import MessageBubble from "../../components/MessageBubble";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, storage } from "../../firebaseConfig";
import useUnreadCounts from "../../hooks/useUnreadCounts";

export default function GroupChat() {
  const { groupId, groupName } = useLocalSearchParams();
  const { appUser } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [webRecorder, setWebRecorder] = useState<any | null>(null);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const webChunksRef = React.useRef<any[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const messagesLenRef = useRef(0);

  const primary = SCHOOL_CONFIG.primaryColor;

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
    if (!groupId) return;
    const q = query(
      collection(db, "studentGroups", groupId as string, "messages"),
      orderBy("timestamp", "asc"),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      const newMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (
        messagesLenRef.current > 0 &&
        newMsgs.length > messagesLenRef.current
      ) {
        const lastMsg = newMsgs[newMsgs.length - 1] as any;
        if (lastMsg.senderId !== appUser?.uid) {
          playSound("received");
        }
      }

      setMessages(newMsgs);
      messagesLenRef.current = newMsgs.length;
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [groupId]);

  const { markChatRead } = useUnreadCounts();
  useEffect(() => {
    if (groupId) markChatRead("group", String(groupId));
  }, [groupId]);

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
          `chats/groups/${groupId}/${Date.now()}.webm`,
        );
        await uploadBytes(audioRef, blob);
        const audioUrl = await getDownloadURL(audioRef);
        await addDoc(
          collection(db, "studentGroups", groupId as string, "messages"),
          {
            senderId: appUser!.uid,
            senderName: `${appUser!.profile?.firstName ?? ""} ${appUser!.profile?.lastName ?? ""}`,
            type: "audio",
            fileUrl: audioUrl,
            timestamp: serverTimestamp(),
          },
        );
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
      const audioRef = ref(
        storage,
        `chats/groups/${groupId}/${Date.now()}.m4a`,
      );
      await uploadBytes(audioRef, blob);
      const audioUrl = await getDownloadURL(audioRef);

      await addDoc(
        collection(db, "studentGroups", groupId as string, "messages"),
        {
          senderId: appUser!.uid,
          senderName: `${appUser!.profile?.firstName ?? ""} ${appUser!.profile?.lastName ?? ""}`,
          type: "audio",
          fileUrl: audioUrl,
          timestamp: serverTimestamp(),
        },
      );
      playSound("sent");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to send voice message");
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !appUser || !groupId) return;
    setInput("");

    try {
      await addDoc(
        collection(db, "studentGroups", groupId as string, "messages"),
        {
          senderId: appUser.uid,
          senderName: `${appUser.profile?.firstName ?? ""} ${appUser.profile?.lastName ?? ""}`,
          text,
          type: "text",
          timestamp: serverTimestamp(),
        },
      );
      playSound("sent");
    } catch (e) {
      console.error("Send Message Error:", e);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color={primary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {groupName || "Group Chat"} 💬
            </Text>
            <Text style={styles.headerSub}>Learning together!</Text>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <SVGIcon name="information-circle" size={24} color={primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={{ padding: 15, paddingBottom: 160 }}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={{
                type: m.type || "text",
                text: m.text,
                senderName: m.senderName,
                fileUrl: m.fileUrl,
                createdAt: m.timestamp,
              }}
              isYou={m.senderId === appUser?.uid}
            >
              {m.type === "audio" ? (
                <AudioPlayer url={m.fileUrl} />
              ) : (
                <Text
                  style={[
                    styles.msgText,
                    m.senderId === appUser?.uid
                      ? { color: "#fff" }
                      : { color: "#1E293B" },
                  ]}
                >
                  {m.text}
                </Text>
              )}
            </MessageBubble>
          ))}
        </ScrollView>

        <View style={styles.inputBar}>
          {uploading && (
            <ActivityIndicator
              size="small"
              color={primary}
              style={{ marginRight: 10 }}
            />
          )}

          <TouchableOpacity
            onPressIn={startRecording}
            onPressOut={stopRecordingAndSend}
            style={[styles.iconBtn, recording && styles.recordingBtn]}
          >
            <SVGIcon
              name={recording ? "mic" : "mic-outline"}
              size={24}
              color={recording ? "#fff" : primary}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[
              styles.sendBtn,
              { backgroundColor: primary },
              !input.trim() && { opacity: 0.5 },
            ]}
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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: { flex: 1, marginLeft: 15 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  headerSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  headerAction: { padding: 5 },
  chatArea: { flex: 1 },
  msgText: { fontSize: 15, lineHeight: 22 },
  inputBar: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    paddingBottom: Platform.OS === "ios" ? 25 : 20,
  },
  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: "#0F172A",
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
    ...SHADOWS.medium,
  },
});
