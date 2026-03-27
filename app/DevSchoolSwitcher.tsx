import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SVGIcon from "../components/SVGIcon";
import { SHADOWS } from "../constants/theme";

const SCHOOLS = [
  { id: "eagles", name: "Adehyeemba", color: "#2c0964" },
  { id: "afahjoy", name: "Gilead App", color: "#F07F13" },
  { id: "beano", name: "Beano App", color: "#6A1B9A" },
  { id: "morgis", name: "Great Legacy", color: "#FBC02D" },
  { id: "IBS", name: "IBS App", color: "#1C6E3C" },
  { id: "perfect", name: "PEI End", color: "#C1272D" },
  { id: "creation", name: "Creation Star", color: "#7A7D82" },
  { id: "clis", name: "CLIS App", color: "#3cca48" },
  { id: "jewel", name: "Jewel App", color: "#f0bf5e" },
  { id: "stone", name: "Stepping Stone", color: "#7a0b1a" },
  { id: "kent", name: "KIS App", color: "#006B3F" },
  { id: "bishops", name: "Bishop App", color: "#1E4D8C" },
  { id: "bms", name: "BMS App", color: "#FEDD00" },
  { id: "model", name: "Model Power", color: "#D4AF37" },
  { id: "brain", name: "Bright Brain", color: "#7B2CBF" },
  { id: "cascom", name: "CASCOM App", color: "#0D47A1" },
];

export default function DevSchoolSwitcher() {
  const [visible, setVisible] = useState(false);
  const [currentId, setCurrentId] = useState("");

  useEffect(() => {
    const loadId = async () => {
      const id = await AsyncStorage.getItem("DEV_SCHOOL_ID");
      setCurrentId(id || "eagles");
    };
    loadId();
  }, []);

  const switchSchool = async (id: string) => {
    await AsyncStorage.setItem("DEV_SCHOOL_ID", id);
    setCurrentId(id);
    setVisible(false);
    // Force app reload to apply new config
    alert(`Switched to ${id}. Please reload the app to apply changes.`);
  };

  if (!__DEV__) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
      >
        <SVGIcon name="settings" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Dev School Hub</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sub}>Testing with build-time config? Use scripts. Testing UI logic? Switch here.</Text>

            <ScrollView contentContainerStyle={styles.list}>
              {SCHOOLS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.card,
                    currentId === s.id && { borderColor: s.color, borderWidth: 2 }
                  ]}
                  onPress={() => switchSchool(s.id)}
                >
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.slug}>{s.id}</Text>
                  </View>
                  {currentId === s.id && (
                    <SVGIcon name="checkmark-circle" size={20} color={s.color} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
                style={styles.resetBtn} 
                onPress={async () => {
                    await AsyncStorage.removeItem("DEV_SCHOOL_ID");
                    setCurrentId("eagles");
                    alert("Reset to default. Reload app.");
                }}
            >
                <Text style={styles.resetText}>Reset to Build Default</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    position: "absolute",
    bottom: 25,
    right: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
    zIndex: 999999,
  },
  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.8)", justifyContent: "flex-end" },
  container: { backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: "80%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 25 },
  title: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  sub: { paddingHorizontal: 25, color: "#64748B", fontSize: 13, marginBottom: 15 },
  list: { padding: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#F8FAFC",
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 15 },
  name: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  slug: { fontSize: 11, color: "#94A3B8", textTransform: "uppercase", fontWeight: "800" },
  resetBtn: { margin: 25, padding: 15, alignItems: "center" },
  resetText: { color: "#EF4444", fontWeight: "800", fontSize: 13 }
});
