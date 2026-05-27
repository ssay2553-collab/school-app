import NetInfo from "@react-native-community/netinfo";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import debounce from "lodash.debounce";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";

import * as Animatable from "react-native-animatable";

import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions, storage } from "../../firebaseConfig";

const { width } = Dimensions.get("window");

const MAX_FILE_SIZE = 20 * 1024 * 1024;

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

  const isMounted = useRef(true);
  const latestSearchRef = useRef(0);

  const [activeTab, setActiveTab] = useState<TabType>("discovery");

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");

  const [discoveryResults, setDiscoveryResults] = useState<TLM[]>([]);

  const [savedTlms, setSavedTlms] = useState<TLM[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetchingSaved, setFetchingSaved] = useState(false);

  const [savingIds, setSavingIds] = useState<string[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const [aiTip, setAiTip] = useState<string | null>(null);

  const [searchCache, setSearchCache] = useState<
    Record<
      string,
      {
        results: TLM[];
        tip: string | null;
      }
    >
  >({});

  const [newTlm, setNewTlm] = useState({
    title: "",
    subject: "",
    topic: "",
    type: "link" as TLM["type"],
    url: "",
    thumbnail: "",
  });

  const handleAddCustomTlm = async () => {
    if (!newTlm.title || !newTlm.subject || !newTlm.topic || !newTlm.url) {
      Alert.alert("Error", "Please fill all required fields and upload/link a resource.");
      return;
    }

    if (!appUser?.uid) return;

    try {
      setLoading(true);
      const resourceId = `custom_${Date.now()}`;
      const docId = `${appUser.uid}_${resourceId}`;
      const docRef = doc(db, "tlms", docId);

      const tlmData = {
        ...newTlm,
        id: resourceId,
        userId: appUser.uid,
        createdAt: serverTimestamp(),
        isSaved: true,
      };

      await setDoc(docRef, tlmData);

      const newSaved = {
        ...tlmData,
        id: docId,
        isSaved: true,
      } as TLM;

      setSavedTlms((prev) => [newSaved, ...prev]);
      setShowAddModal(false);
      setNewTlm({
        title: "",
        subject: "",
        topic: "",
        type: "link",
        url: "",
        thumbnail: "",
      });

      Alert.alert("Success", "Resource added to your hub.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save resource.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getTypeColor = (type: TLM["type"]) => {
    switch (type) {
      case "video":
        return "#EF4444";
      case "image":
        return "#10B981";
      case "pdf":
        return "#3B82F6";
      default:
        return "#8B5CF6";
    }
  };

  const checkInternet = async () => {
    const net = await NetInfo.fetch();

    if (!net.isConnected) {
      Alert.alert("No Internet", "Please check your internet connection.");
      return false;
    }

    return true;
  };

  const fetchSavedMaterials = useCallback(async () => {
    if (!appUser?.uid) return;

    try {
      setFetchingSaved(true);

      const q = query(
        collection(db, "tlms"),
        where("userId", "==", appUser.uid),
        limit(50),
      );

      const snapshot = await getDocsFromServer(q as any);

      if (!isMounted.current) return;

      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
        isSaved: true,
      })) as TLM[];

      setSavedTlms(items);
    } catch (error) {
      console.error(error);

      Alert.alert("Error", "Failed to load saved materials.");
    } finally {
      if (isMounted.current) {
        setFetchingSaved(false);
      }
    }
  }, [appUser?.uid]);

  useEffect(() => {
    fetchSavedMaterials();
  }, [fetchSavedMaterials]);

  const searchMaterials = async () => {
    if (!topic.trim()) {
      Alert.alert("Required", "Please enter a topic.");
      return;
    }

    const hasInternet = await checkInternet();

    if (!hasInternet) return;

    const requestId = Date.now();

    latestSearchRef.current = requestId;

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

    try {
      setLoading(true);
      setAiTip(null);

      const ytFn = httpsCallable(functions, "searchYouTube");

      const { data: ytData } = (await ytFn({
        query: `${subject} ${topic}`,
        maxResults: 8,
      })) as { data: any[] };

      if (latestSearchRef.current !== requestId) {
        return;
      }

      const youtubeResults: TLM[] = ytData.map((item) => ({
        id: item.id,
        title: item.title,
        subject: subject || "General",
        topic,
        type: "video",
        url: item.url,
        thumbnail: item.thumbnail,
        description: item.description,
        isSaved: savedTlms.some((s) => s.url === item.url),
      }));

      if (!isMounted.current) return;

      setDiscoveryResults(youtubeResults);

      const aiFn = httpsCallable(functions, "aiSearch");

      const { data: aiData } = (await aiFn({
        queryText: `Give me 3 creative and low-cost teaching aid ideas for teaching ${topic} in ${subject || "class"}. Keep it brief.`,
        schoolName: SCHOOL_CONFIG.name,
      })) as {
        data: {
          text: string;
        };
      };

      if (latestSearchRef.current !== requestId) {
        return;
      }

      if (aiData?.text) {
        setAiTip(aiData.text);
      }

      setSearchCache((prev) => ({
        ...prev,
        [cacheKey]: {
          results: youtubeResults,
          tip: aiData?.text || null,
        },
      }));
    } catch (error) {
      console.error(error);

      Alert.alert("Error", "Failed to fetch learning materials.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const debouncedSearch = useMemo(
    () =>
      debounce(() => {
        searchMaterials();
      }, 700),
    [subject, topic, savedTlms],
  );

  const openUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Invalid URL", "Cannot open this resource.");

        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Error", "Failed to open resource.");
    }
  };

  const handleSaveTlm = async (item: TLM) => {
    if (!appUser?.uid) return;

    const resourceId = item.id || encodeURIComponent(item.url).substring(0, 50);

    const docId = `${appUser.uid}_${resourceId}`;

    const docRef = doc(db, "tlms", docId);

    try {
      setSavingIds((prev) => [...prev, item.id]);

      if (item.isSaved) {
        await deleteDoc(docRef);

        setSavedTlms((prev) => prev.filter((s) => s.url !== item.url));

        setDiscoveryResults((prev) =>
          prev.map((p) =>
            p.url === item.url
              ? {
                  ...p,
                  isSaved: false,
                }
              : p,
          ),
        );
      } else {
        const tlmData = {
          ...item,
          userId: appUser.uid,
          createdAt: serverTimestamp(),
          isSaved: true,
        };

        await setDoc(docRef, tlmData);

        const newSaved = {
          ...item,
          id: docId,
          isSaved: true,
        };

        setSavedTlms((prev) => [newSaved, ...prev]);

        setDiscoveryResults((prev) =>
          prev.map((p) =>
            p.url === item.url
              ? {
                  ...p,
                  isSaved: true,
                }
              : p,
          ),
        );
      }
    } catch (error) {
      console.error(error);

      Alert.alert("Error", "Failed to update saved materials.");
    } finally {
      setSavingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "video/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const file = result.assets[0];

      if (file.size && file.size > MAX_FILE_SIZE) {
        Alert.alert("File Too Large", "Maximum allowed size is 20MB.");

        return;
      }

      const { uri, name, mimeType } = file;

      let type: TLM["type"] = "link";

      if (mimeType?.startsWith("image/")) {
        type = "image";
      } else if (mimeType?.startsWith("video/")) {
        type = "video";
      } else if (mimeType === "application/pdf") {
        type = "pdf";
      }

      setUploading(true);
      setUploadProgress(0);

      let uploadUri = uri;

      if (type === "image") {
        const compressed = await ImageManipulator.manipulateAsync(uri, [], {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        });

        uploadUri = compressed.uri;
      }

      const extension = name.split(".").pop();

      const fileName = `tlm_${appUser?.uid}_${Date.now()}.${extension}`;

      const storageRef = ref(storage, `tlms/${appUser?.uid}/${fileName}`);

      const response = await fetch(uploadUri);

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
          console.error(error);

          setUploading(false);

          Alert.alert("Upload Failed", "Failed to upload file.");
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

              thumbnail = thumbUri;
            } catch (e) {
              console.warn(e);
            }
          } else if (type === "image") {
            thumbnail = downloadURL;
          }

          setNewTlm((prev) => ({
            ...prev,
            title: prev.title || name,
            url: downloadURL,
            type,
            thumbnail,
          }));

          setUploading(false);

          Alert.alert("Success", "File uploaded successfully.");
        },
      );
    } catch (error) {
      console.error(error);

      Alert.alert("Error", "Failed to pick file.");
    }
  };

  const renderTlmItem = ({ item }: { item: TLM }) => {
    const saving = savingIds.includes(item.id);

    return (
      <Animatable.View animation="fadeInUp" style={styles.tlmCard}>
        <Image
          source={{
            uri: item.thumbnail || "https://via.placeholder.com/150",
          }}
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
                {
                  backgroundColor: getTypeColor(item.type) + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.typeText,
                  {
                    color: getTypeColor(item.type),
                  },
                ]}
              >
                {item.type.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.tlmMeta}>
            {item.subject} • {item.topic}
          </Text>

          <View style={styles.tlmActions}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderColor: primary,
                },
              ]}
              onPress={() => openUrl(item.url)}
            >
              <SVGIcon name="play-circle-outline" size={16} color={primary} />

              <Text
                style={[
                  styles.actionText,
                  {
                    color: primary,
                  },
                ]}
              >
                View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={saving}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: item.isSaved ? "#EF4444" : primary,
                  borderColor: item.isSaved ? "#EF4444" : primary,
                },
              ]}
              onPress={() => handleSaveTlm(item)}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <SVGIcon
                    name={item.isSaved ? "trash-outline" : "bookmark-outline"}
                    size={16}
                    color="#FFF"
                  />

                  <Text
                    style={[
                      styles.actionText,
                      {
                        color: "#FFF",
                      },
                    ]}
                  >
                    {item.isSaved ? "Remove" : "Save"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>TLM Hub</Text>

        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <SVGIcon name="add-circle-outline" size={28} color={primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "discovery" && { borderBottomColor: primary }]}
          onPress={() => setActiveTab("discovery")}
        >
          <Text style={[styles.tabText, activeTab === "discovery" && { color: primary, fontWeight: "700" }]}>
            Discovery
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "saved" && { borderBottomColor: primary }]}
          onPress={() => setActiveTab("saved")}
        >
          <Text style={[styles.tabText, activeTab === "saved" && { color: primary, fontWeight: "700" }]}>
            My Hub
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "discovery" && (
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Subject"
            value={subject}
            onChangeText={setSubject}
            style={styles.input}
          />

          <TextInput
            placeholder="Topic"
            value={topic}
            onChangeText={setTopic}
            style={styles.input}
          />

          <TouchableOpacity
            style={[
              styles.searchBtn,
              {
                backgroundColor: primary,
              },
            ]}
            onPress={() => debouncedSearch()}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.searchText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {activeTab === "discovery" && aiTip && (
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>AI Teaching Tip</Text>

          <Text style={styles.tipText}>{aiTip}</Text>
        </View>
      )}

      <FlatList
        data={activeTab === "saved" ? savedTlms : discoveryResults}
        keyExtractor={(item) => item.id}
        renderItem={renderTlmItem}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Materials Found</Text>

            <Text style={styles.emptySubtitle}>
              Search for teaching materials to begin.
            </Text>
          </View>
        )}
      />

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Resource</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <SVGIcon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter resource title"
                  value={newTlm.title}
                  onChangeText={(text) => setNewTlm({ ...newTlm, title: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mathematics"
                  value={newTlm.subject}
                  onChangeText={(text) => setNewTlm({ ...newTlm, subject: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Topic</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Addition"
                  value={newTlm.topic}
                  onChangeText={(text) => setNewTlm({ ...newTlm, topic: text })}
                />
              </View>

              <TouchableOpacity
                style={[styles.uploadBox, uploading && styles.disabledBtn]}
                onPress={handlePickFile}
                disabled={uploading}
              >
                {uploading ? (
                  <View style={styles.uploadInfo}>
                    <ActivityIndicator color={primary} />
                    <Text style={styles.uploadText}>Uploading... {Math.round(uploadProgress)}%</Text>
                  </View>
                ) : newTlm.url ? (
                  <View style={styles.uploadInfo}>
                    <SVGIcon name="checkmark-circle" size={32} color="#10B981" />
                    <Text style={styles.uploadText}>File Ready</Text>
                  </View>
                ) : (
                  <View style={styles.uploadInfo}>
                    <SVGIcon name="cloud-upload-outline" size={32} color={primary} />
                    <Text style={styles.uploadText}>Upload Document, Image or Video</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.orDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.orText}>OR LINK</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>External URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  value={newTlm.url}
                  onChangeText={(text) => setNewTlm({ ...newTlm, url: text, type: 'link' })}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primary }]}
                onPress={handleAddCustomTlm}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save to Hub</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },

  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },

  searchContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 10,
  },

  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  tabText: {
    fontSize: 15,
    color: "#6B7280",
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },

  searchBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  searchText: {
    color: "#FFF",
    fontWeight: "700",
  },

  tlmCard: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF",
    borderRadius: 18,
    overflow: "hidden",
    ...SHADOWS.medium,
  },

  tlmThumbnail: {
    width: 120,
    height: 120,
  },

  tlmInfo: {
    flex: 1,
    padding: 14,
  },

  tlmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  tlmTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 10,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  typeText: {
    fontSize: 10,
    fontWeight: "700",
  },

  tlmMeta: {
    marginTop: 8,
    color: "#6B7280",
  },

  tlmActions: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  actionText: {
    fontWeight: "600",
  },

  tipCard: {
    margin: 20,
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
  },

  tipTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },

  tipText: {
    lineHeight: 22,
    color: "#374151",
  },

  emptyState: {
    alignItems: "center",
    marginTop: 80,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  emptySubtitle: {
    marginTop: 8,
    color: "#6B7280",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadInfo: {
    alignItems: 'center',
    gap: 12,
  },
  uploadText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
