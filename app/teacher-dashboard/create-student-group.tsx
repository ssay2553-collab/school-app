import { Picker } from "@react-native-picker/picker";
import { Audio } from "expo-av";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  BackHandler,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useRouter } from "expo-router";

import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import moment from "moment";
import MessageBubble from "../../components/MessageBubble";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { sortClasses } from "../../lib/classHelpers";

/* ================= TYPES ================= */
type Message = {
  id: string;
  from: string;
  senderName: string;
  text?: string;
  type: "text" | "image" | "file";
  fileUrl?: string;
  fileName?: string;
  timestamp: any;
  deletedFor?: string[];
};

type Group = {
  id: string;
  name: string;
  classId: string;
  studentIds: string[];
  staffIds?: string[];
  teacherId: string;
  createdAt: any;
};

type Student = {
  id: string;
  fullName: string;
};

type Staff = {
  id: string;
  fullName: string;
  role: string;
};

/* ======================================================
   CHAT VIEW — COST OPTIMIZED + AUDIO FEEDBACK
====================================================== */
const GroupChatView = ({
  group,
  onBack,
}: {
  group: Group;
  onBack: () => void;
}) => {
  const { appUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const isFirstLoad = useRef(true);

  const primary = SCHOOL_CONFIG.primaryColor;

  const senderName =
    `${appUser?.profile?.firstName || ""} ${appUser?.profile?.lastName || ""}`.trim() ||
    "Teacher";

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
      console.log("Audio error", e);
    }
  };

  useEffect(() => {
    if (!group.id || !appUser?.uid) return;
    isFirstLoad.current = true;
    const q = query(
      collection(db, "studentGroups", group.id, "messages"),
      orderBy("timestamp", "asc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const newMsgs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Message)
          .filter((m) => !m.deletedFor?.includes(appUser.uid));

        if (
          !isFirstLoad.current &&
          newMsgs.length > messagesRef.current.length
        ) {
          const last = newMsgs[newMsgs.length - 1];
          if (last.from !== appUser.uid) playSound("received");
        }

        setMessages(newMsgs);
        isFirstLoad.current = false;
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      },
      (err) => {
        console.error("Teacher Group Chat Error:", err);
      },
    );
    return () => unsubscribe();
  }, [group.id, appUser?.uid]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const send = async (type: "text" | "image" | "file", content: any) => {
    if (!appUser) return;
    const data: any = {
      from: appUser.uid,
      senderId: appUser.uid,
      senderName,
      type,
      timestamp: serverTimestamp(),
      deletedFor: [],
      ...content,
    };
    try {
      await addDoc(collection(db, "studentGroups", group.id, "messages"), data);
      playSound("sent");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.chatTitle}>{group.name}</Text>
          <Text style={styles.chatSubTitle}>Collaborative Study Group</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageBubble message={item} isYou={item.from === appUser?.uid} />
        )}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          placeholderTextColor="#94A3B8"
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        <TouchableOpacity
          onPress={() => {
            if (messageText.trim()) {
              send("text", { text: messageText.trim() });
              setMessageText("");
            }
          }}
          style={[styles.sendBtn, { backgroundColor: primary }]}
          disabled={!messageText.trim()}
        >
          <SVGIcon name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

/* ======================================================
   MAIN SCREEN — GROUP MANAGEMENT
====================================================== */
export default function TeacherStudentGroups() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"LIST" | "CREATE" | "CHAT" | "EDIT">("LIST");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingStudents, setFetchingStudents] = useState(false);

  // Management State
  const [teacherClasses, setTeacherClasses] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);

  const activeGroupRef = useRef<Group | null>(null);
  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  const handleBack = useCallback(() => {
    if (view === "CHAT") {
      setView("LIST");
      setActiveGroup(null);
    } else if (view === "CREATE" || view === "EDIT") {
      setView("LIST");
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/teacher-dashboard");
      }
    }
    return true;
  }, [view, router, setActiveGroup]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBack,
    );
    return () => backHandler.remove();
  }, [handleBack]);

  const schoolId = (
    Constants.expoConfig?.extra?.schoolId || "school"
  ).toLowerCase();
  const schoolLogo = getSchoolLogo(schoolId);
  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const fetchStaff = async () => {
    try {
      const q = query(
        collection(db, "users"),
        where("role", "in", ["teacher", "admin"])
      );
      const snap = await getDocs(q);
      const staffList = snap.docs
        .map((d) => ({
          id: d.id,
          fullName: `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim() || "Staff",
          role: d.data().role,
        }))
        .filter((s) => s.id !== appUser?.uid); // Don't include self
      setStaff(staffList);
    } catch (e) {
      console.error("Error fetching staff:", e);
    }
  };

  useEffect(() => {
    if (!appUser?.uid) return;
    setLoading(true);
    const q = query(
      collection(db, "studentGroups"),
      where("teacherId", "==", appUser.uid),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      let groupsData = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Group,
      );
      groupsData.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );
      setGroups(groupsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [appUser?.uid]);

  const startCreate = async () => {
    if (!appUser?.uid) return;
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, "users", appUser.uid));
      const classIds = userSnap.data()?.classes || [];
      const q = query(
        collection(db, "classes"),
        where(documentId(), "in", classIds),
      );
      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.id,
      }));
      // Logical Sort
      setTeacherClasses(sortClasses(list));
      await fetchStaff();

      setGroupName("");
      setSelectedClassId("");
      setSelectedStudentIds([]);
      setSelectedStaffIds([]);
      setView("CREATE");
    } catch {
      Alert.alert("Error", "Could not fetch classes.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = async (group: Group) => {
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, "users", appUser!.uid));
      const classIds = userSnap.data()?.classes || [];
      const q = query(
        collection(db, "classes"),
        where(documentId(), "in", classIds),
      );
      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.id,
      }));
      setTeacherClasses(sortClasses(list));
      await fetchStaff();

      setActiveGroup(group);
      setGroupName(group.name);
      setSelectedClassId(group.classId);
      setSelectedStudentIds(group.studentIds);
      setSelectedStaffIds(group.staffIds || []);
      setView("EDIT");
    } catch {
      Alert.alert("Error", "Could not load edit screen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((view === "CREATE" || view === "EDIT") && selectedClassId) {
      const fetchList = async () => {
        setFetchingStudents(true);
        try {
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId),
          );
          const snap = await getDocs(q);
          setStudents(
            snap.docs.map((d) => ({
              id: d.id,
              fullName:
                `${d.data().profile?.firstName || ""} ${d.data().profile?.lastName || ""}`.trim(),
            })),
          );
        } catch (e) {
          console.error(e);
        } finally {
          setFetchingStudents(false);
        }
      };
      fetchList();
    }
  }, [view, selectedClassId]);

  const handleCreateOrUpdate = async () => {
    if (!groupName.trim() || selectedStudentIds.length === 0)
      return Alert.alert(
        "Required",
        "Please provide a name and select students",
      );
    setLoading(true);
    try {
      if (view === "EDIT" && activeGroup) {
        await updateDoc(doc(db, "studentGroups", activeGroup.id), {
          name: groupName.trim(),
          studentIds: selectedStudentIds,
          staffIds: selectedStaffIds,
        });
        Alert.alert("Success", "Group updated.");
      } else {
        await addDoc(collection(db, "studentGroups"), {
          name: groupName.trim(),
          teacherId: appUser!.uid,
          classId: selectedClassId,
          studentIds: selectedStudentIds,
          staffIds: selectedStaffIds,
          createdAt: serverTimestamp(),
        });
        Alert.alert("Success", "Group created.");
      }
      setView("LIST");
    } catch {
      Alert.alert("Error", "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleStaff = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (loading && view === "LIST")
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  if (view === "CHAT" && activeGroup)
    return <GroupChatView group={activeGroup} onBack={handleBack} />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {view === "LIST" && (
        <Animatable.View animation="fadeIn" style={{ flex: 1 }}>
          <LinearGradient
            colors={[primary, "#1E293B"]}
            style={styles.headerGradient}
          >
            <View style={styles.headerTitleRow}>
              <View style={styles.brandingHeader}>
                <Image
                  source={schoolLogo}
                  style={styles.miniLogo}
                  resizeMode="contain"
                />
                <Text style={styles.titleText}>Study Hub</Text>
              </View>
              <TouchableOpacity
                onPress={startCreate}
                style={[styles.addBtnHeader, { backgroundColor: secondary }]}
              >
                <SVGIcon name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerDesc}>
              Manage your collaborative student learning groups.
            </Text>
          </LinearGradient>

          <ScrollView
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          >
            {groups.length === 0 ? (
              <View style={styles.emptyCenter}>
                <SVGIcon name="chatbubbles" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No Active Groups</Text>
                <Text
                  style={styles.emptyText}
                >{`Tap '+' to create your first collaborative student group.`}</Text>
              </View>
            ) : (
              groups.map((g, index) => (
                <Animatable.View
                  animation="fadeInUp"
                  delay={index * 100}
                  key={g.id}
                  style={styles.groupCard}
                >
                  <TouchableOpacity
                    style={styles.cardMain}
                    onPress={() => {
                      setActiveGroup(g);
                      setView("CHAT");
                    }}
                  >
                    <View
                      style={[
                        styles.groupIcon,
                        { backgroundColor: primary + "10" },
                      ]}
                    >
                      <SVGIcon name="people" size={24} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupName}>{g.name}</Text>
                      <Text style={styles.groupMeta}>
                        {g.studentIds.length} Students • Created{" "}
                        {moment(g.createdAt?.toDate()).fromNow()}
                      </Text>
                    </View>
                    <SVGIcon name="chevron-forward" size={20} color="#CBD5E1" />
                  </TouchableOpacity>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => startEdit(g)}
                      style={styles.actionBtn}
                    >
                      <SVGIcon
                        name="create-outline"
                        size={18}
                        color="#64748B"
                      />
                      <Text style={styles.actionText}>Edit Members</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert("Delete", "Remove this group?", [
                          { text: "Cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () =>
                              deleteDoc(doc(db, "studentGroups", g.id)),
                          },
                        ])
                      }
                      style={styles.actionBtn}
                    >
                      <SVGIcon name="trash-outline" size={18} color="#ef4444" />
                      <Text style={[styles.actionText, { color: "#ef4444" }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animatable.View>
              ))
            )}
          </ScrollView>
        </Animatable.View>
      )}

      {(view === "CREATE" || view === "EDIT") && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.modalBack}
            >
              <SVGIcon name="close" size={24} color={primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitleText}>
              {view === "CREATE" ? "New Study Group" : "Update Group"}
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>GROUP NAME</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Science Revision A"
              value={groupName}
              onChangeText={setGroupName}
            />

            {view === "CREATE" && (
              <>
                <Text style={[styles.label, { marginTop: 20 }]}>
                  SELECT CLASS
                </Text>
                <View style={styles.modalPickerWrapper}>
                  <Picker
                    selectedValue={selectedClassId}
                    onValueChange={setSelectedClassId}
                    style={styles.picker}
                  >
                    <Picker.Item
                      label="Select Class..."
                      value=""
                      color="#94A3B8"
                    />
                    {teacherClasses.map((c) => (
                      <Picker.Item key={c.id} label={c.name} value={c.id} />
                    ))}
                  </Picker>
                </View>
              </>
            )}

            {selectedClassId ? (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.label}>
                  SELECT STUDENTS ({selectedStudentIds.length})
                </Text>
                {fetchingStudents ? (
                  <ActivityIndicator
                    color={primary}
                    style={{ marginTop: 20 }}
                  />
                ) : (
                  <View style={styles.studentList}>
                    {students.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.studentChip,
                          selectedStudentIds.includes(s.id) && {
                            backgroundColor: primary,
                            borderColor: primary,
                          },
                        ]}
                        onPress={() => toggleStudent(s.id)}
                      >
                        <Text
                          style={[
                            styles.studentChipText,
                            selectedStudentIds.includes(s.id) && {
                              color: "#fff",
                            },
                          ]}
                        >
                          {s.fullName}
                        </Text>
                        <SVGIcon
                          name={
                            selectedStudentIds.includes(s.id)
                              ? "checkmark-circle"
                              : "add-circle-outline"
                          }
                          size={16}
                          color={
                            selectedStudentIds.includes(s.id) ? "#fff" : primary
                          }
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptySelection}>
                <SVGIcon name="people-circle" size={48} color="#CBD5E1" />
                <Text style={styles.emptySelectionText}>
                  Please select a class to load student list.
                </Text>
              </View>
            )}

            <View style={{ marginTop: 25, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 20 }}>
              <Text style={styles.label}>
                ADD COLLABORATORS (STAFF) ({selectedStaffIds.length})
              </Text>
              <View style={styles.studentList}>
                {staff.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.studentChip,
                      selectedStaffIds.includes(s.id) && {
                        backgroundColor: secondary,
                        borderColor: secondary,
                      },
                    ]}
                    onPress={() => toggleStaff(s.id)}
                  >
                    <Text
                      style={[
                        styles.studentChipText,
                        selectedStaffIds.includes(s.id) && {
                          color: "#fff",
                        },
                      ]}
                    >
                      {s.fullName} ({s.role === 'admin' ? 'Admin' : 'Teacher'})
                    </Text>
                    <SVGIcon
                      name={
                        selectedStaffIds.includes(s.id)
                          ? "checkmark-circle"
                          : "add-circle-outline"
                      }
                      size={16}
                      color={
                        selectedStaffIds.includes(s.id) ? "#fff" : secondary
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.mainActionBtn, { backgroundColor: primary }]}
            onPress={handleCreateOrUpdate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.mainActionText}>
                {view === "CREATE" ? "Initialize Group" : "Save Changes"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
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
    marginBottom: 10,
  },
  brandingHeader: { flexDirection: "row", alignItems: "center" },
  miniLogo: { width: 32, height: 32, marginRight: 10 },
  titleText: { fontSize: 22, fontWeight: "900", color: "#fff" },
  addBtnHeader: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  headerDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  listContainer: { padding: 20, paddingBottom: 100 },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    marginBottom: 15,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
  },
  cardMain: { flexDirection: "row", alignItems: "center", padding: 18 },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  groupName: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  groupMeta: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
    backgroundColor: "#FBFCFE",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 6,
  },
  actionText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  emptyCenter: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 15,
  },
  emptyText: {
    color: "#94A3B8",
    marginTop: 8,
    textAlign: "center",
    width: 250,
    lineHeight: 20,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    ...SHADOWS.small,
    paddingTop: Platform.OS === "android" ? 15 : 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  chatTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  chatSubTitle: { fontSize: 11, color: "#94A3B8", fontWeight: "700" },
  inputBar: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
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
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 25,
  },
  modalBack: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  modalTitleText: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.medium,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalPickerWrapper: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  picker: { height: 50 },
  studentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 15,
  },
  studentChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  studentChipText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  emptySelection: { alignItems: "center", marginTop: 30, paddingBottom: 20 },
  emptySelectionText: {
    color: "#94A3B8",
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
  },
  mainActionBtn: {
    height: 55,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
    ...SHADOWS.medium,
  },
  mainActionText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});

// moment imported via ES module at top
