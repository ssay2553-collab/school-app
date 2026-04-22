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
} from "react-native";
import * as Animatable from "react-native-animatable";

import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { auth, db } from "../../firebaseConfig";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { useToast } from "../../contexts/ToastContext";

export default function SettingsScreen() {
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleBack = useCallback(() => {
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
            // Redirect to root hub instead of /login
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

      {settingsOptions.map((section, idx) => (
        <Animatable.View
          key={section.title}
          animation="fadeInUp"
          duration={600}
          delay={idx * 100}
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
