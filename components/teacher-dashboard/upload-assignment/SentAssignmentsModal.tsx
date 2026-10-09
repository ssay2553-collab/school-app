import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import SVGIcon from "../../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { SentAssignment } from "../../../hooks/teacher-dashboard/useSentAssignments";
import { ClassData } from "../../../hooks/teacher-dashboard/useUploadAssignment";
import moment from "moment";

interface SentAssignmentsModalProps {
  visible: boolean;
  onClose: () => void;
  sentAssignments: SentAssignment[];
  teacherClasses: ClassData[];
  onDelete: (id: string) => void;
  onDeleteBulk: (ids: string[]) => void;
  onReupload: (assignment: SentAssignment, targetClassId: string) => Promise<boolean>;
}

export default function SentAssignmentsModal({
  visible,
  onClose,
  sentAssignments,
  teacherClasses,
  onDelete,
  onDeleteBulk,
  onReupload,
}: SentAssignmentsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reuploadTargetAssignment, setReuploadTargetAssignment] = useState<SentAssignment | null>(null);
  const [selectedTargetClassId, setSelectedTargetClassId] = useState<string>("");
  const [reuploading, setReuploading] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === sentAssignments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sentAssignments.map((item) => item.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeletePress = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      "Delete Selected",
      `Are you sure you want to delete ${selectedIds.length} assignment(s) from history?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeleteBulk(selectedIds);
            setSelectedIds([]);
          },
        },
      ]
    );
  };

  const handleUnitDeletePress = (id: string) => {
    Alert.alert(
      "Delete Assignment",
      "Are you sure you want to remove this assignment from your sent history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(id);
            setSelectedIds((prev) => prev.filter((i) => i !== id));
          },
        },
      ]
    );
  };

  const startReupload = (assignment: SentAssignment) => {
    setReuploadTargetAssignment(assignment);
    setSelectedTargetClassId(assignment.classId || teacherClasses[0]?.id || "");
  };

  const confirmReupload = async () => {
    if (!reuploadTargetAssignment || !selectedTargetClassId) return;
    setReuploading(true);
    const success = await onReupload(reuploadTargetAssignment, selectedTargetClassId);
    setReuploading(false);
    if (success) {
      setReuploadTargetAssignment(null);
      onClose();
    }
  };

  const renderItem = ({ item }: { item: SentAssignment }) => {
    const isSelected = selectedIds.includes(item.id);
    const targetClassName =
      teacherClasses.find((c) => c.id === item.classId)?.name || item.className || item.classId;

    return (
      <View style={[styles.card, isSelected && styles.cardSelected]}>
        <View style={styles.cardHeader}>
          <TouchableOpacity onPress={() => toggleSelectItem(item.id)} style={styles.checkboxContainer}>
            <SVGIcon
              name={isSelected ? "checkbox" : "square-outline"}
              size={22}
              color={isSelected ? COLORS.primary : "#94A3B8"}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>
              {item.subjectId} • Class: {targetClassName} • {moment(item.createdAt).format("MMM DD, YYYY")}
            </Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{(item.type || "mcq").toUpperCase()}</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.unitDeleteBtn}
            onPress={() => handleUnitDeletePress(item.id)}
          >
            <SVGIcon name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.unitDeleteText}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reuploadBtn}
            onPress={() => startReupload(item)}
          >
            <SVGIcon name="refresh" size={16} color="#fff" />
            <Text style={styles.reuploadBtnText}>Re-upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient colors={[COLORS.primary, "#1E293B"]} style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Sent Assignments Archive</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <SVGIcon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              Offline-accessible history of assignments you have posted. Re-upload or manage items below.
            </Text>
          </LinearGradient>

          {/* Selection & Bulk Actions Bar */}
          {sentAssignments.length > 0 && (
            <View style={styles.bulkActionBar}>
              <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllRow}>
                <SVGIcon
                  name={selectedIds.length === sentAssignments.length && sentAssignments.length > 0 ? "checkbox" : "square-outline"}
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.selectAllText}>
                  {selectedIds.length === sentAssignments.length ? "Deselect All" : "Select All"} ({selectedIds.length} selected)
                </Text>
              </TouchableOpacity>

              {selectedIds.length > 0 && (
                <TouchableOpacity onPress={handleBulkDeletePress} style={styles.bulkDeleteBtn}>
                  <SVGIcon name="trash" size={16} color="#fff" />
                  <Text style={styles.bulkDeleteText}>Delete Selected ({selectedIds.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* List */}
          <FlatList
            data={sentAssignments}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <SVGIcon name="document-text" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No sent assignments saved locally yet.</Text>
                <Text style={styles.emptySubtext}>Assignments you post will appear here for easy offline re-uploading.</Text>
              </View>
            }
          />

          {/* Re-upload Class Selection Sub-Modal / Picker Overlay */}
          {reuploadTargetAssignment && (
            <Modal visible={true} transparent={true} animationType="fade">
              <View style={styles.subModalOverlay}>
                <View style={styles.subModalContainer}>
                  <Text style={styles.subModalTitle}>Choose Class for Re-upload</Text>
                  <Text style={styles.subModalSubtitle}>
                    Re-uploading "{reuploadTargetAssignment.title}". Select destination class:
                  </Text>

                  <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
                    {teacherClasses.map((cls) => {
                      const isSelected = selectedTargetClassId === cls.id;
                      return (
                        <TouchableOpacity
                          key={cls.id}
                          style={[styles.classOptionItem, isSelected && styles.classOptionItemActive]}
                          onPress={() => setSelectedTargetClassId(cls.id)}
                        >
                          <Text style={[styles.classOptionText, isSelected && styles.classOptionTextActive]}>
                            {cls.name} {cls.id === reuploadTargetAssignment.classId ? "(Original)" : ""}
                          </Text>
                          {isSelected && <SVGIcon name="checkmark-circle" size={20} color={COLORS.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.subModalActions}>
                    <TouchableOpacity
                      style={styles.subModalCancelBtn}
                      onPress={() => setReuploadTargetAssignment(null)}
                      disabled={reuploading}
                    >
                      <Text style={styles.subModalCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.subModalConfirmBtn, reuploading && { opacity: 0.7 }]}
                      onPress={confirmReupload}
                      disabled={reuploading}
                    >
                      <Text style={styles.subModalConfirmText}>
                        {reuploading ? "Posting..." : "Confirm & Post"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContainer: { backgroundColor: "#F8FAFC", borderTopLeftRadius: 30, borderTopRightRadius: 30, height: "85%", overflow: "hidden" },
  modalHeader: { padding: 20, paddingTop: 25 },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  closeBtn: { padding: 4 },
  headerSubtitle: { fontSize: 13, color: "#94A3B8", lineHeight: 18 },
  bulkActionBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  selectAllRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectAllText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  bulkDeleteBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#EF4444", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6 },
  bulkDeleteText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0", ...SHADOWS.small },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: "#EEF2FF" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  checkboxContainer: { padding: 2 },
  title: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  subtitle: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  typeBadge: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 9, fontWeight: "900", color: COLORS.primary },
  description: { fontSize: 13, color: "#475569", marginBottom: 10, lineHeight: 18 },
  cardFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  unitDeleteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#FEF2F2" },
  unitDeleteText: { fontSize: 12, fontWeight: "700", color: "#EF4444" },
  reuploadBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.primary },
  reuploadBtnText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 80, paddingHorizontal: 20 },
  emptyText: { fontSize: 16, fontWeight: "800", color: "#475569", marginTop: 15, textAlign: "center" },
  emptySubtext: { fontSize: 13, color: "#94A3B8", textAlign: "center", marginTop: 6, lineHeight: 18 },
  subModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  subModalContainer: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "100%", maxWidth: 400, ...SHADOWS.medium },
  subModalTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", marginBottom: 8 },
  subModalSubtitle: { fontSize: 13, color: "#64748B", marginBottom: 12, lineHeight: 18 },
  classOptionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: "#F8FAFC", marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  classOptionItemActive: { backgroundColor: COLORS.primary + "15", borderColor: COLORS.primary },
  classOptionText: { fontSize: 14, fontWeight: "700", color: "#334155" },
  classOptionTextActive: { color: COLORS.primary, fontWeight: "900" },
  subModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 15 },
  subModalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#F1F5F9" },
  subModalCancelText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  subModalConfirmBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: COLORS.primary },
  subModalConfirmText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});
