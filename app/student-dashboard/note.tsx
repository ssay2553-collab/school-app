// app/student-dashboard/note.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RichTextEditor, { RichTextEditorRef } from "../../components/RichTextEditor";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

const DEFAULT_SUBJECTS = [
  "Mathematics",
  "English",
  "Science",
  "Social Studies",
  "RME",
  "Computing",
  "French",
  "History",
  "Personal",
  "Other",
];

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "#3B82F6",
  English: "#EF4444",
  Science: "#10B981",
  "Social Studies": "#F59E0B",
  RME: "#8B5CF6",
  Computing: "#4B5563",
  French: "#06B6D4",
  History: "#B45309",
  Personal: "#EC4899",
  Other: "#6B7280",
};

const getSubjectColor = (subj: string | null): string => {
  if (!subj) return COLORS.primary;
  return SUBJECT_COLORS[subj] || COLORS.primary;
};

const NOTES_KEY = "@student_notes_v1";

type Note = {
  id: string;
  uid: string;
  subject: string | null;
  title: string;
  content: string;
  pinned?: boolean;
  color?: string;
  createdAt: number;
  updatedAt?: number;
  synced?: boolean;
  docId?: string | null;
  classId?: string;
  department?: string;
  submissionStatus?: "submitted" | "graded" | "rework" | "draft";
  teacherFeedback?: string;
  submissionId?: string;
};

export default function NoteScreen() {
  const { appUser, loading: authLoading } = useAuth();
  const mountedRef = useRef(true);

  const [subject, setSubject] = useState<string | null>(null);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [assignmentCode, setAssignmentCode] = useState("");
  const [selectedNoteForSubmit, setSelectedNoteForSubmit] = useState<Note | null>(null);
  const editorRef = useRef<RichTextEditorRef>(null);

  // For rework/editing of existing submissions
  const [currentNoteSubmission, setCurrentNoteSubmission] = useState<any>(null);

  const canEdit = !currentNoteSubmission || currentNoteSubmission?.status === "draft" || currentNoteSubmission?.status === "rework";
  const canSubmit = !currentNoteSubmission || currentNoteSubmission?.status === "draft" || currentNoteSubmission?.status === "rework";

  // Dynamic subjects state
  const [dynamicSubjects, setDynamicSubjects] =
    useState<string[]>(DEFAULT_SUBJECTS);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  /* ---------------------------------------------
     Fetch Dynamic Subjects based on Teachers
  --------------------------------------------- */
  const fetchDynamicSubjects = useCallback(async () => {
    if (!appUser?.classId) return;
    setLoadingSubjects(true);
    try {
      // Find all teachers who teach this student's class
      const q = query(
        collection(db, "users"),
        where("role", "==", "teacher"),
        where("classes", "array-contains", appUser.classId),
      );

      const snap = await getDocs(q);
      const subjectSet = new Set<string>();

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.subjects && Array.isArray(data.subjects)) {
          data.subjects.forEach((s: string) => subjectSet.add(s));
        }
      });

      // Always include these useful categories
      subjectSet.add("Personal");
      subjectSet.add("Other");

      const list = Array.from(subjectSet).sort();
      if (list.length > 2) {
        // 2 because of Personal and Other
        setDynamicSubjects(list);
      } else {
        // Fallback if no teachers found yet
        setDynamicSubjects(DEFAULT_SUBJECTS);
      }
    } catch (err) {
      console.error("Error fetching dynamic subjects:", err);
      setDynamicSubjects(DEFAULT_SUBJECTS);
    } finally {
      setLoadingSubjects(false);
    }
  }, [appUser?.classId]);

  /* ---------------------------------------------
     Load & Persist Notes
  --------------------------------------------- */
  const loadLocalNotes = useCallback(async () => {
    if (!appUser) return;
    try {
      const raw = await AsyncStorage.getItem(NOTES_KEY);
      const parsed: Note[] = raw ? JSON.parse(raw) : [];
      const userNotes = parsed.filter((n) => n.uid === appUser.uid);
      setNotes(userNotes);
    } catch (e) {
      console.warn("loadLocalNotes", e);
      setNotes([]);
    }
  }, [appUser]);

  const persistLocalNotes = useCallback(
    async (next: Note[]) => {
      if (!appUser) return;
      try {
        const raw = await AsyncStorage.getItem(NOTES_KEY);
        const all: Note[] = raw ? JSON.parse(raw) : [];
        const others = all.filter((n) => n.uid !== appUser.uid);
        const merged = [...others, ...next];
        await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(merged));
        setNotes(next);
      } catch (e) {
        console.warn("persistLocalNotes", e);
      }
    },
    [appUser],
  );

  /* ---------------------------------------------
     Fetch from Firestore & merge with local notes
  --------------------------------------------- */
  const fetchFromFirestoreAndMerge = useCallback(async () => {
    if (!appUser) return;
    try {
      const q = query(
        collection(db, "student_notes"),
        where("uid", "==", appUser.uid),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);

      const remote: Note[] = snap.docs.map((d) => ({
        docId: d.id,
        id: d.id + "_remote",
        uid: appUser.uid,
        subject: d.data().subject ?? null,
        title: d.data().title,
        content: d.data().content,
        pinned: d.data().pinned ?? false,
        color: d.data().color ?? getSubjectColor(d.data().subject ?? null),
        createdAt: d.data().createdAt?.toMillis() ?? Date.now(),
        updatedAt: d.data().updatedAt?.toMillis(),
        synced: true,
        classId: appUser.classId,
        department: appUser.departments?.[0] ?? "Unknown",
      }));

      // Fetch submission statuses for these notes
      const submissionQ = query(
        collection(db, "submissions"),
        where("studentId", "==", appUser.uid)
      );
      const subSnap = await getDocs(submissionQ);
      const subMap = new Map<string, any>();
      subSnap.forEach(sDoc => {
        const data = sDoc.data();
        if (data.noteId) {
          subMap.set(data.noteId, { id: sDoc.id, ...data });
        }
      });

      const localRaw = await AsyncStorage.getItem(NOTES_KEY);
      const localAll: Note[] = localRaw ? JSON.parse(localRaw) : [];
      const localForUser = localAll.filter((n) => n.uid === appUser.uid);

      const map = new Map<string, Note>();
      for (const r of remote) {
        const subData = subMap.get(r.docId ?? "");
        if (subData) {
          r.submissionStatus = subData.status;
          r.teacherFeedback = subData.feedback;
          r.submissionId = subData.id;
          // If there's a rework content, we might want to use it
          if (subData.status === "rework" && subData.contentHtml) {
             r.content = subData.contentHtml;
          }
        }
        map.set(r.docId ?? r.id, r);
      }
      for (const l of localForUser) {
        const key = l.docId ?? l.id;
        const existing = map.get(key);
        if (
          !existing ||
          l.synced === false ||
          (l.updatedAt ?? l.createdAt) >
            (existing.updatedAt ?? existing.createdAt)
        ) {
          map.set(key, l);
        }
      }

      const merged = Array.from(map.values()).sort(
        (a, b) =>
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt,
      );

      await persistLocalNotes(merged);
    } catch (e) {
      console.warn("fetchFromFirestoreAndMerge", e);
    }
  }, [appUser, persistLocalNotes]);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      await loadLocalNotes();
      await fetchFromFirestoreAndMerge();
      await fetchDynamicSubjects();
      setLoading(false);
    })();
    const interval = setInterval(() => {
      fetchFromFirestoreAndMerge();
    }, 10000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [loadLocalNotes, fetchFromFirestoreAndMerge, fetchDynamicSubjects]);

  if (!appUser && !authLoading)
    return (
      <View style={styles.center}>
        <Text>Please log in to use notes.</Text>
      </View>
    );

  if (loading || authLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  /* ---------------------------------------------
     CRUD
  --------------------------------------------- */
  const createLocalNote = async (htmlContent: string) => {
    if (!subject) return Alert.alert("Select a subject before creating a note");

    const newNote: Note = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      uid: appUser!.uid,
      subject,
      title: title.trim() || "Untitled",
      content: htmlContent,
      pinned: false,
      color: getSubjectColor(subject),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
      docId: null,
      classId: appUser!.classId,
      department: appUser!.departments?.[0] ?? "Unknown",
    };

    const next = [newNote, ...notes];
    await persistLocalNotes(next);
    setTitle("");
    setContent("");
    setEditingId(null);
    setIsAdding(false);
  };

  const updateLocalNote = async (id: string, htmlContent: string) => {
    const next = notes.map((n) =>
      n.id === id
        ? {
            ...n,
            title: title.trim() || n.title,
            content: htmlContent,
            subject,
            color: getSubjectColor(subject),
            updatedAt: Date.now(),
            synced: false,
          }
        : n,
    );
    await persistLocalNotes(next);
    setEditingId(null);
    setTitle("");
    setContent("");
    setIsAdding(false);
  };

  const submitNoteToAssignment = (note: Note) => {
    setSelectedNoteForSubmit(note);
    setAssignmentCode("");
    setShowCodeInput(true);
  };

  const executeSubmission = async (note: Note, code: string) => {
    if (!appUser) return Alert.alert("Error", "You must be logged in.");
    setSubmitting(true);
    try {
      const q = query(
        collection(db, "assignments"),
        where("code", "==", code.trim().toUpperCase()),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setSubmitting(false);
        return Alert.alert("Invalid Code", "Assignment not found.");
      }

      const assignmentDoc = snapshot.docs[0];
      const assignment = assignmentDoc.data();

      // Fetch student name fresh (like submit-assignment.tsx)
      let studentName = "Student";
      if (appUser.profile?.firstName && appUser.profile?.lastName) {
        studentName = `${appUser.profile.firstName} ${appUser.profile.lastName}`;
      }

      try {
        const studentSnap = await getDoc(doc(db, "users", appUser.uid));
        if (studentSnap.exists()) {
          const data = studentSnap.data();
          if (data.profile?.firstName && data.profile?.lastName) {
            studentName = `${data.profile.firstName} ${data.profile.lastName}`;
          } else if (data.fullName) {
            studentName = data.fullName;
          } else if (data.name) {
            studentName = data.name;
          }
        }
      } catch (err) {
        console.log("Error fetching student name", err);
      }

      // Check deadline
      const deadline = assignment.dueDate || assignment.deadline;
      if (deadline && new Date() > deadline.toDate()) {
        setSubmitting(false);
        return Alert.alert("Submission Closed", "The deadline has passed.");
      }

      const submissionId = `${assignmentDoc.id}_${appUser.uid}`;

      await addDoc(collection(db, "submissions"), {
        submissionKey: submissionId,
        assignmentId: assignmentDoc.id,
        assignmentCode: assignment.code,
        studentId: appUser.uid,
        studentName,
        type: "rich-text",
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        contentHtml: note.content,
        noteTitle: note.title,
        noteId: note.docId || note.id,
        status: "submitted",
        isLate: false,
        marked: false,
        submittedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Note submitted as assignment successfully!");
      setShowCodeInput(false);
      setAssignmentCode("");
    } catch (error: any) {
      console.error("Submission error:", error);
      Alert.alert("Error", error.message || "Failed to submit note.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLocalNote = async (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    await persistLocalNotes(next);

    const removed = notes.find((n) => n.id === id);
    if (removed?.docId) {
      try {
        await deleteDoc(doc(db, "student_notes", removed.docId));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setSubject(note.subject);
    setTitle(note.title);
    setContent(note.content);
    setIsAdding(true);

    // Check if this note has an active submission
    if (note.submissionStatus) {
      setCurrentNoteSubmission({
        status: note.submissionStatus,
        feedback: note.teacherFeedback,
        id: note.submissionId
      });
    } else {
      setCurrentNoteSubmission(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setIsAdding(false);
    setCurrentNoteSubmission(null);
  };

  /* ---------------------------------------------
     Filter & sort
  --------------------------------------------- */
  const filtered = notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt,
    );

  /* ---------------------------------------------
     Render
  --------------------------------------------- */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Academic Notes ✏️</Text>
        <TouchableOpacity
          style={styles.addCircle}
          onPress={() => {
            fetchDynamicSubjects();
            setIsAdding(!isAdding);
          }}
        >
          <SVGIcon
            name={isAdding ? "close-circle" : "add-circle"}
            size={32}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {isAdding ? (
        <ScrollView
          style={styles.editorContainer}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.subjectPick}
            onPress={() => setShowSubjectDropdown((s) => !s)}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{ color: subject ? "#111" : "#666", fontWeight: "600" }}
              >
                {subject ?? "Select Subject"}
              </Text>
              {loadingSubjects && (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={{ marginLeft: 10 }}
                />
              )}
            </View>
            <SVGIcon name="chevron-down" size={18} color={COLORS.primary} />
          </TouchableOpacity>

          {showSubjectDropdown && (
            <View style={styles.dropdown}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {dynamicSubjects.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.subjectChip,
                      {
                        borderLeftWidth: 4,
                        borderLeftColor: getSubjectColor(s),
                      },
                      subject === s && { backgroundColor: getSubjectColor(s) },
                    ]}
                    onPress={() => {
                      setSubject(s);
                      setShowSubjectDropdown(false);
                    }}
                  >
                    <Text
                      style={{
                        color: subject === s ? "#fff" : "#333",
                        fontSize: 13,
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TextInput
            placeholder="Note Title"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
            editable={canEdit}
          />

          {currentNoteSubmission?.status === "rework" && (
            <View style={styles.reworkBanner}>
              <View style={styles.reworkHeader}>
                <SVGIcon name="alert-circle" size={20} color="#B45309" />
                <Text style={styles.reworkTitle}>Rework Required by Teacher</Text>
              </View>
              {currentNoteSubmission.feedback && (
                <Text style={styles.reworkFeedback}>
                  "{currentNoteSubmission.feedback}"
                </Text>
              )}
            </View>
          )}

          <View style={styles.editorWrapper}>
            <RichTextEditor
              ref={editorRef}
              initialContent={content}
              readOnly={!canEdit}
            />
          </View>

          <View style={styles.actionRow}>
            {canEdit && (
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1 }]}
                onPress={async () => {
                  if (!subject) return Alert.alert("Please pick a subject first");
                  setSaving(true);
                  const html = await editorRef.current?.getHTML();
                  if (editingId) await updateLocalNote(editingId, html || "");
                  else await createLocalNote(html || "");
                  setSaving(false);
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingId ? "Update Draft" : "Save Draft"}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {currentNoteSubmission?.status === "rework" && (
               <TouchableOpacity
                style={[styles.saveBtn, { flex: 1, backgroundColor: COLORS.secondary }]}
                onPress={async () => {
                  setSubmitting(true);
                  const html = await editorRef.current?.getHTML();
                  try {
                    await updateDoc(doc(db, "submissions", currentNoteSubmission.id), {
                      contentHtml: html,
                      status: "submitted",
                      submittedAt: serverTimestamp(),
                      marked: false
                    });
                    Alert.alert("Success", "Resubmitted successfully!");
                    setIsAdding(false);
                    fetchFromFirestoreAndMerge();
                  } catch (e) {
                    Alert.alert("Error", "Failed to resubmit.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Resubmit to Teacher</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
              <Text style={styles.cancelBtnText}>{canEdit ? "Cancel" : "Close"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <SVGIcon
              name="search"
              size={20}
              color="#999"
              style={{ marginRight: 8 }}
            />
            <TextInput
              placeholder="Search through notes..."
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.noteCard,
                  { borderLeftColor: item.color || COLORS.primary },
                ]}
                onPress={() => startEdit(item)}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View
                      style={[
                        styles.subjectBadge,
                        {
                          backgroundColor:
                            (item.color || COLORS.primary) + "15",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subjectBadgeText,
                          { color: item.color || COLORS.primary },
                        ]}
                      >
                        {item.subject}
                      </Text>
                    </View>
                    {item.submissionStatus && (
                      <View style={[
                        styles.statusBadge,
                        item.submissionStatus === 'rework' && { backgroundColor: '#FEF3C7' },
                        item.submissionStatus === 'graded' && { backgroundColor: '#D1FAE5' },
                        item.submissionStatus === 'submitted' && { backgroundColor: '#DBEAFE' },
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          item.submissionStatus === 'rework' && { color: '#B45309' },
                          item.submissionStatus === 'graded' && { color: '#059669' },
                          item.submissionStatus === 'submitted' && { color: '#2563EB' },
                        ]}>
                          {item.submissionStatus.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      const next = notes.map((n) =>
                        n.id === item.id
                          ? { ...n, pinned: !n.pinned, synced: false }
                          : n,
                      );
                      await persistLocalNotes(next);
                    }}
                  >
                    <SVGIcon
                      name={item.pinned ? "pin" : "pin"}
                      size={20}
                      color={item.pinned ? COLORS.secondary : "#999"}
                    />
                  </TouchableOpacity>
                </View>

                <Text numberOfLines={4} style={styles.cardContent}>
                  {item.content}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    {new Date(
                      item.updatedAt || item.createdAt,
                    ).toLocaleDateString()}
                  </Text>
                  <View style={styles.footerActions}>
                    <TouchableOpacity
                      onPress={() => {
                        try {
                          Alert.alert(
                            "Content Copied",
                            "Note text has been copied to your clipboard.",
                          );
                        } catch {
                          Alert.alert("Copy failed");
                        }
                      }}
                    >
                      <SVGIcon name="copy" size={18} color="#666" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => submitNoteToAssignment(item)}
                      disabled={submitting}
                      style={styles.submitBadge}
                    >
                      <SVGIcon
                        name="cloud-upload"
                        size={16}
                        color="#fff"
                      />
                      <Text style={styles.submitBadgeText}>Submit to Teacher</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Delete Note",
                          "Are you sure you want to remove this note?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: async () =>
                                await deleteLocalNote(item.id),
                            },
                          ],
                        );
                      }}
                    >
                      <SVGIcon name="trash-outline" size={18} color="#FF4D4D" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {showCodeInput && (
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Submit Assignment</Text>
            <Text style={styles.modalLabel}>Enter the assignment code provided by your teacher:</Text>
            <TextInput
              style={styles.codeInput}
              value={assignmentCode}
              onChangeText={setAssignmentCode}
              placeholder="e.g. MATH101"
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#F1F3F5" }]}
                onPress={() => setShowCodeInput(false)}
              >
                <Text style={{ color: "#495057", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => {
                  if (!assignmentCode.trim()) return Alert.alert("Error", "Assignment code is required.");
                  if (selectedNoteForSubmit) executeSubmission(selectedNoteForSubmit, assignmentCode.trim());
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FDFDFD",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: Platform.OS === "ios" ? 40 : 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1C1E",
  },
  addCircle: {
    padding: 4,
  },
  editorContainer: {
    flex: 1,
  },
  subjectPick: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  dropdown: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    ...SHADOWS.medium,
  },
  subjectChip: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 5,
  },
  subjectChipActive: {
    backgroundColor: COLORS.primary,
  },
  titleInput: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1C1E",
    ...SHADOWS.small,
  },
  editorWrapper: {
    backgroundColor: "#FFF",
    borderRadius: 15,
    marginBottom: 20,
    minHeight: 400,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 30,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  saveBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: "#F1F3F5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  cancelBtnText: {
    color: "#495057",
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 15,
    borderRadius: 12,
    marginBottom: 20,
    height: 50,
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1C1E",
  },
  noteCard: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 15,
    marginBottom: 16,
    borderLeftWidth: 6,
    ...SHADOWS.small,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1C1E",
    marginBottom: 4,
  },
  subjectBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  subjectBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "700",
  },
  cardContent: {
    fontSize: 14,
    color: "#495057",
    lineHeight: 20,
    marginBottom: 15,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F3F5",
    paddingTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: "#ADB5BD",
    fontWeight: "600",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  submitBadge: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    ...SHADOWS.small,
  },
  submitBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  reworkBanner: {
    backgroundColor: '#FFFBEB',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reworkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  reworkTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  reworkFeedback: {
    fontSize: 13,
    color: '#B45309',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    ...SHADOWS.medium,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1C1E",
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 16,
    lineHeight: 20,
  },
  codeInput: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E9ECEF",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
