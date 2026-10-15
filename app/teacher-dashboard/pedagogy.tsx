import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
  TextInput,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useSchoolConfig } from "../../constants/Config";
import { useToast } from "../../contexts/ToastContext";
import {
  LOWER_PRIMARY_PEDAGOGY,
  UPPER_PRIMARY_PEDAGOGY,
  JHS_PEDAGOGY,
  PedagogyTier,
} from "../../constants/Pedagogy";

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

const PEDAGOGY_TIERS: { id: string; name: string; data: PedagogyTier; icon: string }[] = [
  { id: "lower", name: "Lower Primary", data: LOWER_PRIMARY_PEDAGOGY, icon: "happy-outline" },
  { id: "upper", name: "Upper Primary", data: UPPER_PRIMARY_PEDAGOGY, icon: "school-outline" },
  { id: "jhs", name: "JHS (Basic 7-9)", data: JHS_PEDAGOGY, icon: "trophy-outline" },
];

const QUICK_SEARCHES = [
  "BECE Past Questions",
  "NaCCA Lesson Plans",
  "WASSCE Chief Examiner Reports",
  "JHS Science Diagrams",
  "Primary Math Games",
];

export default function PedagogyScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const config = useSchoolConfig();
  const primary = config.brandPrimary || COLORS.primary;
  const isNavigating = useRef(false);

  const [activeTab, setActiveTab] = useState<"resources" | "pedagogy">("resources");
  const [selectedPedagogyId, setSelectedPedagogyId] = useState<string>("jhs");
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenLink = async (url: string, title?: string) => {
    try {
      router.push({
        pathname: "/shared/web-view",
        params: { url, title: title || "Resource" },
      });
    } catch (error) {
      console.error("Error opening in-app web view:", error);
      showToast({ message: "Could not open the resource link.", type: "error" });
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
        router.replace("/teacher-dashboard");
      }
    } catch (e) {
      router.replace("/teacher-dashboard");
    }

    setTimeout(() => {
      isNavigating.current = false;
    }, 500);
  };

  const selectedPedagogy = PEDAGOGY_TIERS.find((t) => t.id === selectedPedagogyId)?.data || JHS_PEDAGOGY;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Pedagogy & Resources</Text>
          <Text style={styles.subtitle}>Teaching Frameworks, Search & Exam Portals</Text>
        </View>
      </View>

      {/* MAIN TAB CONTROLLER */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === "resources" && { backgroundColor: primary }]}
          onPress={() => setActiveTab("resources")}
        >
          <SVGIcon
            name="earth-outline"
            size={18}
            color={activeTab === "resources" ? "#fff" : "#64748B"}
          />
          <Text
            style={[
              styles.mainTabText,
              activeTab === "resources" && styles.mainTabTextActive,
            ]}
          >
            Portals & Research
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainTab, activeTab === "pedagogy" && { backgroundColor: primary }]}
          onPress={() => setActiveTab("pedagogy")}
        >
          <SVGIcon
            name="bulb-outline"
            size={18}
            color={activeTab === "pedagogy" ? "#fff" : "#64748B"}
          />
          <Text
            style={[
              styles.mainTabText,
              activeTab === "pedagogy" && styles.mainTabTextActive,
            ]}
          >
            Pedagogy Framework
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === "resources" ? (
          <Animatable.View animation="fadeIn" duration={400}>
            {/* RESEARCH CARD */}
            <View style={styles.bingCard}>
              <View style={styles.bingHeader}>
                <View style={styles.bingIconBadge}>
                  <SVGIcon name="search" size={20} color="#0078D4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bingTitle}>Research</Text>
                  <Text style={styles.bingSubtitle}>Search for lesson plans, research, & diagrams</Text>
                </View>
              </View>

              <View style={styles.searchInputRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="e.g. BECE Math past questions, Science diagrams..."
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
                      <Text style={[styles.visitText, { color: primary }]}>Open Portal</Text>
                      <SVGIcon name="open-outline" size={16} color={primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeIn" duration={400}>
            {/* TIER SELECTION CHIPS */}
            <View style={styles.tierContainer}>
              {PEDAGOGY_TIERS.map((tier) => (
                <TouchableOpacity
                  key={tier.id}
                  style={[
                    styles.tierChip,
                    selectedPedagogyId === tier.id && { backgroundColor: primary, borderColor: primary },
                  ]}
                  onPress={() => setSelectedPedagogyId(tier.id)}
                >
                  <SVGIcon
                    name={tier.icon}
                    size={16}
                    color={selectedPedagogyId === tier.id ? "#fff" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.tierChipText,
                      selectedPedagogyId === tier.id && styles.tierChipTextActive,
                    ]}
                  >
                    {tier.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* PEDAGOGY DETAILS DISPLAY */}
            <View style={styles.pedagogyCard}>
              <View style={styles.pedagogyHeader}>
                <Text style={styles.tierTitle}>{selectedPedagogy.tierName}</Text>
                <Text style={styles.tierDesc}>{selectedPedagogy.description}</Text>
              </View>

              <View style={styles.sectionDivider} />

              {/* Teaching Methods */}
              <View style={styles.pedagogySection}>
                <View style={styles.sectionTitleRow}>
                  <SVGIcon name="construct-outline" size={18} color={primary} />
                  <Text style={styles.sectionHeading}>Teaching Methods & Pedagogy</Text>
                </View>
                <View style={styles.bulletList}>
                  {selectedPedagogy.teachingMethods.map((m, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <View style={[styles.dot, { backgroundColor: primary }]} />
                      <Text style={styles.bulletText}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* TLMs */}
              <View style={styles.pedagogySection}>
                <View style={styles.sectionTitleRow}>
                  <SVGIcon name="cube-outline" size={18} color="#F59E0B" />
                  <Text style={styles.sectionHeading}>Teaching & Learning Materials (TLMs)</Text>
                </View>
                <View style={styles.bulletList}>
                  {selectedPedagogy.tlms.map((t, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                      <Text style={styles.bulletText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Starter Activities */}
              <View style={styles.pedagogySection}>
                <View style={styles.sectionTitleRow}>
                  <SVGIcon name="play-outline" size={18} color="#10B981" />
                  <Text style={styles.sectionHeading}>Phase 1: Lesson Starter / RPK</Text>
                </View>
                <View style={styles.bulletList}>
                  {selectedPedagogy.starterActivities.map((s, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                      <Text style={styles.bulletText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Core Activities */}
              <View style={styles.pedagogySection}>
                <View style={styles.sectionTitleRow}>
                  <SVGIcon name="layers-outline" size={18} color="#6366F1" />
                  <Text style={styles.sectionHeading}>Phase 2: Core Delivery Steps</Text>
                </View>
                <View style={styles.bulletList}>
                  {selectedPedagogy.coreActivities.map((c, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <View style={[styles.dot, { backgroundColor: "#6366F1" }]} />
                      <Text style={styles.bulletText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Assessment Methods */}
              <View style={styles.pedagogySection}>
                <View style={styles.sectionTitleRow}>
                  <SVGIcon name="checkmark-done-circle" size={18} color="#EC4899" />
                  <Text style={styles.sectionHeading}>Phase 3: Assessment Methods</Text>
                </View>
                <View style={styles.bulletList}>
                  {selectedPedagogy.assessmentMethods.map((a, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <View style={[styles.dot, { backgroundColor: "#EC4899" }]} />
                      <Text style={styles.bulletText}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Animatable.View>
        )}
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    padding: 4,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 14,
    gap: 4,
  },
  mainTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  mainTabText: { fontSize: 13, fontWeight: "800", color: "#64748B" },
  mainTabTextActive: { color: "#fff" },
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
  tierContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
  },
  tierChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    gap: 6,
  },
  tierChipText: { fontSize: 11, fontWeight: "800", color: "#64748B" },
  tierChipTextActive: { color: "#fff" },
  pedagogyCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  pedagogyHeader: { marginBottom: 15 },
  tierTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", marginBottom: 4 },
  tierDesc: { fontSize: 13, color: "#64748B", lineHeight: 18 },
  sectionDivider: { height: 1, backgroundColor: "#E2E8F0", marginBottom: 20 },
  pedagogySection: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionHeading: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  bulletList: { gap: 8, paddingLeft: 6 },
  bulletItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bulletText: { fontSize: 13, color: "#334155", fontWeight: "600" },
});
