import React, { useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebaseConfig";
import { useToast } from "../contexts/ToastContext";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const GlobalNotificationListener = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const lastNotifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (!appUser?.uid) return;

    // 1. Listen for in-app Firestore notifications
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", appUser.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc"),
      limit(5) // Show up to 5 recent unread ones if they just arrived
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const notifId = change.doc.id;

          // Prevent duplicate processing if listener re-triggers
          if (lastNotifiedId.current === notifId) return;
          lastNotifiedId.current = notifId;

          // Show in-app toast
          showToast({
            message: `${data.title}: ${data.body}`,
            type: "info",
          });

          // Mark as read immediately after showing toast so it doesn't pop up again
          try {
            await updateDoc(doc(db, "notifications", notifId), {
              read: true,
              readAt: serverTimestamp()
            });
          } catch (e) {
            console.error("Error marking notification as read:", e);
          }

          // Show local push notification if not on web and app is in background/quit
          // Note: expo-notifications handles foreground display via setNotificationHandler in _layout.tsx
          if (Platform.OS !== "web") {
            Notifications.scheduleNotificationAsync({
              content: {
                title: data.title,
                body: data.body,
                data: { ...data.data, firestoreId: notifId } || { firestoreId: notifId },
                sound: true,
              },
              trigger: null, // show immediately
            });
          }
        }
      });
    });

    // 2. Handle push notification interactions (clicks)
    const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.firestoreId) {
        try {
          await updateDoc(doc(db, "notifications", data.firestoreId), {
            read: true,
            readAt: serverTimestamp()
          });
        } catch (e) {
          console.error("Error marking clicked notification as read:", e);
        }
      }
    });

    return () => {
      unsubscribe();
      responseListener.remove();
    };
  }, [appUser?.uid]);

  return null;
};
