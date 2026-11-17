import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SVGIcon from "./SVGIcon";
import { COLORS, SHADOWS } from "../constants/theme";
import { useNoteSharing, ShareRecipient } from "../hooks/useNoteSharing";

interface Props {
  visible: boolean;
  onClose: () => void;
  note: { title: string; content: string } | null;
  userRole: "teacher" | "student";
}

export default function ShareNoteModal({ visible, onClose, note, userRole }: Props) {
  const {
    fetchClasses,
    fetchStudents,
    fetchTeachers,
    fetchClassmates,
    shareNote,
    sharing,
  } = useNoteSharing();

  const isTeacher = userRole === "teacher";

  const [activeTab, setActiveTab] = useState<"class" | "student" | "teacher" | "classmate">(
    isTeacher ? "class" : "teacher"
  );
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<ShareRecipient | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setActiveTab(isTeacher ? "class" : "teacher");
    setSelectedRecipient(null);
    setSearch("");
  }, [isTeacher, visible]);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    setSelectedRecipient(null);
    try {
      let list: ShareRecipient[] = [];
      if (activeTab === "class") {
        list = await fetchClasses();
      } else if (activeTab === "student") {
        list = await fetchStudents();
      } else if (activeTab === "teacher") {
        list = await fetchTeachers();
      } else if (activeTab === "classmate") {
        list = await fetchClassmates();
      }
      setRecipients(list);
    } catch (e) {
      console.error(e);
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  }, [activeTab, fetchClasses, fetchStudents, fetchTeachers, fetchClassmates]);

  useEffect(() => {
    if (visible) {
      loadRecipients();
    }
  }, [visible, activeTab, loadRecipients]);

  const handleConfirmShare = async () => {
    if (!selectedRecipient || !note) return;
    const success = await shareNote({
      noteTitle: note.title,
      noteContent: note.content,
      targetType: activeTab,
      recipient: selectedRecipient,
    });
    if (success) {
      onClose();
    }
  };

  const filteredRecipients = recipients.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.subtitle && r.subtitle.toLowerCase().includes(search.toLowerCase()))
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Share Note</Text>
              <Text style={styles.noteTitlePreview} numberOfLines={1}>
                "{note?.title || "Untitled Note"}"
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <SVGIcon name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Role-based Tab Selector */}
          <View style={styles.tabRow}>
            {isTeacher ? (
              <>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "class" && styles.activeTab]}
                  onPress={() => setActiveTab("class")}
                >
                  <SVGIcon
                    name="people"
                    size={16}
                    color={activeTab === "class" ? "#fff" : "#64748B"}
                  />
                  <Text style={[styles.tabText, activeTab === "class" && styles.activeTabText]}>
                    Entire Class
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, activeTab === "student" && styles.activeTab]}
                  onPress={() => setActiveTab("student")}
                >
                  <SVGIcon
                    name="person"
                    size={16}
                    color={activeTab === "student" ? "#fff" : "#64748B"}
                  />
                  <Text style={[styles.tabText, activeTab === "student" && styles.activeTabText]}>
                    Individual Student
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.tab, activeTab === "teacher" && styles.activeTab]}
                  onPress={() => setActiveTab("teacher")}
                >
                  <SVGIcon
                    name="school"
                    size={16}
                    color={activeTab === "teacher" ? "#fff" : "#64748B"}
                  />
                  <Text style={[styles.tabText, activeTab === "teacher" && styles.activeTabText]}>
                    My Teacher
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, activeTab === "classmate" && styles.activeTab]}
                  onPress={() => setActiveTab("classmate")}
                >
                  <SVGIcon
                    name="people"
                    size={16}
                    color={activeTab === "classmate" ? "#fff" : "#64748B"}
                  />
                  <Text style={[styles.tabText, activeTab === "classmate" && styles.activeTabText]}>
                    Classmate
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <SVGIcon name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeTab === "class"
                  ? "Search classes..."
                  : activeTab === "student"
                  ? "Search students..."
                  : activeTab === "teacher"
                  ? "Search teachers..."
                  : "Search classmates..."
              }
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Recipients List */}
          {loadingRecipients ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {filteredRecipients.length > 0 ? (
                filteredRecipients.map((item) => {
                  const isSelected = selectedRecipient?.id === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                      onPress={() => setSelectedRecipient(item)}
                    >
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
                          {item.name}
                        </Text>
                        {item.subtitle ? (
                          <Text style={[styles.itemSubtitle, isSelected && styles.itemSubSelected]}>
                            {item.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>
                  No recipients found for this category.
                </Text>
              )}
            </ScrollView>
          )}

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.shareBtn,
                (!selectedRecipient || sharing) && { opacity: 0.5 },
              ]}
              onPress={handleConfirmShare}
              disabled={!selectedRecipient || sharing}
            >
              {sharing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.shareBtnText}>Share Note</Text>
                  <SVGIcon name="send" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
    ...SHADOWS.medium,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  noteTitlePreview: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 260,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
  },
  activeTabText: {
    color: "#fff",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  list: {
    maxHeight: 280,
  },
  loadingBox: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  itemCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "0A",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  itemNameSelected: {
    color: COLORS.primary,
  },
  itemSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  itemSubSelected: {
    color: COLORS.primary + "AA",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
    paddingVertical: 30,
    fontStyle: "italic",
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  shareBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    ...SHADOWS.small,
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
});
