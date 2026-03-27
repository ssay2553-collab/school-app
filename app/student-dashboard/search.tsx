import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState, useEffect } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StatusBar,
    Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import SVGIcon from "../../components/SVGIcon";
import { COLORS } from "../../constants/theme";
import { useRouter } from "expo-router";

// Check if running in Electron (via global window property set in electron-main.js)
const isElectron = typeof window !== 'undefined' && (window as any).isElectron;

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const webViewRef = useRef<WebView>(null);

  const BLOCKED_KEYWORDS = ["porn", "xxx", "adult", "sex", "nude", "bet", "casino"];

  const handleSearch = () => {
    if (query.trim() !== "") {
      const lowercaseQuery = query.toLowerCase();
      if (BLOCKED_KEYWORDS.some((word) => lowercaseQuery.includes(word))) {
        Alert.alert("Safe Search", "Your search contains restricted terms. Please try a different topic.");
        return;
      }
      // Use adlt=strict for Bing and ensure we are using the full URL
      setSearchUrl(`https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=strict`);
    }
  };

  const handleShouldStartLoad = (request: any) => {
    const url = request.url.toLowerCase();
    // In Electron, network-level filtering is handled by the main process for security.
    // However, we still check here for consistent UI feedback.
    if (BLOCKED_KEYWORDS.some((word) => url.includes(word))) {
      if (!url.includes("bing.com")) {
        Alert.alert("Safe Search", "Access to this content is restricted for your safety.");
        return false;
      }
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.input}
              placeholder="Search safely (Strict filter)..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {searchUrl ? (
          <View style={styles.navBar}>
            <TouchableOpacity 
              onPress={() => {
                if (isElectron) {
                   // Direct DOM manipulation for Electron as webview history is tricky via props
                   const iframe = document.getElementsByTagName('iframe')[0];
                   if (iframe && (iframe as any).contentWindow) (iframe as any).contentWindow.history.back();
                } else {
                   webViewRef.current?.goBack();
                }
              }} 
              style={styles.navBtn}
            >
              <SVGIcon name="chevron-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => {
                if (isElectron) {
                    const iframe = document.getElementsByTagName('iframe')[0];
                    if (iframe) iframe.src = iframe.src;
                } else {
                    webViewRef.current?.reload();
                }
            }} style={styles.navBtn}>
              <Ionicons name="refresh" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                if (isElectron) {
                    const iframe = document.getElementsByTagName('iframe')[0];
                    if (iframe && (iframe as any).contentWindow) (iframe as any).contentWindow.history.forward();
                } else {
                    webViewRef.current?.goForward();
                }
              }} 
              style={styles.navBtn}
            >
              <SVGIcon name="chevron-forward" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {searchUrl ? (
          <WebView
            ref={webViewRef}
            source={{ uri: searchUrl }}
            style={{ flex: 1 }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={(navState) => {
              // Note: canGoBack/Forward are limited on web cross-domain
              setCanGoBack(navState.canGoBack);
              setCanGoForward(navState.canGoForward);
            }}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
          />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.shieldCircle}>
               <SVGIcon name="shield-checkmark" size={60} color={COLORS.primary} />
            </View>
            <Text style={styles.placeholderText}>Safe Student Search 🛡️</Text>
            <Text style={styles.placeholderSub}>Explore cool facts safely!</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 16, height: 44, color: "#0F172A", marginRight: 8 },
  searchBtn: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  navBar: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 5 },
  navBtn: { padding: 10 },
  disabledBtn: { opacity: 0.3 },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.8)", justifyContent: "center", alignItems: "center", zIndex: 10 },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  shieldCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primary + '10', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  placeholderText: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  placeholderSub: { color: "#64748B", fontSize: 14, marginTop: 8, fontWeight: '600' },
});
