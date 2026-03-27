import { useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Dimensions,
  Platform,
  RefreshControl,
  Image,
  Linking,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import Constants from "expo-constants";
import { signOut } from "firebase/auth";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { getSchoolLogo } from "../../constants/Logos";
import { COLORS, SHADOWS } from "../../constants/theme";
import { auth } from "../../firebaseConfig";

const { width } = Dimensions.get("window");

export default function GuestDashboard() {
  const router = useRouter();
  const schoolId = Constants.expoConfig?.extra?.schoolId || "afahjoy";
  const schoolLogo = getSchoolLogo(schoolId);
  const schoolName = SCHOOL_CONFIG.name || "School";
  
  const brandPrimary = SCHOOL_CONFIG.brandPrimary || COLORS.primary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary || COLORS.secondary;
  const surface = SCHOOL_CONFIG.surfaceColor || "#F8FAFC";

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to exit the guest portal?")) {
        signOut(auth).then(() => router.replace("/"));
      }
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to exit the guest portal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/");
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Could not sign out.");
          }
        },
      },
    ]);
  };

  const handleCall = async (number: string) => {
    const cleanNumber = number.replace(/[^0-9+]/g, "");
    const url = `tel:${cleanNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Not Supported",
          "Phone calls are not supported on this device.",
        );
      }
    } catch (err) {
      console.error("Linking error:", err);
      Alert.alert("Error", "Could not open dialer.");
    }
  };

  const phoneNumbers = SCHOOL_CONFIG.hotline
    .split("/")
    .map((n: string) => n.trim())
    .filter((n: string) => !!n);

  const sections = [
    {
      title: "EXPLORE CAMPUS",
      items: [
        { title: "Academic Gallery", subtitle: "Visual campus tour", route: "/guest-dashboard/gallery", icon: "images", color: "#6366f1" },
        { title: "Common Questions", subtitle: "Helpful FAQs & info", route: "/guest-dashboard/FAQ", icon: "help-circle", color: "#f59e0b" },
      ],
    },
    {
      title: "ADMISSIONS & ENQUIRY",
      items: [
        { title: "Direct Inquiry", subtitle: "Chat with admissions", route: "/guest-dashboard/chat-with-admin", icon: "chatbubbles", color: "#10b981" },
        { title: "Membership Upgrade", subtitle: "Full registration", route: "/guest-dashboard/upgrade-account", icon: "flash", color: "#ec4899" },
      ],
    },
  ];

  const renderCard = (item: any, index: number) => (
    <Animatable.View 
      animation="fadeInUp" 
      duration={600} 
      delay={index * 100} 
      key={item.title}
      style={styles.cardWrapper}
    >
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(item.route as any)} 
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
          <SVGIcon name={item.icon} size={26} color={item.color} />
        </View>
        <View style={styles.cardTextContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>
        <View style={styles.chevronBox}>
           <SVGIcon name="chevron-forward" size={16} color="#CBD5E1" />
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandPrimary} colors={[brandPrimary]} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.topBar}>
            <View style={styles.schoolBadge}>
              <Image source={schoolLogo} style={styles.schoolLogoMini} resizeMode="contain" />
              <Text style={styles.schoolNameMini}>{schoolName}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.settingsBtn}>
              <SVGIcon name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroSection}>
            <View>
              <Text style={styles.welcomeText}>Welcome to our portal,</Text>
              <Text style={styles.nameText}>Guest Explorer</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
               <View style={[styles.dot, { backgroundColor: '#fff' }]} />
               <Text style={[styles.statusText, { color: '#fff' }]}>Explorer</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          <View style={styles.infoCard}>
             <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: brandPrimary + '15' }]}>
                   <SVGIcon name="location-outline" size={18} color={brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={styles.infoLabel}>LOCATION</Text>
                   <Text style={styles.infoValue}>{SCHOOL_CONFIG.address}</Text>
                </View>
             </View>
             <View style={[styles.infoRow, { marginTop: 15 }]}>
                <View style={[styles.infoIcon, { backgroundColor: brandPrimary + '15' }]}>
                   <SVGIcon name="mail-outline" size={18} color={brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={styles.infoLabel}>EMAIL US</Text>
                   <Text style={styles.infoValue}>{SCHOOL_CONFIG.email || "info@school.edu"}</Text>
                </View>
             </View>
          </View>

          <View style={styles.callCardContainer}>
            {phoneNumbers.map((phone: string, index: number) => (
              <Animatable.View
                key={phone}
                animation="fadeIn"
                duration={800}
                delay={200 + index * 100}
                style={styles.callCard}
              >
                <View style={[styles.callIconBox, { backgroundColor: "#ef444415" }]}>
                  <SVGIcon name="megaphone" size={24} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.callTitle}>Admissions Hotline</Text>
                  <Text style={styles.callPhone}>{phone}</Text>
                </View>
                <TouchableOpacity
                  style={styles.callActionBtn}
                  onPress={() => handleCall(phone)}
                >
                  <Text style={styles.callActionText}>Call</Text>
                </TouchableOpacity>
              </Animatable.View>
            ))}
          </View>

          {sections.map((section, sIndex) => (
            <View key={section.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <View style={styles.sectionLine} />
              </View>
              <View style={styles.grid}>
                {section.items.map((item, index) => renderCard(item, index + sIndex * 2))}
              </View>
            </View>
          ))}
          
          <View style={styles.footerInfo}>
             <SVGIcon name="information-circle" size={16} color="#94A3B8" />
             <Text style={styles.footerText}>Explore our school modules</Text>
          </View>
        </View>
        
        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 20 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingHorizontal: 25,
    paddingBottom: 40,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    ...SHADOWS.medium,
  },
  topBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 25 
  },
  schoolBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 100, 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  schoolLogoMini: { width: 18, height: 18, marginRight: 8 },
  schoolNameMini: { fontSize: 11, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
  settingsBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: "rgba(255,255,255,0.15)", 
    justifyContent: "center", 
    alignItems: "center", 
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  heroSection: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end',
  },
  welcomeText: { fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  nameText: { fontSize: 24, fontWeight: "900", color: "#fff", marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 25,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 1 },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { 
    fontSize: 11, 
    fontWeight: "900", 
    color: "#94A3B8", 
    letterSpacing: 1.2,
    marginRight: 10
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  cardWrapper: { 
    width: (width - 55) / 2, 
    marginBottom: 15 
  },
  card: { 
    backgroundColor: "#FFFFFF", 
    borderRadius: 24, 
    padding: 16, 
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    minHeight: 140,
    justifyContent: 'space-between'
  },
  iconBox: { 
    width: 48, 
    height: 48, 
    borderRadius: 16, 
    justifyContent: "center", 
    alignItems: "center",
    marginBottom: 12
  },
  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#1E293B", lineHeight: 20 },
  cardSubtitle: { fontSize: 11, color: "#64748B", marginTop: 4, fontWeight: '500' },
  chevronBox: { alignSelf: 'flex-end', marginTop: 5 },
  callCardContainer: { marginBottom: 25, gap: 10 },
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 24,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  callIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  callTitle: { fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: 'uppercase' },
  callPhone: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginTop: 2 },
  callActionBtn: { backgroundColor: "#ef4444", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  callActionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  footerInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 10,
    opacity: 0.7
  },
  footerText: { 
    fontSize: 12, 
    color: "#94A3B8", 
    marginLeft: 6, 
    fontWeight: '500' 
  },
  footerSpace: { height: 40 }
});
