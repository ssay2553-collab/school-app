import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "../contexts/AuthContext";
import { NotificationPayload, markNotificationsAsRead } from "../src/services/notificationService";

export interface ExtendedNotification extends NotificationPayload {
  id: string;
  read: boolean;
  timestamp: any;
}

export function useUnreadNotifications() {
  const { appUser } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState<ExtendedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!appUser?.uid) {
      setUnreadNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Query without orderBy("timestamp", "desc") to prevent Firestore composite index requirements
    // and local optimistic write exclusions when timestamp is serverTimestamp().
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", appUser.uid),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: ExtendedNotification[] = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as NotificationPayload),
            read: d.data().read ?? false,
            timestamp: d.data().timestamp,
          }))
          .sort((a, b) => {
            const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : Date.now());
            const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : Date.now());
            return tB - tA;
          });

        setUnreadNotifications(items);
        setUnreadCount(items.length);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening for unread notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [appUser?.uid]);

  const clearAll = async () => {
    if (appUser?.uid) {
      await markNotificationsAsRead(appUser.uid);
    }
  };

  return { unreadNotifications, unreadCount, loading, clearAll };
}

