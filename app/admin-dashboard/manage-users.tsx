import { useIsFocused } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AssignmentModal } from "../../components/admin-dashboard/manage-users/AssignmentModal";
import { BulkActionBar } from "../../components/admin-dashboard/manage-users/BulkActionBar";
import { RoleSelector } from "../../components/admin-dashboard/manage-users/RoleSelector";
import { UserCard } from "../../components/admin-dashboard/manage-users/UserCard";
import { UserDetailModal } from "../../components/admin-dashboard/manage-users/UserDetailModal";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useManageUsers } from "../../hooks/admin-dashboard/useManageUsers";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useEffect, useRef } from "react";

export default function ManageUsers() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();
  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const {
    selectedRole,
    setSelectedRole,
    selectedClassId,
    setSelectedClassId,
    searchQuery,
    setSearchQuery,
    showArchived,
    setShowArchived,
    selectedUserUids,
    setSelectedUserUids,
    users,
    loading,
    refreshing,
    allClasses,
    viewingUser,
    setViewingUser,
    linkedUsers,
    loadingLinks,
    assignmentModal,
    setAssignmentModal,
    updating,
    deletingUid,
    uploadingImage,
    editForm,
    setEditForm,
    upgradeForm,
    setUpgradeForm,
    customRoleText,
    setCustomRoleText,
    deptText,
    setDeptText,
    newsPermission,
    setNewsPermission,
    selectedSubjects,
    setSelectedSubjects,
    selectedClasses,
    setSelectedClasses,
    busLocations,
    isAddingNewBusLoc,
    setIsAddingNewBusLoc,
    newBusLocInput,
    setNewBusLocInput,
    tempPermissions,
    setTempPermissions,
    targetClassId,
    setTargetClassId,
    filteredUsers,
    isHighestClassView,
    toggleUserSelection,
    handleSelectAll,
    handleBulkImport,
    handleBulkUpdate,
    fetchLinkedUsers,
    handleUnlinkParent,
    handleUpdatePermissions,
    handleAssignRole,
    handleUpdateClasses,
    handleUpdateSubjects,
    handleAssignDeptHead,
    handleRemoveAssignedRole,
    handleAssignClassTeacher,
    handleToggleArchiveStatus,
    handleGraduateClass,
    handleDeleteUser,
    handleUpdateProfile,
    handleUpgradeStaff,
    handleRegenerateSignupCode,
    handleShareCode,
    handleUpdateEmail,
    handleSaveNewBusLocation,
    openPermissionModal,
    openEditProfile,
    handleUploadProfileImage,
    handleCopyAllCodes,
    clearServiceArrears,
    clearTermArrears,
    isSuperAdmin,
    hasManageUsersAccess,
    handlePromoteRepeat,
    openPromoteRepeat,
    runFinanceCleanup,
    runFinanceMigration,
    runAcademicCleanup,
    isFinanceCleaning,
    isAcademicCleaning,
  } = useManageUsers({ appUser, acadConfig, showToast, router });

  if (!hasManageUsersAccess && appUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <SVGIcon name="lock-closed" size={80} color={COLORS.secondary} />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorSub}>
            You do not have the required permissions to access the User
            Management module.
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

  if (!selectedRole) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <SVGIcon name="chevron-back" size={24} color="#1E293B" />
          </TouchableOpacity>
        </View>
        <RoleSelector onSelectRole={setSelectedRole} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={loading ? [] : filteredUsers}
          keyExtractor={(item) => item.uid}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => setSelectedRole(null)}
                    style={styles.backButton}
                  >
                    <SVGIcon name="chevron-back" size={24} color="#1E293B" />
                  </TouchableOpacity>
                  <View>
                    <Text style={styles.headerTitle}>
                      {selectedRole.charAt(0).toUpperCase() +
                        selectedRole.slice(1)}s
                    </Text>
                    <Text style={styles.headerSub}>
                      {showArchived ? "Archived Records" : "Active Directory"}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.iconBtn,
                      {
                        width: "auto",
                        paddingHorizontal: 12,
                        flexDirection: "row",
                        gap: 8,
                      },
                    ]}
                    onPress={() => setShowArchived(!showArchived)}
                  >
                    <SVGIcon
                      name={showArchived ? "people" : "archive"}
                      size={20}
                      color={COLORS.primary}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: COLORS.primary,
                      }}
                    >
                      {showArchived ? "Active" : "Archive"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                  <SVGIcon name="search" size={20} color="#94A3B8" />
                  <TextInput
                    placeholder={`Search ${selectedRole}s...`}
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
              </View>

              {selectedRole === "student" && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                  style={{ backgroundColor: "#fff" }}
                >
                  <TouchableOpacity
                    style={[
                      styles.graduateBtn,
                      {
                        backgroundColor: COLORS.primary,
                        flexDirection: "row",
                        gap: 8,
                        paddingHorizontal: 15,
                      },
                    ]}
                    onPress={handleBulkImport}
                  >
                    <SVGIcon name="cloud-upload" size={18} color="#fff" />
                    <Text style={styles.graduateBtnText}>Bulk CSV</Text>
                  </TouchableOpacity>

                  <View style={[styles.pickerContainer, { width: 160 }]}>
                    <Text style={styles.miniLabel}>FILTER BY CLASS</Text>
                    <Picker
                      selectedValue={selectedClassId}
                      onValueChange={setSelectedClassId}
                      style={styles.picker}
                    >
                      <Picker.Item label="All Classes" value="all" />
                      {allClasses.map((c) => (
                        <Picker.Item key={c.id} label={c.name} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                  {isHighestClassView && !showArchived && (
                    <TouchableOpacity
                      style={[
                        styles.graduateBtn,
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingHorizontal: 15,
                        },
                      ]}
                      onPress={handleGraduateClass}
                    >
                      <SVGIcon name="school" size={18} color="#fff" />
                      <Text style={styles.graduateBtnText}>Graduate Class</Text>
                    </TouchableOpacity>
                  )}
                  {!isHighestClassView &&
                    selectedClassId !== "all" &&
                    !showArchived && (
                      <TouchableOpacity
                        style={[
                          styles.graduateBtn,
                          {
                            backgroundColor: COLORS.secondary || "#c53b59",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            paddingHorizontal: 15,
                          },
                        ]}
                        onPress={() =>
                          setAssignmentModal({
                            type: "promote_repeat",
                            target: null,
                          })
                        }
                      >
                        <SVGIcon name="trending-up" size={18} color="#fff" />
                        <Text style={styles.graduateBtnText}>
                          Promote/Repeat Class
                        </Text>
                      </TouchableOpacity>
                    )}
                </ScrollView>
              )}

              {selectedRole === "student" && !showArchived && (
                <View style={styles.selectAllRow}>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                    onPress={handleSelectAll}
                  >
                    <SVGIcon
                      name={
                        filteredUsers.length > 0 &&
                        filteredUsers.every((u) => selectedUserUids.includes(u.uid))
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={24}
                      color={COLORS.primary}
                    />
                    <Text style={styles.selectAllText}>Select All Visible</Text>
                  </TouchableOpacity>
                  {selectedUserUids.length > 0 && (
                    <TouchableOpacity onPress={handleCopyAllCodes}>
                      <Text
                        style={[styles.selectAllText, { color: COLORS.secondary }]}
                      >
                        Copy Codes
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={{ height: 10 }} />
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              <UserCard
                user={item}
                isSelected={selectedUserUids.includes(item.uid)}
                isSelectionActive={selectedUserUids.length > 0}
                allClasses={allClasses}
                onToggleSelection={toggleUserSelection}
                onPress={(u) => {
                  if (selectedUserUids.length > 0 && u.role === "student") {
                    toggleUserSelection(u.uid);
                  } else {
                    setViewingUser(u);
                    fetchLinkedUsers(u);
                  }
                }}
                onLongPress={(u) => {
                  if (u.role === "student" && !showArchived) {
                    toggleUserSelection(u.uid);
                  }
                }}
              />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {}} />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Fetching directory...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <SVGIcon name="people-outline" size={60} color="#E2E8F0" />
                <Text style={styles.emptyTitle}>No {selectedRole}s Found</Text>
                <Text style={styles.emptySub}>
                  Try adjusting your search or filters
                </Text>
              </View>
            )
          }
        />

        <BulkActionBar
          selectedCount={selectedUserUids.length}
          onCancel={() => setSelectedUserUids([])}
          onBulkUpdate={handleBulkUpdate}
          onClearArrears={() => {
            handleBulkUpdate("dailyArrears", 0);
          }}
          onPromoteRepeat={() => openPromoteRepeat(null)}
        />

        <UserDetailModal
          user={viewingUser}
          isVisible={isFocused && !!viewingUser}
          onClose={() => setViewingUser(null)}
          linkedUsers={linkedUsers}
          isSuperAdmin={isSuperAdmin}
          hasManageUsersAccess={hasManageUsersAccess}
          allClasses={allClasses}
          updating={updating}
          deletingUid={deletingUid}
          onEditProfile={openEditProfile}
          onOpenPermissions={openPermissionModal}
          onUpgradeStaff={(u) =>
            setAssignmentModal({ type: "upgrade_staff", target: u })
          }
          onModifyAuthority={(u) =>
            setAssignmentModal({ type: "assign_as", target: u })
          }
          onDeleteUser={handleDeleteUser}
          onUnlinkParent={handleUnlinkParent}
          onShareCode={handleShareCode}
          onRegenerateCode={handleRegenerateSignupCode}
          onClearArrears={clearServiceArrears}
          onClearTermArrears={clearTermArrears}
          onRemoveAssignedRole={handleRemoveAssignedRole}
          onPromoteRepeat={openPromoteRepeat}
          onToggleArchive={handleToggleArchiveStatus}
          onRunFinanceCleanup={(u) => runFinanceCleanup(u.uid)}
          onRunFinanceMigration={(u) => runFinanceMigration(u.uid)}
          onRunAcademicCleanup={(u) => runAcademicCleanup(u.uid)}
          isFinanceCleaning={isFinanceCleaning}
          isAcademicCleaning={isAcademicCleaning}
          onViewAttendance={(u) => {
            if (isNavigating.current) return;
            isNavigating.current = true;
            router.push({
              pathname: "/admin-dashboard/student-attendance-details",
              params: {
                studentId: u.uid,
                studentName: `${u.profile?.firstName} ${u.profile?.lastName}`,
                classId: u.classId,
              },
            });
            setTimeout(() => { isNavigating.current = false; }, 500);
          }}
        />

        <AssignmentModal
          state={assignmentModal}
          onClose={() => setAssignmentModal({ type: "none", target: null })}
          onSetType={setAssignmentModal}
          allClasses={allClasses}
          updating={updating}
          uploadingImage={uploadingImage}
          handleUploadProfileImage={handleUploadProfileImage}
          newsPermission={newsPermission}
          setNewsPermission={setNewsPermission}
          handleAssignRole={handleAssignRole}
          tempPermissions={tempPermissions}
          setTempPermissions={setTempPermissions}
          handleUpdatePermissions={handleUpdatePermissions}
          selectedClasses={selectedClasses}
          setSelectedClasses={setSelectedClasses}
          handleUpdateClasses={handleUpdateClasses}
          selectedSubjects={selectedSubjects}
          setSelectedSubjects={setSelectedSubjects}
          handleUpdateSubjects={handleUpdateSubjects}
          handleAssignClassTeacher={handleAssignClassTeacher}
          deptText={deptText}
          setDeptText={setDeptText}
          handleAssignDeptHead={handleAssignDeptHead}
          customRoleText={customRoleText}
          setCustomRoleText={setCustomRoleText}
          editForm={editForm}
          setEditForm={setEditForm}
          handleUpdateProfile={handleUpdateProfile}
          handleUpdateEmail={handleUpdateEmail}
          upgradeForm={upgradeForm}
          setUpgradeForm={setUpgradeForm}
          handleUpgradeStaff={handleUpgradeStaff}
          busLocations={busLocations}
          isAddingNewBusLoc={isAddingNewBusLoc}
          setIsAddingNewBusLoc={setIsAddingNewBusLoc}
          newBusLocInput={newBusLocInput}
          setNewBusLocInput={setNewBusLocInput}
          handleSaveNewBusLocation={handleSaveNewBusLocation}
          targetClassId={targetClassId}
          setTargetClassId={setTargetClassId}
          handlePromoteRepeat={handlePromoteRepeat}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  headerSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#fff",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
  },
  bulkImportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...SHADOWS.small,
  },
  bulkImportButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#fff",
    gap: 12,
  },
  pickerContainer: {
    flex: 1,
    minHeight: 65,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    justifyContent: "center",
    paddingTop: 12,
  },
  miniLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94A3B8",
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 1,
    letterSpacing: 0.5
  },
  picker: { height: 45, marginLeft: -10 },
  graduateBtn: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 15,
    borderRadius: 12,
    justifyContent: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  graduateBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  listContent: { flexGrow: 1, paddingBottom: 100 },
  loadingState: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748B", fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 15,
  },
  emptySub: { fontSize: 14, color: "#64748B", marginTop: 5 },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
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
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
