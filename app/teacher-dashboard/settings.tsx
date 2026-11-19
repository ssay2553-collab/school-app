import { useRouter } from "expo-router";
import { deleteUser, signOut } from "firebase/auth";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    BackHandler,
    TextInput,
} from "react-native";
import * as Animatable from "react-native-animatable";

import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { auth, db } from "../../firebaseConfig";
import { doc, updateDoc, deleteField, collection, query, where, getDocs, arrayUnion, writeBatch } from "firebase/firestore";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { useRef } from "react";

export default function SettingsScreen() {
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const router = useRouter();
  const { showToast } = useToast();
  const { appUser } = useAuth();
  const isNavigating = useRef(false);

  const handleBack = useCallback(() => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/teacher-dashboard");
    }
  }, [router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  const primary = SCHOOL_CONFIG.primaryColor;

  const handleLinkStudent = async () => {
    if (!linkCode.trim()) {
      return showToast({ message: "Please enter a student link code.", type: "error" });
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
        where("status", "in", ["active", "pending_activation"])
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showToast({ message: "No student found with this link code.", type: "error" });
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data() as any;
      const studentId = studentDoc.id;

      if (appUser.childrenIds?.includes(studentId)) {
        showToast({ message: "You are already linked to this student.", type: "info" });
        return;
      }

      const currentParents = studentData.parentUids || [];
      if (currentParents.length >= 2) {
        showToast({ message: "This student already has 2 parents linked.", type: "error" });
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

      showToast({
        message: `Successfully linked to ${studentData.profile?.firstName || "student"}.`,
        type: "success",
      });
      setLinkCode("");
    } catch (error: any) {
      console.error(error);
      showToast({ message: error.message, type: "error" });
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
            const user = auth.currentUser;
            
            if (user) {
              const userRef = doc(db, "users", user.uid);
              await updateDoc(userRef, {
                fcmToken: deleteField()
              }).catch(e => console.log("FCM cleanup skipped:", e.message));
            }

            await signOut(auth);
            router.replace("/");
          } catch (error: any) {
            showToast({ message: error.message, type: "error" });
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
      "Are you sure you want to delete your account? This action is irreversible.",
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
                showToast({ message: "Your account has been removed successfully.", type: "success" });
                router.replace("/");
              }
            } catch (error: any) {
              showToast({ message: error.message, type: "error" });
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
          label: "Edit Profile Info",
          icon: "person",
          color: "#6366f1",
          onPress: () => router.push("/teacher-dashboard/profile-edit"),
        },
        {
          label: "Classes & Subjects",
          icon: "book",
          color: "#F59E0B",
          onPress: () => router.push({ pathname: "/teacher-dashboard/profile-edit", params: { focus: "work" } }),
        },
      ],
    },
    {
      title: "Account Security",
      items: [
        {
          label: "Log Out of Portal",
          icon: "log-out",
          color: primary,
          onPress: handleLogout,
          loading: logoutLoading,
        },
        {
          label: "Delete Teacher Account",
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
        <Text style={[styles.header, { color: primary }]}>
          Instructor Settings
        </Text>
        <Text style={styles.subHeader}>
          Manage your profile and account preferences
        </Text>
      </View>

      {/* Link Student Section */}
      <Animatable.View
        animation="fadeInUp"
        duration={600}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Student Connection (Parent)</Text>
        <View style={styles.card}>
          <View style={{ padding: 16 }}>
            <Text style={styles.cardTitle}>Link Your Child</Text>
            <Text style={styles.cardSubtitle}>
              Enter the unique 6-digit code from your child's student dashboard to enable parent access
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
                style={[styles.linkBtn, { backgroundColor: primary }]}
                onPress={handleLinkStudent}
                disabled={linkLoading}
              >
                {linkLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <SVGIcon name="link" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animatable.View>

      {settingsOptions.map((section, idx) => (
        <Animatable.View
          key={section.title}
          animation="fadeInUp"
          duration={600}
          delay={(idx + 1) * 100}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
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
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
    color: "#1E293B",
    fontWeight: "700",
  },
  linkBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
