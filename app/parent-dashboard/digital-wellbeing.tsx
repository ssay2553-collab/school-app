import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";

export default function DigitalWellbeingParentScreen() {
  const router = useRouter();
  const primary = SCHOOL_CONFIG.primaryColor || "#6366F1";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/parent-dashboard");
    }
  };

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
          <Text style={styles.title}>Digital Wellbeing</Text>
          <Text style={styles.subtitle}>
            Screen time limits & device control guide for parents
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animatable.View animation="fadeInUp" duration={800}>
          {/* HERO BANNER */}
          <View style={[styles.heroCard, { backgroundColor: primary }]}>
            <View style={styles.heroIconBadge}>
              <SVGIcon name="shield-checkmark" size={32} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>
              Balanced Screen Time for Children
            </Text>
            <Text style={styles.heroDesc}>
              EduEaz automatically monitors continuous app activity and prompts students to take healthy rest breaks based on their grade level.
            </Text>
          </View>

          {/* AGE-BASED SCREEN TIME LIMITS */}
          <Text style={styles.sectionHeader}>
            AUTOMATIC SCREEN TIME LIMITS ON EDUEAZ
          </Text>

          <View style={styles.tierGrid}>
            <View style={[styles.tierCard, { borderLeftColor: "#FF6B6B" }]}>
              <View style={styles.tierHeader}>
                <SVGIcon name="happy-outline" size={24} color="#FF6B6B" />
                <Text style={styles.tierTitle}>Preschool (Creche, Nursery, KG)</Text>
              </View>
              <Text style={styles.tierTime}>Limit: 1 Hour Continuous Use</Text>
              <Text style={styles.tierText}>
                Triggers a gentle rest alert encouraging tactile play, movement, and eye rest.
              </Text>
            </View>

            <View style={[styles.tierCard, { borderLeftColor: "#F59E0B" }]}>
              <View style={styles.tierHeader}>
                <SVGIcon name="fitness-outline" size={24} color="#F59E0B" />
                <Text style={styles.tierTitle}>Lower Primary (Basic 1 - 3)</Text>
              </View>
              <Text style={styles.tierTime}>Limit: 2 Hours Continuous Use</Text>
              <Text style={styles.tierText}>
                Prompts students to stretch, eat a healthy snack, and take a 15-minute break.
              </Text>
            </View>

            <View style={[styles.tierCard, { borderLeftColor: "#6366F1" }]}>
              <View style={styles.tierHeader}>
                <SVGIcon name="time-outline" size={24} color="#6366F1" />
                <Text style={styles.tierTitle}>Upper Primary & JHS (Basic 4 - 9)</Text>
              </View>
              <Text style={styles.tierTime}>Limit: 3 Hours Continuous Use</Text>
              <Text style={styles.tierText}>
                Requires a mandatory break to prevent eye strain and maintain focus.
              </Text>
            </View>
          </View>

          {/* PARENTAL ASSISTANCE & DEVICE CONTROL INSTRUCTIONS */}
          <Text style={styles.sectionHeader}>
            HOW PARENTS CAN ASSIST & CONTROL DEVICE USAGE
          </Text>

          {/* STEP 1: DEVICE CONTROLS */}
          <View style={styles.guideCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumBadge, { backgroundColor: primary + "18" }]}>
                <Text style={[styles.stepNum, { color: primary }]}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Configure Built-In Device Parental Controls</Text>
            </View>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Android Devices:</Text> Open <Text style={styles.codeText}>Settings {">"} Digital Wellbeing & Parental Controls</Text>. Set a daily timer for EduEaz and set "Bedtime mode" to turn off notifications.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>iOS / Apple Devices:</Text> Open <Text style={styles.codeText}>Settings {">"} Screen Time {">"} App Limits</Text>. Add EduEaz and set a maximum daily usage window.
              </Text>
            </View>
          </View>

          {/* STEP 2: ERGONOMICS & LIGHTING */}
          <View style={styles.guideCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumBadge, { backgroundColor: "#10B98118" }]}>
                <Text style={[styles.stepNum, { color: "#10B981" }]}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Promote Healthy Vision & Ergonomics</Text>
            </View>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Well-Lit Environment:</Text> Ensure your child uses the phone/tablet in a brightly lit room rather than a dark bedroom.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>The 20-20-20 Rule:</Text> Teach your ward that every 20 minutes, they should look at an object 20 feet away for at least 20 seconds.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Proper Distance:</Text> Keep screens at least 18 inches (45 cm) away from your child's eyes.
              </Text>
            </View>
          </View>

          {/* STEP 3: SCHEDULES & NO-SCREEN ZONES */}
          <View style={styles.guideCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumBadge, { backgroundColor: "#F59E0B18" }]}>
                <Text style={[styles.stepNum, { color: "#F59E0B" }]}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Establish No-Device Zones & Schedules</Text>
            </View>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Mealtime & Bedtime Rules:</Text> Keep devices away from the dining table and turn off all screens 1 hour before bedtime for quality sleep.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Study Schedule:</Text> Set dedicated study windows (e.g., 4:00 PM – 5:30 PM for homework, then physical play).
              </Text>
            </View>
          </View>

          {/* STEP 4: CO-LEARNING */}
          <View style={styles.guideCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumBadge, { backgroundColor: "#EC489918" }]}>
                <Text style={[styles.stepNum, { color: "#EC4899" }]}>4</Text>
              </View>
              <Text style={styles.stepTitle}>Engage in Active Co-Learning</Text>
            </View>
            <Text style={styles.guideText}>
              For younger students (Preschool & Lower Primary), sit with your ward while they practice assignments or read e-books. Discussing lesson topics together turns passive screen viewing into active learning.
            </Text>
          </View>
        </Animatable.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
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
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  heroIconBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 20,
    fontWeight: "500",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  tierGrid: {
    gap: 12,
    marginBottom: 28,
  },
  tierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  tierTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  tierTime: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 4,
  },
  tierText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
  guideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...SHADOWS.small,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  stepNumBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNum: {
    fontSize: 14,
    fontWeight: "900",
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    flex: 1,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
  boldText: {
    fontWeight: "800",
    color: "#1E293B",
  },
  codeText: {
    fontWeight: "700",
    color: "#6366F1",
  },
  guideText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
});
