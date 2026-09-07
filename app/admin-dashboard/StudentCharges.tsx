import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef } from "react";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { VIBE } from "../../constants/admin-dashboard/ManageFeesStyles";

export default function StudentCharges() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNavigating = useRef(false);
  const primaryBrand = SCHOOL_CONFIG.primaryColor || COLORS.primary || VIBE.primary;
  const secondaryBrand = SCHOOL_CONFIG.secondaryColor || primaryBrand;

  const charges = [
    {
      title: "Admission Fees",
      subtitle: "New admissions billing",
      icon: "person-add",
      route: "/admin-dashboard/AdmissionCharges",
      color: "#6366F1",
    },
    {
      title: "PTA Dues",
      subtitle: "Bulk billing for PTA",
      icon: "people",
      route: "/admin-dashboard/PTACharges",
      color: "#F59E0B",
    },
    {
      title: "Uniforms",
      subtitle: "Main, Lacoste, PE Kit etc",
      icon: "shirt",
      route: "/admin-dashboard/UniformCharges",
      color: "#10B981",
    },
    {
      title: "Maintenance Fee",
      subtitle: "Per class billing",
      icon: "construct",
      route: "/admin-dashboard/MaintenanceCharges",
      color: "#EF4444",
    },
    {
      title: "Books Fee",
      subtitle: "Textbooks and workbooks",
      icon: "book",
      route: "/admin-dashboard/BooksCharges",
      color: "#3B82F6",
    },
    {
      title: "Other Fees",
      subtitle: "Graduation and more",
      icon: "ellipsis-horizontal",
      route: "/admin-dashboard/OtherCharges",
      color: "#8B5CF6",
    },
  ];

  const numColumns = width > 600 ? 3 : 2;
  const cardWidth = (width - 60) / numColumns;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <LinearGradient
          colors={[primaryBrand, secondaryBrand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerTop}
        >
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => {
                if (isNavigating.current) return;
                isNavigating.current = true;
                router.replace("/admin-dashboard/");
                setTimeout(() => { isNavigating.current = false; }, 500);
              }}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={styles.headerTitle}>Student Charges</Text>
              <Text style={styles.headerSub}>BILLING HUB</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {charges.map((item, index) => (
            <Animatable.View
              key={item.title}
              animation="zoomIn"
              delay={index * 100}
              useNativeDriver={false}
              style={[styles.cardWrapper, { width: cardWidth }]}
            >
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => {
                  if (isNavigating.current) return;
                  isNavigating.current = true;
                  router.push(item.route as any);
                  setTimeout(() => { isNavigating.current = false; }, 800);
                }}
              >
                <View
                  style={[styles.iconBox, { backgroundColor: item.color + "15" }]}
                >
                  <SVGIcon name={item.icon} size={30} color={item.color} />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            </Animatable.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VIBE.bg },
  header: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTop: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  titleCenter: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSub: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 2,
  },
  scrollContent: { padding: 20 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 15,
  },
  cardWrapper: { marginBottom: 5 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: VIBE.border,
    minHeight: 160,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: VIBE.text,
    textAlign: "center",
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: VIBE.muted,
    textAlign: "center",
  },
});
