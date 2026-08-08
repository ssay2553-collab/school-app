import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import {
    addDoc,
    updateDoc,
    collection,
    deleteDoc,
    doc,
    getDocsFromServer,
    query,
    serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    FlatList,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Platform,
    RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import NewsCard from "../../components/news/NewsCard";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions } from "../../firebaseConfig";
import { Audience, NewsItem } from "../../types/news";
import SVGIcon from "../../components/SVGIcon";
import moment from "moment";
const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import { SCHOOL_CONFIG } from "../../constants/Config";

import { useToast } from "../../contexts/ToastContext";

const storage = getStorage();

const webInputStyle = Platform.OS === 'web' ? {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  fontSize: '16px',
  width: '100%',
  marginBottom: '10px'
} : {};

const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  return await response.blob();
};

const AUDIENCE_COLORS = {
  all: "#6366F1",
  teacher: "#10B981",
  student: "#F59E0B",
  parent: "#EC4899",
};

export default function NewsCenter() {
  const { appUser, loading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [media, setMedia] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);
  const [bdayTriggerLoading, setBdayTriggerLoading] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;

  const canPostNews = appUser?.role === "admin";
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    if (!appUser) return;
    setScreenLoading(true);
    try {
      const q = query(collection(db, "news"));
      const snapshot = await getDocsFromServer(q as any);
      const list = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }) as NewsItem,
      );
      // For Admin, show all news. For others, filter.
      const filtered = appUser.role === "admin"
        ? list
        : list.filter((n) => n.audience === "all" || n.audience === appUser.role);

      filtered.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );
      setNews(filtered);
    } catch (err) {
      console.error("Fetch news error:", err);
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [appUser]);

  useEffect(() => {
    if (!loading) fetchNews();
  }, [loading, fetchNews]);

  useEffect(() => {
    const onBackPress = () => {
      if (mode === "create" || mode === "edit") {
        setMode("view");
        setEditingId(null);
        setTitle("");
        setContent("");
        setAudience("all");
        setMedia(null);
        setExpiryDate(null);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [mode]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNews();
  };

  const handleTriggerBirthdays = async () => {
    setBdayTriggerLoading(true);
    try {
      const triggerFn = httpsCallable(functions, "triggerBirthdayCheckManually");
      const result: any = await triggerFn();
      showToast({
        message: `Birthday Check: Processed ${result.data.count} new wishes!`,
        type: "success",
      });
      fetchNews();
    } catch (err: any) {
      showToast({
        message: err.message || "Failed to trigger birthday check.",
        type: "error",
      });
    } finally {
      setBdayTriggerLoading(false);
    }
  };

  const pickMedia = async (type: "image" | "video") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === "image" ? ['images'] : ['videos'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setMedia({ uri: result.assets[0].uri, type });
      }
    } catch (err) {
      console.error("Pick media error:", err);
      showToast({ message: "Could not access library.", type: "error" });
    }
  };

  const handlePostNews = async () => {
    if (!title.trim() || !content.trim()) {
      return showToast({
        message: "Please provide both a title and content.",
        type: "error",
      });
    }
    setScreenLoading(true);
    try {
      let mediaUrl = media?.uri || null;
      let mediaType = media?.type || null;

      // Only upload if it's a local URI (starts with 'file' or 'content' or 'ph')
      if (media && (media.uri.startsWith('file') || media.uri.startsWith('content') || media.uri.startsWith('ph'))) {
        const response = await fetch(media.uri);
        const blob = await response.blob();
        const fileName = `${Date.now()}_${media.type}`;
        const storageRef = ref(storage, `newsMedia/${fileName}`);

        const metadata = {
          contentType: media.type === "image" ? "image/jpeg" : "video/mp4",
        };

        await uploadBytes(storageRef, blob, metadata);
        mediaUrl = await getDownloadURL(storageRef);

        // Dispose of the blob to free memory
        if (typeof blob.close === 'function') {
          (blob as any).close();
        }
      }

      const newsData: any = {
        title: title.trim(),
        content: content.trim(),
        audience,
        mediaUrl,
        mediaType,
        author: appUser?.adminRole || "Admin",
        category: "Announcement",
        expiryDate: expiryDate ? expiryDate : null,
      };

      if (mode === "edit" && editingId) {
        await updateDoc(doc(db, "news", editingId), {
          ...newsData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "news"), {
          ...newsData,
          createdAt: serverTimestamp(),
        });
      }

      setTitle("");
      setContent("");
      setMedia(null);
      setExpiryDate(null);
      setMode("view");
      setEditingId(null);
      showToast({
        message: mode === "edit" ? "Announcement updated." : "News broadcast published.",
        type: "success"
      });
      fetchNews();
    } catch (error: any) {
      console.error("Post news error:", error);
      showToast({ message: `Failed to save: ${error.message}`, type: "error" });
    } finally {
      setScreenLoading(false);
    }
  };

  const handleEdit = (item: NewsItem) => {
    setTitle(item.title);
    setContent(item.content);
    setAudience(item.audience);
    setExpiryDate(item.expiryDate ? (item.expiryDate as any).toDate() : null);
    if (item.mediaUrl) {
      setMedia({ uri: item.mediaUrl, type: item.mediaType || "image" });
    } else {
      setMedia(null);
    }
    setEditingId(item.id);
    setMode("edit");
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, "news", id));
        setNews((prev) => prev.filter((n) => n.id !== id));
        showToast({ message: "Announcement deleted.", type: "success" });
      } catch (err) {
        showToast({ message: "Could not delete news.", type: "error" });
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to remove this announcement?")) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete News",
        "Are you sure you want to remove this announcement?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ],
      );
    }
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[brandPrimary, brandSecondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.headerArea}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.miniBtn}>
          <SVGIcon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleCenter}>
          <Text style={styles.headerTitleText}>News Center</Text>
          <Text style={styles.headerSub}>Broadcast Announcements</Text>
        </View>
        {canPostNews ? (
          <TouchableOpacity
            onPress={() => setMode(mode === "view" ? "create" : "view")}
            style={[styles.miniBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
          >
            <SVGIcon
              name={mode === "view" ? "create" : "document-text"}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>
    </LinearGradient>
  );

  if ((mode === "create" || mode === "edit") && canPostNews) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderHeader()}

          <Animatable.View animation="fadeInUp" duration={600} style={styles.formSection}>
            <View style={styles.formCard}>
              <Text style={styles.label}>Announcement Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter a descriptive title"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Content</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: "top" }]}
                placeholder="What would you like to share?"
                placeholderTextColor="#94A3B8"
                value={content}
                onChangeText={setContent}
                multiline
              />

              <Text style={styles.label}>Target Audience</Text>
              <View style={styles.audienceGrid}>
                {Object.keys(AUDIENCE_COLORS).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.audienceBtn,
                      audience === opt && { backgroundColor: AUDIENCE_COLORS[opt as keyof typeof AUDIENCE_COLORS] },
                    ]}
                    onPress={() => setAudience(opt as Audience)}
                  >
                    <Text
                      style={[
                        styles.audienceBtnText,
                        audience === opt && { color: "#fff" },
                      ]}
                    >
                      {opt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Expiry Date</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={expiryDate ? expiryDate.toISOString().split('T')[0] : ""}
                      onChange={(e) => setExpiryDate(e.target.value ? new Date(e.target.value) : null)}
                      style={{
                        height: 48,
                        backgroundColor: "#F8FAFC",
                        borderRadius: 12,
                        paddingLeft: 12,
                        paddingRight: 12,
                        fontSize: 15,
                        fontWeight: '600',
                        color: "#1E293B",
                        border: '1px solid #E2E8F0',
                        width: '100%',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <SVGIcon name="calendar" size={18} color={primary} />
                      <Text style={styles.actionBtnText} numberOfLines={1}>
                        {expiryDate ? moment(expiryDate).format("DD MMM, YYYY") : "Optional"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={styles.label}>Media Attachment</Text>
              <View style={styles.mediaActionRow}>
                <TouchableOpacity
                  style={[styles.mediaActionBox, { borderColor: primary + '40' }]}
                  onPress={() => pickMedia("image")}
                >
                  <View style={[styles.mediaIconCircle, { backgroundColor: primary + '10' }]}>
                    <SVGIcon name="images" size={24} color={primary} />
                  </View>
                  <Text style={[styles.mediaActionText, { color: primary }]}>Add Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mediaActionBox, { borderColor: primary + '40' }]}
                  onPress={() => pickMedia("video")}
                >
                  <View style={[styles.mediaIconCircle, { backgroundColor: primary + '10' }]}>
                    <SVGIcon name="videocam" size={24} color={primary} />
                  </View>
                  <Text style={[styles.mediaActionText, { color: primary }]}>Add Video</Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                Platform.OS === 'web' ? (
                  <View style={styles.webDatePickerContainer}>
                    <input
                      type="date"
                      value={expiryDate ? expiryDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        setExpiryDate(new Date(e.target.value));
                        setShowDatePicker(false);
                      }}
                      style={webInputStyle}
                    />
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.webCloseBtn}>
                      <Text style={styles.webCloseBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <DateTimePicker
                    value={expiryDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event: any, selectedDate?: Date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selectedDate) setExpiryDate(selectedDate);
                    }}
                  />
                )
              )}

              {media && (
                <View style={styles.previewWrapper}>
                  {media.type === "image" ? (
                    <Image source={{ uri: media.uri }} style={styles.preview} />
                  ) : (
                    <Video
                      source={{ uri: media.uri }}
                      style={styles.preview}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                    />
                  )}
                  <TouchableOpacity
                    style={styles.removeMedia}
                    onPress={() => setMedia(null)}
                  >
                    <SVGIcon
                      name="close-circle"
                      size={24}
                      color={COLORS.danger}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.publishBtn, { backgroundColor: brandPrimary }]} onPress={handlePostNews} disabled={screenLoading}>
              {screenLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.publishBtnText}>
                    {mode === "edit" ? "Update Announcement" : "Broadcast Now"}
                  </Text>
                  <SVGIcon name={mode === "edit" ? "checkmark-circle" : "megaphone"} size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        {renderHeader()}

        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.bdayBtn, { borderColor: brandPrimary + '40' }]}
            onPress={handleTriggerBirthdays}
            disabled={bdayTriggerLoading}
          >
             {bdayTriggerLoading ? <ActivityIndicator size="small" color={brandPrimary} /> : <SVGIcon name="star" size={20} color={brandPrimary} />}
             <Text style={[styles.bdayBtnText, { color: brandPrimary }]}>Sync Birthdays</Text>
          </TouchableOpacity>
        </View>

        {screenLoading && news.length === 0 ? (
          <View style={styles.center}><ActivityIndicator size="large" color={primary} /></View>
        ) : (
          <FlatList
            data={news}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item, index }) => (
              <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.newsItemWrapper}>
                <NewsCard item={item} />
                {canPostNews && (
                  <View style={styles.adminActions}>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: COLORS.info || '#3b82f6' }]}
                      onPress={() => handleEdit(item)}
                    >
                      <SVGIcon name="create" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: COLORS.danger }]}
                      onPress={() => handleDelete(item.id)}
                    >
                      <SVGIcon name="trash" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </Animatable.View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <SVGIcon name="document-text" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Quiet Day...</Text>
                <Text style={styles.emptySub}>No announcements have been made yet.</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: { paddingBottom: 40 },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  miniBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  titleCenter: { alignItems: 'center' },
  headerTitleText: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  
  quickActions: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  bdayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 15,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    gap: 10,
  },
  bdayBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },

  formSection: { padding: 20, marginTop: -20 },
  webDatePickerContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.medium,
    alignItems: 'center',
    gap: 10,
  },
  webCloseBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 8,
  },
  webCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.medium,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 8,
    marginTop: 15,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    fontWeight: '600',
    color: "#1E293B",
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  audienceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  audienceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    flex: 1,
    alignItems: 'center',
  },
  audienceBtnText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: "#1E293B",
  },
  mediaPickerRow: { flexDirection: 'row', gap: 10 },
  iconPicker: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mediaActionRow: { flexDirection: 'row', gap: 12, marginTop: 5 },
  mediaActionBox: { flex: 1, padding: 15, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, alignItems: 'center' },
  mediaIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  mediaActionText: { fontSize: 12, fontWeight: '800' },
  previewWrapper: {
    marginTop: 20,
    borderRadius: 15,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  preview: {
    width: "100%",
    height: 180,
  },
  removeMedia: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 2,
  },
  publishBtn: {
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    ...SHADOWS.medium,
  },
  publishBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  listPadding: { padding: 20, paddingBottom: 40 },
  newsItemWrapper: {
    marginBottom: 15,
    position: "relative",
  },
  adminActions: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  actionIconBtn: {
    padding: 8,
    borderRadius: 10,
    ...SHADOWS.small,
  },
  deleteAction: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: COLORS.danger,
    padding: 8,
    borderRadius: 10,
    ...SHADOWS.small,
    zIndex: 10,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginTop: 20 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 8 },
});
