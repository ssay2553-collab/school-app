import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, StatusBar, Alert, Platform, ActivityIndicator, ScrollView } from "react-native";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";
import { collection, query, where, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import moment from "moment";
import { useFinanceCleanup } from "../../hooks/admin-dashboard/useFinanceCleanup";
import { useAcademicCleanup } from "../../hooks/admin-dashboard/useAcademicCleanup";

export default function AdminSettingsScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

  const [isCleaning, setIsCleaning] = React.useState(false);
  const { cleaning: isFinanceCleaning, runCleanup: runFinanceCleanup, runMigration: runFinanceMigration, report: financeReport } = useFinanceCleanup(showToast);
  const { cleaning: isAcademicCleaning, runCleanup: runAcademicCleanup, report: academicReport } = useAcademicCleanup(showToast);

  const performLogout = async () => {
    try {
      await signOut(auth);
      // This is the key change: always go to the root on logout.
      router.replace("/");
    } catch (e) {
      console.error("Logout error", e);
      showToast({ message: "Failed to log out.", type: "error" });
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
      // Purge assignments older than 60 days
      const sixtyDaysAgo = moment().subtract(60, 'days').toDate();
      const q = query(collection(db, "assignments"), where("createdAt", "<", sixtyDaysAgo));
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast({ message: "No expired assignments found.", type: "info" });
        return;
      }

      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();

      showToast({ message: `Cleaned up ${snap.size} expired assignments.`, type: "success" });
    } catch (e) {
      console.error(e);
      showToast({ message: "Cleanup failed.", type: "error" });
    } finally {
      setIsCleaning(false);
    }
  };

  const settingsOptions = [
    {
      title: "Clean Expired Data",
      icon: "trash-outline",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Purge assignments older than 60 days?")) {
            runCleanup();
          }
        } else {
          Alert.alert("Confirm Cleanup", "Purge assignments older than 60 days?", [
            { text: "Cancel", style: "cancel" },
            { text: "Run Purge", style: "destructive", onPress: runCleanup }
          ]);
        }
      },
      color: "#F59E0B",
      loading: isCleaning,
    },
    {
      title: "Identity & Legacy Migration",
      icon: "people-circle",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Scan and resolve student identities? This links legacy records to newly registered Auth accounts.")) {
            runFinanceMigration();
          }
        } else {
          Alert.alert("Identity Migration", "Scan and resolve student identities? This links legacy records to newly registered Auth accounts.", [
            { text: "Cancel", style: "cancel" },
            { text: "Start Migration", style: "default", onPress: runFinanceMigration }
          ]);
        }
      },
      color: "#3B82F6",
      loading: isFinanceCleaning,
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
      title: "Academic Integrity Scan",
      icon: "school",
      action: () => {
        if (Platform.OS === "web") {
          if (window.confirm("Scan academic records (scores, reports) to migrate data from legacy IDs to new Auth UIDs?")) {
            runAcademicCleanup();
          }
        } else {
          Alert.alert("Academic Integrity Scan", "Scan academic records (scores, reports) to migrate data from legacy IDs to new Auth UIDs?", [
            { text: "Cancel", style: "cancel" },
            { text: "Start Scan", style: "default", onPress: runAcademicCleanup }
          ]);
        }
      },
      color: "#A55EEA",
      loading: isAcademicCleaning,
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
                <Text style={styles.reportLabel}>Orphaned Records</Text>
                <Text style={[styles.reportValue, { color: financeReport.orphanedRecords > 0 ? "#F59E0B" : "#10B981" }]}>{financeReport.orphanedRecords}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Records Fixed</Text>
                <Text style={[styles.reportValue, { color: "#10B981" }]}>{financeReport.fixedRecords}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Orphaned Payments</Text>
                <Text style={[styles.reportValue, { color: financeReport.orphanedPayments > 0 ? "#EF4444" : "#10B981" }]}>{financeReport.orphanedPayments}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Payments Purged</Text>
                <Text style={[styles.reportValue, { color: "#EF4444" }]}>{financeReport.deletedPayments}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Balances Reconciled</Text>
                <Text style={[styles.reportValue, { color: "#8B5CF6" }]}>{financeReport.reconciledBalances}</Text>
              </View>
            </View>
          </View>
        )}

        {academicReport && (
          <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 10 }]}>
            <Text style={[styles.reportTitle, { color: theme.text }]}>Last Academic Scan Result</Text>
            <View style={styles.reportGrid}>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Scores Migrated</Text>
                <Text style={[styles.reportValue, { color: "#10B981" }]}>{academicReport.scoresFixed}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Reports Migrated</Text>
                <Text style={[styles.reportValue, { color: "#10B981" }]}>{academicReport.reportsFixed}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Summaries Fixed</Text>
                <Text style={[styles.reportValue, { color: "#8B5CF6" }]}>{academicReport.summaryFixed}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Orphaned Scores</Text>
                <Text style={[styles.reportValue, { color: academicReport.orphanedScores > 0 ? "#EF4444" : "#10B981" }]}>{academicReport.orphanedScores}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.versionText, { color: theme.gray }]}>Version 2.1.0 • EduEaze Platform</Text>
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
