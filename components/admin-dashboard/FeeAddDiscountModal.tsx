import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";
import { doc, writeBatch, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { propagateArrears } from "../../utils/financeUtils";

interface FeeAddDiscountModalProps {
  visible: boolean;
  onClose: () => void;
  students: StudentDraft[];
  academicYear: string;
  term: string;
  showToast: (props: { message: string; type: "success" | "error" | "info" }) => void;
  fetchStudents: (silent?: boolean) => Promise<void>;
  canEdit: boolean;
}

export const FeeAddDiscountModal: React.FC<FeeAddDiscountModalProps> = ({
  visible,
  onClose,
  students,
  academicYear,
  term,
  showToast,
  fetchStudents,
  canEdit,
}) => {
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter students who are NOT currently on discount
  const eligibleStudents = students.filter((s) => !s.onDiscount);

  const filteredEligible = eligibleStudents.filter((s) =>
    !searchQuery ||
    (s.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.studentID || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    const allSelected = filteredEligible.length > 0 && filteredEligible.every((s) => selectedUids.has(s.uid));
    setSelectedUids(new Set(allSelected ? [] : filteredEligible.map((s) => s.uid)));
  };

  const toggleSelection = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (saving || selectedUids.size === 0) return;
    if (!canEdit) {
      showToast({ message: "Access Denied", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const uids = Array.from(selectedUids);
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const disc = parseFloat(discountInput) || 0;

      const CHUNK_SIZE = 200;
      for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
        const chunk = uids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const uid of chunk) {
          const s = students.find((stud) => stud.uid === uid);
          if (!s) continue;

          // 1. Update user profile to enable discount
          batch.update(doc(db, "users", uid), { onDiscount: true });

          // 2. If discount amount is provided, also apply it to their term fee record
          if (disc > 0) {
            const recordId = `${uid}_${cleanYear}_${cleanTerm}`;
            if (!s.hasRecordInTerm) {
              batch.set(doc(db, "studentFeeRecords", recordId), {
                studentUid: uid,
                studentName: s.fullName,
                classId: s.classId,
                className: s.className,
                academicYear,
                term,
                termBill: 0,
                arrears: s.previousBalance || 0,
                discount: disc,
                amountPaid: 0,
                balance: (s.previousBalance || 0) - disc,
                totalPayable: s.previousBalance || 0,
                editCount: 1,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
                payments: [],
              });
            } else {
              batch.update(doc(db, "studentFeeRecords", recordId), {
                discount: increment(disc),
                balance: increment(-disc),
                lastUpdated: serverTimestamp(),
              });
            }
            batch.update(doc(db, "users", uid), { walletBalance: increment(-disc), onDiscount: true });
          }
        }
        await batch.commit();
      }

      // Propagate arrears for applied discounts
      if (disc > 0) {
        uids.forEach(uid => {
          propagateArrears(uid, academicYear, term, -disc, 'payment').catch(console.error);
        });
      }

      showToast({ message: `Successfully added ${uids.length} student(s) to discount.`, type: "success" });
      setSelectedUids(new Set());
      setDiscountInput("");
      setSearchQuery("");
      fetchStudents(true);
      onClose();
    } catch (error) {
      console.error("Add discount students error:", error);
      showToast({ message: "Failed to add students to discount", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.paymentModal, { maxHeight: '85%' }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.modalTopRow}>
            <Text style={styles.modalStudentName}>Add Students to Discount</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeRound} activeOpacity={0.7}>
              <SVGIcon name="close" size={24} color={VIBE.muted} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={[styles.searchBar, { width: '100%' }]}>
              <SVGIcon name="search" size={18} color={VIBE.muted} />
              <TextInput
                placeholder="Search active students..."
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={VIBE.muted}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <TextInput
                style={styles.pillInput}
                placeholder="Initial Discount Amount (₵) [Optional]"
                keyboardType="numeric"
                value={discountInput}
                onChangeText={setDiscountInput}
                placeholderTextColor={VIBE.muted}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: VIBE.muted }}>
                Selected: {selectedUids.size} of {filteredEligible.length}
              </Text>
              <TouchableOpacity onPress={toggleSelectAll}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: VIBE.primary }}>
                  {selectedUids.size === filteredEligible.length ? "Deselect All" : "Select All"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            nestedScrollEnabled={true}
          >
            {filteredEligible.length > 0 ? (
              filteredEligible.map((s) => {
                const isSelected = selectedUids.has(s.uid);
                return (
                  <TouchableOpacity
                    key={s.uid}
                    style={[
                      styles.financeCard,
                      isSelected && { borderColor: VIBE.primary, backgroundColor: VIBE.primary + '08' },
                      { marginBottom: 8 }
                    ]}
                    activeOpacity={0.8}
                    onPress={() => toggleSelection(s.uid)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, padding: 12 }}>
                      <View style={[styles.avatar, { backgroundColor: VIBE.primary + '15', marginRight: 12 }]}>
                        <Text style={[styles.avatarText, { color: VIBE.primary }]}>
                          {(s.fullName || 'S').charAt(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{s.fullName}</Text>
                        <Text style={{ fontSize: 10, color: VIBE.muted, fontWeight: '700' }}>
                          {s.className} {s.studentID ? `• ID: ${s.studentID}` : ''}
                        </Text>
                      </View>
                      <View style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: isSelected ? VIBE.primary : '#CBD5E1',
                        backgroundColor: isSelected ? VIBE.primary : 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        {isSelected && <SVGIcon name="checkmark" size={14} color="#fff" />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <SVGIcon name="people" size={48} color="#CBD5E1" />
                <Text style={{ color: VIBE.muted, marginTop: 10, fontWeight: '700' }}>No eligible students found</Text>
              </View>
            )}
          </ScrollView>

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: selectedUids.size > 0 ? VIBE.primary : '#CBD5E1' },
                Platform.OS === 'web' && ({ cursor: selectedUids.size > 0 ? 'pointer' : 'default' } as any)
              ]}
              activeOpacity={0.8}
              onPress={handleAddSelected}
              disabled={saving || selectedUids.size === 0}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  ADD {selectedUids.size} STUDENT{selectedUids.size === 1 ? '' : 'S'} TO DISCOUNT
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
