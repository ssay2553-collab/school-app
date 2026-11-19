import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import SVGIcon from "../SVGIcon";
import { VIBE, styles } from "../../constants/admin-dashboard/ManageFeesStyles";
import { COLORS } from "../../constants/theme";

interface FeeSearchStripProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
  onPrintReports: () => void;
  onRefresh: () => void;
  onShowDaily: () => void;
  onNormalize?: () => void;
  isSuperAdmin: boolean;
  inconsistentCount: number;
}

export const FeeSearchStrip: React.FC<FeeSearchStripProps> = ({
  searchQuery,
  setSearchQuery,
  showArchived,
  setShowArchived,
  onPrintReports,
  onRefresh,
  onShowDaily,
  onNormalize,
  isSuperAdmin,
  inconsistentCount,
}) => {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.searchStrip}>
      <TouchableOpacity activeOpacity={1} style={[styles.searchBar, { flex: 1 }]}>
        <SVGIcon name="search" size={18} color={VIBE.muted} />
        <TextInput
          placeholder="Search students or receipts..."
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={VIBE.muted}
          underlineColorAndroid="transparent"
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMenuVisible(true)}
        style={[
          styles.refreshRound,
          {
            backgroundColor: "#fff",
            borderColor: VIBE.border,
            borderWidth: 1,
            width: 48,
            height: 48,
            borderRadius: 24,
            justifyContent: "center",
            alignItems: "center",
          },
          Platform.OS === "web" && ({ cursor: "pointer" } as any),
        ]}
        activeOpacity={0.7}
      >
        <SVGIcon name="ellipsis-horizontal" size={20} color={VIBE.primary} />
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.5)",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: "#fff",
              width: "100%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: Platform.OS === "ios" ? 40 : 20,
              gap: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: "#CBD5E1",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 10,
              }}
            />

            <Text
              style={{
                fontSize: 16,
                fontWeight: "900",
                color: "#1E293B",
                marginBottom: 5,
              }}
            >
              Fee Management Options
            </Text>

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                setShowArchived(!showArchived);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 15,
                borderRadius: 12,
                backgroundColor: showArchived ? COLORS.secondary + "15" : "#F8FAFC",
                gap: 12,
              }}
              activeOpacity={0.7}
            >
              <SVGIcon
                name="archive"
                size={20}
                color={showArchived ? COLORS.secondary : VIBE.muted}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: showArchived ? COLORS.secondary : "#334155",
                  flex: 1,
                }}
              >
                {showArchived ? "Show Active Students" : "Show Archived Students"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                onPrintReports();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 15,
                borderRadius: 12,
                backgroundColor: "#F8FAFC",
                gap: 12,
              }}
              activeOpacity={0.7}
            >
              <SVGIcon name="print" size={20} color={VIBE.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#334155",
                  flex: 1,
                }}
              >
                Financial Reports
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                router.push("/admin-dashboard/StudentCharges" as any);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 15,
                borderRadius: 12,
                backgroundColor: "#F8FAFC",
                gap: 12,
              }}
              activeOpacity={0.7}
            >
              <SVGIcon name="card" size={20} color={VIBE.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#334155",
                  flex: 1,
                }}
              >
                Student Charges (Other Fees)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                onRefresh();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 15,
                borderRadius: 12,
                backgroundColor: "#F8FAFC",
                gap: 12,
              }}
              activeOpacity={0.7}
            >
              <SVGIcon name="refresh" size={20} color={VIBE.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#334155",
                  flex: 1,
                }}
              >
                Refresh Students
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                onShowDaily();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 15,
                borderRadius: 12,
                backgroundColor: "#F8FAFC",
                gap: 12,
              }}
              activeOpacity={0.7}
            >
              <SVGIcon name="calendar" size={20} color={VIBE.secondary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#334155",
                  flex: 1,
                }}
              >
                Daily Transactions
              </Text>
            </TouchableOpacity>

            {isSuperAdmin && onNormalize && (
              <TouchableOpacity
                onPress={() => {
                  setMenuVisible(false);
                  onNormalize();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 15,
                  borderRadius: 12,
                  backgroundColor: VIBE.info + "10",
                  gap: 12,
                }}
                activeOpacity={0.7}
              >
                <SVGIcon name="sync" size={20} color={VIBE.info} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: VIBE.info,
                    flex: 1,
                  }}
                >
                  Normalize Discounts{" "}
                  {inconsistentCount > 0 ? `(${inconsistentCount})` : ""}
                </Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
