import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  documentId
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
  TextInput,
  Image,
  Dimensions,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { getDocsCacheFirst } from "../../lib/firestoreHelpers";

const { width } = Dimensions.get("window");

interface Teacher {
  uid: string;
  profile: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    gender?: string;
    profileImage?: string;
    bio?: string;
    experience?: string;
    education?: string;
  };
  role: "teacher";
  classes?: string[];
  subjects?: string[];
  classTeacherOf?: string;
  assignedRoles?: string[];
}

export default function ViewTeachers() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    const fetchTeacherDirectory = async () => {
      if (!appUser?.childrenIds || appUser.childrenIds.length === 0) {
        setLoading(false);
        return;
      }
      
      try {
        // 1. Get children's class IDs to filter teachers
        const childQuery = query(
          collection(db, "users"), 
          where(documentId(), "in", appUser.childrenIds)
        );
        const childSnap = await getDocs(childQuery);
        const classIds = new Set<string>();
        childSnap.forEach(doc => {
          const data = doc.data() as any;
          if (data.classId) classIds.add(data.classId);
        });
        
        const myKidsClasses = Array.from(classIds);
        
        if (myKidsClasses.length === 0) {
          setTeachers([]);
          setLoading(false);
          return;
        }

        // 2. Fetch all Teachers
        const q = query(
          collection(db, "users"),
          where("role", "==", "teacher"),
          orderBy("profile.firstName"),
          limit(200)
        );
        const snap = await getDocsCacheFirst(q as any);
        const allTeachers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Teacher));
        
        // 3. Filter teachers who teach at least one of the parent's children's classes
        const filteredList = allTeachers.filter(t => 
           t.classes?.some(cid => myKidsClasses.includes(cid)) || 
           (t.classTeacherOf && myKidsClasses.includes(t.classTeacherOf))
        );

        setTeachers(filteredList);
      } catch (err) {
        console.error("Directory Filter Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherDirectory();
  }, [appUser]);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const low = searchQuery.toLowerCase();
    return teachers.filter(u => 
      u.profile?.firstName?.toLowerCase().includes(low) || 
      u.profile?.lastName?.toLowerCase().includes(low) ||
      u.subjects?.some(s => s.toLowerCase().includes(low))
    );
  }, [teachers, searchQuery]);

  const renderTeacherItem = ({ item, index }: { item: Teacher, index: number }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50} duration={400}>
      <TouchableOpacity 
        style={styles.teacherCard} 
        onPress={() => setViewingTeacher(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {item.profile.profileImage ? (
            <Image source={{ uri: item.profile.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: COLORS.primary + '10' }]}>
              <Text style={styles.avatarText}>{item.profile.firstName?.[0] || "T"}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.teacherName}>{item.profile.firstName} {item.profile.lastName}</Text>
            <View style={styles.rolesRow}>
              {item.assignedRoles?.map((role, i) => (
                <View key={i} style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{role}</Text>
                </View>
              ))}
              {item.classTeacherOf && (
                <View style={[styles.roleBadge, { backgroundColor: '#10B98115' }]}>
                  <Text style={[styles.roleBadgeText, { color: '#10B981' }]}>Class Teacher</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => router.push({ pathname: "/parent-dashboard/chat-with-teacher", params: { teacherId: item.uid, parentId: appUser?.uid } })}
            style={styles.chatBtn}
          >
            <SVGIcon name="chatbubble-ellipses" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {item.subjects && item.subjects.length > 0 && (
          <View style={styles.subjectContainer}>
            {item.subjects.slice(0, 3).map((s, i) => (
              <View key={i} style={styles.subjectChip}>
                <Text style={styles.subjectChipText}>{s}</Text>
              </View>
            ))}
            {item.subjects.length > 3 && (
              <Text style={styles.moreText}>+{item.subjects.length - 3} more</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Teachers Directory</Text>
          <Text style={styles.headerSub}>Instructors for your children</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <SVGIcon name="search" size={20} color="#94A3B8" />
          <TextInput
            placeholder="Search by name or subject..."
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <SVGIcon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={filteredTeachers}
          keyExtractor={item => item.uid}
          renderItem={renderTeacherItem}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SVGIcon name="people-outline" size={60} color="#E2E8F0" />
              <Text style={styles.emptyText}>No linked teachers found</Text>
            </View>
          }
        />
      )}

      {/* Profile Detail Modal */}
      <Modal visible={!!viewingTeacher} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Animatable.View animation="slideInUp" duration={400} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Teacher Profile</Text>
              <TouchableOpacity onPress={() => setViewingTeacher(null)} style={styles.closeBtn}>
                <SVGIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {viewingTeacher && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileHeader}>
                  {viewingTeacher.profile.profileImage ? (
                    <Image source={{ uri: viewingTeacher.profile.profileImage }} style={styles.largeAvatar} />
                  ) : (
                    <View style={styles.largeAvatarPlaceholder}>
                      <Text style={styles.largeAvatarText}>{viewingTeacher.profile.firstName?.[0]}</Text>
                    </View>
                  )}
                  <Text style={styles.profileName}>{viewingTeacher.profile.firstName} {viewingTeacher.profile.lastName}</Text>
                  <Text style={styles.profileEmail}>{viewingTeacher.profile.email || "No email provided"}</Text>
                </View>

                {viewingTeacher.profile.bio && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionLabel}>ABOUT INSTRUCTOR</Text>
                    <View style={styles.bioCard}>
                       <SVGIcon name="quote" size={20} color={COLORS.primary + '30'} style={styles.quoteIcon} />
                       <Text style={styles.bioText}>{viewingTeacher.profile.bio}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.statsRow}>
                   <View style={styles.statBox}>
                      <Text style={styles.statValue}>{viewingTeacher.profile.experience || "0"}</Text>
                      <Text style={styles.statLabel}>YRS EXP.</Text>
                   </View>
                   <View style={styles.statBox}>
                      <Text style={styles.statValue} numberOfLines={1}>{viewingTeacher.profile.education?.split(' ')[0] || "N/A"}</Text>
                      <Text style={styles.statLabel}>DEGREE</Text>
                   </View>
                   <View style={styles.statBox}>
                      <Text style={styles.statValue}>{viewingTeacher.subjects?.length || "0"}</Text>
                      <Text style={styles.statLabel}>SUBJECTS</Text>
                   </View>
                </View>

                {viewingTeacher.profile.education && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionLabel}>QUALIFICATIONS</Text>
                    <View style={styles.infoCard}>
                       <View style={styles.infoRow}>
                          <SVGIcon name="school" size={18} color={COLORS.primary} />
                          <Text style={styles.infoText}>{viewingTeacher.profile.education}</Text>
                       </View>
                    </View>
                  </View>
                )}

                <View style={styles.infoSection}>
                  <Text style={styles.sectionLabel}>ASSIGNED ROLES</Text>
                  <View style={styles.infoCard}>
                     <View style={styles.infoRow}>
                        <SVGIcon name="briefcase" size={18} color={COLORS.primary} />
                        <Text style={styles.infoText}>
                           {viewingTeacher.classTeacherOf ? `Class Teacher of ${viewingTeacher.classTeacherOf}` : "Subject Instructor"}
                        </Text>
                     </View>
                     {viewingTeacher.assignedRoles?.map((role, i) => (
                        <View key={i} style={styles.infoRow}>
                           <SVGIcon name="star" size={18} color="#F59E0B" />
                           <Text style={styles.infoText}>{role}</Text>
                        </View>
                     ))}
                  </View>
                </View>

                {viewingTeacher.subjects && viewingTeacher.subjects.length > 0 && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionLabel}>SUBJECTS HANDLED</Text>
                    <View style={styles.profileSubjectGrid}>
                      {viewingTeacher.subjects.map((s, i) => (
                        <View key={i} style={styles.profileSubjectChip}>
                          <Text style={styles.profileSubjectText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {viewingTeacher.classes && viewingTeacher.classes.length > 0 && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionLabel}>CLASSES TAUGHT</Text>
                    <View style={styles.profileSubjectGrid}>
                      {viewingTeacher.classes.map((c, i) => (
                        <View key={i} style={[styles.profileSubjectChip, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.profileSubjectText, { color: '#475569' }]}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.messageBtn}
                  onPress={() => {
                    setViewingTeacher(null);
                    router.push({ pathname: "/parent-dashboard/chat-with-teacher", params: { teacherId: viewingTeacher.uid, parentId: appUser?.uid } });
                  }}
                >
                  <SVGIcon name="chatbubbles" size={22} color="#fff" />
                  <Text style={styles.messageBtnText}>Start Conversation</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </Animatable.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  headerTitleContainer: { marginLeft: 15 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  headerSub: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  searchContainer: { padding: 20, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 50,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: '600', color: '#1E293B' },
  listPadding: { padding: 20, paddingBottom: 100 },
  teacherCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 18 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  headerInfo: { flex: 1, marginLeft: 15 },
  teacherName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  roleBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  chatBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary + '10', justifyContent: 'center', alignItems: 'center' },
  subjectContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15, gap: 8, alignItems: 'center' },
  subjectChip: { backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  subjectChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  moreText: { fontSize: 11, color: '#94A3B8', fontWeight: '800' },
  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: '800', color: '#94A3B8', marginTop: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  profileHeader: { alignItems: 'center', marginBottom: 30 },
  largeAvatar: { width: 100, height: 100, borderRadius: 35 },
  largeAvatarPlaceholder: { width: 100, height: 100, borderRadius: 35, backgroundColor: COLORS.primary + '10', justifyContent: 'center', alignItems: 'center' },
  largeAvatarText: { fontSize: 36, fontWeight: '900', color: COLORS.primary },
  profileName: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginTop: 15 },
  profileEmail: { fontSize: 14, color: '#64748B', fontWeight: '600', marginTop: 4 },
  infoSection: { marginBottom: 25 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 },
  infoCard: { backgroundColor: '#F8FAFC', borderRadius: 20, padding: 15, gap: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  profileSubjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profileSubjectChip: { backgroundColor: COLORS.primary + '10', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  profileSubjectText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  bioCard: { backgroundColor: '#EEF2FF', borderRadius: 20, padding: 20, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  quoteIcon: { position: 'absolute', top: 10, right: 10, opacity: 0.1 },
  bioText: { fontSize: 14, color: '#475569', lineHeight: 22, fontWeight: '600', fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 20, alignItems: 'center', ...SHADOWS.small, borderWidth: 1, borderColor: '#F1F5F9' },
  statValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  statLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', marginTop: 4 },
  messageBtn: { backgroundColor: COLORS.primary, height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, ...SHADOWS.medium, marginTop: 10 },
  messageBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});
