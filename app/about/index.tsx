import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";

export default function AboutAppScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const sections = [
    {
      title: "Legal Agreement",
      subtitle: "Terms of Service & Privacy Policy",
      icon: "document-text",
      color: "#3b82f6",
      action: () => router.push("/about/legal"),
    },
    {
      title: "FAQ",
      subtitle: "Frequently Asked Questions",
      icon: "help-circle",
      color: "#8b5cf6",
      action: () => router.push("/about/faq"),
    },
    {
      title: "Contact Us",
      subtitle: "Get in touch with EduEaz Support",
      icon: "mail",
      color: "#10b981",
      action: () => router.push("/about/contact"),
    },
    {
      title: "Report a Complaint",
      subtitle: "Let us know about your issues",
      icon: "alert-circle",
      color: "#ef4444",
      action: () => router.push("/about/complaint"),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          style={styles.heroGradient}
        >
          <View style={[styles.safeHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={[styles.backBtn, { top: insets.top + 10 }]}
              activeOpacity={0.8}
            >
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Animatable.Text
              animation="fadeInDown"
              style={styles.heroTitle}
            >
              ABOUT EDUEAZ
            </Animatable.Text>
            <Text style={styles.heroSubtitle}>VERSION 2.0.4</Text>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <Animatable.View animation="fadeInUp" delay={200} style={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              EduEaz is a comprehensive school management system designed to
              bridge the gap between schools, parents, and students. Our goal is
              to provide a seamless educational experience through modern
              technology.
            </Text>
          </View>

          <View style={styles.sectionGrid}>
            {sections.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.sectionCard}
                onPress={item.action}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: item.color + "15" },
                  ]}
                >
                  <SVGIcon name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.sectionText}>
                  <Text style={styles.sectionTitle}>{item.title}</Text>
                  <Text style={styles.sectionSubtitle}>{item.subtitle}</Text>
                </View>
                <SVGIcon name="chevron-forward" size={20} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.copyright}>
              © {new Date().getFullYear()} EduEaz Inc. All rights reserved.
            </Text>
          </View>
        </Animatable.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrapper: {
    height: 180,
  },
  heroGradient: {
    flex: 1,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  safeHeader: {
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    marginTop: 40,
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    marginTop: 4,
  },
  scrollContent: {
    padding: 20,
  },
  content: {
    gap: 20,
  },
  infoCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    ...SHADOWS.small,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    textAlign: "center",
  },
  sectionGrid: {
    gap: 12,
  },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    ...SHADOWS.small,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionText: {
    flex: 1,
    marginLeft: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  copyright: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
});
