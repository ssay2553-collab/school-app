import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import SVGIcon from '../../components/SVGIcon';
import { useSchoolConfig } from '../../constants/Config';
import { COLORS } from '../../constants/theme';

export default function WebViewScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const router = useRouter();
  const config = useSchoolConfig();
  const primary = config.brandPrimary || COLORS.primary;
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleOpenExternal = () => {
    if (!url) return;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  if (!url) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.title}>Error</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>No URL provided</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Web Platform: Render in-app viewer with iframe + frame fallback for X-Frame-Options
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{title || 'External Resource'}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{url}</Text>
          </View>
          <TouchableOpacity onPress={handleOpenExternal} style={styles.externalBtn} title="Open in browser tab">
            <SVGIcon name="open-outline" size={20} color={primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.webNoticeBanner}>
          <SVGIcon name="information-circle" size={18} color={primary} />
          <Text style={styles.webNoticeText}>
            If this portal is blocked by security headers (X-Frame-Options), tap "Open Portal Tab".
          </Text>
          <TouchableOpacity onPress={handleOpenExternal} style={[styles.webOpenTabBtn, { backgroundColor: primary }]}>
            <Text style={styles.webOpenTabBtnText}>Open Portal Tab</Text>
            <SVGIcon name="open-outline" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, backgroundColor: '#F8FAFC', position: 'relative' }}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          )}
          <iframe
            src={url}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              flex: 1,
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setHasError(true);
            }}
            title={title || 'Web View'}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Mobile Native Platform (Android / iOS): Render Native WebView
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title || 'In-App Web View'}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{url}</Text>
        </View>
        <TouchableOpacity onPress={handleOpenExternal} style={styles.externalBtn} title="Open in browser">
          <SVGIcon name="open-outline" size={20} color={primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {hasError ? (
          <View style={styles.errorContainer}>
            <SVGIcon name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorTitle}>Could Not Load Website</Text>
            <Text style={styles.errorSubtitle}>The remote website encountered an error or blocked embedded viewing.</Text>
            <TouchableOpacity onPress={handleOpenExternal} style={[styles.actionBtn, { backgroundColor: primary }]}>
              <Text style={styles.actionBtnText}>Open in Browser</Text>
              <SVGIcon name="open-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: url }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setHasError(true);
            }}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={primary} />
              </View>
            )}
            style={{ flex: 1 }}
            allowsFullscreenVideo={true}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            allowFileAccess={true}
            scalesPageToFit={true}
          />
        )}
        {loading && Platform.OS === 'android' && !hasError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={primary} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  externalBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  webNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  webNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  webOpenTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  webOpenTabBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F8FAFC',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 15,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});
