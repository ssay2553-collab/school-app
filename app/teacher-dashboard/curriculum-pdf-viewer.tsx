import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import SVGIcon from '../../components/SVGIcon';
import StationaryBackground from '../../components/StationaryBackground';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import { useToast } from '../../contexts/ToastContext';
import { GES_SUBJECTS, CAMBRIDGE_SUBJECTS, MONTESSORI_SUBJECTS, CurriculumType } from '../../constants/Curriculum';

interface CurriculumPdfDoc {
  id: string;
  title: string;
  curriculumType: CurriculumType;
  subject: string;
  classLevel: string;
  fileUri: string;
  fileName: string;
  uploadedBy: string;
  createdAt: any;
}

export default function CurriculumPdfViewerScreen() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [curriculums, setCurriculums] = useState<CurriculumPdfDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurrType, setSelectedCurrType] = useState<CurriculumType>("GES");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCurrType, setUploadCurrType] = useState<CurriculumType>("GES");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadClassLevel, setUploadClassLevel] = useState("Primary 1");
  const [pickedFile, setPickedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // PDF Viewer Modal State
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState("");
  const [activePdfTitle, setActivePdfTitle] = useState("");

  const isAdmin = appUser?.role === "admin";
  const isTeacher = appUser?.role === "teacher" || isAdmin;

  // Fetch Curriculum documents from Firestore
  useEffect(() => {
    const q = query(collection(db, "curriculums"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: CurriculumPdfDoc[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as CurriculumPdfDoc[];
      setCurriculums(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching curriculums:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const subjectsList = useMemo(() => {
    switch (uploadCurrType) {
      case "Cambridge":
        return CAMBRIDGE_SUBJECTS;
      case "Montessori":
        return MONTESSORI_SUBJECTS;
      case "GES":
      default:
        return GES_SUBJECTS;
    }
  }, [uploadCurrType]);

  const filterSubjectsList = useMemo(() => {
    switch (selectedCurrType) {
      case "Cambridge":
        return CAMBRIDGE_SUBJECTS;
      case "Montessori":
        return MONTESSORI_SUBJECTS;
      case "GES":
      default:
        return GES_SUBJECTS;
    }
  }, [selectedCurrType]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPickedFile(asset);
        if (!uploadTitle) {
          setUploadTitle(asset.name.replace(/\.[^/.]+$/, ""));
        }
        showToast({ message: "PDF file selected successfully!", type: "success" });
      }
    } catch (err) {
      console.error("Error picking document:", err);
      showToast({ message: "Failed to pick PDF file.", type: "error" });
    }
  };

  const handleSaveCurriculumPdf = async () => {
    if (!uploadTitle.trim()) {
      showToast({ message: "Please enter a document title.", type: "error" });
      return;
    }
    if (!uploadSubject) {
      showToast({ message: "Please select a subject.", type: "error" });
      return;
    }
    if (!pickedFile) {
      showToast({ message: "Please select a PDF file.", type: "error" });
      return;
    }

    try {
      setUploading(true);

      // Copy file to local document directory for offline persistence
      let localUri = pickedFile.uri;
      if (Platform.OS !== 'web') {
        const fileName = `${Date.now()}_${pickedFile.name || 'curriculum.pdf'}`;
        const destinationUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({
          from: pickedFile.uri,
          to: destinationUri,
        });
        localUri = destinationUri;
      }

      await addDoc(collection(db, "curriculums"), {
        title: uploadTitle.trim(),
        curriculumType: uploadCurrType,
        subject: uploadSubject,
        classLevel: uploadClassLevel,
        fileUri: localUri,
        fileName: pickedFile.name || "curriculum.pdf",
        uploadedBy: appUser?.uid || "admin",
        createdAt: serverTimestamp(),
      });

      showToast({ message: "Curriculum PDF saved locally & online!", type: "success" });
      setIsUploadModalOpen(false);
      setUploadTitle("");
      setPickedFile(null);
    } catch (err: any) {
      console.error("Error saving curriculum PDF:", err);
      showToast({ message: err.message || "Failed to save curriculum PDF.", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCurriculum = async (id: string, title: string) => {
    Alert.alert(
      "Delete Curriculum",
      `Are you sure you want to delete "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "curriculums", id));
              showToast({ message: "Curriculum deleted successfully.", type: "success" });
            } catch (err) {
              console.error("Error deleting curriculum:", err);
              showToast({ message: "Failed to delete curriculum.", type: "error" });
            }
          }
        }
      ]
    );
  };

  const filteredCurriculums = useMemo(() => {
    return curriculums.filter(c => {
      const matchType = c.curriculumType === selectedCurrType;
      const matchSubject = !selectedSubject || c.subject === selectedSubject;
      const matchSearch = !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.classLevel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSubject && matchSearch;
    });
  }, [curriculums, selectedCurrType, selectedSubject, searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <StationaryBackground />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/teacher-dashboard');
            }
          }}
          style={styles.backBtn}
        >
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Curriculum PDF Viewer</Text>
          <Text style={styles.headerSubtitle}>Offline Curriculum Library</Text>
        </View>
        {isTeacher && (
          <TouchableOpacity
            style={styles.uploadHeaderBtn}
            onPress={() => setIsUploadModalOpen(true)}
          >
            <SVGIcon name="add" size={20} color="#fff" />
            <Text style={styles.uploadHeaderText}>Upload PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Curriculum Type Selector Tabs */}
      <View style={styles.tabRow}>
        {(["GES", "Cambridge", "Montessori"] as CurriculumType[]).map(type => (
          <TouchableOpacity
            key={type}
            onPress={() => {
              setSelectedCurrType(type);
              setSelectedSubject("");
            }}
            style={[styles.tabBtn, selectedCurrType === type && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, selectedCurrType === type && styles.tabTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search & Subject Filter Bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <SVGIcon name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search curricula by title or class..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <SVGIcon name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Subject horizontal pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
        <TouchableOpacity
          onPress={() => setSelectedSubject("")}
          style={[styles.subjectChip, !selectedSubject && styles.subjectChipActive]}
        >
          <Text style={[styles.subjectChipText, !selectedSubject && styles.subjectChipTextActive]}>All Subjects</Text>
        </TouchableOpacity>
        {filterSubjectsList.map(subj => (
          <TouchableOpacity
            key={subj}
            onPress={() => setSelectedSubject(subj)}
            style={[styles.subjectChip, selectedSubject === subj && styles.subjectChipActive]}
          >
            <Text style={[styles.subjectChipText, selectedSubject === subj && styles.subjectChipTextActive]}>{subj}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading curriculum documents...</Text>
        </View>
      ) : filteredCurriculums.length === 0 ? (
        <View style={styles.emptyContainer}>
          <SVGIcon name="document-text" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Curriculum PDFs Found</Text>
          <Text style={styles.emptySubtitle}>
            {isTeacher ? "Upload a curriculum PDF to make it available offline for teachers." : "No curriculum PDFs available for this filter yet."}
          </Text>
          {isTeacher && (
            <TouchableOpacity style={styles.emptyUploadBtn} onPress={() => setIsUploadModalOpen(true)}>
              <Text style={styles.emptyUploadText}>Upload First Curriculum PDF</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filteredCurriculums.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardIconBox}>
                <SVGIcon name="document-text" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.cardDetails}>
                <View style={styles.cardBadgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.curriculumType}</Text>
                  </View>
                  <View style={[styles.badge, styles.classBadge]}>
                    <Text style={styles.classBadgeText}>{item.classLevel}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubject}>Subject: {item.subject}</Text>
                <Text style={styles.cardFileName}>File: {item.fileName}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => {
                    setActivePdfUrl(item.fileUri);
                    setActivePdfTitle(item.title);
                    setViewerModalOpen(true);
                  }}
                >
                  <SVGIcon name="eye" size={18} color="#fff" />
                  <Text style={styles.viewBtnText}>View PDF</Text>
                </TouchableOpacity>
                {(isAdmin || item.uploadedBy === appUser?.uid) && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteCurriculum(item.id, item.title)}
                  >
                    <SVGIcon name="trash" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Upload Modal */}
      <Modal
        visible={isUploadModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsUploadModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Curriculum PDF</Text>
              <TouchableOpacity onPress={() => setIsUploadModalOpen(false)}>
                <SVGIcon name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>CURRICULUM TYPE</Text>
              <View style={styles.modalTypeRow}>
                {(["GES", "Cambridge", "Montessori"] as CurriculumType[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setUploadCurrType(t);
                      setUploadSubject("");
                    }}
                    style={[styles.modalTypeBtn, uploadCurrType === t && styles.modalTypeBtnActive]}
                  >
                    <Text style={[styles.modalTypeText, uploadCurrType === t && styles.modalTypeTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>DOCUMENT TITLE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Mathematics Primary 1 Curriculum"
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />

              <Text style={styles.inputLabel}>SUBJECT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalSubjectScroll}>
                {subjectsList.map(subj => (
                  <TouchableOpacity
                    key={subj}
                    onPress={() => setUploadSubject(subj)}
                    style={[styles.modalSubjectChip, uploadSubject === subj && styles.modalSubjectChipActive]}
                  >
                    <Text style={[styles.modalSubjectChipText, uploadSubject === subj && styles.modalSubjectChipTextActive]}>{subj}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>CLASS LEVEL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Primary 1, JSS 2, Kindergarten"
                value={uploadClassLevel}
                onChangeText={setUploadClassLevel}
              />

              <Text style={styles.inputLabel}>PDF FILE (OFFLINE STORAGE)</Text>
              <TouchableOpacity style={styles.filePickerBtn} onPress={handlePickDocument}>
                <SVGIcon name="document-attach" size={20} color={COLORS.primary} />
                <Text style={styles.filePickerText} numberOfLines={1}>
                  {pickedFile ? pickedFile.name : "Select PDF from device..."}
                </Text>
              </TouchableOpacity>
              {pickedFile && (
                <Text style={styles.fileSelectedNote}>✓ Ready to save locally for offline access.</Text>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, uploading && { opacity: 0.7 }]}
                onPress={handleSaveCurriculumPdf}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <SVGIcon name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Save & Store Offline</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PDF Viewer Modal */}
      <Modal
        visible={viewerModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setViewerModalOpen(false)}
      >
        <SafeAreaView style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity onPress={() => setViewerModalOpen(false)} style={styles.viewerCloseBtn}>
              <SVGIcon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.viewerHeaderTitle} numberOfLines={1}>{activePdfTitle}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {activePdfUrl ? (
              <WebView
                source={{
                  uri: Platform.OS === 'web'
                    ? activePdfUrl
                    : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(activePdfUrl)}`
                }}
                style={{ flex: 1 }}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.viewerLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                )}
              />
            ) : (
              <View style={styles.centerContainer}>
                <Text>No PDF source available</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFCF0',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  uploadHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  uploadHeaderText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#fff',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  subjectScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 54,
  },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    height: 36,
    justifyContent: 'center',
  },
  subjectChipActive: {
    backgroundColor: COLORS.primary,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  subjectChipTextActive: {
    color: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  emptyUploadBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyUploadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardDetails: {
    flex: 1,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  classBadge: {
    backgroundColor: '#F0FDF4',
  },
  classBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  cardSubject: {
    fontSize: 12,
    color: '#64748B',
  },
  cardFileName: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    marginTop: 12,
  },
  modalTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTypeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalTypeTextActive: {
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: '#1E293B',
  },
  modalSubjectScroll: {
    maxHeight: 46,
  },
  modalSubjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    height: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalSubjectChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalSubjectChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSubjectChipTextActive: {
    color: '#fff',
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  filePickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  fileSelectedNote: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  viewerHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  viewerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  viewerHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  viewerLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
