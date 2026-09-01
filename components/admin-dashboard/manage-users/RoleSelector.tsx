import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { roles, UserRole } from "../../../hooks/admin-dashboard/manage-users-types";

interface RoleSelectorProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
  return (
    <View style={styles.container}>
      <View style={styles.roleHeader}>
        <Text style={styles.roleHeaderTitle}>User Directory</Text>
        <Text style={styles.roleHeaderSub}>
          School staff and community management
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.roleGrid}>
        {roles.map((r, idx) => (
          <Animatable.View
            key={r.role}
            animation="fadeInUp"
            delay={idx * 100}
          >
            <TouchableOpacity
              style={styles.roleCard}
              activeOpacity={0.7}
              onPress={() => onSelectRole(r.role)}
            >
              <View
                style={[
                  styles.roleIcon,
                  { backgroundColor: (COLORS.primary || "#2e86de") + "10" },
                ]}
              >
                <SVGIcon
                  name={r.icon}
                  color={COLORS.primary || "#2e86de"}
                  size={28}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleCardTitle}>{r.name}</Text>
                <Text style={styles.roleCardSub}>
                  Overview and security control
                </Text>
              </View>
              <SVGIcon
                name="chevron-forward"
                size={20}
                color={COLORS.gray || "#9ca3af"}
              />
            </TouchableOpacity>
          </Animatable.View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  roleHeader: { padding: 30, backgroundColor: "#fff" },
  roleHeaderTitle: { fontSize: 28, fontWeight: "800", color: "#1E293B" },
  roleHeaderSub: { fontSize: 15, color: "#64748B", marginTop: 4 },
  roleGrid: { padding: 20 },
  roleCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    ...SHADOWS.medium,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  roleIcon: {
    width: 55,
    height: 55,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  roleCardTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  roleCardSub: { fontSize: 13, color: "#94A3B8" },
});
