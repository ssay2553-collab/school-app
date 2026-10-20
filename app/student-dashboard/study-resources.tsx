import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  TextInput,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useSchoolConfig } from "../../constants/Config";
import { useToast } from "../../contexts/ToastContext";
import * as Animatable from "react-native-animatable";

const RESOURCES = [
  {
    title: "BECE Past Questions",
    description: "Download and practice BECE past questions from Ghana Learner.",
    url: "https://ghlearner.com/bece",
    icon: "book",
    color: "#4D96FF",
    tag: "GHANA",
    image: "https://ghlearner.com/wp-content/uploads/2021/04/gh-learner-logo.png",
  },
  {
    title: "WASSCE Hub",
    description: "Official resources and examiners reports for WASSCE candidates.",
    url: "https://www.waecgh.org/examiners-report",
    icon: "school",
    color: "#FF6B6B",
    tag: "WAEC",
    image: "https://www.waecgh.org/images/logo.png",
  },
  {
    title: "GES Official Portal",
    description: "Ghana Education Service official news, resources, and announcements.",
    url: "https://ges.gov.gh",
    icon: "library",
    color: "#FFD93D",
    tag: "GES PORTAL",
  },
  {
    title: "NaCCA & GES Portal",
    description: "National Curriculum Assessment and GES official resources.",
    url: "https://nacca.gov.gh",
    icon: "library",
    color: "#10B981",
    tag: "CURRICULUM",
  },
  {
    title: "Khan Academy",
    description: "Free world-class educational tools, videos, and exercises.",
    url: "https://www.khanacademy.org",
    icon: "globe-outline",
    color: "#6BCB77",
    tag: "GLOBAL",
    image: "https://cdn.kastatic.org/images/khan-logo-vertical-transparent.png",
  },
];

const QUICK_SEARCHES = [
  "BECE Past Questions",
  "WASSCE Chief Examiner Reports",
  "NaCCA Curriculum Notes",
  "JHS Science Diagrams",
  "Primary Math Games",
];

export default function StudyResources() {
  const router = useRouter();
  const { showToast } = useToast();
  const config = useSchoolConfig();
  const primary = config.brandPrimary || COLORS.primary;
  const isNavigating = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenLink = async (url: string, title?: string) => {
    try {
      router.push({
        pathname: "/shared/web-view",
        params: { url, title: title || "Study Resource" },
      });
    } catch (error) {
      console.error("Error opening in-app web view:", error);
      showToast({ message: "Could not open the study resource.", type: "error" });
    }
  };

  const handleBingSearch = (queryToSearch?: string) => {
    const q = (queryToSearch || searchQuery).trim();
    if (!q) {
      showToast({ message: "Please enter a topic to research.", type: "info" });
      return;
    }
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
    handleOpenLink(bingUrl, `Research: ${q}`);
  };

  const handleBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/student-dashboard");
      }
    } catch (e) {
      router.replace("/student-dashboard");
    }

    setTimeout(() => {
      isNavigating.current = false;
    }, 500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Study Resources</Text>
          <Text style={styles.subtitle}>Curated links & research portal for academic success</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInUp" duration={800}>
          {/* RESEARCH CARD / SEARCH ENGINE */}
          <View style={styles.bingCard}>
            <View style={styles.bingHeader}>
              <View style={styles.bingIconBadge}>
                <SVGIcon name="search" size={20} color="#0078D4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bingTitle}>Research & Search Engine</Text>
                <Text style={styles.bingSubtitle}>Search for topics, past questions, notes & diagrams</Text>
              </View>
            </View>

            <View style={styles.searchInputRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. BECE Science past questions, Math formulas..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => handleBingSearch()}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: "#0078D4" }]}
                onPress={() => handleBingSearch()}
              >
                <SVGIcon name="search" size={18} color="#fff" />
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>

            {/* QUICK SUGGESTION CHIPS */}
            <Text style={styles.quickSearchLabel}>Quick Searches:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {QUICK_SEARCHES.map((chip, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickChip}
                  onPress={() => {
                    setSearchQuery(chip);
                    handleBingSearch(chip);
                  }}
                >
                  <SVGIcon name="search" size={12} color="#0078D4" />
                  <Text style={styles.quickChipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.noticeBox}>
            <SVGIcon name="information-circle" size={20} color={primary} />
            <Text style={styles.noticeText}>
              Access official WAEC portals, BECE past questions, and learning platforms directly in-app.
            </Text>
          </View>

          <View style={styles.grid}>
            {RESOURCES.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.card}
                onPress={() => handleOpenLink(item.url, item.title)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color + "15" }]}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.cardImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <SVGIcon name={item.icon} size={30} color={item.color} />
                  )}
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={[styles.tag, { backgroundColor: item.color + "25" }]}>
                      <Text style={[styles.tagText, { color: item.color }]}>{item.tag}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDesc}>{item.description}</Text>

                  <View style={styles.visitLink}>
                    <Text style={[styles.visitText, { color: primary }]}>Open Resource</Text>
                    <SVGIcon name="open-outline" size={16} color={primary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animatable.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    zIndex: 10,
    ...Platform.select({
      web: { cursor: "pointer" } as any,
      default: {},
    }),
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  bingCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  bingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  bingIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#0078D415",
    justifyContent: "center",
    alignItems: "center",
  },
  bingTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
  },
  bingSubtitle: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  quickSearchLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  chipScroll: {
    flexDirection: "row",
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0078D4",
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: "#475569", fontWeight: "600" },
  grid: { gap: 15 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardImage: { width: 35, height: 35 },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 9, fontWeight: "900" },
  cardDesc: { fontSize: 12, color: "#64748B", lineHeight: 17, marginBottom: 10 },
  visitLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  visitText: { fontSize: 12, fontWeight: "800" },
});
