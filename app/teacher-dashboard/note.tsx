// app/teacher-dashboard/note.tsx
import { useRouter } from "expo-router";
import moment from "moment";
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
  BackHandler,
} from "react-native";
import RichTextEditor, { RichTextEditorRef } from "../../components/RichTextEditor";
import ShareNoteModal from "../../components/ShareNoteModal";
import SVGIcon from "../../components/SVGIcon";
import { TierProtectedRoute } from "../../components/TierProtectedRoute";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useTeacherNotes, Note } from "../../hooks/teacher-dashboard/useTeacherNotes";
import { useNoteSharing, SharedNote } from "../../hooks/useNoteSharing";
import { useToast } from "../../contexts/ToastContext";

const { width } = Dimensions.get("window");
const isLargeScreen = width > 768;

export default function TeacherNoteScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    notes,
    loading,
    saving,
    search,
    setSearch,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    appUser
  } = useTeacherNotes();

  const {
    sharedNotes,
    loadingShared,
    fetchSharedNotes,
    deleteSharedNote,
  } = useNoteSharing();

  const [mainTab, setMainTab] = useState<"mine" | "shared">("mine");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [shareNoteModalItem, setShareNoteModalItem] = useState<Note | null>(null);

  const editorRef = useRef<RichTextEditorRef>(null);
  const isNavigating = useRef(false);

  const handleBack = useCallback(async () => {
    if (isAdding) {
      const currentHtml = await editorRef.current?.getHTML();
      const hasContent = title.trim() || (currentHtml && currentHtml !== "<p></p>" && currentHtml !== "");

      if (hasContent) {
        Alert.alert(
          "Discard Note?",
          "You have unsaved changes in your note. Do you want to discard them?",
          [
            { text: "Keep Editing", style: "cancel" },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => {
                setIsAdding(false);
                setEditingId(null);
                setTitle("");
                setContent("");
              },
            },
          ]
        );
      } else {
        setIsAdding(false);
        setEditingId(null);
        setTitle("");
        setContent("");
      }
      return;
    }

    if (isNavigating.current) return;
    isNavigating.current = true;
    setTimeout(() => {
      isNavigating.current = false;
    }, 500);

    if (Platform.OS === "web") {
      router.replace("/teacher-dashboard");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
  }, [isAdding, title, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  if (!appUser && !loading)
    return (
      <View style={styles.center}>
        <Text>Please log in to use notes.</Text>
      </View>
    );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

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

  const handleSave = async () => {
    const html = await editorRef.current?.getHTML();
    if (editingId) {
      await updateNote(editingId, title, html || "");
    } else {
      await createNote(title, html || "");
    }
    cancelEdit();
  };

  const handleImportSharedNote = async (sharedNote: SharedNote) => {
    await createNote(sharedNote.title, sharedNote.content);
    showToast({
      message: "Shared note copied into your personal notes!",
      type: "success",
    });
  };

  return (
    <TierProtectedRoute featureId="teacher_note">
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>
            {isAdding ? (editingId ? "Edit Note" : "New Note") : "My Notes 🗒️"}
          </Text>
          {isAdding ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerSaveBtn}
                onPress={handleSave}
                disabled={saving}
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
              contentContainerStyle={{ paddingBottom: 80, flexGrow: 1 }}
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
                  enableTeacherTools={true}
                  placeholder="Write your note here..."
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
              data={notes}
              keyExtractor={(i) => i.id}
              numColumns={isLargeScreen ? 2 : 1}
              columnWrapperStyle={isLargeScreen ? { gap: 16 } : null}
              contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
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
                      onPress={() => togglePin(item.id)}
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
                                onPress: () => deleteNote(item.id),
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
                contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
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
                  Notes shared with you or sent by you will appear here.
                </Text>
              </View>
            )}
          </View>
        )}

        <ShareNoteModal
          visible={!!shareNoteModalItem}
          onClose={() => setShareNoteModalItem(null)}
          note={shareNoteModalItem}
          userRole="teacher"
        />
      </View>
    </TierProtectedRoute>
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
  headerTitle: {
    fontSize: 26,
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
