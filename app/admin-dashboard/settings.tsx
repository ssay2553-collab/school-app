import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, StatusBar, Alert, Platform, ActivityIndicator, ScrollView } from "react-native";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { signOut } from "firebase/auth";
import { auth, db, functions } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";
import { collection, query, where, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import moment from "moment";
import { useFinanceCleanup } from "../../hooks/admin-dashboard/useFinanceCleanup";
import { repairMissingSignupCodes } from "../../scratch/repair_signup_codes";
import { broadcastFeeReminders } from "../../src/services/feeReminderService";
import { useRef, useEffect } from "react";

export default function AdminSettingsScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

  const [isCleaning, setIsCleaning] = React.useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [unifyLoading, setUnifyLoading] = useState(false);
  const [cfLoading, setCfLoading] = useState<Record<string, boolean>>({});
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const { cleaning: isFinanceCleaning, runCleanup: runFinanceCleanup, report: financeReport } = useFinanceCleanup(showToast);

  const handleRepairSignupCodes = async () => {
    setRepairLoading(true);
    try {
      const count = await repairMissingSignupCodes();
      if (isMounted.current) {
        showToast({ message: `Successfully repaired ${count} signup/parent link codes.`, type: "success" });
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error(err);
        showToast({ message: "Repair failed. Check console.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setRepairLoading(false);
      }
    }
  };

  const handleUnifySiblingLinkCodes = async () => {
    setUnifyLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "student"));
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast({ message: "No student accounts found.", type: "info" });
        return;
      }

      const familyMap = new Map<string, Array<{ id: string; code: string }>>();

      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const profile = data.profile || {};
        const parentPhone = (profile.parentPhone || "").trim();
        const parentName = (profile.parentName || "").trim().toLowerCase();
        const lastName = (profile.lastName || "").trim().toLowerCase();

        let familyKey = "";
        if (parentPhone.length >= 7) {
          familyKey = `phone_${parentPhone}`;
        } else if (parentName) {
          familyKey = `name_${parentName}_${lastName}`;
        }

        if (familyKey) {
          const current = familyMap.get(familyKey) || [];
          current.push({
            id: docSnap.id,
            code: data.parentLinkCode || "",
          });
          familyMap.set(familyKey, current);
        }
      });

      let updatedStudentsCount = 0;
      let unifiedFamiliesCount = 0;
      const batch = writeBatch(db);

      familyMap.forEach((students) => {
        if (students.length >= 2) {
          let masterCode = students.find((s) => s.code)?.code;
          if (!masterCode) {
            masterCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          }

          let familyHasUpdates = false;
          students.forEach((student) => {
            if (student.code !== masterCode) {
              batch.update(doc(db, "users", student.id), {
                parentLinkCode: masterCode,
              });
              updatedStudentsCount++;
              familyHasUpdates = true;
            }
          });

          if (familyHasUpdates) {
            unifiedFamiliesCount++;
          }
        }
      });

      if (updatedStudentsCount > 0) {
        await batch.commit();
        if (isMounted.current) {
          showToast({
            message: `Unified link codes for ${updatedStudentsCount} students across ${unifiedFamiliesCount} families!`,
            type: "success",
          });
        }
      } else {
        if (isMounted.current) {
          showToast({
            message: "All sibling link codes are already synchronized!",
            type: "info",
          });
        }
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error("Error unifying sibling link codes:", err);
        showToast({
          message: err.message || "Failed to unify sibling link codes.",
          type: "error",
        });
      }
    } finally {
      if (isMounted.current) {
        setUnifyLoading(false);
      }
    }
  };

  const handleFeeRemindersBroadcast = async () => {
    const run = async () => {
      setCfLoading(prev => ({ ...prev, triggerFeeReminders: true }));
      try {
        const result = await broadcastFeeReminders(auth.currentUser?.uid, "School Financial Office");
        if (isMounted.current) {
          showToast({
            message: result.message,
            type: "success"
          });
        }
      } catch (err: any) {
        if (isMounted.current) {
          showToast({ message: err.message || "Failed to broadcast fee reminders.", type: "error" });
        }
      } finally {
        if (isMounted.current) {
          setCfLoading(prev => ({ ...prev, triggerFeeReminders: false }));
        }
      }
    };

    const confirmMessage = "Send push notification fee reminders to ALL parents with outstanding balances?";
    if (Platform.OS === "web") {
      if (window.confirm(confirmMessage)) run();
    } else {
      Alert.alert("Broadcast Fee Reminders", confirmMessage, [
        { text: "Cancel", style: "cancel" },
        { text: "Send Reminders", style: "default", onPress: run }
      ]);
    }
  };

  const handleCloudFunctionTrigger = async (fnName: string, confirmMessage: string) => {
    const run = async () => {
      setCfLoading(prev => ({ ...prev, [fnName]: true }));
      try {
        const callable = httpsCallable(functions, fnName);
        const result: any = await callable();
        if (isMounted.current) {
          showToast({
            message: `Success: ${result.data.deletedMessages || result.data.count || result.data.deleted || result.data.notificationCount || 0} items processed.`,
            type: "success"
          });
        }
      } catch (err: any) {
        if (isMounted.current) {
          showToast({ message: err.message || "Execution failed", type: "error" });
        }
      } finally {
        if (isMounted.current) {
          setCfLoading(prev => ({ ...prev, [fnName]: false }));
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(confirmMessage)) run();
    } else {
      Alert.alert("System Task", confirmMessage, [
        { text: "Cancel", style: "cancel" },
        { text: "Execute", style: "destructive", onPress: run }
      ]);
    }
  };

  const performLogout = async () => {
    try {
      await signOut(auth);
      // This is the key change: always go to the root on logout.
      if (!isNavigating.current) {
        isNavigating.current = true;
        router.replace("/");
      }
    } catch (e) {
      if (isMounted.current) {
        console.error("Logout error", e);
        showToast({ message: "Failed to log out.", type: "error" });
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) {
        performLogout();
      }
    } else {
      Alert.alert(
        "Confirm Logout",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", style: "destructive", onPress: performLogout },
        ]
      );
    }
  };

  const runCleanup = async () => {
    setIsCleaning(true);
    try {
      const now = new Date();
      const snap = await getDocs(collection(db, "assignments"));

      const expiredDocs = snap.docs.filter((d) => {
        const data = d.data();
        if (!data.dueDate) return false;
        const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
        return due.getTime() < now.getTime();
      });

      if (expiredDocs.length === 0) {
        showToast({ message: "No expired assignments found.", type: "info" });
        return;
      }

      const batch = writeBatch(db);
      expiredDocs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();

      if (isMounted.current) {
        showToast({ message: `Cleaned up ${expiredDocs.length} expired assignments.`, type: "success" });
      }
    } catch (e) {
      if (isMounted.current) {
        console.error(e);
        showToast({ message: "Cleanup failed.", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setIsCleaning(false);
      }
    }
  };

  const settingsOptions = [
    {
      title: "Clear Expired Assignments",
      icon: "trash-outline",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Purge all assignments with expired due dates from the system?")) {
            runCleanup();
          }
        } else {
          Alert.alert("Confirm Cleanup", "Purge all assignments with expired due dates from the system?", [
            { text: "Cancel", style: "cancel" },
            { text: "Run Purge", style: "destructive", onPress: runCleanup }
          ]);
        }
      },
      color: "#F59E0B",
      loading: isCleaning,
    },
    {
      title: "Financial Balance Reconcile",
      icon: "calculator",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Re-calculate all student balances from scratch? This fixes discrepancies between billed vs paid amounts.")) {
            runFinanceCleanup();
          }
        } else {
          Alert.alert("Financial Reconciliation", "Re-calculate all student balances from scratch? This fixes discrepancies between billed vs paid amounts.", [
            { text: "Cancel", style: "cancel" },
            { text: "Reconcile All", style: "default", onPress: runFinanceCleanup }
          ]);
        }
      },
      color: "#8B5CF6",
      loading: isFinanceCleaning,
    },
    {
        title: "Chat & Token Maintenance",
        icon: "chatbubble-ellipses-outline",
        action: () => handleCloudFunctionTrigger("runChatMaintenance", "Clear old messages and inactive tokens to optimize Firestore performance?"),
        color: "#10B981",
        loading: cfLoading["runChatMaintenance"],
    },
    {
        title: "News Expiry Cleanup",
        icon: "megaphone-outline",
        action: () => handleCloudFunctionTrigger("runNewsMaintenance", "Permanently delete announcements that expired over 7 days ago?"),
        color: "#EC4899",
        loading: cfLoading["runNewsMaintenance"],
    },
    {
        title: "Archive Purge (3+ Years)",
        icon: "shield-checkmark-outline",
        action: () => handleCloudFunctionTrigger("purgeOldArchivedUsers", "Hard-delete users who have been archived for more than 3 years? This action is irreversible."),
        color: "#6366F1",
        loading: cfLoading["purgeOldArchivedUsers"],
    },
    {
        title: "Broadcast Fee Reminders",
        icon: "notifications-outline",
        action: handleFeeRemindersBroadcast,
        color: "#F59E0B",
        loading: cfLoading["triggerFeeReminders"],
    },
    {
      title: "Repair Missing Codes (Signup & Parent)",
      icon: "key",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Scan for missing signup codes and student parent link codes in the database and generate/fix them?")) {
            handleRepairSignupCodes();
          }
        } else {
          Alert.alert("Repair Codes", "Scan for missing signup codes and student parent link codes in the database and generate/fix them?", [
            { text: "Cancel", style: "cancel" },
            { text: "Repair Now", style: "default", onPress: handleRepairSignupCodes }
          ]);
        }
      },
      color: "#6366F1",
      loading: repairLoading,
    },
    {
      title: "Unify Sibling Parent Link Codes",
      icon: "people-circle-outline",
      action: () => {
        const confirmMsg = "Scan all students and assign siblings (sharing parent phone/name) the exact same Parent Link Code?";
        if (Platform.OS === "web") {
          if (window.confirm(confirmMsg)) {
            handleUnifySiblingLinkCodes();
          }
        } else {
          Alert.alert("Unify Sibling Codes", confirmMsg, [
            { text: "Cancel", style: "cancel" },
            { text: "Unify Now", style: "default", onPress: handleUnifySiblingLinkCodes }
          ]);
        }
      },
      color: "#10B981",
      loading: unifyLoading,
    },
    {
      title: "Logout",
      icon: "log-out-outline",
      action: handleLogout,
      color: "#EF4444",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            if (isNavigating.current) return;
            isNavigating.current = true;
            router.back();
          }}
          style={styles.backBtn}
        >
           <SVGIcon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.header, { color: theme.text }]}>Settings</Text>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.list}>
          {settingsOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.item, { backgroundColor: theme.card, borderBottomWidth: index === settingsOptions.length - 1 ? 0 : 1, borderBottomColor: theme.border }]}
              onPress={option.action}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: option.color + "15" }]}>
                {option.loading ? <ActivityIndicator size="small" color={option.color} /> : <SVGIcon name={option.icon} size={22} color={option.color} />}
              </View>
              <Text style={[styles.itemText, { color: theme.text }]}>{option.title}</Text>
              <SVGIcon name="chevron-forward" size={20} color={theme.gray} />
            </TouchableOpacity>
          ))}
        </View>

        {financeReport && (
          <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.reportTitle, { color: theme.text }]}>Last Integrity Scan Result</Text>
            <View style={styles.reportGrid}>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Records Reconciled</Text>
                <Text style={[styles.reportValue, { color: "#10B981" }]}>{financeReport.fixedRecords}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Balances Reconciled</Text>
                <Text style={[styles.reportValue, { color: "#8B5CF6" }]}>{financeReport.reconciledBalances}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.versionText, { color: theme.gray }]}>Version 2.2.0 • EduEaze Platform</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SIZES.medium,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backBtn: {
    marginRight: 15,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
  },
  list: {
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  item: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  versionText: {
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
    fontSize: 12,
    fontWeight: '500',
  },
  reportCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 15,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  reportItem: {
    width: '45%',
  },
  reportLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  reportValue: {
    fontSize: 18,
    fontWeight: '700',
  }
});
