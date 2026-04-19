import { useRouter } from "expo-router";
import { deleteUser, signOut } from "firebase/auth";
import {
    arrayUnion,
    collection,
    doc,
    getDocs,
    query,
    where,
    writeBatch,
} from "firebase/firestore";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";

import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { auth, db } from "../../firebaseConfig";

export default function ParentSettingsScreen() {
  const { theme } = useTheme();
  const { appUser } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const router = useRouter();

  const handleLinkStudent = async () => {
    if (!linkCode.trim()) {
      return Alert.alert("Required", "Please enter a student link code.");
    }

    if (!appUser) return;

    try {
      setLinkLoading(true);
      const code = linkCode.trim().toUpperCase();

      const studentsRef = collection(db, "users");
      const q = query(
        studentsRef,
        where("role", "==", "student"),
        where("parentLinkCode", "==", code),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert("Invalid Code", "No student found with this link code.");
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;

      if (appUser.childrenIds?.includes(studentId)) {
        Alert.alert(
          "Already Linked",
          "You are already linked to this student.",
        );
        return;
      }

      const currentParents = studentData.parentUids || [];
      if (currentParents.length >= 2) {
        Alert.alert(
          "Limit Reached",
          "This student already has 2 parents linked.",
        );
        return;
      }

      const batch = writeBatch(db);

      batch.update(doc(db, "users", appUser.uid), {
        childrenIds: arrayUnion(studentId),
        childrenClassIds: arrayUnion(studentData.classId),
      });

      batch.update(doc(db, "users", studentId), {
        parentUids: arrayUnion(appUser.uid),
      });

      await batch.commit();

      Alert.alert(
        "Success",
        `Successfully linked to ${studentData.profile?.firstName || "student"}.`,
      );
      setLinkCode("");
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setLogoutLoading(true);
            await signOut(auth);
            router.replace("/");
          } catch (error: any) {
            Alert.alert("Error", error.message);
          } finally {
            setLogoutLoading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action is irreversible and will remove your access to student records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleteLoading(true);
              const user = auth.currentUser;
              if (user) {
                await deleteUser(user);
                Alert.alert(
                  "Account Deleted",
                  "Your account has been removed successfully.",
                );
                router.replace("/");
              }
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ],
    );
  };

  const settingsOptions = [
    {
      title: "Profile Management",
      items: [
        {
          label: "Edit Personal Info",
          icon: "person",
          color: "#6366f1",
          onPress: () => router.push("/parent-dashboard/profile-edit"),
        },
      ],
    },
    {
      title: "Account Security",
      items: [
        {
          label: "Log Out of App",
          icon: "log-out",
          color: COLORS.primary,
          onPress: handleLogout,
          loading: logoutLoading,
        },
        {
          label: "Delete Parent Account",
          icon: "trash",
          color: "#ef4444",
          onPress: handleDeleteAccount,
          loading: deleteLoading,
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: "#F8FAFC" }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        <Text style={[styles.header, { color: COLORS.primary }]}>
          Parental Settings
        </Text>
        <Text style={styles.subHeader}>
          Manage your account and student connections
        </Text>
      </View>

      {/* Profile Summary Card */}
      {appUser && (
        <View style={styles.profileSummary}>
          <View style={styles.profileInfo}>
            <View style={styles.summaryAvatar}>
              {appUser.profile?.profileImage ? (
                <Image
                  source={{ uri: appUser.profile.profileImage }}
                  style={styles.sumImg}
                />
              ) : (
                <Text style={styles.sumText}>
                  {appUser.profile?.firstName?.[0] || "P"}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.sumName}>
                {appUser.profile?.firstName} {appUser.profile?.lastName}
              </Text>
              <Text style={styles.sumEmail}>
                {appUser.profile?.email || "No email"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Link Student Section */}
      <Animatable.View
        animation="fadeInUp"
        duration={600}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Student Connection</Text>
        <View style={styles.card}>
          <View style={{ padding: 16 }}>
            <Text style={styles.cardTitle}>Link New Student</Text>
            <Text style={styles.cardSubtitle}>
              Enter the unique 6-digit code from your child's dashboard
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="E.G. AB12CD"
                value={linkCode}
                onChangeText={setLinkCode}
                autoCapitalize="characters"
                maxLength={6}
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={[styles.linkBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleLinkStudent}
                disabled={linkLoading}
              >
                {linkLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <SVGIcon name="link" size={20} color={COLORS.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animatable.View>

      {/* Menu Options */}
      {settingsOptions.map((section, idx) => (
        <Animatable.View
          key={section.title}
          animation="fadeInUp"
          duration={600}
          delay={idx * 100}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item: any, i: number) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.itemRow,
                  i < section.items.length - 1 && styles.borderBottom,
                ]}
                onPress={item.onPress}
                disabled={!!item.loading}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: item.color + "15" },
                  ]}
                >
                  <SVGIcon name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.itemLabel}>{item.label}</Text>
                {item.loading ? (
                  <ActivityIndicator size="small" color={item.color} />
                ) : (
                  <SVGIcon name="chevron-forward" size={18} color="#CBD5E1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animatable.View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    padding: 20,
    marginTop: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: "900",
  },
  subHeader: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  profileSummary: {
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 24,
    marginBottom: 25,
    ...SHADOWS.medium,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  summaryAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: COLORS.primary + "10",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  sumImg: { width: "100%", height: "100%" },
  sumText: { fontSize: 24, fontWeight: "900", color: COLORS.primary },
  sumName: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  sumEmail: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
    marginLeft: 5,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    ...SHADOWS.medium,
    overflow: "hidden",
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    ...SHADOWS.medium,
    overflow: "hidden",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 15,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  linkBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.small,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
});
