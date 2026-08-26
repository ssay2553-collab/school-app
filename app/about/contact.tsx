import { useRouter } from "expo-router";
import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SHADOWS } from "../../constants/theme";

export default function ContactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const contactMethods = [
    {
      label: "Email Support",
      value: "ssay2553@gmail.com",
      icon: "mail",
      color: "#3b82f6",
      action: () => Linking.openURL("mailto:ssay2553@gmail.com"),
    },
    {
      label: "Call or WhatsApp",
      value: "0554715716",
      icon: "call",
      color: "#10b981",
      action: () => Linking.openURL("tel:0554715716"),
    },
    {
      label: "Visit Website",
      value: "edueaz-c7db2.web.app",
      icon: "globe",
      color: "#8b5cf6",
      action: () => {
        const url = "https://edueaz-c7db2.web.app/";
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          router.push({
            pathname: '/shared/web-view',
            params: { url, title: 'EduEaz Website' },
          });
        }
      },
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>We're here to help!</Text>
          <Text style={styles.infoSubtitle}>
            Have questions or need assistance? Reach out to us through any of
            the following channels.
          </Text>
        </View>

        <View style={styles.methodList}>
          {contactMethods.map((method, index) => (
            <TouchableOpacity
              key={index}
              style={styles.methodCard}
              onPress={method.action}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: method.color + "15" },
                ]}
              >
                <SVGIcon name={method.icon} size={24} color={method.color} />
              </View>
              <View style={styles.methodText}>
                <Text style={styles.methodLabel}>{method.label}</Text>
                <Text style={styles.methodValue}>{method.value}</Text>
              </View>
              <SVGIcon name="open-outline" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    padding: 8,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  content: {
    padding: 20,
  },
  infoBox: {
    marginBottom: 30,
    alignItems: "center",
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
  },
  infoSubtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
  methodList: {
    gap: 16,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    ...SHADOWS.small,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  methodText: {
    flex: 1,
    marginLeft: 16,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  methodValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 2,
  },
});
