import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Text,
} from "react-native";
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
  return (
    <View style={styles.searchStrip}>
      <TouchableOpacity activeOpacity={1} style={styles.searchBar}>
        <SVGIcon name="search" size={18} color={VIBE.muted} />
        <TextInput
          placeholder="Search..."
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={VIBE.muted}
          underlineColorAndroid="transparent"
        />
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.searchActionsScroll}
        contentContainerStyle={styles.searchActionsContainer}
      >
        <TouchableOpacity
          onPress={() => setShowArchived(!showArchived)}
          style={[
            styles.archiveToggle,
            showArchived && { backgroundColor: COLORS.secondary },
          ]}
        >
          <SVGIcon
            name="archive"
            size={18}
            color={showArchived ? "#fff" : VIBE.muted}
          />
          <Text
            style={[
              styles.archiveToggleText,
              { color: showArchived ? "#fff" : VIBE.muted },
            ]}
          >
            {showArchived ? "ACTIVE" : "ARCHIVE"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onPrintReports} style={styles.refreshRound}>
          <SVGIcon name="print" size={18} color={VIBE.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onRefresh} style={styles.refreshRound}>
          <SVGIcon name="refresh" size={18} color={VIBE.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onShowDaily} style={styles.refreshRound}>
          <SVGIcon name="calendar" size={18} color={VIBE.secondary} />
        </TouchableOpacity>

        {isSuperAdmin && onNormalize && (
          <TouchableOpacity
            onPress={onNormalize}
            style={[styles.refreshRound, { backgroundColor: VIBE.info + "10" }]}
          >
            <SVGIcon name="sync" size={18} color={VIBE.info} />
            {inconsistentCount > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  backgroundColor: VIBE.danger,
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}>
                  {inconsistentCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};
