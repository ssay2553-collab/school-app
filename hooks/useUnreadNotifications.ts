import { useState, useEffect } from "react";
import { collection, doc, getDoc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "../contexts/AuthContext";
import {
  NotificationPayload,
  markNotificationsAsRead,
  markSingleNotificationAsRead,
} from "../src/services/notificationService";

export interface ExtendedNotification extends NotificationPayload {
  id: string;
  read: boolean;
  timestamp: any;
  resolved?: boolean;
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

    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", appUser.uid),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rawItems: ExtendedNotification[] = snapshot.docs
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

        // Smart check: Verify whether pending items have already been attended to/approved
        const validItems: ExtendedNotification[] = [];

        for (const item of rawItems) {
          let isResolved = false;
          try {
            if (item.type === "score" && item.data?.docId) {
              const recSnap = await getDoc(doc(db, "academicRecords", item.data.docId));
              if (recSnap.exists() && recSnap.data()?.status === "approved") {
                isResolved = true;
              }
            } else if (item.type === "assignment" && item.data?.assignmentId) {
              const asgSnap = await getDoc(doc(db, "assignments", item.data.assignmentId));
              if (asgSnap.exists() && asgSnap.data()?.status === "approved") {
                isResolved = true;
              }
            } else if (item.type === "submission" && item.data?.submissionId) {
              const subSnap = await getDoc(doc(db, "submissions", item.data.submissionId));
              if (subSnap.exists() && subSnap.data()?.marked === true) {
                isResolved = true;
              }
            }
          } catch (e) {
            // Ignore error and retain item
          }

          if (isResolved) {
            // Silently mark resolved notification as read in Firestore
            markSingleNotificationAsRead(item.id);
          } else {
            validItems.push(item);
          }
        }

        setUnreadNotifications(validItems);
        setUnreadCount(validItems.length);
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

