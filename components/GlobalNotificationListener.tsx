import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import {
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
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
import { sendNotification } from "../src/services/notificationService";

let flashInterval: any = null;
const originalTitle =
  typeof document !== "undefined" ? document.title || "EduEaz" : "EduEaz";

const ADMIN_ROLE_NAMES = [
  "manager",
  "headmaster",
  "headmistress",
  "administrator",
  "director",
  "proprietor",
  "proprietress",
  "accountant",
  "bursar",
];

function isEligibleAdminRecipient(userData: any) {
  const adminRole = String(userData?.adminRole || "")
    .toLowerCase()
    .trim();
  const role = String(userData?.role || "")
    .toLowerCase()
    .trim();

  if (["admin", "superadmin", "super admin"].includes(role)) return true;
  if (!!adminRole && ADMIN_ROLE_NAMES.includes(adminRole)) return true;
  if (role === "staff" && !!adminRole) return true;

  return false;
}

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
  const notifForPendingAssignments = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!appUser?.uid) return;

    // Request Web / Desktop OS Notification permission if supported
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      "Notification" in window
    ) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    // Automated monthly fee debt check
    checkAndSendMonthlyFeeReminders(appUser.role);

    // Listen for in-app Firestore notifications
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", appUser.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc"),
      limit(5),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
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

          // Note: We deliberately DO NOT automatically mark as read here!
          // This keeps the notification unread so it stays in the Unattended Notification Center & Bell badge.

          // 2. Play audio sound chime
          try {
            const { sound } = await Audio.Sound.createAsync(
              require("../assets/notification.mp3"),
            );
            await sound.playAsync();
          } catch (e) {
            // Web autoplay restrictions might require user interaction first
          }

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
    });

    // Fallback: if a teacher assignment is created with status "pending",
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
          } catch (error) {
            console.error(
              "Error notifying admins about pending assignment approval:",
              error,
            );
          }
        });
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
      responseListener.remove();
    };
  }, [appUser?.uid]);

  return null;
};
