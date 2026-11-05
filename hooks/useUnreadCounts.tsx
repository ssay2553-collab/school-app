import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    doc,
    getDoc,
    getCountFromServer,
    limit,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
    where,
    or,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { db } from "../firebaseConfig";
import { isEligibleAdminRecipient } from "../src/services/notificationService";

type CountsMap = Record<string, number>;

const GROUP_SEEN_KEY = (id: string) => `@lastSeen_group_${id}`;
const DIRECT_SEEN_KEY = (id: string) => `@lastSeen_direct_${id}`;
const STAFF_GROUP_SEEN_KEY = (id: string) => `@lastSeen_staff_group_${id}`;

export default function useUnreadCounts() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [groupUnread, setGroupUnread] = useState<CountsMap>({});
  const [directUnread, setDirectUnread] = useState<CountsMap>({});
  const [staffGroupUnread, setStaffGroupUnread] = useState<CountsMap>({});

  const groupUnsubs = useRef<Record<string, () => void>>({});
  const directUnsubs = useRef<Record<string, () => void>>({});
  const staffGroupUnsubs = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!appUser?.uid) return;

    // Watch student groups that include this user
    let q;
    if (appUser.role === 'teacher') {
      q = query(
        collection(db, "studentGroups"),
        where("teacherId", "==", appUser.uid)
      );
    } else if (appUser.role === 'staff' || appUser.role === 'admin') {
      q = query(
        collection(db, "studentGroups"),
        where("staffIds", "array-contains", appUser.uid)
      );
    } else if (appUser.role === 'student') {
      q = query(
        collection(db, "studentGroups"),
        where("studentIds", "array-contains", appUser.uid)
      );
    }

    if (!q) return;

    const unsub = onSnapshot(q, (snap) => {
      const ids: string[] = snap.docs.map((d) => d.id);
      // start watchers for new groups
      ids.forEach((id) => {
        if (!groupUnsubs.current[id]) watchGroup(id);
      });
      // remove watchers for deleted groups
      Object.keys(groupUnsubs.current).forEach((existing) => {
        if (!ids.includes(existing)) {
          groupUnsubs.current[existing]?.();
          delete groupUnsubs.current[existing];
          setGroupUnread((g) => {
            const copy = { ...g };
            delete copy[existing];
            return copy;
          });
        }
      });
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("studentGroups listener failed", err);
    });

    return () => {
      unsub();
      Object.values(groupUnsubs.current).forEach((u) => u && u());
      groupUnsubs.current = {};
    };
  }, [appUser?.uid]);

  // Listen to server-side unread counters on the user document if present
  useEffect(() => {
    if (!appUser?.uid || appUser.role === 'admin') return;
    const userRef = doc(db, "users", appUser.uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data: any = snap.data();
        const unreads = data?.unreads || null;
        if (unreads) {
          // prefer server-side counters
          setGroupUnread(unreads.groups || {});
          setDirectUnread(unreads.direct || {});
        }
      },
      (err) => {
        if (err.code === 'permission-denied') return;
        console.warn("user unreads listener failed", err);
      },
    );

    return () => unsub();
  }, [appUser?.uid]);

  // Real-time listener for unread chat notifications from notifications collection
  useEffect(() => {
    if (!appUser?.uid) return;

    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", appUser.uid),
      where("read", "==", false),
      where("type", "==", "chat")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const newDirect: CountsMap = {};
        const newGroup: CountsMap = {};
        const newStaffGroup: CountsMap = {};

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const chatId = data.data?.chatId || data.data?.parentUid || data.senderId || docSnap.id;
          const groupId = data.data?.groupId;

          if (groupId) {
            newGroup[groupId] = (newGroup[groupId] || 0) + 1;
          } else if (chatId) {
            newDirect[chatId] = (newDirect[chatId] || 0) + 1;
          }
        });

        setDirectUnread((prev) => ({ ...prev, ...newDirect }));
        setGroupUnread((prev) => ({ ...prev, ...newGroup }));
        setStaffGroupUnread((prev) => ({ ...prev, ...newStaffGroup }));
      },
      (err) => {
        if (err.code === "permission-denied") return;
        console.warn("unread chat notifications listener failed", err);
      }
    );

    return () => unsub();
  }, [appUser?.uid]);

  const watchGroup = async (groupId: string) => {
    try {
      const messagesRef = collection(db, "studentGroups", groupId, "messages");
      const latestQ = query(
        messagesRef,
        orderBy("timestamp", "desc"),
        limit(1),
      );
      const unsub = onSnapshot(latestQ, async (snap) => {
        const lastMsg = snap.docs[0]?.data();

        // FIX: Don't count as unread if I sent the message
        if (lastMsg?.senderId === appUser?.uid) {
          setGroupUnread((g) => ({ ...g, [groupId]: 0 }));
          return;
        }

        const latestTs = lastMsg?.timestamp?.toMillis?.() || 0;
        const seenKey = GROUP_SEEN_KEY(groupId);
        const seenStr = await AsyncStorage.getItem(seenKey);
        const seen = seenStr ? parseInt(seenStr, 10) : 0;
        if (!latestTs || latestTs <= seen) {
          setGroupUnread((g) => ({ ...g, [groupId]: 0 }));
          return;
        }
        // count messages since seen
        try {
          const countQ = query(
            messagesRef,
            where("timestamp", ">", Timestamp.fromMillis(seen)),
            orderBy("timestamp", "asc"),
          );
          const snapCount = await getCountFromServer(countQ as any);
          setGroupUnread((g) => ({
            ...g,
            [groupId]: snapCount.data().count || 0,
          }));
        } catch (err: any) {
          // fallback to indicator
          if (err.code !== 'permission-denied') {
            setGroupUnread((g) => ({ ...g, [groupId]: 1 }));
          }
        }
      }, (err) => {
        if (err.code === 'permission-denied') return;
        console.warn("watchGroup onSnapshot error", err);
      });
      groupUnsubs.current[groupId] = unsub;
    } catch (err) {
      console.warn("watchGroup error", err);
    }
  };

  // Direct chat watchers are created when components register chatIds
  const registerDirectChat = (chatId: string) => {
    if (directUnsubs.current[chatId]) return;
    const messagesRef = collection(db, "directMessages", chatId, "messages");
    const latestQ = query(messagesRef, orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(latestQ, async (snap) => {
      const lastMsg = snap.docs[0]?.data();
      // FIX: Don't count as unread if I sent the message
      if (lastMsg?.senderId === appUser?.uid) {
        setDirectUnread((d) => ({ ...d, [chatId]: 0 }));
        return;
      }

      const latestTs = lastMsg?.createdAt?.toMillis?.() || 0;
      const seenKey = DIRECT_SEEN_KEY(chatId);
      const seenStr = await AsyncStorage.getItem(seenKey);
      const seen = seenStr ? parseInt(seenStr, 10) : 0;
      if (!latestTs || latestTs <= seen) {
        setDirectUnread((d) => ({ ...d, [chatId]: 0 }));
        return;
      }
      try {
        const countQ = query(
          messagesRef,
          where("createdAt", ">", Timestamp.fromMillis(seen)),
          orderBy("createdAt", "asc"),
        );
        const snapCount = await getCountFromServer(countQ as any);
        setDirectUnread((d) => ({
          ...d,
          [chatId]: snapCount.data().count || 0,
        }));
      } catch (err: any) {
        if (err.code !== 'permission-denied') {
          setDirectUnread((d) => ({ ...d, [chatId]: 1 }));
        }
      }
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("registerDirectChat onSnapshot error", err);
    });
    directUnsubs.current[chatId] = unsub;
  };

  const unregisterDirectChat = (chatId: string) => {
    if (directUnsubs.current[chatId]) {
      directUnsubs.current[chatId]?.();
      delete directUnsubs.current[chatId];
      setDirectUnread((d) => {
        const c = { ...d };
        delete c[chatId];
        return c;
      });
    }
  };

  const registerStaffGroup = (groupId: string) => {
    if (staffGroupUnsubs.current[groupId]) return;
    const messagesRef = collection(db, "staffGroups", groupId, "messages");
    const latestQ = query(messagesRef, orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(latestQ, async (snap) => {
      const lastMsg = snap.docs[0]?.data();
      if (lastMsg?.senderId === appUser?.uid) {
        setStaffGroupUnread((g) => ({ ...g, [groupId]: 0 }));
        return;
      }

      const latestTs = lastMsg?.createdAt?.toMillis?.() || 0;
      const seenKey = STAFF_GROUP_SEEN_KEY(groupId);
      const seenStr = await AsyncStorage.getItem(seenKey);
      const seen = seenStr ? parseInt(seenStr, 10) : 0;
      if (!latestTs || latestTs <= seen) {
        setStaffGroupUnread((g) => ({ ...g, [groupId]: 0 }));
        return;
      }
      try {
        const countQ = query(
          messagesRef,
          where("createdAt", ">", Timestamp.fromMillis(seen)),
          orderBy("createdAt", "asc"),
        );
        const snapCount = await getCountFromServer(countQ as any);
        setStaffGroupUnread((g) => ({
          ...g,
          [groupId]: snapCount.data().count || 0,
        }));
      } catch (err: any) {
        if (err.code !== 'permission-denied') {
          setStaffGroupUnread((g) => ({ ...g, [groupId]: 1 }));
        }
      }
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("registerStaffGroup onSnapshot error", err);
    });
    staffGroupUnsubs.current[groupId] = unsub;
  };

  const unregisterStaffGroup = (groupId: string) => {
    if (staffGroupUnsubs.current[groupId]) {
      staffGroupUnsubs.current[groupId]?.();
      delete staffGroupUnsubs.current[groupId];
      setStaffGroupUnread((g) => {
        const copy = { ...g };
        delete copy[groupId];
        return copy;
      });
    }
  };

  const markChatRead = async (type: "group" | "direct" | "staffGroup", id: string) => {
    try {
      const key = type === "group" ? GROUP_SEEN_KEY(id) : type === "staffGroup" ? STAFF_GROUP_SEEN_KEY(id) : DIRECT_SEEN_KEY(id);
      await AsyncStorage.setItem(key, Date.now().toString());
      if (type === "group") setGroupUnread((g) => ({ ...g, [id]: 0 }));
      else if (type === "staffGroup") setStaffGroupUnread((g) => ({ ...g, [id]: 0 }));
      else setDirectUnread((d) => ({ ...d, [id]: 0 }));
    } catch (err) {
      console.warn("markChatRead error", err);
    }
  };

  const [assignmentUnread, setAssignmentUnread] = useState<number>(0);
  const [submissionUnread, setSubmissionUnread] = useState<number>(0);
  const [allAssignmentIds, setAllAssignmentIds] = useState<string[]>([]);
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);

  // Watch Assignments
  useEffect(() => {
    if (!appUser?.uid) return;

    let assignmentQuery;
    if (appUser.role === "student" && appUser.classId) {
      assignmentQuery = query(
        collection(db, "assignments"),
        where("classId", "==", appUser.classId)
      );
    } else if (appUser.role === "parent" && appUser.childrenClassIds?.length) {
      assignmentQuery = query(
        collection(db, "assignments"),
        where("classId", "in", appUser.childrenClassIds)
      );
    }

    if (!assignmentQuery) {
      setAllAssignmentIds([]);
      return;
    }

    const unsub = onSnapshot(assignmentQuery, (snap) => {
      setAllAssignmentIds(snap.docs.map(d => d.id));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("Watch Assignments error", err);
    });

    return () => unsub();
  }, [appUser?.uid, appUser?.role, appUser?.classId, appUser?.childrenClassIds]);

  // Watch Submissions
  useEffect(() => {
    if (!appUser?.uid) return;

    let submissionQuery;
    if (appUser.role === "student") {
      submissionQuery = query(
        collection(db, "submissions"),
        where("studentId", "==", appUser.uid)
      );
    } else if (appUser.role === "parent" && appUser.childrenIds?.length) {
      submissionQuery = query(
        collection(db, "submissions"),
        where("studentId", "in", appUser.childrenIds)
      );
    }

    if (!submissionQuery) {
      setSubmittedIds([]);
      return;
    }

    const unsub = onSnapshot(submissionQuery, (snap) => {
      setSubmittedIds(snap.docs.map(d => d.data().assignmentId));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("Watch Submissions error", err);
    });

    return () => unsub();
  }, [appUser?.uid, appUser?.role, appUser?.childrenIds]);

  // Derived Unread Count
  useEffect(() => {
    const unreadCount = allAssignmentIds.filter(id => !submittedIds.includes(id)).length;
    setAssignmentUnread(unreadCount);
  }, [allAssignmentIds, submittedIds]);

  // Watch Marked Submissions (for Teachers)
  useEffect(() => {
    if (!appUser?.uid || appUser.role !== "teacher") return;

    const submissionsQ = query(
      collection(db, "submissions"),
      where("teacherId", "==", appUser.uid),
      where("marked", "==", false)
    );

    const unsub = onSnapshot(submissionsQ, (snap) => {
      setSubmissionUnread(snap.docs.length);
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("Watch Marked Submissions error", err);
    });

    return () => unsub();
  }, [appUser?.uid, appUser?.role]);

  const totalUnread =
    Object.values(groupUnread).reduce((s, v) => s + (v || 0), 0) +
    Object.values(directUnread).reduce((s, v) => s + (v || 0), 0) +
    Object.values(staffGroupUnread).reduce((s, v) => s + (v || 0), 0);

  // Assignment Notification Trigger
  const prevAssignmentUnreadRef = useRef<number>(0);
  useEffect(() => {
    if (!appUser?.uid) return;

    const prev = prevAssignmentUnreadRef.current || 0;
    if (assignmentUnread > prev) {
      const diff = assignmentUnread - prev;
      const title = appUser.role === "parent" ? "New Child Assignment" : "New Homework!";
      const message = appUser.role === "parent"
        ? `Your children have ${diff} new assignment(s) to complete.`
        : `You have ${diff} new assignment(s). Time to learn!`;

      if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.LONG);
      } else {
        showToast({ message: `${title}: ${message}`, type: "info" });
      }
    }
    prevAssignmentUnreadRef.current = assignmentUnread;
  }, [assignmentUnread, appUser?.uid, appUser?.role, showToast]);

  // Message Notification Trigger
  const prevTotalRef = useRef<number>(0);
  useEffect(() => {
    if (!appUser?.uid) return;

    const prev = prevTotalRef.current || 0;
    if (totalUnread > prev) {
      const diff = totalUnread - prev;
      try {
        if (Platform.OS === "android") {
          ToastAndroid.show(
            `You have ${diff} new message(s)`,
            ToastAndroid.SHORT,
          );
        } else {
          showToast({ message: `💬 You have ${diff} new message(s)`, type: "info" });
        }
      } catch (e) {
        /* ignore */
      }
    }
    prevTotalRef.current = totalUnread;
  }, [totalUnread, appUser?.uid, showToast]);

  const [academicRecordUnread, setAcademicRecordUnread] = useState<number>(0);
  const [pendingAssignmentApprovalCount, setPendingAssignmentApprovalCount] = useState<number>(0);

  // Watch Pending Academic Records Awaiting Approval (for Admins & Staff)
  useEffect(() => {
    if (!appUser?.uid || !isEligibleAdminRecipient(appUser)) {
      setAcademicRecordUnread(0);
      return;
    }

    const q = query(
      collection(db, "academicRecords"),
      where("status", "in", ["pending", "partially_approved"])
    );

    const unsub = onSnapshot(q, async (snap) => {
      try {
        const configSnap = await getDoc(doc(db, "school_settings", "academic_config"));
        const configData = configSnap.exists() ? configSnap.data() : {};
        const currentYear = configData.academicYear || "";
        const currentTerm = configData.currentTerm || "";

        const filteredDocs = snap.docs.filter(d => {
          const data = d.data() as any;
          const status = data.status;
          if (status === "draft" || status === "approved") return false;
          if (!status || (status !== "pending" && status !== "partially_approved")) return false;

          if (currentYear && data.academicYear && data.academicYear !== currentYear) return false;
          if (currentTerm && data.term && data.term !== currentTerm) return false;

          return true;
        });

        setAcademicRecordUnread(filteredDocs.length);
      } catch (e) {
        setAcademicRecordUnread(snap.docs.length);
      }
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("Watch Pending Academic Records error", err);
    });

    return () => unsub();
  }, [appUser]);

  // Watch Pending Assignments Awaiting Approval (for Admins & Staff)
  useEffect(() => {
    if (!appUser?.uid || !isEligibleAdminRecipient(appUser)) {
      setPendingAssignmentApprovalCount(0);
      return;
    }

    const q = query(
      collection(db, "assignments"),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      setPendingAssignmentApprovalCount(snap.docs.length);
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.warn("Watch Pending Assignments Approval error", err);
    });

    return () => unsub();
  }, [appUser]);

  return {
    totalUnread,
    groupUnread,
    directUnread,
    staffGroupUnread,
    assignmentUnread,
    submissionUnread,
    academicRecordUnread,
    pendingAssignmentApprovalCount,
    registerDirectChat,
    unregisterDirectChat,
    registerStaffGroup,
    unregisterStaffGroup,
    markChatRead,
  };
}
