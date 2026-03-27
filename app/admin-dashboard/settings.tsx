import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, StatusBar, Alert, Platform } from "react-native";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import SVGIcon from "../../components/SVGIcon";

export default function AdminSettingsScreen() {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();

  const performLogout = async () => {
    try {
      await signOut(auth);
      // This is the key change: always go to the root on logout.
      router.replace("/");
    } catch (e) {
      console.error("Logout error", e);
      if (Platform.OS !== 'web') Alert.alert("Error", "Failed to log out.");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout", 
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: performLogout },
      ]
    )
  }

  const settingsOptions = [
    {
      title: `${isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}`,
      icon: isDarkMode ? "flash" : "time", 
      action: toggleTheme,
      color: isDarkMode ? "#F1C40F" : COLORS.primary,
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
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
           <SVGIcon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.header, { color: theme.text }]}>Settings</Text>
      </View>
      
      <View style={styles.list}>
        {settingsOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.item, { backgroundColor: theme.card, borderBottomWidth: index === settingsOptions.length - 1 ? 0 : 1, borderBottomColor: theme.border }]}
            onPress={option.action}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: option.color + "15" }]}>
              <SVGIcon name={option.icon} size={22} color={option.color} />
            </View>
            <Text style={[styles.itemText, { color: theme.text }]}>{option.title}</Text>
            <SVGIcon name="chevron-forward" size={20} color={theme.gray} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.versionText, { color: theme.gray }]}>Version 2.1.0 • EduEaze Platform</Text>
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
    fontSize: 12,
    fontWeight: '500',
  }
});
