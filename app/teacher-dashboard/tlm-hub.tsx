import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
    collection,
    deleteDoc,
    doc,
    query,
    serverTimestamp,
    setDoc,
    where
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions, storage } from "../../firebaseConfig";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

const { width } = Dimensions.get("window");

interface TLM {
  id: string;
  title: string;
  subject: string;
  topic: string;
  type: "image" | "video" | "pdf" | "link";
  url: string;
  thumbnail?: string;
  isSaved?: boolean;
  userId?: string;
  description?: string;
}

type TabType = "discovery" | "saved";

export default function TLMHub() {
  const router = useRouter();
  const { appUser } = useAuth();
  const primary = SCHOOL_CONFIG.primaryColor;

  const [activeTab, setActiveTab] = useState<TabType>("discovery");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [discoveryResults, setDiscoveryResults] = useState<TLM[]>([]);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [savedTlms, setSavedTlms] = useState<TLM[]>([]);
  const [searchCache, setSearchCache] = useState<
    Record<string, { results: TLM[]; tip: string | null }>
  >({});
  const [loading, setLoading] = useState(false);
  const [fetchingSaved, setFetchingSaved] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form State for new TLM
  const [newTlm, setNewTlm] = useState({
    title: "",
    subject: "",
    topic: "",
    type: "link" as TLM["type"],
    url: "",
    thumbnail: "",
  });

  // Fetch saved TLMs with Offline Optimization
  const fetchSavedMaterials = async () => {
    if (!appUser?.uid) return;
    setFetchingSaved(true);
    try {
      const q = query(
        collection(db, "tlms"),
        where("userId", "==", appUser.uid),
      );

      const snapshot = await getDocsCacheFirst(q);
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        isSaved: true,
      })) as TLM[];
      setSavedTlms(items);
    } catch (error) {
      console.error("Error fetching saved TLMs:", error);
    } finally {
      setFetchingSaved(false);
    }
  };

  useEffect(() => {
    fetchSavedMaterials();
  }, [appUser?.uid]); // Removed activeTab to prevent unnecessary re-fetches on switch

  const searchMaterials = async () => {
    if (!topic) {
      Alert.alert("Error", "Please enter a topic to search");
      return;
    }

    const cacheKey = `${subject}-${topic}`.toLowerCase().trim();
    if (searchCache[cacheKey]) {
      const cached = searchCache[cacheKey];
      setDiscoveryResults(
        cached.results.map((r) => ({
          ...r,
          isSaved: savedTlms.some((s) => s.url === r.url),
        })),
      );
      setAiTip(cached.tip);
      return;
    }

    setLoading(true);
    setAiTip(null);

    try {
      // 1. Fetch Videos via YouTube Proxy
      const searchFn = httpsCallable(functions, "searchYouTube");
      const { data: ytData } = (await searchFn({
        query: `${subject} ${topic}`,
        maxResults: 6,
      })) as { data: any[] };

      const youtubeResults: TLM[] = ytData.map((item) => ({
        id: item.id,
        title: item.title,
        subject: subject || "General",
        topic: topic,
        type: "video",
        url: item.url,
        thumbnail: item.thumbnail,
        description: item.description,
        isSaved: savedTlms.some((s) => s.url === item.url),
      }));

      setDiscoveryResults(youtubeResults);

      // 2. Fetch AI Teaching Tip
      const aiFn = httpsCallable(functions, "aiSearch");
      const { data: aiData } = (await aiFn({
        queryText: `Give me 3 creative and low-cost teaching aid (TLM) ideas for teaching ${topic} in ${subject || "class"}. Keep it brief.`,
        schoolName: SCHOOL_CONFIG.name,
      })) as { data: { text: string } };

      if (aiData?.text) {
        setAiTip(aiData.text);
      }

      // Cache results
      setSearchCache((prev) => ({
        ...prev,
        [cacheKey]: { results: youtubeResults, tip: aiData?.text || null },
      }));
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        "Failed to fetch materials. Check your internet connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTlm = async (item: TLM) => {
    if (loading) return; // Prevent rapid duplicate clicks

    // Generate a deterministic ID to prevent duplicates (UserId + ResourceId/URL)
    const resourceId = item.id || encodeURIComponent(item.url).substring(0, 50);
    const docId = `${appUser?.uid}_${resourceId}`;
    const docRef = doc(db, "tlms", docId);

    try {
      if (item.isSaved) {
        await deleteDoc(docRef);
        setSavedTlms((prev) => prev.filter((s) => s.url !== item.url));
        setDiscoveryResults((prev) =>
          prev.map((p) => (p.url === item.url ? { ...p, isSaved: false } : p)),
        );
        Alert.alert("Success", "Removed from saved list");
      } else {
        const tlmData = {
          ...item,
          userId: appUser?.uid,
          createdAt: serverTimestamp(),
          isSaved: true,
        };

        await setDoc(docRef, tlmData);

        const newSaved = { ...item, id: docId, isSaved: true };
        setSavedTlms((prev) => [newSaved, ...prev]);
        setDiscoveryResults((prev) =>
          prev.map((p) => (p.url === item.url ? { ...p, isSaved: true } : p)),
        );
        Alert.alert("Success", "Material saved for offline use!");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update saved materials");
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "video/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;

      const file = result.assets[0];
      const { uri, name, mimeType } = file;

      // Determine type
      let type: TLM["type"] = "link";
      if (mimeType?.startsWith("image/")) type = "image";
      else if (mimeType?.startsWith("video/")) type = "video";
      else if (mimeType === "application/pdf") type = "pdf";

      setUploading(true);
      setUploadProgress(0);

      // Upload to Firebase Storage
      const extension = name.split(".").pop();
      const fileName = `tlm_${appUser?.uid}_${Date.now()}.${extension}`;
      const storageRef = ref(storage, `tlms/${appUser?.uid}/${fileName}`);

      const response = await fetch(uri);
      const blob = await response.blob();

      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          setUploading(false);
          Alert.alert("Error", "Failed to upload file");
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          let thumbnail = "";

          if (type === "video") {
            try {
              const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(
                uri,
                {
                  time: 1000,
                },
              );
              // Upload thumbnail too or just use a generic one?
              // For simplicity, we'll use a generic icon or try to upload the thumb
              thumbnail = thumbUri; // Local URI might not persist well if we don't upload it, but for now...
            } catch (e) {
              console.warn("Could not generate thumbnail", e);
            }
          } else if (type === "image") {
            thumbnail = downloadURL;
          }

          setNewTlm((prev) => ({
            ...prev,
            title: prev.title || name,
            url: downloadURL,
            type: type,
            thumbnail: thumbnail,
          }));
          setUploading(false);
          Alert.alert("Success", "File uploaded and ready to add!");
        },
      );
    } catch (error) {
      console.error("Pick error:", error);
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const handleManualUpload = async () => {
    if (!newTlm.title || !newTlm.url || !newTlm.subject || !newTlm.topic) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      // Use URL as unique identifier to prevent duplicate uploads of same resource
      const resourceId = encodeURIComponent(newTlm.url).substring(0, 50);
      const docId = `${appUser?.uid}_${resourceId}`;

      await setDoc(doc(db, "tlms", docId), {
        ...newTlm,
        id: resourceId,
        userId: appUser?.uid,
        createdAt: serverTimestamp(),
      });
      setShowAddModal(false);
      setNewTlm({
        title: "",
        subject: "",
        topic: "",
        type: "link",
        url: "",
        thumbnail: "",
      });
      fetchSavedMaterials();
      Alert.alert("Success", "TLM Uploaded successfully");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to upload TLM");
    } finally {
      setLoading(false);
    }
  };

  const renderTlmItem = (item: TLM) => (
    <Animatable.View animation="fadeInUp" key={item.id} style={styles.tlmCard}>
      <Image
        source={{ uri: item.thumbnail || "https://via.placeholder.com/150" }}
        style={styles.tlmThumbnail}
      />
      <View style={styles.tlmInfo}>
        <View style={styles.tlmHeader}>
          <Text style={styles.tlmTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: getTypeColor(item.type) + "20" },
            ]}
          >
            <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
              {item.type.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.tlmMeta}>
          {item.subject} • {item.topic}
        </Text>

        <View style={styles.tlmActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: primary }]}
            onPress={() => Linking.openURL(item.url)}
          >
            <SVGIcon name="play-circle-outline" size={16} color={primary} />
            <Text style={[styles.actionText, { color: primary }]}>View</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: item.isSaved ? "#EF4444" : primary,
                borderColor: item.isSaved ? "#EF4444" : primary,
              },
            ]}
            onPress={() => handleSaveTlm(item)}
          >
            <SVGIcon
              name={item.isSaved ? "trash-outline" : "bookmark-outline"}
              size={16}
              color="#FFF"
            />
            <Text style={[styles.actionText, { color: "#FFF" }]}>
              {item.isSaved ? "Remove" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animatable.View>
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case "video":
        return "#FF4444";
      case "image":
        return "#4D96FF";
      case "pdf":
        return "#6BCB77";
      default:
        return "#F59E0B";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>TLM Hub 🎓</Text>
          <Text style={styles.subtitle}>AI-Powered Learning Materials</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <SVGIcon name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "discovery" && {
              borderBottomColor: primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setActiveTab("discovery")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "discovery" && {
                color: primary,
                fontWeight: "800",
              },
            ]}
          >
            Discovery
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "saved" && {
              borderBottomColor: primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setActiveTab("saved")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "saved" && { color: primary, fontWeight: "800" },
            ]}
          >
            Saved Assets
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "discovery" ? (
          <>
            {/* Search Section */}
            <View style={styles.searchSection}>
              <Text style={styles.label}>What are you teaching today?</Text>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Subject (e.g. Science)"
                  value={subject}
                  onChangeText={setSubject}
                />
                <TextInput
                  style={[styles.input, { marginTop: 12 }]}
                  placeholder="Topic (e.g. Solar System)"
                  value={topic}
                  onChangeText={setTopic}
                />
              </View>
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: primary }]}
                onPress={searchMaterials}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <SVGIcon name="sparkles" size={20} color="#FFF" />
                    <Text style={styles.searchBtnText}>Generate with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Results */}
            <View style={styles.listSection}>
              {aiTip && (
                <Animatable.View animation="fadeIn" style={styles.aiTipCard}>
                  <View style={styles.aiTipHeader}>
                    <SVGIcon name="bulb" size={20} color="#F59E0B" />
                    <Text style={styles.aiTipTitle}>AI Teaching Tips</Text>
                  </View>
                  <Text style={styles.aiTipText}>{aiTip}</Text>
                </Animatable.View>
              )}

              <Text style={styles.sectionTitle}>
                {loading
                  ? "Searching YouTube & AI..."
                  : discoveryResults.length > 0
                    ? "Recommended for your Class"
                    : "Search to find teaching aids"}
              </Text>

              {discoveryResults.map((item) => renderTlmItem(item))}
            </View>
          </>
        ) : (
          <View style={styles.listSection}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 15,
              }}
            >
              <Text style={styles.sectionTitle}>Offline-Ready Materials</Text>
              {fetchingSaved && (
                <ActivityIndicator size="small" color={primary} />
              )}
            </View>

            {savedTlms.length === 0 && !fetchingSaved ? (
              <View style={styles.emptyState}>
                <SVGIcon name="bookmark-outline" size={60} color="#CBD5E1" />
                <Text style={styles.emptyText}>No saved materials yet.</Text>
                <Text style={styles.emptySubtext}>
                  Save items from Discovery to access them quickly here.
                </Text>
              </View>
            ) : (
              savedTlms.map((item) => renderTlmItem(item))
            )}
          </View>
        )}
      </ScrollView>

      {/* Manual Upload Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Resource</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <SVGIcon name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Parts of a Plant Diagram"
                value={newTlm.title}
                onChangeText={(t) => setNewTlm({ ...newTlm, title: t })}
              />

              <View style={{ flexDirection: "row", gap: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Subject</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Science"
                    value={newTlm.subject}
                    onChangeText={(t) => setNewTlm({ ...newTlm, subject: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Topic</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Botany"
                    value={newTlm.topic}
                    onChangeText={(t) => setNewTlm({ ...newTlm, topic: t })}
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Resource Type</Text>
              <View style={styles.typeSelector}>
                {(["link", "image", "video", "pdf"] as TLM["type"][]).map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        newTlm.type === type && {
                          backgroundColor: primary,
                          borderColor: primary,
                        },
                      ]}
                      onPress={() => setNewTlm({ ...newTlm, type: type })}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          newTlm.type === type && { color: "#FFF" },
                        ]}
                      >
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <Text style={styles.modalLabel}>URL / Web Link</Text>
              <View style={styles.urlInputContainer}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="https://..."
                  value={newTlm.url}
                  onChangeText={(t) => setNewTlm({ ...newTlm, url: t })}
                />
                <TouchableOpacity
                  style={[styles.fileBtn, { backgroundColor: primary + "15" }]}
                  onPress={handlePickFile}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={primary} />
                  ) : (
                    <SVGIcon name="cloud-upload" size={20} color={primary} />
                  )}
                </TouchableOpacity>
              </View>

              {uploading && (
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${uploadProgress}%`, backgroundColor: primary },
                    ]}
                  />
                  <Text style={styles.progressText}>
                    {Math.round(uploadProgress)}% uploaded
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: primary }]}
                onPress={handleManualUpload}
              >
                <Text style={styles.uploadBtnText}>Add to Library</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  title: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  subtitle: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94A3B8",
  },
  content: { padding: 20 },
  searchSection: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.medium,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 15,
  },
  inputGroup: { marginBottom: 20 },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: "500",
  },
  searchBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    ...SHADOWS.small,
  },
  searchBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  listSection: { marginTop: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 15,
  },
  tlmCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    marginBottom: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  tlmThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  tlmInfo: { flex: 1, marginLeft: 15, justifyContent: "space-between" },
  tlmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 5,
  },
  tlmTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    flex: 1,
    lineHeight: 20,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeText: { fontSize: 9, fontWeight: "900" },
  tlmMeta: { fontSize: 12, color: "#64748B", fontWeight: "600", marginTop: 4 },
  tlmActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  actionText: { fontSize: 12, fontWeight: "800" },

  aiTipCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  aiTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  aiTipTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#B45309",
    textTransform: "uppercase",
  },
  aiTipText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
    fontWeight: "500",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  modalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 8,
    marginTop: 15,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },
  typeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 5,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  typeChipText: { fontSize: 12, fontWeight: "800", color: "#64748B" },
  uploadBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 35,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  uploadBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  urlInputContainer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  fileBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    marginTop: 10,
    height: 20,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  progressBar: {
    height: "100%",
    position: "absolute",
    left: 0,
    top: 0,
  },
  progressText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
    zIndex: 1,
  },
});
