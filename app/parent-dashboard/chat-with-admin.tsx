import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { arrayUnion, doc, onSnapshot, setDoc } from "firebase/firestore";
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

interface ChatMessage {
  id: string;
  type: "text" | "audio";
  text?: string;
  fileUrl?: string;
  sender: "parent" | "admin";
  createdAt: number;
}

export default function ChatWithAdmin() {
  const { appUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;

  useEffect(() => {
    if (!appUser) return;
    const chatRef = doc(db, "chats", appUser.uid);
    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        setMessages(snap.data().messages || []);
      } else {
        setMessages([]);
      }
    });
    return unsub;
  }, [appUser]);

  const scrollToBottom = (animated = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(), 200);
    }
  }, [messages]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(() => scrollToBottom(), 100);
    });
    return () => showSubscription.remove();
  }, []);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Microphone access is needed");
        return;
      }
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
    if (!previewUri || !appUser) return;
    try {
      setUploading(true);
      const response = await fetch(previewUri);
      const blob = await response.blob();
      const audioRef = ref(storage, `chats/${appUser.uid}/${Date.now()}.m4a`);
      await uploadBytes(audioRef, blob);
      const audioUrl = await getDownloadURL(audioRef);
      await sendMessage({ type: "audio", fileUrl: audioUrl });
      setPreviewUri(null);
    } catch (err) {
      Alert.alert("Error", "Failed to send voice message");
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
    if (!appUser) return;
    if (type === "text" && !text?.trim()) return;
    if (type === "audio" && !fileUrl) return;

    const msg: any = {
      id: Date.now().toString(),
      type,
      sender: "parent",
      createdAt: Date.now(),
    };

    if (type === "text" && text) msg.text = text.trim();
    else if (type === "audio" && fileUrl) msg.fileUrl = fileUrl;

    const currentInput = input;
    if (type === "text") setInput("");

    try {
      const chatRef = doc(db, "chats", appUser.uid);
      await setDoc(
        chatRef,
        {
          messages: arrayUnion(msg),
          lastUpdated: Date.now(),
          parentUid: appUser.uid,
          parentName: `${appUser.profile?.firstName} ${appUser.profile?.lastName}`,
        },
        { merge: true },
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Message Sent",
          body: type === "text" ? text : "🎤 Voice message sent",
        },
        trigger: null,
      });
    } catch (err) {
      if (type === "text") setInput(currentInput);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <View style={[styles.header, { borderBottomColor: primary + "20" }]}>
        <Text style={styles.headerTitle}>Admin Support</Text>
        <Text style={styles.headerSub}>Real-time assistance</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.messagesList, { paddingBottom: 160 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <SVGIcon name="chatbubble-ellipses" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                Start a conversation with school administration.
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isYou={msg.sender === "parent"}
              >
                {msg.type === "text" && msg.text && (
                  <Text
                    style={[
                      styles.msgText,
                      msg.sender === "parent"
                        ? { color: "#fff" }
                        : { color: "#1E293B" },
                    ]}
                  >
                    {msg.text}
                  </Text>
                )}
                {msg.type === "audio" && msg.fileUrl && (
                  <AudioPlayer url={msg.fileUrl} />
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
                <SVGIcon name="close-circle" size={32} color={COLORS.danger} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <AudioPlayer url={previewUri} />
              </View>
              <TouchableOpacity onPress={sendVoiceMessage}>
                <SVGIcon name="send" size={28} color={primary} />
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
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                style={styles.input}
                multiline
              />
              <TouchableOpacity
                onPress={() => sendMessage({ type: "text", text: input })}
                style={[
                  styles.sendBtn,
                  { backgroundColor: primary },
                  !input.trim() && { opacity: 0.5 },
                ]}
                disabled={!input.trim()}
              >
                <SVGIcon name="send" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  headerSub: { fontSize: 12, color: "#64748B" },
  messagesList: { padding: 16, paddingBottom: 160 },
  msgText: { fontSize: 15, lineHeight: 20 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    marginTop: 16,
    fontSize: 14,
    lineHeight: 22,
  },
  inputArea: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingBottom: Platform.OS === "ios" ? 10 : 20,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
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
  recordingBtn: { backgroundColor: COLORS.danger },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 20,
  },
});
