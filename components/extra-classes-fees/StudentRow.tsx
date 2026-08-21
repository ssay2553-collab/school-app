import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import SVGIcon from "../SVGIcon";
import { VIBE } from "./ExtraClassesFeeConstants";
import { SHADOWS } from "../../constants/theme";

interface StudentRowProps {
  item: any;
  existingRecord: any;
  isAbsent: boolean;
  canEdit: boolean;
  overrideAmount?: string;
  onMarkPaid: (uid: string, override?: string) => void;
  onMarkNotPaid: (uid: string) => void;
  onSetOverride: (uid: string, amount: string | undefined) => void;
  showToast: (props: { message: string; type: "success" | "error" | "info" | "warning" }) => void;
}

const StudentRow = memo(({
  item,
  existingRecord,
  isAbsent,
  canEdit,
  overrideAmount,
  onMarkPaid,
  onMarkNotPaid,
  onSetOverride,
  showToast,
}: StudentRowProps) => {
  const isPaid = existingRecord?.extraPaid === true;

  return (
    <View
      style={[
        styles.studentCard,
        isPaid && styles.studentCardPaid,
        isAbsent && styles.studentCardAbsent,
      ]}
    >
      <View style={styles.studentCardMain}>
        <View
          style={[
            styles.studentAvatar,
            isPaid && {
              backgroundColor: VIBE.success + "20",
            },
            isAbsent && {
              backgroundColor: VIBE.danger + "10",
            },
          ]}
        >
          <Text
            style={[
              styles.studentAvatarText,
              isPaid && { color: VIBE.success },
              isAbsent && { color: VIBE.danger },
            ]}
          >
            {item.fullName.charAt(0)}
          </Text>
        </View>
        <View style={styles.studentInfo}>
          <View style={styles.studentNameRow}>
            <Text
              style={styles.studentName}
              numberOfLines={1}
            >
              {item.fullName}
            </Text>
          </View>
          <View style={styles.studentMetaRow}>
            <Text style={styles.studentClass}>
              {item.className}
            </Text>
            {isAbsent ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: VIBE.danger + "15" },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: VIBE.danger },
                  ]}
                >
                  Absent
                </Text>
              </View>
            ) : existingRecord &&
              (existingRecord.extraClassesFee || 0) > 0 ? (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isPaid
                      ? VIBE.success + "15"
                      : VIBE.secondary + "15",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: isPaid
                        ? VIBE.success
                        : VIBE.secondary,
                    },
                  ]}
                >
                  {isPaid ? "Paid" : "Recorded"}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.studentActions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnPaid,
            isPaid && styles.actionBtnActivePaid,
            (!canEdit || isAbsent) && { opacity: 0.5 },
          ]}
          onPress={() => {
            if (!canEdit) return;
            if (isAbsent) {
              showToast({
                message: "Student is absent.",
                type: "error",
              });
              return;
            }
            onMarkPaid(item.uid, overrideAmount);
            onSetOverride(item.uid, undefined);
          }}
          onLongPress={() => {
            if (!canEdit) return;
            onSetOverride(item.uid, overrideAmount !== undefined ? undefined : "");
          }}
          disabled={!canEdit}
        >
          <SVGIcon
            name="checkmark"
            size={18}
            color={isPaid ? "#fff" : VIBE.success}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: isPaid ? "#fff" : VIBE.success },
            ]}
          >
            Paid
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnUnpaid,
            existingRecord &&
              (existingRecord.extraClassesFee || 0) > 0 &&
              !isPaid &&
              styles.actionBtnActiveUnpaid,
            (!canEdit || isAbsent) && { opacity: 0.5 },
          ]}
          onPress={() => {
            if (!canEdit) return;
            if (isAbsent) {
              showToast({
                message: "Student is absent.",
                type: "error",
              });
              return;
            }
            onMarkNotPaid(item.uid);
          }}
          disabled={!canEdit}
        >
          <SVGIcon
            name="close"
            size={18}
            color={
              existingRecord &&
              (existingRecord.extraClassesFee || 0) > 0 &&
              !isPaid
                ? "#fff"
                : VIBE.danger
            }
          />
          <Text
            style={[
              styles.actionBtnText,
              {
                color:
                  existingRecord &&
                  (existingRecord.extraClassesFee || 0) > 0 &&
                  !isPaid
                    ? "#fff"
                    : VIBE.danger,
              },
            ]}
          >
            Unpaid
          </Text>
        </TouchableOpacity>
      </View>

      {overrideAmount !== undefined && (
        <View style={styles.overrideContainer}>
          <TextInput
            value={overrideAmount}
            onChangeText={(val) => onSetOverride(item.uid, val)}
            placeholder="Override amount (₵)"
            keyboardType="numeric"
            style={styles.overrideInput}
            autoFocus
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  studentCard: {
    backgroundColor: VIBE.surface,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: VIBE.border,
    ...SHADOWS.small,
  },
  studentCardPaid: {
    borderColor: VIBE.success + "40",
    backgroundColor: VIBE.success + "05",
  },
  studentCardAbsent: {
    opacity: 0.8,
    backgroundColor: VIBE.bg,
  },
  studentCardMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: VIBE.primary + "10",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  studentAvatarText: { fontSize: 18, fontWeight: "900", color: VIBE.primary },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "700", color: VIBE.text, flex: 1 },
  studentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  studentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 8,
  },
  studentClass: { fontSize: 12, color: VIBE.muted, fontWeight: "500" },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  studentActions: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: VIBE.border,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
  },
  actionBtnPaid: { borderColor: VIBE.success, backgroundColor: "#fff" },
  actionBtnUnpaid: { borderColor: VIBE.danger, backgroundColor: "#fff" },
  actionBtnActivePaid: { backgroundColor: VIBE.success },
  actionBtnActiveUnpaid: { backgroundColor: VIBE.danger },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  overrideContainer: { marginTop: 12 },
  overrideInput: {
    backgroundColor: VIBE.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: VIBE.text,
    borderWidth: 1,
    borderColor: VIBE.primary + "40",
    fontWeight: "600",
  },
});

export default StudentRow;
