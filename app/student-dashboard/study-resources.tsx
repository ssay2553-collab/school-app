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
import { useToast } from '../../contexts/ToastContext';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

const RESOURCES = [
  {
    title: 'BECE Past Questions',
    description: 'Download and practice BECE past questions from Ghana Learner.',
    url: 'https://ghlearner.com/bece',
    icon: 'book',
    color: '#4D96FF',
    tag: 'GHANA'
  },
  {
    title: 'WASSCE Hub',
    description: 'Official resources and examiners reports for WASSCE candidates.',
    url: 'https://www.waecgh.org/examiners-report',
    icon: 'school',
    color: '#FF6B6B',
    tag: 'WAEC'
  },
  {
    title: 'Khan Academy',
    description: 'Free world-class education for anyone, anywhere.',
    url: 'https://www.khanacademy.org',
    icon: 'library',
    color: '#6BCB77',
    tag: 'GLOBAL'
  },
  {
    title: 'Passco GH',
    description: 'Large collection of past questions for all levels.',
    url: 'https://passco.org',
    icon: 'cloud-download',
    color: '#FFD93D',
    tag: 'PAST QUESTIONS'
  }
];

export default function StudyResources() {
  const router = useRouter();
  const { showToast } = useToast();
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
      showToast({ message: "Could not open the study resource.", type: "error" });
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
          <Text style={styles.title}>Study Resources</Text>
          <Text style={styles.subtitle}>Curated links for your academic success</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInUp" duration={800}>
          <View style={styles.noticeBox}>
            <SVGIcon name="information-circle" size={20} color={primary} />
            <Text style={styles.noticeText}>
              These are external websites. Make sure to stay focused on your studies!
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
