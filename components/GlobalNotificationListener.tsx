import React, { useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebaseConfig";
import { useToast } from "../contexts/ToastContext";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const GlobalNotificationListener = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!appUser?.uid) return;

    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", appUser.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();

          // Show in-app toast
          showToast({
            message: `${data.title}: ${data.body}`,
            type: "info",
          });

          // Show local push notification if not on web
          if (Platform.OS !== "web") {
            Notifications.scheduleNotificationAsync({
              content: {
                title: data.title,
                body: data.body,
                data: data.data || {},
                sound: true,
              },
              trigger: null, // show immediately
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [appUser?.uid]);

  return null;
};
