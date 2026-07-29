import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useExpenditure } from "../../hooks/admin-dashboard/useExpenditure";
import { ExpenditureSummaryCard } from "../../components/admin-dashboard/expenditure/ExpenditureSummaryCard";
import { ExpenditureItemCard } from "../../components/admin-dashboard/expenditure/ExpenditureItemCard";
import { ExpenditureModal } from "../../components/admin-dashboard/expenditure/ExpenditureModal";
import { Expenditure } from "../../constants/admin-dashboard/ExpenditureConstants";

export default function ExpenditureScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const {
    loading,
    refreshing,
    saving,
    deletingId,
    expenditures,
    serverTotal,
    selectedYear,
    selectedTerm,
    isPreviousTerm,
    groupedSummary,
    summaryTotal,
    fetchExpenditures,
    fetchPreviousTerm,
    resetToCurrentTerm,
    addExpenditure,
    deleteExpenditure,
  } = useExpenditure();

  // Access Control
  const currentUserRole = appUser?.adminRole?.toLowerCase() || "";
  const isSuperAdmin = [
    "proprietor",
    "proprietress",
    "manager",
    "headmaster",
    "headmistress",
    "administrator",
    "director",
    "accountant",
    "bursar",
    "admin",
    "super admin",
    "superadmin",
  ].includes(currentUserRole);
  const expPermission = appUser?.permissions?.["expenditure"] || "deny";
  const canView =
    isSuperAdmin ||
    expPermission === "full" ||
    expPermission === "view" ||
    expPermission === "edit";
  const canEdit =
    isSuperAdmin || expPermission === "full" || expPermission === "edit";

  // Brand Fallbacks
  const primaryBrand =
    SCHOOL_CONFIG.primaryColor || COLORS.primary || "#2e86de";
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  const [modalVisible, setModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredExpenditures = useMemo(() => {
    if (!filterCategory) return expenditures;
    return expenditures.filter(
      (exp) =>
        (exp.category || "").toLowerCase().trim() ===
        filterCategory.toLowerCase().trim()
    );
  }, [expenditures, filterCategory]);

  useEffect(() => {
    if (appUser && !canView) {
      showToast({
        message:
          "Access Denied: You do not have permission to view expenditures.",
        type: "error",
      });
      router.replace("/admin-dashboard");
    }
  }, [appUser, canView]);

  useEffect(() => {
    const onBackPress = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [modalVisible]);

  const handleDeleteExpenditure = (item: Expenditure) => {
    if (!canEdit) return;

    const performDelete = async () => {
      await deleteExpenditure(item);
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Are you sure you want to remove "${item.item}"? This action cannot be undone.`,
        )
      ) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Confirm Delete",
        `Are you sure you want to remove "${item.item}"? This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ],
      );
    }
  };

  if (!canView) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <SVGIcon
            name="lock-closed"
            size={60}
            color={COLORS.secondary || "#c53b59"}
          />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorSub}>
            You do not have the required permissions to view expenditures.
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.replace("/admin-dashboard")}
          >
            <Text style={styles.errorButtonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isConfigMissing = !selectedYear || !selectedTerm;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[primaryBrand, "#1E293B"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expenditures</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {!isConfigMissing && !isPreviousTerm && (
              <TouchableOpacity
                onPress={fetchPreviousTerm}
                style={styles.smallActionBtn}
              >
                <SVGIcon name="time-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
            {canEdit && !isConfigMissing && !isPreviousTerm && (
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={styles.addBtn}
              >
                <SVGIcon name="add" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>
              {filterCategory
                ? `TOTAL FOR ${filterCategory.toUpperCase()}`
                : "TOTAL PERIOD SPENDING"}
            </Text>
            <Text style={styles.summaryValue}>
              ₵
              {(filterCategory
                ? filteredExpenditures.reduce((sum, e) => sum + e.amount, 0)
                : serverTotal || 0
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>

          <View style={styles.viewToggleCompact}>
            <TouchableOpacity
              style={[
                styles.toggleItem,
                viewMode === "detailed" && !filterCategory && styles.toggleItemActive,
              ]}
              onPress={() => {
                setViewMode("detailed");
                setFilterCategory(null);
              }}
            >
              <SVGIcon name="list" size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleItem,
                viewMode === "summary" && styles.toggleItemActive,
              ]}
              onPress={() => {
                setViewMode("summary");
                setFilterCategory(null);
              }}
            >
              <SVGIcon name="pie-chart" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.compactFilterRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedYear || "N/A"}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedTerm || "N/A"}</Text>
          </View>
          {filterCategory && (
            <TouchableOpacity
              onPress={() => setFilterCategory(null)}
              style={styles.filterBadge}
            >
              <Text style={styles.badgeText}>Category: {filterCategory}</Text>
              <SVGIcon name="close-circle" size={12} color="#fff" />
            </TouchableOpacity>
          )}
          {isPreviousTerm && (
            <TouchableOpacity
              onPress={resetToCurrentTerm}
              style={styles.archiveBadge}
            >
              <SVGIcon name="refresh" size={12} color="#fff" />
              <Text style={styles.archiveText}>ARCHIVE - Return</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {isConfigMissing ? (
        <View style={styles.emptyContainer}>
          <SVGIcon name="settings-outline" size={80} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Configuration Required</Text>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: primaryBrand, width: 200, marginTop: 20 },
            ]}
            onPress={() => router.push("/academic-calendar")}
          >
            <Text style={styles.saveBtnText}>Go to Calendar</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === "summary" ? (
        <FlatList
          data={groupedSummary}
          keyExtractor={(item) => item.item}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchExpenditures(true)}
              colors={[primaryBrand]}
            />
          }
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SVGIcon name="receipt" size={80} color="#CBD5E1" />
              <Text style={styles.emptyText}>No expenses recorded.</Text>
            </View>
          }
          ListHeaderComponent={
            groupedSummary.length > 0 ? (
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryHeaderText}>
                  BULK EXPENDITURE SUMMARY
                </Text>
                <Text style={styles.summarySubHeader}>
                  Case-insensitive grouping • {groupedSummary.length} categories
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => {
                setFilterCategory(item.displayItem);
                setViewMode("detailed");
              }}
            >
              <ExpenditureSummaryCard
                item={item}
                index={index}
                summaryTotal={summaryTotal}
                primaryBrand={primaryBrand}
                secondaryBrand={secondaryBrand}
              />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={filteredExpenditures}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchExpenditures(true)}
              colors={[primaryBrand]}
            />
          }
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SVGIcon name="receipt" size={80} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {filterCategory
                  ? `No items found in category "${filterCategory}".`
                  : "No expenses recorded."}
              </Text>
            </View>
          }
          ListHeaderComponent={
            filterCategory ? (
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryHeaderText}>
                  ITEMS IN {filterCategory.toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={() => setFilterCategory(null)}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: primaryBrand, fontWeight: "700" }}>
                    Clear Filter
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ExpenditureItemCard
              item={item}
              canEdit={canEdit}
              deletingId={deletingId}
              onDelete={handleDeleteExpenditure}
            />
          )}
        />
      )}

      <ExpenditureModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={async (data) => {
            const success = await addExpenditure(data);
            if (success) setModalVisible(false);
            return success;
        }}
        saving={saving}
        primaryBrand={primaryBrand}
        secondaryBrand={secondaryBrand}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  backBtn: { padding: 5 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 12,
    borderRadius: 12,
  },
  summaryContent: { flex: 1 },
  summaryLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  viewToggleCompact: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 2,
  },
  toggleItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleItemActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  compactFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  archiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  archiveText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  smallActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: { padding: 16, paddingBottom: 100 },
  summaryHeader: {
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
  },
  summaryHeaderText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: 0.5,
  },
  summarySubHeader: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },
  saveBtn: {
    height: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 20,
  },
  errorSub: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 15,
    ...SHADOWS.medium,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
