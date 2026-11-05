import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  getDocsFromServer,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
  getCountFromServer,
} from "firebase/firestore";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  ScrollView,
  RefreshControl,
  Modal,
  AppState,
  Platform,
  Alert
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import QuestionResponseItem from "../../components/student-dashboard/assignments/QuestionResponseItem";
import AssignmentReviewModal from "../../components/admin-dashboard/AssignmentReviewModal";
import { TierProtectedRoute } from "../../components/TierProtectedRoute";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { getTeacherClasses } from "../../lib/classHelpers";
import { sendNotification } from "../../src/services/notificationService";
import moment from "moment";

const { width } = Dimensions.get("window");

export interface CategoryBreakdown {
  attScore: number;       // Max 20 pts
  academicScore: number;  // Max 10 pts
  topicScore: number;     // Max 20 pts
  assignmentScore: number;// Max 25 pts
  groupScore: number;     // Max 10 pts
  submissionScore: number;// Max 10 pts
  notesScore: number;     // Max 5 pts
}

export interface ActivitySet {
  assignments: any[];
  topics: any[];
  groups: any[];
  totalAttendance: number;
  totalMarkedSubmissions: number;
  totalNotes: number;
  totalAcademicRecords: number;
  usageScore: number;
  usageBreakdown: CategoryBreakdown;
}

export interface TeacherStats {
  uid: string;
  fullName: string;
  email: string;
  profileImage?: string;
  role: string;
  lastActive?: any;
  onlineTimeMinutes: number;
  assignedClasses: string[];
  assignedClassIds: string[];

  // Statistics for active display mode
  totalAssignments: number;
  pendingAssignmentsCount: number;
  totalGroups: number;
  totalTopics: number;
  totalAttendance: number;
  totalMarkedSubmissions: number;
  totalNotes: number;
  totalAcademicRecords: number;
  usageScore: number;
  usageBreakdown: CategoryBreakdown;

  // Stored sets
  weeklyStats: ActivitySet;
  allTimeStats: ActivitySet;

  assignments: any[];
  allTopics: any[];
  groups: { name: string; className: string; memberCount: number }[];
  assignmentBreakdown: {
    subject: string;
    className: string;
    count: number;
  }[];
  topicBreakdown: {
    subject: string;
    classId: string;
    className: string;
    count: number;
    topics: any[];
  }[];
}

const safeFormat = (date: any, format: string) => {
  if (!date) return "N/A";
  try {
    if (date.toDate && typeof date.toDate === 'function') {
      return moment(date.toDate()).format(format);
    }
    return moment(date).format(format);
  } catch (e) {
    return "Invalid Date";
  }
};

/**
 * Gets Sunday 00:00:00 to Saturday 23:59:59 for current week
 */
const getWeekRange = () => {
  const startOfWeek = moment().day(0).startOf('day'); // Sunday 00:00:00
  const endOfWeek = moment().day(6).endOf('day');     // Saturday 23:59:59
  return { startOfWeek, endOfWeek };
};

/**
 * Fast timestamp extractor from various Firestore doc formats
 */
const getDocTimestampMs = (data: any): number | null => {
  if (!data) return null;
  const raw = data.createdAt || data.date || data.timestamp || data.markedAt || data.submittedAt || data.updatedAt;
  if (!raw) return null;

  try {
    if (typeof raw.toDate === 'function') {
      return raw.toDate().getTime();
    }
    if (raw instanceof Date) {
      return raw.getTime();
    }
    if (typeof raw === 'number') {
      return raw;
    }
    if (raw.seconds) {
      return raw.seconds * 1000;
    }
    if (typeof raw === 'string') {
      const t = Date.parse(raw);
      return isNaN(t) ? null : t;
    }
  } catch (e) {
    return null;
  }
  return null;
};

/**
 * Extracts a moment Date object from various Firestore doc formats
 */
const getDocDate = (data: any): moment.Moment | null => {
  const ts = getDocTimestampMs(data);
  return ts ? moment(ts) : null;
};

/**
 * Checks if document timestamp falls in current week using fast numeric comparison
 */
const isDocInCurrentWeek = (data: any, startMs: number, endMs: number) => {
  const ts = getDocTimestampMs(data);
  if (ts === null) return false;
  return ts >= startMs && ts <= endMs;
};

/**
 * Weighted scoring formula:
 * - Attendance: 4 pts each, CAP 20 pts (20%)
 * - Daily Financials / Academic Records: 2.5 pts each, CAP 10 pts (10%)
 * - Assignments: 8 pts each, CAP 25 pts (25%)
 * - Weekly Topics: 10 pts each, CAP 20 pts (20%)
 * - Student Groups: 5 pts each, CAP 10 pts (10%)
 * - Graded Submissions: 2 pts each, CAP 10 pts (10%)
 * - Teacher Notes: 2.5 pts each, CAP 5 pts (5%)
 * Total Max = 100%
 */
const computeUsageScore = (stats: {
  assignmentsCount: number;
  topicsCount: number;
  groupsCount: number;
  attendanceCount: number;
  markedSubmissionsCount: number;
  notesCount: number;
  academicRecordsCount: number;
}): { usageScore: number; breakdown: CategoryBreakdown } => {
  const attScore = Math.min(stats.attendanceCount * 4, 20);
  const academicScore = Math.min(stats.academicRecordsCount * 2.5, 10);
  const topicScore = Math.min(stats.topicsCount * 10, 20);
  const assignmentScore = Math.min(stats.assignmentsCount * 8, 25);
  const groupScore = Math.min(stats.groupsCount * 5, 10);
  const submissionScore = Math.min(stats.markedSubmissionsCount * 2, 10);
  const notesScore = Math.min(stats.notesCount * 2.5, 5);

  const usageScore = Math.min(
    100,
    Math.round(attScore + academicScore + topicScore + assignmentScore + groupScore + submissionScore + notesScore)
  );

  return {
    usageScore,
    breakdown: {
      attScore,
      academicScore,
      topicScore,
      assignmentScore,
      groupScore,
      submissionScore,
      notesScore,
    }
  };
};

export default function TeacherStatistics() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"weekly" | "all_time">("weekly");
  const [teachers, setTeachers] = useState<TeacherStats[]>([]);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherStats | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  const [reviewingAssignment, setReviewingAssignment] = useState<any | null>(null);
  const [viewingTopicsList, setViewingTopicsList] = useState<any[] | null>(null);
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<any | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");

  const weekRangeText = useMemo(() => {
    const start = moment().day(0); // Sunday
    const end = moment().day(6);   // Saturday
    return `${start.format("MMM D")} - ${end.format("MMM D, YYYY")}`;
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const CACHE_KEY = `teacher_stats_${SCHOOL_CONFIG.schoolId}`;
  const CACHE_EXPIRY = 12 * 60 * 60 * 1000; // 12 hours cache

  const primary = SCHOOL_CONFIG.primaryColor;
  const secondary = SCHOOL_CONFIG.secondaryColor;

  const fetchStatistics = useCallback(async (showLoading = true) => {
    if (!appUser) return;
    try {
      if (showLoading && isMounted.current) setLoading(true);

      const startOfWeekMs = moment().day(0).startOf('day').valueOf();
      const endOfWeekMs = moment().day(6).endOf('day').valueOf();

      // 0. Fetch metadata once using cached Firestore query
      const classesSnap = await getDocs(collection(db, "classes"));
      const newClassMap: Record<string, string> = {};
      classesSnap.forEach((doc: any) => {
        const data = doc.data() as any;
        newClassMap[doc.id] = data.name || data.className || doc.id;
      });
      if (isMounted.current) setClassMap(newClassMap);

      // 1. Batch Fetch all required collections for the school using getDocs (cache-friendly)
      const [
        teacherSnap,
        allAssignmentsSnap,
        allGroupsSnap,
        allTopicsSnap,
        allAttendanceSnap,
        allSubmissionsSnap,
        allNotesSnap,
        allAcademicRecordsSnap
      ] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "in", ["teacher", "admin", "superadmin", "super admin"]))),
        getDocs(collection(db, "assignments")),
        getDocs(collection(db, "studentGroups")),
        getDocs(collection(db, "weeklyTopics")),
        getDocs(collection(db, "attendance")),
        getDocs(query(collection(db, "submissions"), where("marked", "==", true))),
        getDocs(collection(db, "teacher_notes")),
        getDocs(collection(db, "academicRecords")),
      ]);

      const nowMs = Date.now();
      const isExpired = (a: any) => {
        if (!a.dueDate) return false;
        const dueMs = getDocTimestampMs({ createdAt: a.dueDate });
        return dueMs !== null && dueMs < nowMs;
      };

      // Map collections into All-Time and Weekly datasets per teacher
      const assignmentMap: Record<string, any[]> = {};
      const weeklyAssignmentMap: Record<string, any[]> = {};
      allAssignmentsSnap.docs.forEach((d: any) => {
        const data = d.id ? { id: d.id, ...d.data() } : d.data();
        if (isExpired(data)) return;
        const tId = data.teacherId;
        if (!tId) return;
        const className = newClassMap[data.classId] || data.className || data.classId;
        const item = { ...data, className };

        if (!assignmentMap[tId]) assignmentMap[tId] = [];
        assignmentMap[tId].push(item);

        if (isDocInCurrentWeek(data, startOfWeekMs, endOfWeekMs)) {
          if (!weeklyAssignmentMap[tId]) weeklyAssignmentMap[tId] = [];
          weeklyAssignmentMap[tId].push(item);
        }
      });

      const groupMap: Record<string, any[]> = {};
      const weeklyGroupMap: Record<string, any[]> = {};
      allGroupsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const tId = data.teacherId;
        if (!tId) return;

        if (!groupMap[tId]) groupMap[tId] = [];
        groupMap[tId].push(data);

        // Include in weekly if created/updated this week or active doc
        if (isDocInCurrentWeek(data, startOfWeekMs, endOfWeekMs) || !getDocTimestampMs(data)) {
          if (!weeklyGroupMap[tId]) weeklyGroupMap[tId] = [];
          weeklyGroupMap[tId].push(data);
        }
      });

      const topicMap: Record<string, any[]> = {};
      const weeklyTopicMap: Record<string, any[]> = {};
      allTopicsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const tId = data.teacherId;
        if (!tId) return;

        if (!topicMap[tId]) topicMap[tId] = [];
        topicMap[tId].push(data);

        if (isDocInCurrentWeek(data, startOfWeekMs, endOfWeekMs)) {
          if (!weeklyTopicMap[tId]) weeklyTopicMap[tId] = [];
          weeklyTopicMap[tId].push(data);
        }
      });

      const attendanceMap: Record<string, number> = {};
      const weeklyAttendanceMap: Record<string, number> = {};
      allAttendanceSnap.docs.forEach((d: any) => {
        const data = d.data();
        const tId = data.markedBy || data.teacherId;
        if (!tId) return;

        attendanceMap[tId] = (attendanceMap[tId] || 0) + 1;

        if (isDocInCurrentWeek(data, startOfWeekMs, endOfWeekMs)) {
          weeklyAttendanceMap[tId] = (weeklyAttendanceMap[tId] || 0) + 1;
        }
      });

      const markedSubmissionsMap: Record<string, number> = {};
      const weeklyMarkedSubmissionsMap: Record<string, number> = {};
      allSubmissionsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const tId = data.teacherId || data.markedBy;
        if (!tId) return;

        markedSubmissionsMap[tId] = (markedSubmissionsMap[tId] || 0) + 1;

        if (isDocInCurrentWeek(data, startOfWeekMs, endOfWeekMs)) {
          weeklyMarkedSubmissionsMap[tId] = (weeklyMarkedSubmissionsMap[tId] || 0) + 1;
        }
      });

      const notesMap: Record<string, number> = {};
      const weeklyNotesMap: Record<string, number> = {};
      allNotesSnap.docs.forEach((d: any) => {
        const data = d.data();
        const tId = data.teacherId || data.userId;
        if (!tId) return;

        notesMap[tId] = (notesMap[tId] || 0) + 1;

        if (isDocInCurrentWeek(data, startOfWeekMs, endOfWeekMs)) {
          weeklyNotesMap[tId] = (weeklyNotesMap[tId] || 0) + 1;
        }
      });

      const academicRecordsMap: Record<string, number> = {};
      const weeklyAcademicRecordsMap: Record<string, number> = {};
      allAcademicRecordsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const tId = data.teacherId || data.classTeacherId || data.enteredBy;
        if (!tId) return;

        academicRecordsMap[tId] = (academicRecordsMap[tId] || 0) + 1;

        if (isDocInCurrentWeek(data, startOfWeekMs, endOfWeekMs)) {
          weeklyAcademicRecordsMap[tId] = (weeklyAcademicRecordsMap[tId] || 0) + 1;
        }
      });

      // Assemble final teacher list
      const teacherList: TeacherStats[] = teacherSnap.docs.map(tDoc => {
        const t = { uid: tDoc.id, ...tDoc.data() } as any;

        // All-Time Data
        const allAssignments = assignmentMap[t.uid] || [];
        const allGroups = groupMap[t.uid] || [];
        const allTopics = topicMap[t.uid] || [];
        const allAttendance = attendanceMap[t.uid] || 0;
        const allMarkedSubmissions = markedSubmissionsMap[t.uid] || 0;
        const allNotes = notesMap[t.uid] || 0;
        const allAcademicRecords = academicRecordsMap[t.uid] || 0;

        const allTimeCalculated = computeUsageScore({
          assignmentsCount: allAssignments.length,
          topicsCount: allTopics.length,
          groupsCount: allGroups.length,
          attendanceCount: allAttendance,
          markedSubmissionsCount: allMarkedSubmissions,
          notesCount: allNotes,
          academicRecordsCount: allAcademicRecords,
        });

        const allTimeStats: ActivitySet = {
          assignments: allAssignments,
          topics: allTopics,
          groups: allGroups,
          totalAttendance: allAttendance,
          totalMarkedSubmissions: allMarkedSubmissions,
          totalNotes: allNotes,
          totalAcademicRecords: allAcademicRecords,
          usageScore: allTimeCalculated.usageScore,
          usageBreakdown: allTimeCalculated.breakdown,
        };

        // Weekly Data (Resets on Sunday)
        const wAssignments = weeklyAssignmentMap[t.uid] || [];
        const wGroups = weeklyGroupMap[t.uid] || [];
        const wTopics = weeklyTopicMap[t.uid] || [];
        const wAttendance = weeklyAttendanceMap[t.uid] || 0;
        const wMarkedSubmissions = weeklyMarkedSubmissionsMap[t.uid] || 0;
        const wNotes = weeklyNotesMap[t.uid] || 0;
        const wAcademicRecords = weeklyAcademicRecordsMap[t.uid] || 0;

        const weeklyCalculated = computeUsageScore({
          assignmentsCount: wAssignments.length,
          topicsCount: wTopics.length,
          groupsCount: wGroups.length,
          attendanceCount: wAttendance,
          markedSubmissionsCount: wMarkedSubmissions,
          notesCount: wNotes,
          academicRecordsCount: wAcademicRecords,
        });

        const weeklyStats: ActivitySet = {
          assignments: wAssignments,
          topics: wTopics,
          groups: wGroups,
          totalAttendance: wAttendance,
          totalMarkedSubmissions: wMarkedSubmissions,
          totalNotes: wNotes,
          totalAcademicRecords: wAcademicRecords,
          usageScore: weeklyCalculated.usageScore,
          usageBreakdown: weeklyCalculated.breakdown,
        };

        const teacherClasses = getTeacherClasses(t);

        return {
          uid: t.uid,
          role: t.role || "teacher",
          fullName: `${t.profile?.firstName || ""} ${t.profile?.lastName || ""}`.trim() || "Teacher",
          email: t.profile?.email || "",
          profileImage: t.profile?.profileImage,
          lastActive: t.lastActive,
          onlineTimeMinutes: t.onlineTimeMinutes || 0,
          assignedClasses: teacherClasses.map((cid: string) => newClassMap[cid] || cid),
          assignedClassIds: teacherClasses,

          // Default placeholder fields (overridden dynamically by displayTeachers)
          totalAssignments: wAssignments.length,
          pendingAssignmentsCount: wAssignments.filter(a => a.status === 'pending').length,
          totalGroups: wGroups.length,
          totalTopics: wTopics.length,
          totalAttendance: wAttendance,
          totalMarkedSubmissions: wMarkedSubmissions,
          totalNotes: wNotes,
          totalAcademicRecords: wAcademicRecords,
          usageScore: weeklyCalculated.usageScore,
          usageBreakdown: weeklyCalculated.breakdown,

          weeklyStats,
          allTimeStats,

          assignments: wAssignments,
          allTopics: wTopics,
          groups: wGroups.map(g => ({
            name: g.name || "Unnamed Group",
            className: newClassMap[g.classId] || g.classId || "General",
            memberCount: (g.studentIds || []).length
          })),
          assignmentBreakdown: [],
          topicBreakdown: []
        };
      });

      if (isMounted.current) {
        // Keep active teachers or admins with teaching duties
        const filteredList = teacherList.filter(t =>
          t.role === 'teacher' ||
          (t.allTimeStats?.totalAttendance || 0) > 0 ||
          (t.allTimeStats?.assignments?.length || 0) > 0 ||
          (t.allTimeStats?.topics?.length || 0) > 0 ||
          (t.allTimeStats?.groups?.length || 0) > 0 ||
          (t.allTimeStats?.totalAcademicRecords || 0) > 0 ||
          (t.assignedClasses && t.assignedClasses.length > 0)
        );

        setTeachers(filteredList);
        lastFetchRef.current = Date.now();

        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: filteredList,
          classMap: newClassMap
        }));
      }
    } catch (error) {
      if (isMounted.current) console.error("Error fetching teacher stats:", error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [appUser, CACHE_KEY]);

  useEffect(() => {
    if (!appUser) return;

    const init = async () => {
      let hasCachedData = false;
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached && isMounted.current) {
          const { data, classMap: cachedClassMap } = JSON.parse(cached);
          if (cachedClassMap) setClassMap(cachedClassMap);
          if (data && Array.isArray(data) && data.length > 0) {
            setTeachers(data);
            setLoading(false);
            hasCachedData = true;
          }
        }
      } catch (e) {
        console.error("Cache load error:", e);
      }

      // Fetch fresh data in background if cache loaded, or show spinner if no cache
      fetchStatistics(!hasCachedData);
    };

    init();

    const subscription = AppState.addEventListener("change", nextAppState => {
      if (nextAppState === "active" && appUser) {
        const age = Date.now() - lastFetchRef.current;
        if (age > 10 * 60 * 1000) {
          fetchStatistics(false);
        }
      }
    });

    return () => subscription.remove();
  }, [fetchStatistics, appUser, CACHE_KEY]);

  // Derived teacher list based on current timePeriod filter
  const displayTeachers = useMemo(() => {
    return teachers.map(t => {
      const isWeekly = timePeriod === "weekly";
      const sourceStats = isWeekly ? (t.weeklyStats || {}) : (t.allTimeStats || {});
      const assignments = sourceStats.assignments || [];
      const topics = sourceStats.topics || [];
      const groups = sourceStats.groups || [];

      const breakdownMap: Record<string, number> = {};
      assignments.forEach((a: any) => {
        const key = `${a.classId || "unknown"}|||${a.subjectId || a.subject || "General"}`;
        breakdownMap[key] = (breakdownMap[key] || 0) + 1;
      });

      const assignmentBreakdown = Object.entries(breakdownMap).map(([key, count]) => {
        const [classId, subject] = key.split("|||");
        return { subject, className: classMap[classId] || classId, count };
      });

      const topicBreakdownMap: Record<string, any[]> = {};
      topics.forEach((top: any) => {
        const key = `${top.classId || "unknown"}|||${top.subject || "General"}`;
        if (!topicBreakdownMap[key]) topicBreakdownMap[key] = [];
        topicBreakdownMap[key].push(top);
      });

      const topicBreakdown = Object.entries(topicBreakdownMap).map(([key, topicsList]) => {
        const [classId, subject] = key.split("|||");
        return {
          subject,
          classId,
          className: classMap[classId] || classId,
          count: topicsList.length,
          topics: topicsList.sort((a, b) => (b.weekNumber || 0) - (a.weekNumber || 0))
        };
      });

      return {
        ...t,
        totalAssignments: assignments.length,
        pendingAssignmentsCount: assignments.filter((a: any) => a.status === 'pending').length,
        totalGroups: groups.length,
        totalTopics: topics.length,
        totalAttendance: sourceStats.totalAttendance || 0,
        totalMarkedSubmissions: sourceStats.totalMarkedSubmissions || 0,
        totalNotes: sourceStats.totalNotes || 0,
        totalAcademicRecords: sourceStats.totalAcademicRecords || 0,
        usageScore: sourceStats.usageScore || 0,
        usageBreakdown: sourceStats.usageBreakdown || {},
        assignments,
        allTopics: topics,
        groups: groups.map((g: any) => ({
          name: g.name || "Unnamed Group",
          className: classMap[g.classId] || g.classId || "General",
          memberCount: (g.studentIds || []).length
        })),
        assignmentBreakdown,
        topicBreakdown,
      };
    }).sort((a, b) => (b.usageScore || 0) - (a.usageScore || 0));
  }, [teachers, timePeriod, classMap]);

  // Selected teacher currently rendered in Modal
  const activeSelectedTeacher = useMemo(() => {
    if (!selectedTeacher) return null;
    const found = displayTeachers.find(t => t.uid === selectedTeacher.uid);
    if (found) return found;
    return {
      ...selectedTeacher,
      assignments: selectedTeacher.assignments || [],
      allTopics: selectedTeacher.allTopics || [],
      groups: selectedTeacher.groups || [],
      usageBreakdown: selectedTeacher.usageBreakdown || {},
      totalAssignments: selectedTeacher.totalAssignments || 0,
      pendingAssignmentsCount: selectedTeacher.pendingAssignmentsCount || 0,
    };
  }, [selectedTeacher, displayTeachers]);

  const teacherClassFilterTabs = useMemo(() => {
    if (!activeSelectedTeacher?.assignments || activeSelectedTeacher.assignments.length === 0) return [];
    const classMapObj: Record<string, { id: string; name: string; count: number }> = {};
    activeSelectedTeacher.assignments.forEach((a: any) => {
      const cId = a.classId || "unknown";
      const cName = a.className || a.classId || "Class";
      if (!classMapObj[cId]) {
        classMapObj[cId] = { id: cId, name: cName, count: 0 };
      }
      classMapObj[cId].count += 1;
    });
    return Object.values(classMapObj);
  }, [activeSelectedTeacher]);

  const filteredTeacherAssignments = useMemo(() => {
    if (!activeSelectedTeacher?.assignments) return [];
    if (selectedClassFilter === "all") return activeSelectedTeacher.assignments;
    return activeSelectedTeacher.assignments.filter(
      (a: any) => a.classId === selectedClassFilter || a.className === selectedClassFilter
    );
  }, [activeSelectedTeacher, selectedClassFilter]);

  const handleStatusUpdate = (updatedAssignment: any) => {
    setTeachers(prev => {
      const updatedList = prev.map(t => {
        if (t.uid === updatedAssignment.teacherId) {
          const updateSet = (set: ActivitySet | undefined) => {
            const currentSet = set || {
              assignments: [],
              topics: [],
              groups: [],
              totalAttendance: 0,
              totalMarkedSubmissions: 0,
              totalNotes: 0,
              totalAcademicRecords: 0,
              usageScore: 0,
              usageBreakdown: {
                attScore: 0,
                academicScore: 0,
                topicScore: 0,
                assignmentScore: 0,
                groupScore: 0,
                submissionScore: 0,
                notesScore: 0,
              },
            };
            const updatedAssignments = (currentSet.assignments || []).map(a =>
              a.id === updatedAssignment.id ? { ...a, ...updatedAssignment } : a
            );
            return {
              ...currentSet,
              assignments: updatedAssignments,
            };
          };

          return {
            ...t,
            weeklyStats: updateSet(t.weeklyStats),
            allTimeStats: updateSet(t.allTimeStats),
          };
        }
        return t;
      });

      AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          data: updatedList,
          classMap,
        })
      ).catch(e => console.error("Error updating stats cache:", e));

      return updatedList;
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatistics();
  };

  const getUsageColor = (score: number) => {
    if (score >= 75) return "#10B981"; // Emerald
    if (score >= 45) return "#3B82F6"; // Blue
    if (score >= 20) return "#F59E0B"; // Amber / Yellow
    return "#EF4444"; // Red
  };

  const renderTeacherItem = ({ item, index }: { item: TeacherStats; index: number }) => (
    <Animatable.View animation="fadeInUp" delay={Math.min(index, 8) * 100} style={styles.teacherCard}>
      <View style={styles.cardHeader}>
        <View style={styles.teacherInfo}>
          {item.profileImage ? (
            <Image source={{ uri: item.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: primary + "20" }]}>
              <Text style={[styles.avatarText, { color: primary }]}>{item.fullName.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.teacherName}>{item.fullName}</Text>
            <Text style={styles.teacherEmail} numberOfLines={1}>{item.email}</Text>
          </View>
        </View>
        <View style={[styles.usageBadge, { backgroundColor: getUsageColor(item.usageScore) + "15" }]}>
          <Text style={[styles.usageText, { color: getUsageColor(item.usageScore) }]}>
            {Math.round(item.usageScore)}% Usage
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalAssignments}</Text>
          <Text style={styles.statLabel}>Tasks</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, item.pendingAssignmentsCount > 0 && { color: '#F59E0B' }]}>
            {item.pendingAssignmentsCount}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalAttendance || 0}</Text>
          <Text style={styles.statLabel}>Att. Logs</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalMarkedSubmissions || 0}</Text>
          <Text style={styles.statLabel}>Graded</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalTopics}</Text>
          <Text style={styles.statLabel}>Topics</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.lastActive}>
          Last Active: {item.lastActive ? moment(item.lastActive.toDate()).fromNow() : "Never"}
        </Text>
        <TouchableOpacity style={styles.viewBtn} onPress={() => setSelectedTeacher(item)}>
          <Text style={[styles.viewBtnText, { color: primary }]}>Detailed Report</Text>
          <SVGIcon name="chevron-forward" size={16} color={primary} />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
        <Text style={styles.loadingText}>Analyzing Teacher Performance...</Text>
      </View>
    );
  }

  return (
    <TierProtectedRoute featureId="admin_teacher_stats">
      <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[primary, "#1E293B"]} style={styles.headerGradient}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            onPress={() => {
              if (isNavigating.current) return;
              isNavigating.current = true;
              router.back();
            }}
            style={styles.backBtn}
          >
            <SVGIcon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Teacher Analytics</Text>
          <SVGIcon name="analytics" size={24} color={secondary} />
        </View>
        <Text style={styles.headerSubtitle}>
          Performance and engagement overview across all departments.
        </Text>

        {/* Time Period Filter Tabs */}
        <View style={styles.periodToggleContainer}>
          <TouchableOpacity
            style={[
              styles.periodTab,
              timePeriod === "weekly" && { backgroundColor: "#FFFFFF" }
            ]}
            onPress={() => setTimePeriod("weekly")}
          >
            <SVGIcon
              name="calendar"
              size={15}
              color={timePeriod === "weekly" ? primary : "rgba(255,255,255,0.8)"}
            />
            <Text
              style={[
                styles.periodTabText,
                timePeriod === "weekly" ? { color: primary, fontWeight: "900" } : { color: "rgba(255,255,255,0.9)" }
              ]}
            >
              This Week (Resets Sun)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodTab,
              timePeriod === "all_time" && { backgroundColor: "#FFFFFF" }
            ]}
            onPress={() => setTimePeriod("all_time")}
          >
            <SVGIcon
              name="analytics"
              size={15}
              color={timePeriod === "all_time" ? primary : "rgba(255,255,255,0.8)"}
            />
            <Text
              style={[
                styles.periodTabText,
                timePeriod === "all_time" ? { color: primary, fontWeight: "900" } : { color: "rgba(255,255,255,0.9)" }
              ]}
            >
              All-Time
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Weekly Date Range Banner */}
      {timePeriod === "weekly" && (
        <View style={styles.weeklyInfoBanner}>
          <SVGIcon name="time-outline" size={18} color={primary} />
          <Text style={styles.weeklyInfoText}>
            Current Weekly Period: <Text style={{ fontWeight: "800", color: primary }}>{weekRangeText}</Text> • Resets every Sunday
          </Text>
        </View>
      )}

      <FlatList
        data={displayTeachers}
        keyExtractor={(item) => item.uid}
        renderItem={renderTeacherItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <SVGIcon name="people" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No teacher data available.</Text>
          </View>
        }
      />

      {/* Detailed Teacher Report Modal */}
      <Modal
        visible={!!selectedTeacher}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTeacher(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{activeSelectedTeacher?.fullName}</Text>
                <Text style={styles.modalSubtitle}>
                  Teacher Activity Report • {timePeriod === "weekly" ? "This Week (Resets Sun)" : "All-Time"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTeacher(null)}>
                <SVGIcon name="close-circle" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Rating & Category Breakdown Section */}
              <Text style={styles.sectionTitle}>Usage Rating Breakdown ({timePeriod === "weekly" ? "This Week" : "All Time"})</Text>
              <View style={styles.breakdownCard}>
                <View style={styles.breakdownCardHeader}>
                  <Text style={styles.breakdownCardTitle}>Overall Score</Text>
                  <View style={[styles.usageBadge, { backgroundColor: getUsageColor(activeSelectedTeacher?.usageScore || 0) + "20" }]}>
                    <Text style={[styles.usageText, { color: getUsageColor(activeSelectedTeacher?.usageScore || 0), fontSize: 14 }]}>
                      {Math.round(activeSelectedTeacher?.usageScore || 0)}% Usage
                    </Text>
                  </View>
                </View>

                {/* Score Categories Progress */}
                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>Assignments / Tasks</Text>
                    <Text style={styles.categoryVal}>{activeSelectedTeacher?.usageBreakdown?.assignmentScore || 0} / 25 pts</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((activeSelectedTeacher?.usageBreakdown?.assignmentScore || 0) / 25) * 100}%`, backgroundColor: '#3B82F6' }]} />
                  </View>
                </View>

                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>Weekly Topics / Plans</Text>
                    <Text style={styles.categoryVal}>{activeSelectedTeacher?.usageBreakdown?.topicScore || 0} / 20 pts</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((activeSelectedTeacher?.usageBreakdown?.topicScore || 0) / 20) * 100}%`, backgroundColor: '#10B981' }]} />
                  </View>
                </View>

                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>Attendance Logs</Text>
                    <Text style={styles.categoryVal}>{activeSelectedTeacher?.usageBreakdown?.attScore || 0} / 20 pts (Cap 20%)</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((activeSelectedTeacher?.usageBreakdown?.attScore || 0) / 20) * 100}%`, backgroundColor: '#F59E0B' }]} />
                  </View>
                </View>

                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>Financials & Academic Reports</Text>
                    <Text style={styles.categoryVal}>{activeSelectedTeacher?.usageBreakdown?.academicScore || 0} / 10 pts (Cap 10%)</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((activeSelectedTeacher?.usageBreakdown?.academicScore || 0) / 10) * 100}%`, backgroundColor: '#8B5CF6' }]} />
                  </View>
                </View>

                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>Student Groups</Text>
                    <Text style={styles.categoryVal}>{activeSelectedTeacher?.usageBreakdown?.groupScore || 0} / 10 pts</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((activeSelectedTeacher?.usageBreakdown?.groupScore || 0) / 10) * 100}%`, backgroundColor: '#EC4899' }]} />
                  </View>
                </View>

                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>Graded Submissions</Text>
                    <Text style={styles.categoryVal}>{activeSelectedTeacher?.usageBreakdown?.submissionScore || 0} / 10 pts</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((activeSelectedTeacher?.usageBreakdown?.submissionScore || 0) / 10) * 100}%`, backgroundColor: '#06B6D4' }]} />
                  </View>
                </View>

                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>Teacher Notes</Text>
                    <Text style={styles.categoryVal}>{activeSelectedTeacher?.usageBreakdown?.notesScore || 0} / 5 pts</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((activeSelectedTeacher?.usageBreakdown?.notesScore || 0) / 5) * 100}%`, backgroundColor: '#64748B' }]} />
                  </View>
                </View>

                <Text style={styles.breakdownNote}>
                  * Attendance and routine logs contribute up to 30% max. Full usage rating requires active curriculum tasks, weekly plans, and student group engagement.
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Assigned Classes</Text>
              <View style={styles.tagContainer}>
                {activeSelectedTeacher?.assignedClasses && activeSelectedTeacher.assignedClasses.length > 0 ? (
                  activeSelectedTeacher.assignedClasses.map((c, i) => (
                    <View key={i} style={[styles.classTag, { backgroundColor: primary + "10" }]}>
                      <Text style={[styles.classTagText, { color: primary }]}>{c}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyTextSmall}>No classes assigned</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Dashboard Activity Overview</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeSelectedTeacher?.totalAssignments || 0}</Text>
                  <Text style={styles.statLabel}>Assignments</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeSelectedTeacher?.totalAttendance || 0}</Text>
                  <Text style={styles.statLabel}>Att. Logs</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeSelectedTeacher?.totalMarkedSubmissions || 0}</Text>
                  <Text style={styles.statLabel}>Graded</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeSelectedTeacher?.totalTopics || 0}</Text>
                  <Text style={styles.statLabel}>Weekly Plans</Text>
                </View>
              </View>
              <View style={[styles.statsGrid, { marginTop: 10 }]}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeSelectedTeacher?.totalAcademicRecords || 0}</Text>
                  <Text style={styles.statLabel}>Financials</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeSelectedTeacher?.totalNotes || 0}</Text>
                  <Text style={styles.statLabel}>Notes</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeSelectedTeacher?.totalGroups || 0}</Text>
                  <Text style={styles.statLabel}>Groups</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Assignments & Approval</Text>

              {teacherClassFilterTabs.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginBottom: 12, paddingVertical: 4 }}
                >
                  <TouchableOpacity
                    style={[
                      styles.classFilterChip,
                      selectedClassFilter === "all" && { backgroundColor: primary, borderColor: primary }
                    ]}
                    onPress={() => setSelectedClassFilter("all")}
                  >
                    <Text style={[
                      styles.classFilterChipText,
                      selectedClassFilter === "all" && { color: "#FFFFFF" }
                    ]}>
                      All Classes ({activeSelectedTeacher?.assignments?.length || 0})
                    </Text>
                  </TouchableOpacity>
                  {teacherClassFilterTabs.map((tab) => (
                    <TouchableOpacity
                      key={tab.id}
                      style={[
                        styles.classFilterChip,
                        selectedClassFilter === tab.id && { backgroundColor: primary, borderColor: primary }
                      ]}
                      onPress={() => setSelectedClassFilter(tab.id)}
                    >
                      <Text style={[
                        styles.classFilterChipText,
                        selectedClassFilter === tab.id && { color: "#FFFFFF" }
                      ]}>
                        {tab.name} ({tab.count})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.breakdownList}>
                {filteredTeacherAssignments && filteredTeacherAssignments.length > 0 ? (
                  filteredTeacherAssignments.map((item, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <View style={styles.breakdownInfo}>
                        <Text style={styles.breakdownClass}>{item.title}</Text>
                        <Text style={styles.breakdownSubject}>{item.className || item.classId} • {item.subjectId || item.subject}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: item.status === 'approved' ? '#10B98120' : item.status === 'rejected' ? '#EF444420' : '#F59E0B20' }]}>
                          <Text style={[styles.statusText, { color: item.status === 'approved' ? '#10B981' : item.status === 'rejected' ? '#EF4444' : '#F59E0B' }]}>
                            {item.status ? item.status.toUpperCase() : 'PENDING'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.reviewBtn, { borderColor: primary }]}
                        onPress={() => setReviewingAssignment(item)}
                      >
                        <Text style={[styles.reviewBtnText, { color: primary }]}>Review</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={styles.noDataBox}>
                    <Text style={styles.noDataText}>No assignments found for this period.</Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>Weekly Lesson Plans</Text>
              <View style={styles.breakdownList}>
                {activeSelectedTeacher?.topicBreakdown && activeSelectedTeacher.topicBreakdown.length > 0 ? (
                  activeSelectedTeacher.topicBreakdown.map((item, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <View style={styles.breakdownInfo}>
                        <Text style={styles.breakdownClass}>{item.className}</Text>
                        <Text style={styles.breakdownSubject}>{item.subject}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.countBadge, { backgroundColor: primary + "20", flexDirection: 'row', alignItems: 'center', gap: 5 }]}
                        onPress={() => setViewingTopicsList(item.topics)}
                      >
                        <Text style={[styles.countText, { color: primary }]}>{item.count} Weeks</Text>
                        <SVGIcon name="eye-outline" size={14} color={primary} />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={styles.noDataBox}>
                    <Text style={styles.noDataText}>No weekly topics recorded for this period.</Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>Student Groups</Text>
              <View style={styles.breakdownList}>
                {activeSelectedTeacher?.groups && activeSelectedTeacher.groups.length > 0 ? (
                  activeSelectedTeacher.groups.map((group, idx) => (
                    <View key={idx} style={styles.breakdownItem}>
                      <View style={styles.breakdownInfo}>
                        <Text style={styles.breakdownClass}>{group.name}</Text>
                        <Text style={styles.breakdownSubject}>{group.className}, {group.memberCount} members</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: primary + "15" }]}>
                        <SVGIcon name="people" size={14} color={primary} />
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.noDataBox}>
                    <Text style={styles.noDataText}>No groups recorded.</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: primary }]}
                onPress={() => setSelectedTeacher(null)}
              >
                <Text style={styles.closeModalBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal for Weekly Topics Detail */}
      <Modal
        visible={!!viewingTopicsList}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setViewingTopicsList(null);
          setSelectedTopicDetail(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
             <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Weekly Topics</Text>
                  <Text style={styles.modalSubtitle}>Select a week to view lesson details</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setViewingTopicsList(null);
                  setSelectedTopicDetail(null);
                }}>
                   <SVGIcon name="close-circle" size={28} color="#64748B" />
                </TouchableOpacity>
             </View>

             {selectedTopicDetail ? (
               <Animatable.View animation="fadeInRight" duration={300} style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={styles.backToTopicsBtn}
                    onPress={() => setSelectedTopicDetail(null)}
                  >
                    <SVGIcon name="arrow-back" size={16} color={primary} />
                    <Text style={[styles.backBtnText, { color: primary }]}>Back to Weekly List</Text>
                  </TouchableOpacity>

                  <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
                    <View style={styles.detailCurriculumBadge}>
                      <Text style={styles.detailCurriculumText}>
                        {selectedTopicDetail?.curriculum || "GES"} CURRICULUM
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>CLASS</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail?.className || "N/A"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>SUBJECT</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail?.subject || "N/A"}</Text>
                      </View>
                    </View>

                    <Text style={styles.detailLabel}>WEEK TOPIC / CONTENT STANDARD {selectedTopicDetail?.weekNumber ? `(WEEK #${selectedTopicDetail?.weekNumber})` : ""}</Text>
                    <Text style={styles.detailValue}>{selectedTopicDetail?.topic}</Text>

                    <View style={styles.detailRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>STRAND</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail?.strand || "N/A"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>SUB-STRAND</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail?.subStrand || "N/A"}</Text>
                      </View>
                    </View>

                    <Text style={styles.detailLabel}>INDICATOR CODE</Text>
                    <Text style={styles.detailValue}>{selectedTopicDetail?.indicatorCode || "N/A"}</Text>

                    {(selectedTopicDetail?.indicator || (selectedTopicDetail?.subTopics && selectedTopicDetail?.subTopics !== selectedTopicDetail?.topic)) && (
                      <>
                        <Text style={styles.detailLabel}>INDICATOR ITEM / STATEMENT</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail?.indicator || selectedTopicDetail?.subTopics}</Text>
                      </>
                    )}

                    {selectedTopicDetail?.subTopics && selectedTopicDetail?.indicator && selectedTopicDetail?.subTopics !== selectedTopicDetail?.indicator && (
                      <>
                        <Text style={styles.detailLabel}>SUB-TOPICS & ACTIVITIES</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail?.subTopics}</Text>
                      </>
                    )}

                    <Text style={styles.detailLabel}>LEARNING OBJECTIVES</Text>
                    <Text style={styles.detailValue}>{selectedTopicDetail?.objectives || "Not specified"}</Text>

                    {selectedTopicDetail?.teachingMethod && (
                      <>
                        <Text style={styles.detailLabel}>TEACHING METHOD / PEDAGOGY</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail.teachingMethod}</Text>
                      </>
                    )}

                    {selectedTopicDetail?.tlmRequired && (
                      <>
                        <Text style={styles.detailLabel}>REQUIRED TLM (TEACHING & LEARNING MATERIALS)</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail.tlmRequired}</Text>
                      </>
                    )}

                    {selectedTopicDetail?.starterActivity && (
                      <>
                        <Text style={styles.detailLabel}>PHASE 1: LESSON STARTER / RPK ACTIVITY</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail.starterActivity}</Text>
                      </>
                    )}

                    {selectedTopicDetail?.coreActivities && (
                      <>
                        <Text style={styles.detailLabel}>PHASE 2: CORE LESSON ACTIVITIES</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail.coreActivities}</Text>
                      </>
                    )}

                    {selectedTopicDetail?.assessmentMethod && (
                      <>
                        <Text style={styles.detailLabel}>PHASE 3: ASSESSMENT & REFLECTION</Text>
                        <Text style={styles.detailValue}>{selectedTopicDetail.assessmentMethod}</Text>
                      </>
                    )}

                    <Text style={styles.detailLabel}>DURATION</Text>
                    <Text style={styles.detailValue}>
                      {safeFormat(selectedTopicDetail?.startDate, "MMM D, YYYY")} - {safeFormat(selectedTopicDetail?.endDate, "MMM D, YYYY")}
                    </Text>
                  </ScrollView>
               </Animatable.View>
             ) : (
               <FlatList
                  data={viewingTopicsList}
                  keyExtractor={(item, idx) => `topic_${idx}`}
                  contentContainerStyle={{ padding: 10, paddingBottom: 40 }}
                  initialNumToRender={10}
                  removeClippedSubviews={Platform.OS === 'android'}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.breakdownItem}
                      onPress={() => setSelectedTopicDetail(item)}
                    >
                      <View style={styles.breakdownInfo}>
                        <Text style={styles.breakdownClass}>
                          {item.className ? `${item.className} • ` : ''}{item.subject ? `${item.subject} • ` : ''}Week {item.weekNumber || '-'}: {item.topic}
                        </Text>
                        <Text style={styles.breakdownSubject}>{safeFormat(item.startDate, "MMM D")} - {safeFormat(item.endDate, "MMM D")}</Text>
                      </View>
                      <SVGIcon name="chevron-forward" size={18} color={primary} />
                    </TouchableOpacity>
                  )}
               />
             )}
          </View>
        </View>
      </Modal>

      <AssignmentReviewModal
        assignment={reviewingAssignment}
        visible={!!reviewingAssignment}
        onClose={() => setReviewingAssignment(null)}
        onStatusUpdate={handleStatusUpdate}
      />
    </SafeAreaView>
  </TierProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerGradient: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    flex: 1,
    marginLeft: 15,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    marginBottom: 15,
  },
  periodToggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  periodTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  weeklyInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 8,
  },
  weeklyInfoText: {
    fontSize: 13,
    color: "#1E3A8A",
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#64748B",
    fontWeight: "600",
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  teacherCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  teacherInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  teacherName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  teacherEmail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  usageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  usageText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  statLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  lastActive: {
    fontSize: 12,
    color: "#94A3B8",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  viewBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCenter: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: "#94A3B8",
    fontWeight: "600",
  },
  emptyTextSmall: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 20,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  breakdownCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  breakdownCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  breakdownCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  categoryRow: {
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  categoryVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  breakdownNote: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 10,
    lineHeight: 16,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  classTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  classTagText: {
    fontSize: 13,
    fontWeight: "700",
  },
  classFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  classFilterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  breakdownList: {
    gap: 10,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  breakdownInfo: {
    flex: 1,
    paddingRight: 10,
  },
  breakdownClass: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  breakdownSubject: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  reviewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: "800",
  },
  noDataBox: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  noDataText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  closeModalBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 25,
    marginBottom: 10,
  },
  closeModalBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  backToTopicsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  detailCurriculumBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 15,
  },
  detailCurriculumText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 15,
    gap: 15,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 15,
  },
});
