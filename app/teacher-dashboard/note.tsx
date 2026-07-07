// app/teacher-dashboard/note.tsx
import { useRouter } from "expo-router";
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
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useTeacherNotes, Note } from "../../hooks/teacher-dashboard/useTeacherNotes";

const { width } = Dimensions.get("window");
const isLargeScreen = width > 768;

export default function TeacherNoteScreen() {
  const router = useRouter();
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

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const editorRef = useRef<RichTextEditorRef>(null);

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

    if (router.canGoBack()) {
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>My Notes 🗒️</Text>
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
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1 }]}
                onPress={handleSave}
                disabled={saving}
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
                    {new Date(
                      item.updatedAt || item.createdAt,
                    ).toLocaleDateString()}
                  </Text>
                  <View style={styles.footerActions}>
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
