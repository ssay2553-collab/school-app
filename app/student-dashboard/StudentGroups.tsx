import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StatusBar,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebaseConfig";

type Group = {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
};

export default function StudentGroups() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.uid) return;

    const q = query(
      collection(db, "studentGroups"),
      where("studentIds", "array-contains", appUser.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setGroups(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })),
        );
        setLoading(false);
      },
      (err) => {
        console.error("StudentGroups error:", err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [appUser?.uid]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>My Groups 🤝</Text>
          <Text style={styles.subtitle}>Work together with your friends!</Text>
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupCard}
            onPress={() =>
              router.push({
                pathname: "/student-dashboard/GroupChat",
                params: { groupId: item.id, groupName: item.name },
              })
            }
          >
            <View style={[styles.iconWrapper, { backgroundColor: COLORS.primary + "15" }]}>
              <SVGIcon name="people" size={28} color={COLORS.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.sub}>
                {item.studentIds?.length || 0} friends in this group
              </Text>
            </View>

            <SVGIcon name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
               <SVGIcon name="chatbubbles" size={60} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No groups yet!</Text>
            <Text style={styles.emptySub}>
              Your teacher will add you to a group soon. Hang tight! ✨
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15, ...SHADOWS.small },
  title: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B", fontWeight: '600', marginTop: 2 },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 18,
    marginBottom: 15,
    borderRadius: 20,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  iconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  groupName: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: '500' },
  empty: { marginTop: 100, alignItems: "center", paddingHorizontal: 40 },
  emptyIconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  emptySub: { textAlign: "center", marginTop: 8, color: "#64748B", fontWeight: '500', fontSize: 14, lineHeight: 20 },
});
