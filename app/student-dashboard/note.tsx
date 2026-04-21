// app/student-dashboard/note.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import RichTextEditor, { RichTextEditorRef } from "../../components/RichTextEditor";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useToast } from "../../contexts/ToastContext";

const NOTES_KEY = "@student_notes_v1";

type Note = {
  id: string;
  uid: string;
  title: string;
  content: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt?: number;
  synced?: boolean;
  docId?: string | null;
};

const { width } = Dimensions.get("window");
const isLargeScreen = width > 768;

export default function StudentNoteScreen() {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const mountedRef = useRef(true);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const editorRef = useRef<RichTextEditorRef>(null);

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
        title: (d.data() as any).title,
        content: (d.data() as any).content,
        pinned: (d.data() as any).pinned ?? false,
        createdAt: (d.data() as any).createdAt?.toMillis() ?? Date.now(),
        updatedAt: (d.data() as any).updatedAt?.toMillis(),
        synced: true,
      }));

      const localRaw = await AsyncStorage.getItem(NOTES_KEY);
      const localAll: Note[] = localRaw ? JSON.parse(localRaw) : [];
      const localForUser = localAll.filter((n) => n.uid === appUser.uid);

      const map = new Map<string, Note>();
      for (const r of remote) {
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
      setLoading(false);
    })();
    const interval = setInterval(() => {
      fetchFromFirestoreAndMerge();
    }, 15000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [loadLocalNotes, fetchFromFirestoreAndMerge]);

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
    if (!appUser) return;

    const newNote: Note = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      uid: appUser.uid,
      title: title.trim() || "Untitled Note",
      content: htmlContent,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
      docId: null,
    };

    const next = [newNote, ...notes];
    await persistLocalNotes(next);

    try {
      const docRef = await addDoc(collection(db, "student_notes"), {
        uid: appUser.uid,
        title: newNote.title,
        content: newNote.content,
        pinned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const syncedNext = next.map(n => n.id === newNote.id ? { ...n, docId: docRef.id, synced: true } : n);
      await persistLocalNotes(syncedNext);
      showToast({ message: "Note saved successfully!", type: "success" });
    } catch (e) {
      console.warn("Firestore sync failed:", e);
      showToast({ message: "Note saved locally, but sync failed.", type: "info" });
    }

    setTitle("");
    setContent("");
    setEditingId(null);
    setIsAdding(false);
  };

  const updateLocalNote = async (id: string, htmlContent: string) => {
    if (!appUser) return;
    const next = notes.map((n) =>
      n.id === id
        ? {
            ...n,
            title: title.trim() || n.title,
            content: htmlContent,
            updatedAt: Date.now(),
            synced: false,
          }
        : n,
    );
    await persistLocalNotes(next);

    const noteToUpdate = next.find(n => n.id === id);
    if (noteToUpdate?.docId) {
      try {
        await updateDoc(doc(db, "student_notes", noteToUpdate.docId), {
          title: noteToUpdate.title,
          content: noteToUpdate.content,
          updatedAt: serverTimestamp(),
        });

        const syncedNext = next.map(n => n.id === id ? { ...n, synced: true } : n);
        await persistLocalNotes(syncedNext);
        showToast({ message: "Note updated successfully!", type: "success" });
      } catch (e) {
        console.warn("Firestore update sync failed:", e);
        showToast({ message: "Note updated locally, but sync failed.", type: "info" });
      }
    }

    setEditingId(null);
    setTitle("");
    setContent("");
    setIsAdding(false);
  };

  const deleteLocalNote = async (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    await persistLocalNotes(next);

    const removed = notes.find((n) => n.id === id);
    if (removed?.docId) {
      try {
        await deleteDoc(doc(db, "student_notes", removed.docId));
        showToast({ message: "Note deleted successfully.", type: "success" });
      } catch (e) {
        console.warn(e);
        showToast({ message: "Note deleted locally, but sync failed.", type: "info" });
      }
    }
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setIsAdding(false);
  };

  const filtered = notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>My Study Notes 📚</Text>
        <TouchableOpacity
          style={styles.addCircle}
          onPress={() => setIsAdding(!isAdding)}
        >
          <SVGIcon
            name={isAdding ? "close-circle" : "add-circle"}
            size={32}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {isAdding ? (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.editorContainer}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 50 }}
          >
            <TextInput
              placeholder="Note Title"
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
              style={styles.titleInput}
            />

            <View style={styles.editorWrapper}>
              <RichTextEditor
                ref={editorRef}
                initialContent={content}
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1 }]}
                onPress={async () => {
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
                    {editingId ? "Update Note" : "Save Note"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
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
              placeholder="Search your notes..."
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            numColumns={isLargeScreen ? 2 : 1}
            columnWrapperStyle={isLargeScreen ? { gap: 16 } : null}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.noteCard, isLargeScreen && { flex: 1, marginBottom: 0 }]}
                onPress={() => startEdit(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
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

                <Text numberOfLines={3} style={styles.cardContent}>
                  {item.content.replace(/<[^>]*>?/gm, "")}
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
                        router.push({
                          pathname: "/student-dashboard/submit-assignment",
                          params: {
                            prefillNoteId: item.docId,
                            prefillTitle: item.title,
                            prefillContent: item.content
                          }
                        });
                      }}
                      style={{ marginRight: 15 }}
                    >
                      <SVGIcon name="send" size={18} color={COLORS.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Delete Note",
                          "Are you sure you want to delete this note?",
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
    </View>
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
    borderLeftColor: COLORS.primary,
    ...SHADOWS.small,
    minHeight: 160,
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
    flex: 1,
    marginRight: 10,
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
});
