import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import {
    addDoc,
    collection,
    query,
    serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import moment from "moment";

import NewsCard from "../../components/news/NewsCard";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";
import { Audience, NewsItem } from "../../types/news";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { fetchCategories, fetchNewsForAudience } from "../../lib/newsFetcher";
import DateTimePicker from "@react-native-community/datetimepicker";

const storage = getStorage();

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

export default function TeacherNewsScreen() {
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  // Create Mode States
  const [mode, setMode] = useState<"view" | "create">("view");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [media, setMedia] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);
  const [posting, setPosting] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const brandSecondary = SCHOOL_CONFIG.brandSecondary;

  // Check if teacher has "Event Organiser" or similar role
  const canPostNews = appUser?.assignedRoles?.includes("Event Organiser") || 
                     appUser?.assignedRoles?.includes("Head of Department");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [items, cats] = await Promise.all([
        fetchNewsForAudience("teacher"),
        fetchCategories().catch(() => []),
      ]);
      setNews(items);
      const fetchedCats = cats?.map((c: any) => c.name).filter(Boolean) || [];
      setCategories(Array.from(new Set(["All", ...fetchedCats])));
    } catch (err) {
      console.error("Error fetching teacher news:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filtered = useMemo(() => {
    let result = activeCategory === "All" ? news : news.filter((n) => n.category === activeCategory);
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(n => n.title.toLowerCase().includes(lower) || n.content.toLowerCase().includes(lower));
    }
    return result;
  }, [news, activeCategory, search]);

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
      Alert.alert("Error", "Could not access library.");
    }
  };

  const handlePostNews = async () => {
    if (!title.trim() || !content.trim()) {
      return Alert.alert("Required", "Please provide both a title and content.");
    }
    setPosting(true);
    try {
      let mediaUrl = null;
      if (media) {
        const blob = await uriToBlob(media.uri);
        const fileName = `${Date.now()}_${media.type}`;
        const storageRef = ref(storage, `newsMedia/${fileName}`);
        await uploadBytes(storageRef, blob);
        mediaUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "news"), {
        title: title.trim(),
        content: content.trim(),
        audience,
        mediaUrl,
        mediaType: media?.type || null,
        author: `${appUser?.profile?.firstName || ""} (Staff)`,
        category: "Event Update",
        createdAt: serverTimestamp(),
        expiryDate: expiryDate ? expiryDate : null,
      });

      setTitle("");
      setContent("");
      setMedia(null);
      setExpiryDate(null);
      setMode("view");
      Alert.alert("Success", "Announcement published.");
      loadData();
    } catch (error: any) {
      console.error("Post news error:", error);
      Alert.alert("Error", "Failed to publish announcement.");
    } finally {
      setPosting(false);
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
          <Text style={styles.headerTitleText}>Bulletin Board</Text>
          <Text style={styles.headerSub}>Campus Updates</Text>
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

  if (mode === "create") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {renderHeader()}
          <Animatable.View animation="fadeInUp" duration={600} style={styles.formSection}>
            <View style={styles.formCard}>
              <Text style={styles.label}>Post Title</Text>
              <TextInput style={styles.input} placeholder="Event or News Title" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

              <Text style={styles.label}>Content</Text>
              <TextInput style={[styles.input, { height: 120, textAlignVertical: "top" }]} placeholder="What's happening?" placeholderTextColor="#94A3B8" value={content} onChangeText={setContent} multiline />

              <Text style={styles.label}>Target Audience</Text>
              <View style={styles.audienceGrid}>
                {Object.keys(AUDIENCE_COLORS).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.audienceBtn, audience === opt && { backgroundColor: AUDIENCE_COLORS[opt as keyof typeof AUDIENCE_COLORS] }]}
                    onPress={() => setAudience(opt as Audience)}
                  >
                    <Text style={[styles.audienceBtnText, audience === opt && { color: "#fff" }]}>{opt.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Media Attachment</Text>
              <View style={styles.mediaActionRow}>
                <TouchableOpacity style={[styles.mediaActionBox, { borderColor: primary + '40' }]} onPress={() => pickMedia("image")}>
                  <SVGIcon name="images" size={24} color={primary} />
                  <Text style={[styles.mediaActionText, { color: primary }]}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mediaActionBox, { borderColor: primary + '40' }]} onPress={() => pickMedia("video")}>
                  <SVGIcon name="videocam" size={24} color={primary} />
                  <Text style={[styles.mediaActionText, { color: primary }]}>Video</Text>
                </TouchableOpacity>
              </View>

              {media && (
                <View style={styles.previewWrapper}>
                  {media.type === "image" ? (
                    <Image source={{ uri: media.uri }} style={styles.preview} />
                  ) : (
                    <Video source={{ uri: media.uri }} style={styles.preview} useNativeControls resizeMode={ResizeMode.CONTAIN} />
                  )}
                  <TouchableOpacity style={styles.removeMedia} onPress={() => setMedia(null)}>
                    <SVGIcon name="close-circle" size={24} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.publishBtn, { backgroundColor: brandPrimary }]} onPress={handlePostNews} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>Publish Update</Text>}
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderHeader()}
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <SVGIcon name="search" size={18} color="#94A3B8" />
          <TextInput
            placeholder="Search bulletins..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.catChip, activeCategory === cat && { backgroundColor: primary, borderColor: primary }]}
            >
              <Text style={[styles.catChipText, activeCategory === cat && { color: "#fff" }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
            <NewsCard item={item} />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[primary]} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyCenter}>
            <SVGIcon name="document-text" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Quiet Day...</Text>
            <Text style={styles.emptyText}>No bulletins found in this category.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...SHADOWS.medium,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  titleCenter: { alignItems: 'center' },
  headerTitleText: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  searchContainer: { padding: 20, paddingBottom: 0 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 15, height: 50, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1E293B', fontWeight: '500' },
  categoryContainer: { marginVertical: 15 },
  categoryScroll: { paddingHorizontal: 20 },
  catChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 10, ...SHADOWS.small },
  catChipText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  formSection: { padding: 20, marginTop: -20 },
  formCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, ...SHADOWS.medium, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  label: { fontSize: 10, fontWeight: "900", color: "#94A3B8", marginBottom: 8, marginTop: 15, textTransform: "uppercase", letterSpacing: 1 },
  input: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 15, fontSize: 15, fontWeight: '600', color: "#1E293B", borderWidth: 1, borderColor: '#E2E8F0' },
  audienceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  audienceBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#F1F5F9", flex: 1, alignItems: 'center' },
  audienceBtnText: { fontSize: 10, fontWeight: "900", color: "#64748B" },
  mediaActionRow: { flexDirection: 'row', gap: 12, marginTop: 5 },
  mediaActionBox: { flex: 1, padding: 15, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, alignItems: 'center', gap: 8 },
  mediaActionText: { fontSize: 12, fontWeight: '800' },
  previewWrapper: { marginTop: 20, borderRadius: 15, overflow: "hidden", position: "relative" },
  preview: { width: "100%", height: 180 },
  removeMedia: { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 12, padding: 2 },
  publishBtn: { height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },
  publishBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  emptyCenter: { alignItems: "center", marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginTop: 20 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
