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
      where("studentIds", "array-contains", appUser.uid),
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

  const totalUnread =
    Object.values(groupUnread).reduce((s, v) => s + (v || 0), 0) +
    Object.values(directUnread).reduce((s, v) => s + (v || 0), 0);

  // Simple toast/notification for new unread messages (cross-device indicator)
  const prevTotalRef = useRef<number>(0);
  useEffect(() => {
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
          Alert.alert("New messages", `You have ${diff} new message(s)`);
        }
      } catch (e) {
        /* ignore */
      }
    }
    prevTotalRef.current = totalUnread;
  }, [totalUnread]);

  return {
    totalUnread,
    groupUnread,
    directUnread,
    registerDirectChat,
    unregisterDirectChat,
    markChatRead,
  };
}
