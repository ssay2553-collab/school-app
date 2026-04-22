import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    doc,
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
import { db } from "../firebaseConfig";

type CountsMap = Record<string, number>;

const GROUP_SEEN_KEY = (id: string) => `@lastSeen_group_${id}`;
const DIRECT_SEEN_KEY = (id: string) => `@lastSeen_direct_${id}`;

export default function useUnreadCounts() {
  const { appUser } = useAuth();
  const [groupUnread, setGroupUnread] = useState<CountsMap>({});
  const [directUnread, setDirectUnread] = useState<CountsMap>({});

  const groupUnsubs = useRef<Record<string, () => void>>({});
  const directUnsubs = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!appUser?.uid) return;

    // Watch student groups that include this user
    const q = query(
      collection(db, "studentGroups"),
      or(
        where("studentIds", "array-contains", appUser.uid),
        where("teacherId", "==", appUser.uid),
        where("staffIds", "array-contains", appUser.uid)
      )
    );
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
    });

    return () => {
      unsub();
      Object.values(groupUnsubs.current).forEach((u) => u && u());
      groupUnsubs.current = {};
    };
  }, [appUser?.uid]);

  // Listen to server-side unread counters on the user document if present
  useEffect(() => {
    if (!appUser?.uid) return;
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
        console.warn("user unreads listener failed", err);
      },
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
        } catch (err) {
          // fallback to indicator
          setGroupUnread((g) => ({ ...g, [groupId]: 1 }));
        }
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
      } catch (err) {
        setDirectUnread((d) => ({ ...d, [chatId]: 1 }));
      }
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

  const markChatRead = async (type: "group" | "direct", id: string) => {
    try {
      const key = type === "group" ? GROUP_SEEN_KEY(id) : DIRECT_SEEN_KEY(id);
      await AsyncStorage.setItem(key, Date.now().toString());
      if (type === "group") setGroupUnread((g) => ({ ...g, [id]: 0 }));
      else setDirectUnread((d) => ({ ...d, [id]: 0 }));
    } catch (err) {
      console.warn("markChatRead error", err);
    }
  };

  const [assignmentUnread, setAssignmentUnread] = useState<number>(0);
  const [submissionUnread, setSubmissionUnread] = useState<number>(0);

  // Watch Assignments (for Students)
  useEffect(() => {
    if (!appUser?.uid || appUser.role !== "student" || !appUser.classId) return;

    // First, get all assignments for this class
    const assignmentsQ = query(
      collection(db, "assignments"),
      where("classId", "==", appUser.classId)
    );

    const unsubAssignments = onSnapshot(assignmentsQ, (assignmentSnap) => {
      const allAssignmentIds = assignmentSnap.docs.map(d => d.id);

      // Then, get all submissions by this student
      const submissionsQ = query(
        collection(db, "submissions"),
        where("studentId", "==", appUser.uid)
      );

      const unsubSubmissions = onSnapshot(submissionsQ, (subSnap) => {
        const submittedIds = subSnap.docs.map(d => d.data().assignmentId);
        const unreadCount = allAssignmentIds.filter(id => !submittedIds.includes(id)).length;
        setAssignmentUnread(unreadCount);
      });

      return () => unsubSubmissions();
    });

    return () => unsubAssignments();
  }, [appUser?.uid, appUser?.role, appUser?.classId]);

  // Watch Submissions (for Teachers)
  useEffect(() => {
    if (!appUser?.uid || appUser.role !== "teacher") return;

    const submissionsQ = query(
      collection(db, "submissions"),
      where("teacherId", "==", appUser.uid),
      where("marked", "==", false)
    );

    const unsub = onSnapshot(submissionsQ, (snap) => {
      setSubmissionUnread(snap.docs.length);
    });

    return () => unsub();
  }, [appUser?.uid, appUser?.role]);

  const totalUnread =
    Object.values(groupUnread).reduce((s, v) => s + (v || 0), 0) +
    Object.values(directUnread).reduce((s, v) => s + (v || 0), 0);

  // Simple toast/notification for new unread messages (cross-device indicator)
  const prevTotalRef = useRef<number>(0);
  useEffect(() => {
    // Only notify if we have valid user and the total increased
    if (!appUser?.uid) return;

    const prev = prevTotalRef.current || 0;
    if (totalUnread > prev) {
      // Logic: Only notify if the last message in any of the chats was NOT sent by me
      // This is a bit complex without the full message context here,
      // but we can at least avoid notifying if totalUnread is 0 or if we're currently in a chat.

      const diff = totalUnread - prev;
      try {
        if (Platform.OS === "android") {
          ToastAndroid.show(
            `You have ${diff} new message(s)`,
            ToastAndroid.SHORT,
          );
        } else {
          // Alert is too intrusive for every message, but keeps consistency with previous code
          // In a real app, this would be a Push Notification or a subtle UI indicator
          Alert.alert("New messages", `You have ${diff} new message(s)`);
        }
      } catch (e) {
        /* ignore */
      }
    }
    prevTotalRef.current = totalUnread;
  }, [totalUnread, appUser?.uid]);

  return {
    totalUnread,
    groupUnread,
    directUnread,
    assignmentUnread,
    submissionUnread,
    registerDirectChat,
    unregisterDirectChat,
    markChatRead,
  };
}
