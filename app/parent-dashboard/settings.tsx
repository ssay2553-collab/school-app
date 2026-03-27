import { useRouter } from "expo-router";
import { deleteUser, signOut } from "firebase/auth";
import { arrayUnion, collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { auth, db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";

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
      const q = query(studentsRef, where("role", "==", "student"), where("parentLinkCode", "==", code));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert("Invalid Code", "No student found with this link code.");
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;

      if (appUser.childrenIds?.includes(studentId)) {
        Alert.alert("Already Linked", "You are already linked to this student.");
        return;
      }

      const currentParents = studentData.parentUids || [];
      if (currentParents.length >= 2) {
        Alert.alert("Limit Reached", "This student already has 2 parents linked.");
        return;
      }

      const batch = writeBatch(db);

      batch.update(doc(db, "users", appUser.uid), {
        childrenIds: arrayUnion(studentId),
        childrenClassIds: arrayUnion(studentData.classId)
      });

      batch.update(doc(db, "users", studentId), {
        parentUids: arrayUnion(appUser.uid)
      });

      await batch.commit();

      Alert.alert("Success", `Successfully linked to ${studentData.profile?.firstName || "student"}.`);
      setLinkCode("");
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              setLogoutLoading(true);
              await signOut(auth);
              router.replace("/(auth)/login/parent");
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setLogoutLoading(false);
            }
          },
        },
      ]
    );
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
                Alert.alert("Account Deleted", "Your account has been removed successfully.");
                router.replace("/");
              }
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={{ padding: 20, alignItems: "center" }} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInUp" duration={700} style={{ width: '100%', alignItems: 'center' }}>
          <Text style={[styles.header, { color: COLORS.primary }]}>Settings</Text>

          {/* Link Student Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Link New Student</Text>
            <Text style={styles.cardSubtitle}>Enter the link code from your child&apos;s dashboard</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit code"
                value={linkCode}
                onChangeText={setLinkCode}
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.linkBtn, linkLoading && { opacity: 0.7 }]}
                onPress={handleLinkStudent}
                disabled={linkLoading}
              >
                {linkLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Ionicons name="link" size={20} color={COLORS.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: COLORS.primary }]}
            onPress={handleLogout}
          >
            {logoutLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Logout</Text>
            )}
          </TouchableOpacity>

          {/* Delete account */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: COLORS.secondary }]}
            onPress={handleDeleteAccount}
          >
            {deleteLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Delete Account</Text>
            )}
          </TouchableOpacity>
        </Animatable.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: SIZES.extraLarge,
    fontWeight: "bold",
    marginVertical: 15,
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  linkBtn: {
    backgroundColor: COLORS.primary,
    marginLeft: 10,
    padding: 12,
    borderRadius: 10,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: "100%",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
    ...SHADOWS.medium,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: SIZES.medium,
    fontWeight: "bold",
  },
});
