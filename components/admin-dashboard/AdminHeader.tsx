import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import SVGIcon from "../SVGIcon";
import { SHADOWS } from "../../constants/theme";

interface AdminHeaderProps {
  brandPrimary: string;
  brandSecondary: string;
  appUser: any;
  isSmallScreen: boolean;
  onProfilePress: () => void;
  onSettingsPress: () => void;
  onTeacherDashboardPress: () => void;
  showTeacherButton: boolean;
  children?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  brandPrimary,
  brandSecondary,
  appUser,
  isSmallScreen,
  onProfilePress,
  onSettingsPress,
  onTeacherDashboardPress,
  showTeacherButton,
  children,
}) => {
  return (
    <LinearGradient
      colors={[brandPrimary, brandSecondary]}
      style={styles.header}
    >
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.headerRow}>
          <View style={styles.adminInfo}>
            <TouchableOpacity
              onPress={onProfilePress}
              activeOpacity={0.7}
              style={[
                styles.profileBtn,
                {
                  width: isSmallScreen ? 60 : 80,
                  height: isSmallScreen ? 60 : 80,
                  borderRadius: isSmallScreen ? 30 : 40,
                },
              ]}
            >
              {appUser?.profile?.profileImage ? (
                <Image
                  source={{ uri: appUser.profile.profileImage }}
                  style={styles.profileImg}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text
                    style={[
                      styles.profilePlaceholderText,
                      { fontSize: isSmallScreen ? 24 : 32 },
                    ]}
                  >
                    {appUser?.profile?.firstName?.[0] || "A"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ marginLeft: isSmallScreen ? 10 : 15, flex: 1 }}>
              <Text style={styles.welcomeText}>WELCOME BACK, CHIEF! 🛡️</Text>
              <Text
                style={[
                  styles.adminName,
                  { fontSize: isSmallScreen ? 24 : 32 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {appUser?.profile?.firstName || "Admin"}
              </Text>

              <View style={styles.roleBadge}>
                <SVGIcon name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.roleBadgeText}>
                  {appUser?.adminRole || "Super Admin"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            {showTeacherButton && (
              <TouchableOpacity
                onPress={onTeacherDashboardPress}
                activeOpacity={0.7}
                style={[
                  styles.actionBtn,
                  {
                    width: "auto",
                    paddingHorizontal: 10,
                    flexDirection: "row",
                    gap: 6,
                  },
                ]}
              >
                <SVGIcon name="school" size={20} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: "900",
                  }}
                >
                  TEACHER
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onSettingsPress} style={styles.actionBtn} activeOpacity={0.7}>
              <SVGIcon name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {children}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    ...SHADOWS.medium,
  },
  blob1: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  blob2: {
    position: "absolute",
    bottom: -40,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 20 : 0,
  },
  adminInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  welcomeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    letterSpacing: 1,
  },
  adminName: { fontSize: 32, fontWeight: "900", color: "#fff", marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
  },
  roleBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  profileBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.5)",
    ...SHADOWS.medium,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  profileImg: { width: "100%", height: "100%" },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  profilePlaceholderText: { color: "#4338ca", fontWeight: "900", fontSize: 32 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  actionBtn: {
    height: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
});
