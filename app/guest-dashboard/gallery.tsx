import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  collection,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { router } from "expo-router";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

const PAGE_SIZE = 12;

const GuestDashboardGallery = () => {
  const { width, height } = useWindowDimensions();
  const [gallery, setGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadingRef = useRef(loading);
  const lastVisibleRef = useRef(lastVisible);
  const hasMoreRef = useRef(hasMore);

  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { lastVisibleRef.current = lastVisible; }, [lastVisible]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<any>>(null);

  const fetchMedia = useCallback(async (isInitial = false) => {
    if (loadingRef.current || (!isInitial && !hasMoreRef.current)) return;

    setLoading(true);
    loadingRef.current = true;
    try {
      let q = query(
        collection(db, "gallery"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE),
      );

      if (!isInitial && lastVisibleRef.current) {
        q = query(q, startAfter(lastVisibleRef.current));
      }

      const snapshot = await getDocsCacheFirst(q as any);

      if (snapshot.empty) {
        setHasMore(false);
        hasMoreRef.current = false;
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (isInitial) setGallery(items);
      else setGallery((prev) => [...prev, ...items]);

      const last = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(last);
      lastVisibleRef.current = last;
      const more = snapshot.docs.length === PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
    } catch (err) {
      console.error("Gallery Load Error:", err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchMedia(true);
  }, [fetchMedia]);

  const openModal = (index: number) => {
    setCurrentIndex(index);
    setModalVisible(true);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 150);
  };

  const handleDownload = async (item: any) => {
    if (downloadingId) return;
    setDownloadingId(item.id);
    
    try {
      if (Platform.OS === 'web') {
        // Direct web download
        const response = await fetch(item.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name || `media_${item.id}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return;
      }

      // Native platform download/save using system share (which includes "Save Image/Video")
      const filename = item.url.split("/").pop()?.split("?")[0] || `media_${item.id}`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadRes = await FileSystem.downloadAsync(item.url, fileUri);

      if (downloadRes.status === 200) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(downloadRes.uri);
        } else {
          Alert.alert("Error", "Saving media is not supported on this device.");
        }
      }
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Error", "Failed to process media.");
    } finally {
      setDownloadingId(null);
    }
  };

  const FullMediaItem = ({ item }: { item: any }) => {
    const scale = useSharedValue(1);
    const focalX = useSharedValue(0);
    const focalY = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);

    const pinchGesture = Gesture.Pinch()
      .onUpdate((event) => {
        scale.value = event.scale;
        focalX.value = event.focalX;
        focalY.value = event.focalY;
      })
      .onEnd(() => {
        scale.value = withSpring(1);
      });

    const doubleTapGesture = Gesture.Tap()
      .numberOfTaps(2)
      .onStart((event) => {
        if (scale.value !== 1) {
          scale.value = withSpring(1);
        } else {
          focalX.value = event.x;
          focalY.value = event.y;
          scale.value = withSpring(2.5);
        }
      });

    const panGesture = Gesture.Pan()
      .onUpdate((event) => {
        if (scale.value === 1) {
          translateY.value = event.translationY;
          opacity.value = 1 - Math.abs(event.translationY) / 300;
        }
      })
      .onEnd(() => {
        if (scale.value === 1) {
          if (Math.abs(translateY.value) > 150) {
            opacity.value = withTiming(0, { duration: 100 });
            runOnJS(setModalVisible)(false);
          } else {
            translateY.value = withSpring(0);
            opacity.value = withSpring(1);
          }
        }
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: focalX.value },
        { translateY: focalY.value },
        { translateX: -width / 2 },
        { translateY: -height / 2 },
        { scale: scale.value },
        { translateX: -focalX.value },
        { translateY: -focalY.value },
        { translateX: width / 2 },
        { translateY: height / 2 },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    }));

    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <GestureDetector
          gesture={Gesture.Race(
            doubleTapGesture,
            Gesture.Simultaneous(pinchGesture, panGesture),
          )}
        >
          <Animated.View style={[styles.fullMediaContainer, animatedStyle]}>
            {item.type === "image" ? (
              <Image
                source={{ uri: item.url }}
                style={styles.fullMedia}
                contentFit="scale-down"
              />
            ) : (
              <Video
                source={{ uri: item.url }}
                style={styles.fullMedia}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={modalVisible && gallery[currentIndex]?.id === item.id}
              />
            )}
          </Animated.View>
        </GestureDetector>

        <Animated.View style={[styles.fullScreenActions, { opacity }]}>
          <TouchableOpacity
            style={[styles.fullActionBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => handleDownload(item)}
            disabled={downloadingId === item.id}
          >
            {downloadingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <SVGIcon name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.fullActionText}>Save Memory</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      onPress={() => openModal(index)}
      activeOpacity={0.9}
      style={[styles.mediaContainer, { width: width / 2 - 22, height: width / 2 - 22, maxWidth: 300, maxHeight: 300 }]}
    >
      <Image 
        source={{ uri: item.thumbnailUrl || item.url }} 
        style={styles.media} 
        contentFit="cover"
      />
      {item.type === "video" && (
        <View style={styles.playOverlay}>
          <SVGIcon name="play" size={16} color="#fff" />
        </View>
      )}
      <TouchableOpacity
        style={styles.shareIcon}
        onPress={() => handleDownload(item)}
        disabled={downloadingId === item.id}
      >
        {downloadingId === item.id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <SVGIcon name="cloud-upload" size={16} color="#fff" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <SVGIcon name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>School Gallery</Text>
          <View style={{ width: 44 }} /> 
        </View>

        <FlatList
          data={gallery}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          onEndReached={() => fetchMedia()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            loading ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ margin: 20 }}
              />
            ) : null
          }
          columnWrapperStyle={{
            justifyContent: "space-between",
            paddingHorizontal: 15,
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
        />

        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <SVGIcon name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <FlatList
              ref={flatListRef}
              data={gallery}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <FullMediaItem item={item} />}
              initialScrollIndex={currentIndex}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentIndex(index);
              }}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
            />

            <View style={styles.navContainer}>
              <TouchableOpacity 
                  style={[styles.navBtn, currentIndex === 0 && { opacity: 0.3 }]} 
                  disabled={currentIndex === 0}
                  onPress={() => {
                      const newIndex = currentIndex - 1;
                      setCurrentIndex(newIndex);
                      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                  }}
              >
                  <SVGIcon name="chevron-back" size={40} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity 
                  style={[styles.navBtn, currentIndex === gallery.length - 1 && { opacity: 0.3 }]} 
                  disabled={currentIndex === gallery.length - 1}
                  onPress={() => {
                      const newIndex = currentIndex + 1;
                      setCurrentIndex(newIndex);
                      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                  }}
              >
                  <SVGIcon name="chevron-forward" size={40} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
};

export default GuestDashboardGallery;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.primary,
    flex: 1,
    textAlign: "center",
  },
  mediaContainer: {
    marginBottom: 15,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    ...SHADOWS.small,
  },
  media: { width: "100%", height: "100%" },
  playOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareIcon: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullMediaContainer: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  fullMedia: { width: "100%", height: "100%" },
  fullScreenActions: {
    position: "absolute",
    bottom: 40,
    flexDirection: "row",
    gap: 20,
    zIndex: 20,
  },
  fullActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 15,
    gap: 10,
    ...SHADOWS.medium,
  },
  fullActionText: { color: "#fff", fontWeight: "bold" },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  navContainer: { 
    position: 'absolute', 
    top: '50%', 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    transform: [{ translateY: -20 }],
    pointerEvents: 'box-none',
    zIndex: 15,
  },
  navBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 30, padding: 5 },
});
