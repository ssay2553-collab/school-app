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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import SVGIcon from '../../components/SVGIcon';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useSchoolConfig, SCHOOL_CONFIG } from '../../constants/Config';
import * as Animatable from 'react-native-animatable';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

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
  const { appUser } = useAuth();
  const config = useSchoolConfig();
  const primary = config.brandPrimary || COLORS.primary;

  const [activeTab, setActiveTab] = React.useState<'saved' | 'resources'>('saved');
  const [savedPlans, setSavedPlans] = React.useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSubject, setSelectedSubject] = React.useState('All');
  const [selectedPlan, setSelectedPlan] = React.useState<any>(null);

  React.useEffect(() => {
    if (activeTab === 'saved' && appUser?.uid) {
      fetchSavedPlans();
    }
  }, [activeTab, appUser?.uid]);

  const fetchSavedPlans = async () => {
    try {
      setLoadingPlans(true);
      const q = query(
        collection(db, 'pedagogy_vault'),
        where('userId', '==', appUser?.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const plans = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedPlans(plans);
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'pedagogy_vault', id));
      setSavedPlans(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting plan:", error);
    }
  };

  const subjects = ['All', ...new Set(savedPlans.map(p => p.subject))];

  const filteredPlans = savedPlans.filter(plan => {
    const matchesSearch = plan.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        plan.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || plan.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

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

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && { borderBottomColor: primary }]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && { color: primary }]}>Saved Plans</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'resources' && { borderBottomColor: primary }]}
          onPress={() => setActiveTab('resources')}
        >
          <Text style={[styles.tabText, activeTab === 'resources' && { color: primary }]}>External Resources</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'saved' ? (
          <Animatable.View animation="fadeIn" duration={500}>
            <View style={styles.filterSection}>
              <View style={styles.searchBar}>
                <SVGIcon name="search" size={20} color="#64748B" />
                <TextInput
                  placeholder="Search topic or subject..."
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedSubject}
                  onValueChange={(itemValue) => setSelectedSubject(itemValue)}
                  style={styles.picker}
                >
                  {subjects.map(s => <Picker.Item key={s} label={s} value={s} />)}
                </Picker>
              </View>
            </View>

            {loadingPlans ? (
              <ActivityIndicator color={primary} style={{ marginTop: 40 }} />
            ) : filteredPlans.length === 0 ? (
              <View style={styles.emptyState}>
                <SVGIcon name="document-text-outline" size={64} color="#CBD5E1" />
                <Text style={styles.emptyText}>No saved lesson plans found.</Text>
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: primary }]}
                  onPress={() => router.push('/teacher-dashboard/ai-lesson-planner')}
                >
                  <Text style={styles.createBtnText}>Create Plan</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.grid}>
                {filteredPlans.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.card}
                    onPress={() => setSelectedPlan(plan)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: primary + '15' }]}>
                      <SVGIcon name="journal" size={32} color={primary} />
                    </View>
                    <View style={styles.cardContent}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{plan.topic}</Text>
                        <TouchableOpacity onPress={() => handleDeletePlan(plan.id)}>
                           <SVGIcon name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cardSub}>{plan.subject} • {plan.classLevel}</Text>
                      <Text style={styles.cardDate}>{plan.createdAt?.toDate().toLocaleDateString()}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeIn" duration={500}>
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
        )}
      </ScrollView>

      {/* Plan Detail Modal */}
      {selectedPlan && (
        <View style={styles.modalOverlay}>
          <Animatable.View animation="zoomIn" duration={300} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPlan.topic}</Text>
              <TouchableOpacity onPress={() => setSelectedPlan(null)}>
                <SVGIcon name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
               <Text style={styles.planSubHeader}>{selectedPlan.subject} - {selectedPlan.classLevel} ({selectedPlan.duration})</Text>
               <Text style={styles.planStrand}>Strand: {selectedPlan.strand}</Text>

               {Object.entries(selectedPlan.plan).map(([key, value]: [string, any]) => (
                 <View key={key} style={styles.planSection}>
                   <Text style={styles.sectionTitle}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                   {Array.isArray(value) ? (
                     value.map((item, i) => <Text key={i} style={styles.sectionItem}>• {item}</Text>)
                   ) : (
                     <Text style={styles.sectionItem}>{value}</Text>
                   )}
                 </View>
               ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: primary }]}
              onPress={() => setSelectedPlan(null)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      )}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    justifyContent: 'flex-start'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: isLargeScreen ? (width - 70) / 2 : '100%',
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

  // New styles
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  filterSection: {
    flexDirection: isLargeScreen ? 'row' : 'column',
    gap: 12,
    marginBottom: 20,
  },
  searchBar: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: {
    height: 45,
    width: '100%',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
    marginBottom: 24,
  },
  createBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: isLargeScreen ? '60%' : '100%',
    maxHeight: '80%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    flex: 1,
  },
  modalBody: {
    flex: 1,
  },
  planSubHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  planStrand: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  planSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  sectionItem: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 4,
  },
  closeBtn: {
    marginTop: 20,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
