import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, StatusBar } from "react-native";
import * as Animatable from "react-native-animatable";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import SVGIcon from "../../components/SVGIcon";
import { useRouter } from "expo-router";
import { SCHOOL_CONFIG } from "../../constants/Config";

export default function UpgradeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      setLoading(true);
      try {
        await new Promise((res) => setTimeout(res, 1000));
        setHasUpdate(false);
      } catch  {
        Alert.alert("Error", "Could not check for updates.");
      } finally {
        setLoading(false);
      }
    };
    checkUpdate();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={SCHOOL_CONFIG.primaryColor || COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={SCHOOL_CONFIG.primaryColor || COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Updates 🚀</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: (SCHOOL_CONFIG.primaryColor || COLORS.primary) + '10' }]}>
             <SVGIcon name={hasUpdate ? "cloud-download" : "checkmark-done-circle"} size={60} color={SCHOOL_CONFIG.primaryColor || COLORS.primary} />
          </View>

          {hasUpdate ? (
            <>
              <Text style={styles.title}>New Update Available! ✨</Text>
              <Text style={styles.message}>A newer version of the app is ready to install with new features!</Text>
              <Animatable.View
                animation="bounce"
                iterationCount="infinite"
                duration={2000}
                style={{ width: "100%", alignItems: "center" }}
              >
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: SCHOOL_CONFIG.primaryColor || COLORS.primary }]}
                  onPress={() => Alert.alert("Upgrade", "Redirecting to store...")}
                >
                  <Text style={styles.buttonText}>Upgrade Now</Text>
                </TouchableOpacity>
              </Animatable.View>
            </>
          ) : (
            <>
              <Text style={styles.title}>You're All Set! ✅</Text>
              <Text style={styles.message}>You are using the latest version of the {SCHOOL_CONFIG.name}.</Text>
              <View style={styles.statusLine}>
                 <Text style={styles.statusLabel}>Version 1.0.0 (Latest)</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 40,
    borderRadius: 30,
    alignItems: "center",
    width: "100%",
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  iconCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
    fontWeight: '500'
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 15,
    ...SHADOWS.small,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  statusLine: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#F1F5F9', borderRadius: 10 },
  statusLabel: { color: '#64748B', fontSize: 13, fontWeight: '700' }
});
