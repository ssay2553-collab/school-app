import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { StudentDraft } from "../../constants/admin-dashboard/ManageFeesTypes";

interface FeeStudentCardProps {
  item: StudentDraft;
  isSelected: boolean;
  activeMode: "billing" | "payment" | "discounts";
  onPress: () => void;
  canEdit: boolean;
  individualBillOverrides: Record<string, string>;
  termBillAmount: string;
  setIndividualBillOverrides: (update: any) => void;
  individualDiscountOverrides: Record<string, string>;
  discountAmount: string;
  setIndividualDiscountOverrides: (update: any) => void;
  onViewLedger: () => void;
}

export const FeeStudentCard = React.memo<FeeStudentCardProps>(({
  item,
  isSelected,
  activeMode,
  onPress,
  canEdit,
  individualBillOverrides,
  termBillAmount,
  setIndividualBillOverrides,
  individualDiscountOverrides,
  discountAmount,
  setIndividualDiscountOverrides,
  onViewLedger,
}) => {
  const hasDebt = Math.round((item.currentBalance || 0) * 100) / 100 > 0;
  const currentBillValue =
    individualBillOverrides[item.uid] ?? (isSelected ? termBillAmount : "");
  const hasActiveBill =
    !!currentBillValue && parseFloat(String(currentBillValue)) !== 0;
  const hasOverride = individualBillOverrides[item.uid] !== undefined;
  const isDiscountMode = activeMode === "discounts";
  const currentDiscountValue =
    individualDiscountOverrides[item.uid] ?? (isSelected ? discountAmount : "");

  return (
    <Animatable.View
      animation="fadeInUp"
      duration={400}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        style={[
          styles.financeCard,
          isSelected && styles.selectedCard,
          isDiscountMode && styles.discountCard,
        ]}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: hasDebt ? VIBE.danger : VIBE.success },
          ]}
        />
        <View
          style={
            isDiscountMode ? styles.discountCardContent : styles.cardContent
          }
        >
          <View style={styles.leftSection}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: hasDebt
                    ? VIBE.danger + "10"
                    : VIBE.success + "10",
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: hasDebt ? VIBE.danger : VIBE.success },
                ]}
              >
                {(item.fullName || "S").charAt(0)}
              </Text>
            </View>
            <View style={styles.mainInfo}>
              <Text style={styles.studentName} numberOfLines={1}>
                {item.fullName}
              </Text>
              {!isDiscountMode && item.studentID ? (
                <Text
                  style={{
                    fontSize: 10,
                    color: VIBE.primary,
                    fontWeight: "800",
                  }}
                >
                  ID: {item.studentID}
                </Text>
              ) : null}

              {isDiscountMode && !!item.discount && (
                <View style={{ marginTop: 4 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: VIBE.success,
                    }}
                  >
                    Applied: ₵{(item.discount || 0).toFixed(2)}
                  </Text>
                </View>
              )}

              {!isDiscountMode && (
                <>
                    <View style={styles.debtBox}>
                    <Text
                      style={[
                        styles.debtLabel,
                        { color: hasDebt ? VIBE.danger : VIBE.success },
                      ]}
                    >
                      {hasDebt ? "Balance Due: " : "Cleared"}
                    </Text>
                    <Text
                      style={[
                        styles.debtValue,
                        { color: hasDebt ? VIBE.danger : VIBE.success },
                      ]}
                    >
                      ₵
                      {Math.max(0, item.currentBalance || 0).toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.rightSection}>
            {activeMode === "billing" ? (
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={[
                    styles.billingBubble,
                    hasActiveBill && styles.billingBubbleActive,
                    hasOverride && styles.billingBubbleOverride,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleSym,
                      (hasActiveBill || hasOverride) && styles.textWhite,
                    ]}
                  >
                    ₵
                  </Text>
                  <TextInput
                    style={[
                      styles.bubbleInput,
                      (hasActiveBill || hasOverride) && styles.textWhite,
                    ]}
                    placeholder="+/- ₵"
                    placeholderTextColor={
                      hasActiveBill ? "rgba(255,255,255,0.6)" : VIBE.muted
                    }
                    value={currentBillValue ? String(currentBillValue) : ""}
                    onChangeText={(v) =>
                      setIndividualBillOverrides(
                        (p: Record<string, string>) => ({
                          ...p,
                          [item.uid]: v,
                        }),
                      )
                    }
                    keyboardType="numbers-and-punctuation"
                    editable={canEdit}
                  />
                </View>
              </View>
            ) : activeMode === "discounts" ? (
              <View style={styles.discountRightSection}>
                <View
                  style={[
                    styles.discountBubble,
                    (!!individualDiscountOverrides[item.uid] ||
                      !!discountAmount) && {
                      backgroundColor: VIBE.success,
                      borderColor: VIBE.success,
                    },
                    !!individualDiscountOverrides[item.uid] &&
                      styles.discountBubbleOverride,
                  ]}
                >
                  <Text
                    style={[
                      styles.discountBubbleSym,
                      (!!individualDiscountOverrides[item.uid] ||
                        !!discountAmount) &&
                        styles.textWhite,
                      {
                        color:
                          !!individualDiscountOverrides[item.uid] ||
                          !!discountAmount
                            ? "#fff"
                            : VIBE.success,
                      },
                    ]}
                  >
                    -
                  </Text>
                  <TextInput
                    style={[
                      styles.discountBubbleInput,
                      (!!individualDiscountOverrides[item.uid] ||
                        !!discountAmount) &&
                        styles.textWhite,
                    ]}
                    placeholder="₵"
                    placeholderTextColor={
                      !!individualDiscountOverrides[item.uid] ||
                      !!discountAmount
                        ? "rgba(255,255,255,0.6)"
                        : VIBE.muted
                    }
                    value={currentDiscountValue ? String(currentDiscountValue) : ""}
                    onChangeText={(v) =>
                      setIndividualDiscountOverrides((p: any) => ({
                        ...p,
                        [item.uid]: v,
                      }))
                    }
                    keyboardType="numeric"
                    editable={canEdit}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.actionIcons}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onViewLedger();
                  }}
                  style={styles.ledgerButton}
                >
                  <SVGIcon name="receipt" size={14} color="#fff" />
                  <Text style={styles.ledgerButtonText}>LEDGER</Text>
                </TouchableOpacity>
                <SVGIcon name="chevron-forward" size={18} color="#CBD5E1" />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );
});
