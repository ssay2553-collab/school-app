import { useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Platform,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { SCHOOL_CONFIG } from "../../../constants/Config";
import { getSchoolLogo } from "../../../constants/Logos";
import { SHADOWS } from "../../../constants/theme";
import SVGIcon from "../../../components/SVGIcon";
import { LinearGradient } from "expo-linear-gradient";

const { height } = Dimensions.get("window");

export default function LoginSelectionScreen() {
  const router = useRouter();
  const schoolId = SCHOOL_CONFIG.schoolId;
  const schoolLogo = getSchoolLogo(schoolId);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;
  const surface = SCHOOL_CONFIG.surfaceColor;

  const options = [
    { title: "Administrator", role: "Management", route: "/(auth)/login/admin", icon: "shield-checkmark", color: brandPrimary },
    { title: "Staff Member", role: "Academics", route: "/(auth)/login/teacher", icon: "school", color: primary },
    { title: "Student Portal", role: "Learning", route: "/(auth)/login/student", icon: "person", color: secondary === "#000000" ? brandPrimary : secondary },
    { title: "Parent Access", role: "Guardian", route: "/(auth)/login/parent", icon: "people", color: primary },
  ];

  const navigateToHub = () => {
    router.replace("/");
  };

  return (
    <View style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerWrapper}>
        <LinearGradient 
          colors={[brandPrimary, brandSecondary]} 
          style={styles.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={styles.safeHeader}>
            <TouchableOpacity onPress={navigateToHub} style={styles.backBtn}>
              <SVGIcon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Animatable.View animation="fadeInDown" duration={1000} style={styles.logoCircle}>
              <View style={[styles.innerLogo, { backgroundColor: surface }]}>
                <Image source={schoolLogo} style={styles.logo} resizeMode="contain" />
              </View>
            </Animatable.View>
            <Animatable.Text animation="fadeInUp" delay={300} style={styles.heroTitle}>IDENTITY GATEWAY</Animatable.Text>
            <Animatable.Text animation="fadeInUp" delay={400} style={styles.heroSubtitle}>SELECT YOUR PORTAL TO CONTINUE</Animatable.Text>
          </SafeAreaView>
        </LinearGradient>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainWrapper}>
          <Animatable.View animation="fadeInUp" delay={500} style={styles.grid}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.title}
                style={[styles.portalCard, { backgroundColor: '#fff' }]}
                onPress={() => router.push(opt.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: opt.color + '15' }]}>
                  <SVGIcon name={opt.icon} size={28} color={opt.color} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.optTitle}>{opt.title}</Text>
                  <Text style={styles.optRole}>{opt.role}</Text>
                </View>
                <View style={[styles.arrowBox, { backgroundColor: surface }]}>
                  <SVGIcon name="chevron-forward" size={16} color={opt.color} />
                </View>
              </TouchableOpacity>
            ))}
          </Animatable.View>
          <Animatable.View animation="fadeIn" delay={1000} style={styles.footer}>
            <Text style={styles.guestPrompt}>Visitor or Applicant?</Text>
            <TouchableOpacity 
              style={styles.guestButton}
              onPress={() => router.push("/(auth)/login/guest")}
              activeOpacity={0.8}
            >
              <SVGIcon name="help-circle" size={20} color={primary} />
              <Text style={[styles.guestButtonText, { color: primary }]}>Explore as Guest</Text>
            </TouchableOpacity>

            <View style={styles.brandFooter}>
              <Text style={styles.footerBrandText}>EDUEAZE CORE</Text>
            </View>
          </Animatable.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: { height: height * 0.38, overflow: 'hidden' },
  heroGradient: { flex: 1, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  safeHeader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Platform.OS === 'android' ? 40 : 0 },
  backBtn: { position: 'absolute', top: Platform.OS === 'android' ? 50 : 20, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, marginBottom: 20, ...SHADOWS.medium },
  innerLogo: { width: '100%', height: '100%', borderRadius: 42, padding: 15, justifyContent: 'center', alignItems: 'center' },
  logo: { width: '100%', height: '100%' },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 2, textTransform: 'uppercase' },
  heroSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginTop: 8, letterSpacing: 1.5 },
  scrollContent: { flexGrow: 1 },
  mainWrapper: { paddingHorizontal: 25, paddingTop: 30, paddingBottom: 40 },
  grid: { gap: 16 },
  portalCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', ...SHADOWS.small },
  iconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 16 },
  optTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  optRole: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' },
  arrowBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  footer: { marginTop: 40, alignItems: 'center', gap: 15 },
  guestPrompt: { fontSize: 13, color: '#64748b', fontWeight: '700', marginBottom: 5 },
  guestButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingVertical: 14, 
    paddingHorizontal: 25, 
    borderRadius: 18, 
    borderWidth: 1.5, 
    borderColor: '#f1f5f9',
    gap: 10,
    ...SHADOWS.small 
  },
  guestButtonText: { fontSize: 15, fontWeight: '800' },
  brandFooter: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#f1f5f9', borderRadius: 10 },
  footerBrandText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 2 },
});
