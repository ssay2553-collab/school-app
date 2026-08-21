import React, { memo } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import SVGIcon from "../SVGIcon";
import { VIBE } from "./FeedingFeeConstants";
import { StudentRecord, DailyRecord } from "../../hooks/shared/useFeedingFeeLogic";
import { useToast } from "../../contexts/ToastContext";

interface StudentRowProps {
  item: StudentRecord;
  existingRecord?: DailyRecord;
  attendanceStatus?: string;
  rate: number;
  canEdit: boolean;
  overrideValue?: string;
  onMarkPaid: (uid: string, override?: string) => Promise<void>;
  onMarkNotPaid: (uid: string) => Promise<void>;
  onSetOverride: (uid: string, val?: string) => void;
}

export const StudentRow = memo(({
  item,
  existingRecord,
  attendanceStatus,
  rate,
  canEdit,
  overrideValue,
  onMarkPaid,
  onMarkNotPaid,
  onSetOverride
}: StudentRowProps) => {
  const { showToast } = useToast();
  const isPaid = existingRecord?.feedingPaid === true;
  const isAbsent = attendanceStatus === "absent";
  const hasArrears = (item.dailyArrears || 0) > 0;

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
            isPaid && { backgroundColor: VIBE.success + "20" },
            isAbsent && { backgroundColor: VIBE.danger + "10" },
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
            <Text style={styles.studentName} numberOfLines={1}>
              {item.fullName}
            </Text>
            {hasArrears && (
              <View style={styles.arrearsBadge}>
                <Text style={styles.arrearsText}>Arrears: ₵{item.dailyArrears}</Text>
              </View>
            )}
          </View>
          <View style={styles.studentMetaRow}>
            <Text style={styles.studentClass}>{item.className}</Text>
            <Text style={styles.rateText}>₵{rate}</Text>
            {isAbsent ? (
              <View style={[styles.statusBadge, { backgroundColor: VIBE.danger + "15" }]}>
                <Text style={[styles.statusBadgeText, { color: VIBE.danger }]}>Absent</Text>
              </View>
            ) : existingRecord && (existingRecord.feedingFee || 0) > 0 ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: isPaid ? VIBE.success + "15" : VIBE.info + "15" },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: isPaid ? VIBE.success : VIBE.info }]}>
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
          onPress={async () => {
            if (!canEdit) return;
            if (isAbsent) {
              showToast({ message: "Student is absent.", type: "error" });
              return;
            }
            await onMarkPaid(item.uid, overrideValue);
            onSetOverride(item.uid, undefined);
          }}
          onLongPress={() => {
            if (!canEdit) return;
            onSetOverride(item.uid, overrideValue !== undefined ? undefined : "");
          }}
          disabled={!canEdit}
        >
          <SVGIcon name="checkmark" size={18} color={isPaid ? "#fff" : VIBE.success} />
          <Text style={[styles.actionBtnText, { color: isPaid ? "#fff" : VIBE.success }]}>Paid</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnUnpaid,
            existingRecord && (existingRecord.feedingFee || 0) > 0 && !isPaid && styles.actionBtnActiveUnpaid,
            (!canEdit || isAbsent) && { opacity: 0.5 },
          ]}
          onPress={async () => {
            if (!canEdit) return;
            if (isAbsent) {
              showToast({ message: "Student is absent.", type: "error" });
              return;
            }
            await onMarkNotPaid(item.uid);
          }}
          disabled={!canEdit}
        >
          <SVGIcon
            name="close"
            size={18}
            color={existingRecord && (existingRecord.feedingFee || 0) > 0 && !isPaid ? "#fff" : VIBE.danger}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: existingRecord && (existingRecord.feedingFee || 0) > 0 && !isPaid ? "#fff" : VIBE.danger },
            ]}
          >
            Unpaid
          </Text>
        </TouchableOpacity>
      </View>

      {overrideValue !== undefined && (
        <View style={styles.overrideContainer}>
          <TextInput
            value={overrideValue}
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
  },
  studentCardPaid: {
    borderColor: VIBE.success + "40",
    backgroundColor: VIBE.success + "05",
  },
  studentCardAbsent: {
    opacity: 0.8,
    backgroundColor: VIBE.bg,
  },
  studentCardMain: { flexDirection: "row", alignItems: "center" },
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
  arrearsBadge: {
    backgroundColor: VIBE.danger + "10",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: VIBE.danger + "30",
  },
  arrearsText: { fontSize: 10, fontWeight: "800", color: VIBE.danger },
  studentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 8,
  },
  studentClass: { fontSize: 12, color: VIBE.muted, fontWeight: "500" },
  rateText: { fontSize: 12, color: VIBE.info, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
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
  actionBtnText: { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
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
