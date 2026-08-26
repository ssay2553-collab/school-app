import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  deleteDoc,
  doc
} from "firebase/firestore";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Image,
  RefreshControl,
  Alert,
  Platform
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import moment from "moment";

const { width } = Dimensions.get("window");

export default function ManageAssignments() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const isNavigating = useRef(false);

  const primary = COLORS.primary;

  useEffect(() => {
    if (!appUser?.uid) return;

    const q = query(
      collection(db, "assignments"),
      where("teacherId", "==", appUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignments(list);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Fetch Assignments Error:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [appUser?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this assignment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "assignments", id));
            } catch (e) {
              Alert.alert("Error", "Failed to delete assignment.");
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subjectId || item.subject} • {moment(item.createdAt?.toDate()).format("MMM DD, YYYY")}</Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: item.status === 'approved' ? '#10B98120' :
                          item.status === 'rejected' ? '#EF444420' : '#F59E0B20'
        }]}>
          <Text style={[styles.statusText, {
            color: item.status === 'approved' ? '#10B981' :
                   item.status === 'rejected' ? '#EF4444' : '#F59E0B'
          }]}>
            {(item.status || 'pending').toUpperCase()}
          </Text>
        </View>
      </View>

      {item.status === 'rejected' && item.feedback && (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackLabel}>Feedback for correction:</Text>
          <Text style={styles.feedbackText}>{item.feedback}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleDelete(item.id)}
        >
          <SVGIcon name="trash-outline" size={18} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>

        {item.status === 'rejected' && (
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: primary }]}
            onPress={() => {
                // Future: Implement edit functionality
                Alert.alert("Note", "Direct editing is coming soon. Please re-upload with the suggested changes for now.");
            }}
          >
            <SVGIcon name="create-outline" size={18} color="#fff" />
            <Text style={styles.editBtnText}>Fix & Re-upload</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Assignments</Text>
          <TouchableOpacity onPress={() => router.push("/teacher-dashboard/upload-assignment")}>
             <SVGIcon name="add-circle" size={28} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyCenter}>
              <SVGIcon name="document-text" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>You haven't posted any assignments yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerGradient: { paddingTop: Platform.OS === "ios" ? 60 : 40, paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)" },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", flex: 1, marginLeft: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 16, ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '900' },
  feedbackBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#FEE2E2' },
  feedbackLabel: { fontSize: 11, fontWeight: '900', color: '#EF4444', marginBottom: 4, textTransform: 'uppercase' },
  feedbackText: { fontSize: 13, color: '#B91C1C', fontStyle: 'italic', lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  emptyCenter: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 15, color: '#94A3B8', marginTop: 15, fontWeight: '600', textAlign: 'center' },
});
