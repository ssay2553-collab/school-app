import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { db } from "../firebaseConfig";
import { checkAndSendMonthlyFeeReminders } from "../src/services/feeReminderService";
import {
    isEligibleAdminRecipient,
    sendNotification,
} from "../src/services/notificationService";
import {
    registerWebPushToken,
    setupForegroundPushListener,
} from "../src/services/webPushService";

let flashInterval: any = null;
const originalTitle =
  typeof document !== "undefined" ? document.title || "EduEaz" : "EduEaz";

function triggerTabTitleFlashing(title: string) {
  if (typeof document === "undefined") return;

  if (flashInterval) clearInterval(flashInterval);

  let showAlert = true;
  flashInterval = setInterval(() => {
    document.title = showAlert ? `🔔 (1) ${title}` : originalTitle;
    showAlert = !showAlert;
  }, 1000);

  const stopFlashing = () => {
    if (flashInterval) clearInterval(flashInterval);
    document.title = originalTitle;
    window.removeEventListener("focus", stopFlashing);
  };

  window.addEventListener("focus", stopFlashing);
}

export const GlobalNotificationListener = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const lastNotifiedId = useRef<string | null>(null);
  const isInitialSnapshot = useRef<boolean>(true);
  const lastSoundTime = useRef<number>(0);
  const notifForPendingAssignments = useRef<Set<string>>(new Set());
  const notifForPendingRecords = useRef<Set<string>>(new Set());

  const playChimeSound = async () => {
    const now = Date.now();
    if (now - lastSoundTime.current < 1500) return; // Throttle sound within 1.5s
    lastSoundTime.current = now;
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/notification.mp3"),
      );
      await sound.playAsync();
    } catch (e) {
      // Audio focus or Web autoplay restrictions
    }
  };

  useEffect(() => {
    if (!appUser?.uid) return;

    // Reset initial snapshot flag on user change
    isInitialSnapshot.current = true;

    // Register Web Push Token for background OS Notifications (works when PWA/tab is closed)
    if (Platform.OS === "web") {
      registerWebPushToken(appUser.uid);
      setupForegroundPushListener((payload) => {
        const title = payload?.notification?.title || "EduEaz Alert";
        const body = payload?.notification?.body || "";
        if (title && body) {
          showToast({ message: `${title}: ${body}`, type: "info" });
          playChimeSound();
        }
      });
    }

    // Request Web / Desktop OS Notification permission safely on user gesture if supported
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      "Notification" in window
    ) {
      if (Notification.permission === "default") {
        const handleUserGesture = () => {
          if (Notification.permission === "default") {
            Notification.requestPermission()
              .then(() => registerWebPushToken(appUser.uid))
              .catch(() => {});
          }
          window.removeEventListener("click", handleUserGesture);
          window.removeEventListener("keydown", handleUserGesture);
          window.removeEventListener("touchstart", handleUserGesture);
        };
        window.addEventListener("click", handleUserGesture);
        window.addEventListener("keydown", handleUserGesture);
        window.addEventListener("touchstart", handleUserGesture);
      }
    }

    // Automated monthly fee debt check
    checkAndSendMonthlyFeeReminders(appUser.role);

    // Listen for in-app Firestore notifications for current user.
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", appUser.uid),
      where("read", "==", false),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Handle initial snapshot load upon login: play ONE chime and ONE summary toast
        if (isInitialSnapshot.current) {
          isInitialSnapshot.current = false;
          const unreadCount = snapshot.docs.length;
          if (unreadCount > 0) {
            playChimeSound();
            showToast({
              message:
                unreadCount === 1
                  ? `${snapshot.docs[0].data().title}: ${snapshot.docs[0].data().body}`
                  : `🔔 You have ${unreadCount} unattended notification(s) to review`,
              type: "info",
            });
            snapshot.docs.forEach((docSnap) => {
              lastNotifiedId.current = docSnap.id;
            });
          }
          return;
        }

        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const notifId = change.doc.id;

            // Prevent duplicate toast processing if listener re-triggers
            if (lastNotifiedId.current === notifId) return;
            lastNotifiedId.current = notifId;

            // 1. Show in-app toast notification
            showToast({
              message: `${data.title}: ${data.body}`,
              type: "info",
            });

            // 2. Play audio sound chime (throttled to 1 chime)
            playChimeSound();

            // 3. Tab title flashing & Desktop OS Notification for Web / Desktop
            if (Platform.OS === "web") {
              triggerTabTitleFlashing(data.title);
              if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                try {
                  new Notification(data.title, {
                    body: data.body,
                    icon: "/icon-192.png",
                  });
                } catch (e) {
                  console.warn("Desktop notification trigger failed:", e);
                }
              }
            }

            // 4. Local Push notification for mobile devices (Android / iOS)
            if (Platform.OS !== "web") {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: data.title,
                  body: data.body,
                  data: { ...(data.data || {}), firestoreId: notifId },
                  sound: true,
                },
                trigger: null,
              });
            }
          }
        });
      },
      (error) => {
        console.error("GlobalNotificationListener Firestore query error:", error);
      },
    );

    // Fallback 1: if a teacher assignment is created with status "pending",
    // notify every eligible admin user directly so approvals are never missed.
    const pendingAssignmentsQuery = query(
      collection(db, "assignments"),
      where("status", "==", "pending"),
    );

    const pendingAssignmentsUnsubscribe = onSnapshot(
      pendingAssignmentsQuery,
      async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== "added") return;

          const assignment = change.doc.data();
          const assignmentId = change.doc.id;
          const teacherId = assignment?.teacherId;
          const title = String(
            assignment?.title || "Untitled assignment",
          ).trim();

          if (
            !teacherId ||
            !title ||
            notifForPendingAssignments.current.has(assignmentId)
          )
            return;
          notifForPendingAssignments.current.add(assignmentId);

          try {
            const adminQuery = query(
              collection(db, "users"),
              where("role", "in", [
                "admin",
                "superadmin",
                "super admin",
                "staff",
                "teacher",
              ]),
            );
            const adminSnap = await getDocs(adminQuery);

            for (const adminDoc of adminSnap.docs) {
              const adminData = adminDoc.data();
              if (
                !isEligibleAdminRecipient(adminData) ||
                adminDoc.id === teacherId
              )
                continue;

              // Check if unread notification already exists to prevent duplicate notifications
              const existingNotifQuery = query(
                collection(db, "notifications"),
                where("recipientId", "==", adminDoc.id),
                where("read", "==", false),
                where("type", "==", "assignment"),
              );
              const existingSnap = await getDocs(existingNotifQuery);
              const alreadyNotified = existingSnap.docs.some(
                (d) => d.data()?.data?.assignmentId === assignmentId,
              );

              if (!alreadyNotified) {
                await sendNotification({
                  recipientId: adminDoc.id,
                  senderId: teacherId,
                  senderName: "Teacher",
                  type: "assignment",
                  title: "Assignment Awaiting Approval",
                  body: `${title} is awaiting approval before students can see it.`,
                  data: {
                    assignmentId,
                    teacherId,
                    status: "pending",
                  },
                });
              }
            }
          } catch (error) {
            console.error(
              "Error notifying admins about pending assignment approval:",
              error,
            );
          }
        });
      },
      (error) => {
        console.error("Pending assignments fallback listener error:", error);
      },
    );

    // Fallback 2: if academic records are uploaded/saved with status "pending" or "partially_approved",
    // notify every eligible admin user directly so approvals are never missed.
    const pendingRecordsQuery = query(
      collection(db, "academicRecords"),
      where("status", "in", ["pending", "partially_approved"]),
    );

    const pendingRecordsUnsubscribe = onSnapshot(
      pendingRecordsQuery,
      async (snapshot) => {
        let currentYear = "";
        let currentTerm = "";
        try {
          const configSnap = await getDoc(doc(db, "school_settings", "academic_config"));
          if (configSnap.exists()) {
            const configData = configSnap.data();
            currentYear = configData.academicYear || "";
            currentTerm = configData.currentTerm || "";
          }
        } catch (e) {}

        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== "added" && change.type !== "modified") return;

          const record = change.doc.data();
          const docId = change.doc.id;
          const teacherId = record?.teacherId;
          const className = record?.className || record?.classId || "Class";
          const subject = record?.subject || "Subject";
          const reportType = record?.reportType || "Academic Report";
          const status = record?.status;

          // Ensure draft records do not trigger alert or count, only pending records must trigger
          if (status === "draft" || (status !== "pending" && status !== "partially_approved")) return;

          // Ensure previous term pending records do not trigger the notification alert
          if (currentYear && record?.academicYear && record.academicYear !== currentYear) return;
          if (currentTerm && record?.term && record.term !== currentTerm) return;

          if (!teacherId) return;

          const recordKey = `${docId}_${status}`;
          if (notifForPendingRecords.current.has(recordKey)) return;
          notifForPendingRecords.current.add(recordKey);

          try {
            const adminQuery = query(
              collection(db, "users"),
              where("role", "in", [
                "admin",
                "superadmin",
                "super admin",
                "staff",
                "teacher",
              ]),
            );
            const adminSnap = await getDocs(adminQuery);

            for (const adminDoc of adminSnap.docs) {
              const adminData = adminDoc.data();
              if (
                !isEligibleAdminRecipient(adminData) ||
                adminDoc.id === teacherId
              )
                continue;

              // Check if unread notification already exists to prevent duplicate notifications
              const existingNotifQuery = query(
                collection(db, "notifications"),
                where("recipientId", "==", adminDoc.id),
                where("read", "==", false),
                where("type", "==", "score"),
              );
              const existingSnap = await getDocs(existingNotifQuery);
              const alreadyNotified = existingSnap.docs.some(
                (d) => d.data()?.data?.docId === docId && d.data()?.data?.status === status,
              );

              if (!alreadyNotified) {
                await sendNotification({
                  recipientId: adminDoc.id,
                  senderId: teacherId,
                  senderName: "Teacher",
                  type: "score",
                  title: "Academic Records Awaiting Approval 📊",
                  body: `${className} - ${subject}: ${reportType} scores uploaded require review & approval.`,
                  data: {
                    docId,
                    classId: record?.classId,
                    subject,
                    status,
                  },
                });
              }
            }
          } catch (error) {
            console.error(
              "Error notifying admins about pending academic records approval:",
              error,
            );
          }
        });
      },
      (error) => {
        console.error("Pending academic records fallback listener error:", error);
      },
    );

    // Handle push notification click interactions on mobile
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const data = response.notification.request.content.data;
          if (data && typeof data.firestoreId === "string") {
            try {
              await updateDoc(doc(db, "notifications", data.firestoreId), {
                read: true,
                readAt: serverTimestamp(),
              });
            } catch (e) {
              console.error("Error marking clicked notification as read:", e);
            }
          }
        },
      );

    return () => {
      unsubscribe();
      pendingAssignmentsUnsubscribe();
      pendingRecordsUnsubscribe();
      responseListener.remove();
    };
  }, [appUser?.uid]);

  return null;
};

