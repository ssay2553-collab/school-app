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
import moment from "moment";
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
  BackHandler,
} from "react-native";
import { useRouter } from "expo-router";
import RichTextEditor, { RichTextEditorRef } from "../../components/RichTextEditor";
import ShareNoteModal from "../../components/ShareNoteModal";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { useToast } from "../../contexts/ToastContext";
import { useNoteSharing, SharedNote } from "../../hooks/useNoteSharing";

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
  const isMounted = useRef(true);

  const {
    sharedNotes,
    loadingShared,
    fetchSharedNotes,
    deleteSharedNote,
  } = useNoteSharing();

  const [mainTab, setMainTab] = useState<"mine" | "shared">("mine");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [shareNoteModalItem, setShareNoteModalItem] = useState<Note | null>(null);

  const editorRef = useRef<RichTextEditorRef>(null);
  const isNavigating = useRef(false);

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

      if (isMounted.current) {
        await persistLocalNotes(merged);
      }
    } catch (e) {
      if (isMounted.current) console.warn("fetchFromFirestoreAndMerge", e);
    }
  }, [appUser, persistLocalNotes]);

  useEffect(() => {
    isMounted.current = true;
    (async () => {
      await loadLocalNotes();
      await fetchFromFirestoreAndMerge();
      if (isMounted.current) setLoading(false);
    })();
    const interval = setInterval(() => {
      fetchFromFirestoreAndMerge();
    }, 15000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [loadLocalNotes, fetchFromFirestoreAndMerge]);

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
      if (isMounted.current) {
        await persistLocalNotes(syncedNext);
        showToast({ message: "Note saved successfully!", type: "success" });
      }
    } catch (e) {
      if (isMounted.current) {
        console.warn("Firestore sync failed:", e);
        showToast({ message: "Note saved locally, but sync failed.", type: "info" });
      }
    }

    if (isMounted.current) {
      setTitle("");
      setContent("");
      setEditingId(null);
      setIsAdding(false);
    }
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
        if (isMounted.current) {
          await persistLocalNotes(syncedNext);
          showToast({ message: "Note updated successfully!", type: "success" });
        }
      } catch (e) {
        if (isMounted.current) {
          console.warn("Firestore update sync failed:", e);
          showToast({ message: "Note updated locally, but sync failed.", type: "info" });
        }
      }
    }

    if (isMounted.current) {
      setEditingId(null);
      setTitle("");
      setContent("");
      setIsAdding(false);
    }
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

  const handleImportSharedNote = async (sharedNote: SharedNote) => {
    setTitle(sharedNote.title);
    await createLocalNote(sharedNote.content);
    showToast({
      message: "Shared note saved into your study notes!",
      type: "success",
    });
  };

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()),
  );

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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {!isAdding && (
          <TouchableOpacity
            onPress={() => {
              if (isNavigating.current) return;
              isNavigating.current = true;
              router.back();
            }}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {isAdding ? (editingId ? "Edit Note" : "New Note") : "My Study Notes 📚"}
        </Text>
        {isAdding ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerSaveBtn}
              onPress={async () => {
                setSaving(true);
                const html = await editorRef.current?.getHTML();
                if (editingId) await updateLocalNote(editingId, html || "");
                else await createLocalNote(html || "");
                setSaving(false);
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.headerSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerCancelBtn} onPress={cancelEdit}>
              <Text style={styles.headerCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addCircle}
            onPress={() => setIsAdding(!isAdding)}
          >
            <SVGIcon
              name="add-circle"
              size={32}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {!isAdding && (
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, mainTab === "mine" && styles.segmentBtnActive]}
            onPress={() => setMainTab("mine")}
          >
            <SVGIcon
              name="document-text"
              size={16}
              color={mainTab === "mine" ? "#fff" : COLORS.primary}
            />
            <Text style={[styles.segmentBtnText, mainTab === "mine" && styles.segmentBtnTextActive]}>
              My Notes ({notes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, mainTab === "shared" && styles.segmentBtnActive]}
            onPress={() => {
              setMainTab("shared");
              fetchSharedNotes();
            }}
          >
            <SVGIcon
              name="share-social"
              size={16}
              color={mainTab === "shared" ? "#fff" : COLORS.primary}
            />
            <Text style={[styles.segmentBtnText, mainTab === "shared" && styles.segmentBtnTextActive]}>
              Shared Notes ({sharedNotes.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
                placeholder="Write your study note here..."
              />
            </View>
          </ScrollView>
        </View>
      ) : mainTab === "mine" ? (
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
                    {moment(item.updatedAt || item.createdAt).format("MMM DD, YYYY")}
                  </Text>
                  <View style={styles.footerActions}>
                    <TouchableOpacity
                      onPress={() => setShareNoteModalItem(item)}
                      style={styles.shareIconBtn}
                    >
                      <SVGIcon name="share-social-outline" size={18} color={COLORS.primary} />
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
                              onPress: () => deleteLocalNote(item.id),
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
      ) : (
        <View style={{ flex: 1 }}>
          {loadingShared ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : sharedNotes.length > 0 ? (
            <FlatList
              data={sharedNotes}
              keyExtractor={(i) => i.id}
              numColumns={isLargeScreen ? 2 : 1}
              columnWrapperStyle={isLargeScreen ? { gap: 16 } : null}
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSentByMe = item.senderId === appUser?.uid;
                return (
                  <View style={[styles.noteCard, isLargeScreen && { flex: 1, marginBottom: 0 }]}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={[styles.badge, isSentByMe ? styles.badgeSent : styles.badgeRecv]}>
                        <Text style={[styles.badgeText, isSentByMe ? styles.badgeTextSent : styles.badgeTextRecv]}>
                          {isSentByMe ? `Shared with ${item.targetName}` : `From ${item.senderName}`}
                        </Text>
                      </View>
                    </View>

                    <Text numberOfLines={4} style={styles.cardContent}>
                      {item.content.replace(/<[^>]*>?/gm, "")}
                    </Text>

                    <View style={styles.cardFooter}>
                      <Text style={styles.dateText}>
                        {moment(item.createdAt?.toMillis ? item.createdAt.toMillis() : Date.now()).format("MMM DD, YYYY")}
                      </Text>
                      <View style={styles.footerActions}>
                        {!isSentByMe && (
                          <TouchableOpacity
                            style={styles.copyBtn}
                            onPress={() => handleImportSharedNote(item)}
                          >
                            <SVGIcon name="download-outline" size={16} color={COLORS.primary} />
                            <Text style={styles.copyBtnText}>Save to My Notes</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              "Remove Shared Note",
                              "Remove this note from your shared list?",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: () => deleteSharedNote(item.id),
                                },
                              ]
                            );
                          }}
                        >
                          <SVGIcon name="trash-outline" size={18} color="#FF4D4D" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            <View style={styles.center}>
              <SVGIcon name="share-social-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Shared Notes Yet</Text>
              <Text style={styles.emptySubText}>
                Notes shared with you by teachers or classmates will appear here.
              </Text>
            </View>
          )}
        </View>
      )}

      <ShareNoteModal
        visible={!!shareNoteModalItem}
        onClose={() => setShareNoteModalItem(null)}
        note={shareNoteModalItem}
        userRole="student"
      />
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
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: Platform.OS === "ios" ? 40 : 10,
  },
  backBtn: {
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1C1E",
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSaveBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  headerCancelBtn: {
    backgroundColor: "#F1F3F5",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCancelBtnText: {
    color: "#495057",
    fontWeight: "700",
    fontSize: 14,
  },
  addCircle: {
    padding: 4,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  segmentBtnTextActive: {
    color: "#fff",
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
    minHeight: 500,
    overflow: "hidden",
    ...SHADOWS.small,
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
    gap: 12,
  },
  shareIconBtn: {
    padding: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeRecv: {
    backgroundColor: "#FEF3C7",
  },
  badgeSent: {
    backgroundColor: "#E0E7FF",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  badgeTextRecv: {
    color: "#B45309",
  },
  badgeTextSent: {
    color: "#3730A3",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary + "10",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
  },
});
