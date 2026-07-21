import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import NetInfo from "@react-native-community/netinfo";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Alert, Linking } from "react-native";
import debounce from "lodash.debounce";
import { db, functions, storage } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { SCHOOL_CONFIG } from "../../constants/Config";

export interface TLM {
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

export type TabType = "discovery" | "saved";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const useTLMHub = () => {
  const { appUser } = useAuth();

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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  const checkInternet = async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert("No Internet", "Please check your internet connection.");
      return false;
    }
    return true;
  };

  const searchMaterials = async () => {
    if (!topic.trim()) {
      Alert.alert("Required", "Please enter a topic.");
      return;
    }

    const hasInternet = await checkInternet();
    if (!hasInternet) return;

    Alert.alert("Feature unavailable", "Content discovery is currently disabled.");
  };

  const debouncedSearch = useMemo(
    () =>
      debounce(() => {
        searchMaterials();
      }, 700),
    [subject, topic, savedTlms, searchCache],
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
            p.url === item.url ? { ...p, isSaved: false } : p,
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
            p.url === item.url ? { ...p, isSaved: true } : p,
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
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
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
                { time: 1000 },
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

  return {
    activeTab,
    setActiveTab,
    subject,
    setSubject,
    topic,
    setTopic,
    discoveryResults,
    savedTlms,
    loading,
    fetchingSaved,
    savingIds,
    showAddModal,
    setShowAddModal,
    uploading,
    uploadProgress,
    aiTip,
    newTlm,
    setNewTlm,
    handleAddCustomTlm,
    searchMaterials,
    debouncedSearch,
    openUrl,
    handleSaveTlm,
    handlePickFile,
  };
};
