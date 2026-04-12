import { ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    limit as fLimit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from "firebase/firestore";
import {
    deleteObject,
    getDownloadURL,
    ref as sRef,
    uploadBytesResumable,
} from "firebase/storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    StatusBar,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import {
    PanGestureHandler,
    PinchGestureHandler,
} from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db, storage } from "../../firebaseConfig";

type GalleryItem = {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: "image" | "video";
  storagePath?: string;
};
const MAX_FILE_SIZE = 30 * 1024 * 1024;

const uriToBlob = async (uri: string) => {
  const response = await fetch(uri);
  return await response.blob();
};

type FullScreenItemProps = {
  item: GalleryItem;
  width: number;
  height: number;
  onClose: () => void;
  onShare: (item: GalleryItem) => void;
  onDelete: (item: GalleryItem) => void;
  canManageGallery: boolean;
};

const FullScreenItem: React.FC<FullScreenItemProps> = ({
  item,
  width,
  height,
  onClose,
  onShare,
  onDelete,
  canManageGallery,
}) => {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const pinchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <PanGestureHandler
      onGestureEvent={(e) => {
        translateY.value = e.nativeEvent.translationY;
      }}
      onEnded={() => {
        if (translateY.value > 120) {
          onClose();
        } else {
          translateY.value = withSpring(0);
        }
      }}
    >
      <Animated.View
        style={[{ width, height, backgroundColor: "black" }, panStyle]}
      >
        <PinchGestureHandler
          onGestureEvent={(e) => {
            scale.value = e.nativeEvent.scale;
          }}
          onEnded={() => {
            scale.value = withSpring(1);
          }}
        >
          <Animated.View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            {item.type === "image" ? (
              <Animated.Image
                source={{ uri: item.url }}
                style={[{ width: "100%", height: "100%" }, pinchStyle]}
                resizeMode="contain"
              />
            ) : (
              <Video
                source={{ uri: item.url }}
                style={{ width: "100%", height: "100%" }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            )}
          </Animated.View>
        </PinchGestureHandler>

        {/* Close */}
        <TouchableOpacity
          style={{ position: "absolute", top: 50, right: 20 }}
          onPress={onClose}
        >
          <SVGIcon name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Actions */}
        <View
          style={{
            position: "absolute",
            bottom: 40,
            flexDirection: "row",
            gap: 20,
          }}
        >
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
            }}
            onPress={() => onShare(item)}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Share</Text>
          </TouchableOpacity>

          {canManageGallery && (
            <TouchableOpacity
              style={{
                backgroundColor: "#EF4444",
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
              }}
              onPress={() => onDelete(item)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </PanGestureHandler>
  );
};
export default function AdminGalleryUpload() {
  const { appUser } = useAuth();
  const { width, height } = useWindowDimensions();

  const [selectedFile, setSelectedFile] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<GalleryItem> | null>(null);

  const canManageGallery: boolean = useMemo(
    () =>
      !!(
        appUser &&
        [
          "Proprietor",
          "Headmaster",
          "Assistant Headmaster",
          "CEO",
          "Secretary",
        ].includes(appUser.adminRole ?? "")
      ),
    [appUser],
  );

  useEffect(() => {
    const q = query(
      collection(db, "gallery"),
      orderBy("createdAt", "desc"),
      fLimit(100),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setGallery(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GalleryItem, "id">),
        })),
      );
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const pickMedia = async () => {
    if (!canManageGallery) return Alert.alert("Restricted");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const file = result.assets[0] as ImagePicker.ImagePickerAsset;
      if (
        (file.fileSize as number | undefined) &&
        (file.fileSize as number) > MAX_FILE_SIZE
      ) {
        return Alert.alert("File Too Large");
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const timestamp = Date.now();
      const ext =
        (selectedFile as ImagePicker.ImagePickerAsset).uri.split(".").pop() ||
        "jpg";
      const fileType =
        (selectedFile as any)?.type === "video" ||
        (selectedFile as any)?.mediaType === "video"
          ? "video"
          : "image";
      const mainPath = `gallery/${timestamp}.${ext}`;
      const mainRef = sRef(storage, mainPath);
      const mainBlob = await uriToBlob(selectedFile.uri);

      const uploadTask = uploadBytesResumable(mainRef, mainBlob);

      uploadTask.on(
        "state_changed",
        (snapshot) =>
          setUploadProgress(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          ),
        () => setIsUploading(false),
        async () => {
          const mainUrl = await getDownloadURL(mainRef);

          await addDoc(collection(db, "gallery"), {
            url: mainUrl,
            thumbnailUrl: mainUrl,
            type: fileType,
            storagePath: mainPath,
            createdAt: serverTimestamp(),
          });

          setSelectedFile(null);
          setIsUploading(false);
        },
      );
    } catch (e) {
      Alert.alert("Upload Error");
      setIsUploading(false);
    }
  };

  // ✅ FULLY FIXED SHARE
  const shareToSocial = async (item: GalleryItem) => {
    if (sharingId) return;
    setSharingId(item.id);

    try {
      const url = encodeURIComponent(item.url);
      const text = encodeURIComponent("Check this out");

      if (Platform.OS === "web") {
        const choice = window.prompt(
          "Type: whatsapp / facebook / twitter / copy",
        );

        if (choice === "whatsapp") {
          window.open(`https://wa.me/?text=${text}%20${url}`);
        } else if (choice === "facebook") {
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
        } else if (choice === "twitter") {
          window.open(
            `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
          );
        } else if (choice === "copy") {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(item.url);
            alert("Copied!");
          } else {
            alert(item.url);
          }
        }
        return;
      }

      // 📱 Mobile → open native share (Instagram, TikTok etc will appear)
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Not supported");
        return;
      }

      const filename = item.url.split("/").pop()?.split("?")[0] || "media";
      const fileUri = `${(FileSystem as any).cacheDirectory}${filename}`;

      const downloadRes = await (FileSystem as any).downloadAsync(
        item.url,
        fileUri,
      );

      await Sharing.shareAsync(downloadRes.uri);
    } catch (e) {
      Alert.alert("Sharing failed");
    } finally {
      setSharingId(null);
    }
  };
  const openModal = (index: number) => {
    setCurrentIndex(index);
    setModalVisible(true);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 100);
  };

  const deleteItem = (item: GalleryItem) => {
    if (!canManageGallery) return;

    Alert.alert("Delete Post", "Remove this from the gallery?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (item.storagePath) {
              await deleteObject(sRef(storage, item.storagePath));
            }

            await deleteDoc(doc(db, "gallery", item.id));
            setGallery((prev) => prev.filter((g) => g.id !== item.id));
            setModalVisible(false);
          } catch (e) {
            console.error(e);
            Alert.alert("Error", "Delete failed");
          }
        },
      },
    ]);
  };

  const renderFullItem = ({ item }: { item: GalleryItem }) => (
    <FullScreenItem
      item={item}
      width={width}
      height={height}
      onClose={() => setModalVisible(false)}
      onShare={shareToSocial}
      onDelete={deleteItem}
      canManageGallery={canManageGallery}
    />
  );
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={gallery}
        keyExtractor={(i) => i.id}
        numColumns={2}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={{ width: width / 2, height: 160 }}
            onPress={() => openModal(index)}
          >
            <Image
              source={{ uri: item.thumbnailUrl || item.url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} animationType="fade">
        <FlatList
          ref={flatListRef}
          data={gallery}
          horizontal
          pagingEnabled
          renderItem={renderFullItem}
          initialScrollIndex={currentIndex}
          getItemLayout={(data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
        />
      </Modal>

      <TouchableOpacity
        onPress={pickMedia}
        style={{ position: "absolute", bottom: 40, right: 20 }}
      >
        <LinearGradient
          colors={[COLORS.primary, "#4338ca"]}
          style={{ padding: 16, borderRadius: 50 }}
        >
          <SVGIcon name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {selectedFile && (
        <TouchableOpacity
          onPress={uploadFile}
          style={{ position: "absolute", bottom: 100, right: 20 }}
        >
          <Text
            style={{
              backgroundColor: COLORS.primary,
              color: "#fff",
              padding: 10,
            }}
          >
            Upload
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
