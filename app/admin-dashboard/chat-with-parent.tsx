import { Picker } from "@react-native-picker/picker";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    arrayUnion,
    collection,
    doc,
    getDocs,
    getDocsFromServer,
    onSnapshot,
    query,
    setDoc,
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
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import { AudioPlayer } from "../../components/AudioPlayer";
import MessageBubble from "../../components/MessageBubble";
import SVGIcon from "../../components/SVGIcon";
import UnreadBadge from "../../components/UnreadBadge";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { db, storage } from "../../firebaseConfig";
import { sortClasses } from "../../lib/classHelpers";
import { sendNotification, markNotificationsAsRead, markNotificationsForResolvedItem } from "../../src/services/notificationService";

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
  const insets = useSafeAreaInsets();
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
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  // Broadcast mode states
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [selectedParentUids, setSelectedParentUids] = useState<string[]>([]);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastUploading, setBroadcastUploading] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Broadcast Audio states
  const [broadcastRecording, setBroadcastRecording] = useState<any | null>(null);
  const [broadcastPreviewUri, setBroadcastPreviewUri] = useState<string | null>(null);
  const [broadcastWebRecorder, setBroadcastWebRecorder] = useState<any | null>(null);
  const [broadcastWebStream, setBroadcastWebStream] = useState<MediaStream | null>(null);
  const broadcastWebChunksRef = React.useRef<any[]>([]);
  const broadcastWebBlobRef = React.useRef<Blob | null>(null);

  const toggleSelectParentForBroadcast = (uid: string) => {
    setSelectedParentUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedParentUids.length === filteredParents.length && filteredParents.length > 0) {
      setSelectedParentUids([]);
    } else {
      setSelectedParentUids(filteredParents.map((p) => p.uid));
    }
  };

  const startBroadcastRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showToast({ message: "Audio recording is not supported in this browser.", type: "error" });
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        broadcastWebChunksRef.current = [];
        const MediaRec = (window as any).MediaRecorder || (global as any).MediaRecorder;
        if (!MediaRec) {
          showToast({ message: "MediaRecorder not available.", type: "error" });
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const mediaRecorder = new MediaRec(stream);
        mediaRecorder.ondataavailable = (ev: any) => {
          if (ev.data && ev.data.size > 0) broadcastWebChunksRef.current.push(ev.data);
        };
        mediaRecorder.start();
        setBroadcastWebStream(stream);
        setBroadcastWebRecorder(mediaRecorder);
        setBroadcastRecording({ web: true });
        setBroadcastPreviewUri(null);
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setBroadcastRecording(recording);
      setBroadcastPreviewUri(null);
    } catch (err) {
      console.error(err);
    }
  };

  const stopBroadcastRecording = async () => {
    if (!broadcastRecording) return;
    try {
      if (Platform.OS === "web") {
        if (!broadcastWebRecorder) return;
        broadcastWebRecorder.stop();
        await new Promise((r) => setTimeout(r, 200));
        const blob = new Blob(broadcastWebChunksRef.current, { type: "audio/webm" });
        broadcastWebChunksRef.current = [];
        broadcastWebBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setBroadcastPreviewUri(url);
        setBroadcastRecording(null);
        return;
      }

      await broadcastRecording.stopAndUnloadAsync();
      const uri = broadcastRecording.getURI();
      setBroadcastRecording(null);
      setBroadcastPreviewUri(uri);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendBroadcast = async () => {
    if (selectedParentUids.length === 0) return;
    const hasText = !!broadcastText.trim();
    const hasAudio = !!(broadcastPreviewUri || broadcastWebBlobRef.current);

    if (!hasText && !hasAudio) {
      showToast({ message: "Please enter a text message or record voice to broadcast.", type: "error" });
      return;
    }

    setSendingBroadcast(true);
    try {
      let uploadedAudioUrl: string | undefined = undefined;

      if (hasAudio) {
        setBroadcastUploading(true);
        let blob: Blob | null = null;
        if (Platform.OS === "web") {
          blob = broadcastWebBlobRef.current;
        } else if (broadcastPreviewUri) {
          blob = await (await fetch(broadcastPreviewUri)).blob();
        }

        if (blob) {
          const ext = Platform.OS === "web" ? "webm" : "m4a";
          const audioRef = ref(storage, `chats/broadcasts/${Date.now()}.${ext}`);
          await uploadBytes(audioRef, blob);
          uploadedAudioUrl = await getDownloadURL(audioRef);
        }
        setBroadcastUploading(false);
      }

      const timestamp = Date.now();
      const isAudio = !!uploadedAudioUrl;
      const msgType = isAudio ? "audio" : "text";

      for (const pUid of selectedParentUids) {
        const parentObj = parents.find((p) => p.uid === pUid);
        const msg: any = {
          id: `${timestamp}_${pUid}`,
          type: msgType,
          sender: "admin",
          createdAt: timestamp,
        };

        if (isAudio) {
          msg.fileUrl = uploadedAudioUrl;
        } else {
          msg.text = broadcastText.trim();
        }

        const chatRef = doc(db, "chats", pUid);
        await setDoc(
          chatRef,
          {
            messages: arrayUnion(msg),
            lastUpdated: timestamp,
            lastMessageFrom: "admin",
            parentUid: pUid,
            parentName: parentObj?.fullName || "Parent",
          },
          { merge: true }
        );

        const messagePreview = isAudio ? "🎵 Voice broadcast message" : broadcastText.trim();
        sendNotification({
          recipientId: pUid,
          senderId: appUser?.uid || "admin",
          senderName: appUser?.fullName || "School Administration",
          type: "chat",
          title: "Broadcast Message from School Admin 📢",
          body: messagePreview,
          data: { chatWith: appUser?.uid || "admin", parentUid: pUid },
        });
      }

      playSound("sent");
      showToast({
        message: `Broadcast successfully sent to ${selectedParentUids.length} parent(s)!`,
        type: "success",
      });

      setBroadcastText("");
      setBroadcastPreviewUri(null);
      broadcastWebBlobRef.current = null;
      if (broadcastWebStream) {
        broadcastWebStream.getTracks().forEach((t) => t.stop());
        setBroadcastWebStream(null);
      }
      setIsBroadcastModalOpen(false);
      setIsBroadcastMode(false);
      setSelectedParentUids([]);
    } catch (err) {
      console.error("Broadcast send error:", err);
      showToast({ message: "Failed to send broadcast message.", type: "error" });
    } finally {
      setSendingBroadcast(false);
    }
  };

  useEffect(() => {
    if (appUser?.uid) {
      markNotificationsAsRead(appUser.uid, "chat");
    }
  }, [appUser?.uid]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

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
      if (isMounted.current) {
        soundRef.current = sound;
        await sound.playAsync();
      } else {
        await sound.unloadAsync();
      }
    } catch (error) {
      console.log("Audio error:", error);
    }
  };

  // Load parents and classes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Classes for filtering
        const classesSnap = await getDocsFromServer(
          collection(db, "classes") as any,
        );
        const classList = classesSnap.docs.map((d: any) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setClasses(sortClasses(classList));

        // 2. Fetch Students to link parents to children names
        const studentsSnap = await getDocs(
          query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("status", "in", ["active", "pending_activation"]),
          ),
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
        if (isMounted.current) {
          setParents(list);
          setFilteredParents(list);
        }
      } catch (error) {
        if (isMounted.current) console.error("Error fetching chat data:", error);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };
    fetchData();
  }, []);

  const [parentUnreads, setParentUnreads] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "chats"), async (snapshot) => {
      const unreads: Record<string, number> = {};
      for (const docSnap of snapshot.docs) {
        const parentUid = docSnap.id;
        const data = docSnap.data();
        const msgs = data.messages || [];
        if (msgs.length === 0) continue;

        const seenKey = `@lastSeen_admin_parent_${parentUid}`;
        const seenStr = await AsyncStorage.getItem(seenKey);
        const seen = seenStr ? parseInt(seenStr, 10) : 0;

        const unreadCount = msgs.filter((m: any) => {
          const msgTime = m.createdAt || m.timestamp?.toMillis?.() || 0;
          return m.sender === "parent" && msgTime > seen;
        }).length;

        if (unreadCount > 0) {
          unreads[parentUid] = unreadCount;
        }
      }
      setParentUnreads(unreads);
    }, (err) => {
      console.warn("Error listening to admin parent unreads:", err);
    });

    return () => unsub();
  }, []);

  const markParentChatRead = async (parentUid: string) => {
    try {
      const seenKey = `@lastSeen_admin_parent_${parentUid}`;
      await AsyncStorage.setItem(seenKey, Date.now().toString());
      setParentUnreads((prev) => ({ ...prev, [parentUid]: 0 }));
      if (appUser?.uid) {
        markNotificationsAsRead(appUser.uid, "chat");
        markNotificationsForResolvedItem({ recipientId: appUser.uid, type: "chat", itemId: parentUid });
      }
    } catch (e) {
      console.warn("markParentChatRead error:", e);
    }
  };

  // Filtering & Sorting Logic
  useEffect(() => {
    let result = [...parents];
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
    // Sort unread parents to the top
    result.sort((a, b) => {
      const unreadA = parentUnreads[a.uid] || 0;
      const unreadB = parentUnreads[b.uid] || 0;
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadB > 0 && unreadA === 0) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
    setFilteredParents(result);
  }, [selectedClassId, searchQuery, parents, parentUnreads]);

  // Real-time chat listener
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }

    isFirstLoad.current = true;
    const chatRef = doc(db, "chats", selected.uid);
    const unsub = onSnapshot(chatRef, (snap) => {
      if (!isMounted.current) return;
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
        if (isMounted.current) {
          setWebStream(stream);
          setWebRecorder(mediaRecorder);
          setRecording({ web: true });
          setPreviewUri(null);
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
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
      if ((blob as any).close) (blob as any).close();
      const audioUrl = await getDownloadURL(audioRef);
      await sendMessage({ type: "audio", fileUrl: audioUrl });
      if (isMounted.current) {
        setPreviewUri(null);
        if (webStream) {
          webStream.getTracks().forEach((t) => t.stop());
          setWebStream(null);
        }
        webBlobRef.current = null;
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: "Failed to upload audio", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setUploading(false);
      }
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
      if (!appUser) return;
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

      // Notify parent about new admin message
      const messagePreview = type === "audio" ? "🎵 Voice message" : msg.text || "New message";
      sendNotification({
        recipientId: selected.uid,
        senderId: appUser.uid,
        senderName: appUser.fullName || "School Administration",
        type: "chat",
        title: "New Message from School Admin 💬",
        body: messagePreview,
        data: { chatWith: appUser.uid, parentUid: selected.uid },
      });
    } catch (err) {
      if (isMounted.current) {
        console.error("Send error", err);
        if (type === "text") setInput(currentInput);
        showToast({ message: "Failed to send message", type: "error" });
      }
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
              onPress={() => {
                if (isNavigating.current) return;
                isNavigating.current = true;
                router.back();
              }}
              style={styles.backBtnHeader}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitleMain}>Parent Relations</Text>
            <TouchableOpacity
              onPress={() => {
                setIsBroadcastMode((prev) => !prev);
                setSelectedParentUids([]);
              }}
              style={[
                styles.broadcastToggleBtn,
                isBroadcastMode && { backgroundColor: secondary },
              ]}
            >
              <SVGIcon name="megaphone" size={16} color="#fff" />
              <Text style={styles.broadcastToggleText}>
                {isBroadcastMode ? "Exit" : "Broadcast"}
              </Text>
            </TouchableOpacity>
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

          {isBroadcastMode && (
            <Animatable.View animation="fadeInDown" duration={250} style={styles.broadcastActionBar}>
              <TouchableOpacity onPress={handleSelectAllFiltered} style={styles.selectAllBtn}>
                <SVGIcon
                  name={
                    selectedParentUids.length === filteredParents.length && filteredParents.length > 0
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={18}
                  color="#fff"
                />
                <Text style={styles.selectAllText}>
                  {selectedParentUids.length === filteredParents.length && filteredParents.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.selectedCountBadge}>
                {selectedParentUids.length} Selected
              </Text>

              <TouchableOpacity
                disabled={selectedParentUids.length === 0}
                onPress={() => setIsBroadcastModalOpen(true)}
                style={[
                  styles.composeBroadcastBtn,
                  { backgroundColor: secondary },
                  selectedParentUids.length === 0 && { opacity: 0.5 },
                ]}
              >
                <SVGIcon name="send" size={14} color="#fff" />
                <Text style={styles.composeBroadcastText}>Compose</Text>
              </TouchableOpacity>
            </Animatable.View>
          )}
        </LinearGradient>

        <FlatList
          data={filteredParents}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const isSelectedForBroadcast = selectedParentUids.includes(item.uid);
            const unreadCount = parentUnreads[item.uid] || 0;
            const hasUnread = unreadCount > 0;
            return (
              <Animatable.View animation="fadeInUp" delay={index * 50}>
                <TouchableOpacity
                  style={[
                    styles.parentCard,
                    isBroadcastMode && isSelectedForBroadcast && styles.selectedParentCard,
                    !isBroadcastMode && hasUnread && { backgroundColor: primary + "0D", borderColor: primary + "40", borderWidth: 1.5 },
                  ]}
                  onPress={() => {
                    if (isBroadcastMode) {
                      toggleSelectParentForBroadcast(item.uid);
                    } else {
                      markParentChatRead(item.uid);
                      setSelected(item);
                    }
                  }}
                >
                  {isBroadcastMode && (
                    <View style={{ marginRight: 12 }}>
                      <SVGIcon
                        name={isSelectedForBroadcast ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelectedForBroadcast ? primary : "#94A3B8"}
                      />
                    </View>
                  )}
                  <View
                    style={[styles.avatar, { backgroundColor: primary + "10" }]}
                  >
                    <Text style={[styles.avatarText, { color: primary }]}>
                      {item.fullName.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.parentName, hasUnread && { fontWeight: "800", color: primary }]}>
                        {item.fullName}
                      </Text>
                      {hasUnread && (
                        <View style={styles.newBadgePill}>
                          <Text style={styles.newBadgeText}>New</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.childrenRow}>
                      <SVGIcon name="school" size={12} color="#94A3B8" />
                      <Text style={styles.childrenText}>
                        {item.children?.map((c) => c.name).join(", ") ||
                          "No linked students"}
                      </Text>
                    </View>
                  </View>
                  {!isBroadcastMode && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {hasUnread && <UnreadBadge count={unreadCount} />}
                      <SVGIcon name="chevron-forward" size={20} color="#CBD5E1" />
                    </View>
                  )}
                </TouchableOpacity>
              </Animatable.View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyCenter}>
              <SVGIcon name="people" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No matching parents found.</Text>
            </View>
          )}
        />

        <Modal
          visible={isBroadcastModalOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsBroadcastModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Broadcast Message 📢</Text>
                  <Text style={styles.modalSubTitle}>
                    Sending to {selectedParentUids.length} selected parent(s)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsBroadcastModalOpen(false)}
                  style={styles.modalCloseBtn}
                >
                  <SVGIcon name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalInputLabel}>MESSAGE TEXT</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Type your broadcast message here..."
                  placeholderTextColor="#94A3B8"
                  value={broadcastText}
                  onChangeText={setBroadcastText}
                  multiline
                  numberOfLines={4}
                />

                <Text style={[styles.modalInputLabel, { marginTop: 16 }]}>
                  VOICE MESSAGE (OPTIONAL)
                </Text>
                {broadcastPreviewUri ? (
                  <View style={styles.broadcastAudioPreviewRow}>
                    <View style={{ flex: 1 }}>
                      <AudioPlayer url={broadcastPreviewUri} />
                    </View>
                    <TouchableOpacity
                      onPress={() => setBroadcastPreviewUri(null)}
                      style={styles.deleteAudioBtn}
                    >
                      <SVGIcon name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={broadcastRecording ? stopBroadcastRecording : startBroadcastRecording}
                    style={[
                      styles.broadcastMicBtn,
                      broadcastRecording && styles.broadcastRecordingActive,
                    ]}
                  >
                    <SVGIcon
                      name={broadcastRecording ? "square" : "mic"}
                      size={20}
                      color={broadcastRecording ? "#fff" : primary}
                    />
                    <Text
                      style={[
                        styles.broadcastMicText,
                        broadcastRecording && { color: "#fff" },
                      ]}
                    >
                      {broadcastRecording ? "Stop Recording" : "Record Voice Message"}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {broadcastUploading && (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator size="small" color={primary} />
                  <Text style={styles.uploadingText}>Uploading audio...</Text>
                </View>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  onPress={() => setIsBroadcastModalOpen(false)}
                  style={styles.modalCancelBtn}
                  disabled={sendingBroadcast}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSendBroadcast}
                  style={[styles.modalSubmitBtn, { backgroundColor: primary }]}
                  disabled={sendingBroadcast}
                >
                  {sendingBroadcast ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <SVGIcon name="send" size={16} color="#fff" />
                      <Text style={styles.modalSubmitText}>
                        Send ({selectedParentUids.length})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={['bottom', 'left', 'right']}>
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

        <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 15) }]}>
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
  backBtnHeader: {
    padding: 5,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
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
    minHeight: 65,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    paddingTop: 12,
  },
  pickerLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#fff",
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 1,
  },
  pickerInner: { marginTop: 0 },
  picker: {
    color: "#fff",
    backgroundColor: "transparent",
    marginLeft: Platform.OS === "android" ? -10 : 0,
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
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
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
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
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
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
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
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  recordingBtn: { backgroundColor: "#EF4444" },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
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
  broadcastToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  broadcastToggleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  broadcastActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
  },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectAllText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  selectedCountBadge: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  composeBroadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  composeBroadcastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  selectedParentCard: {
    borderColor: "#3B82F6",
    backgroundColor: "#F0F6FF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  modalSubTitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalInputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    color: "#1E293B",
    textAlignVertical: "top",
    minHeight: 90,
  },
  broadcastAudioPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 16,
    gap: 10,
  },
  deleteAudioBtn: {
    padding: 4,
  },
  broadcastMicBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  broadcastRecordingActive: {
    backgroundColor: "#EF4444",
  },
  broadcastMicText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  uploadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 10,
  },
  uploadingText: {
    fontSize: 12,
    color: "#64748B",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalCancelText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
  modalSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 8,
  },
  modalSubmitText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  newBadgePill: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});
