import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import SVGIcon from '../../components/SVGIcon';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useSchoolConfig } from '../../constants/Config';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

const RESOURCES = [
  {
    title: 'GES Curriculum Hub',
    description: 'Access the official NaCCA curriculum and teaching manuals for all levels.',
    url: 'https://nacca.gov.gh/curriculum/',
    icon: 'book',
    color: '#4D96FF',
    tag: 'CURRICULUM'
  },
  {
    title: 'WAEC Examiners Portal',
    description: 'Insights into marking schemes and common student pitfalls in exams.',
    url: 'https://www.waecgh.org/examiners-report',
    icon: 'school',
    color: '#FF6B6B',
    tag: 'WAEC'
  },
  {
    title: 'Edutopia',
    description: 'Innovative teaching strategies and evidence-based practices for K-12.',
    url: 'https://www.edutopia.org',
    icon: 'library',
    color: '#6BCB77',
    tag: 'STRATEGY'
  },
  {
    title: 'Ghana Learner',
    description: 'Teaching resources, lesson notes, and past questions bank.',
    url: 'https://ghlearner.com',
    icon: 'cloud-download',
    color: '#FFD93D',
    tag: 'RESOURCES'
  },
  {
    title: 'Google for Education',
    description: 'Free tools and training for educators to enhance classroom digital skills.',
    url: 'https://edu.google.com',
    icon: 'logo-google',
    color: '#4285F4',
    tag: 'TECH'
  }
];

export default function PedagogyVault() {
  const router = useRouter();
  const config = useSchoolConfig();
  const primary = config.brandPrimary || COLORS.primary;

  const handleOpenLink = async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(url, {
          toolbarColor: primary,
          enableBarCollapsing: true,
          showTitle: true,
        });
      }
    } catch (error) {
      console.error('Error opening browser:', error);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Pedagogy Vault 🏛️</Text>
          <Text style={styles.subtitle}>Professional tools and resources for educators</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInUp" duration={800}>
          <View style={styles.noticeBox}>
            <SVGIcon name="shield-checkmark" size={20} color={primary} />
            <Text style={styles.noticeText}>
              Elevate your teaching with curated materials from trusted educational bodies.
            </Text>
          </View>

          <View style={styles.grid}>
            {RESOURCES.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.card}
                onPress={() => handleOpenLink(item.url)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                  <SVGIcon name={item.icon} size={32} color={item.color} />
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={[styles.tag, { backgroundColor: item.color + '25' }]}>
                      <Text style={[styles.tagText, { color: item.color }]}>{item.tag}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDesc}>{item.description}</Text>

                  <View style={styles.visitLink}>
                    <Text style={[styles.visitText, { color: primary }]}>Access Resource</Text>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: '#475569', fontWeight: '600' },
  grid: { gap: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconContainer: {
    width: 65,
    height: 65,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 9, fontWeight: '900' },
  cardDesc: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 12 },
  visitLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitText: { fontSize: 12, fontWeight: '800' },
});
