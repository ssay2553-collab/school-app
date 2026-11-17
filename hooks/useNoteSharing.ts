import { useState, useEffect, useCallback, useRef } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getTeacherClasses } from "../lib/classHelpers";
import { sendNotification } from "../src/services/notificationService";

export interface SharedNote {
  id: string;
  noteId?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  targetType: "class" | "student" | "teacher" | "classmate";
  targetId: string;
  targetName: string;
  recipientUids: string[];
  title: string;
  content: string;
  createdAt: any;
  updatedAt?: any;
}

export interface ShareRecipient {
  id: string;
  name: string;
  type: "class" | "student" | "teacher" | "classmate";
  subtitle?: string;
  uids?: string[];
}

export function useNoteSharing() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [sharing, setSharing] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch shared notes (both received by user and sent by user)
  const fetchSharedNotes = useCallback(async () => {
    if (!appUser?.uid) return;
    setLoadingShared(true);

    try {
      // Notes where recipientUids array contains appUser.uid
      const qReceived = query(
        collection(db, "shared_notes"),
        where("recipientUids", "array-contains", appUser.uid),
        orderBy("createdAt", "desc")
      );
      const receivedSnap = await getDocs(qReceived);

      // Notes sent by appUser
      const qSent = query(
        collection(db, "shared_notes"),
        where("senderId", "==", appUser.uid),
        orderBy("createdAt", "desc")
      );
      const sentSnap = await getDocs(qSent);

      const itemsMap = new Map<string, SharedNote>();

      receivedSnap.docs.forEach((d) => {
        itemsMap.set(d.id, { id: d.id, ...(d.data() as any) });
      });

      sentSnap.docs.forEach((d) => {
        itemsMap.set(d.id, { id: d.id, ...(d.data() as any) });
      });

      const combined = Array.from(itemsMap.values()).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });

      if (isMounted.current) {
        setSharedNotes(combined);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error("fetchSharedNotes Error:", err);
      }
    } finally {
      if (isMounted.current) {
        setLoadingShared(false);
      }
    }
  }, [appUser?.uid]);

  useEffect(() => {
    fetchSharedNotes();
  }, [fetchSharedNotes]);

  // Fetch available classes for teachers
  const fetchClasses = useCallback(async (): Promise<ShareRecipient[]> => {
    if (!appUser) return [];
    try {
      const userRole = appUser.role?.toLowerCase() || "";
      const isManagerOrAdmin = userRole === "admin" || userRole === "manager";

      let classList: { id: string; name: string }[] = [];

      if (isManagerOrAdmin) {
        const snap = await getDocs(collection(db, "classes"));
        classList = snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }));
      } else {
        const teacherClassIds = getTeacherClasses(appUser);
        if (teacherClassIds.length === 0) return [];
        for (let i = 0; i < teacherClassIds.length; i += 30) {
          const chunk = teacherClassIds.slice(i, i + 30);
          const q = query(collection(db, "classes"), where(documentId(), "in", chunk));
          const snap = await getDocs(q);
          classList.push(...snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })));
        }
      }

      return classList.map((c) => ({
        id: c.id,
        name: c.name,
        type: "class" as const,
        subtitle: "Entire Class",
      }));
    } catch (err) {
      console.error("fetchClasses error:", err);
      return [];
    }
  }, [appUser]);

  // Fetch students for a given class or all students
  const fetchStudents = useCallback(async (classId?: string): Promise<ShareRecipient[]> => {
    try {
      let q;
      if (classId) {
        q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("classId", "==", classId)
        );
      } else {
        q = query(collection(db, "users"), where("role", "==", "student"));
      }
      const snap = await getDocs(q);
      return snap.docs
        .filter((d) => d.id !== appUser?.uid)
        .map((d) => {
          const data = d.data() as any;
          const name =
            data.fullName ||
            `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
            "Student";
          return {
            id: d.id,
            name,
            type: "student" as const,
            subtitle: data.className || data.classId || "Student",
            uids: [d.id],
          };
        });
    } catch (err) {
      console.error("fetchStudents error:", err);
      return [];
    }
  }, [appUser?.uid]);

  // Fetch teachers for students
  const fetchTeachers = useCallback(async (): Promise<ShareRecipient[]> => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "teacher"));
      const snap = await getDocs(q);
      return snap.docs
        .filter((d) => d.id !== appUser?.uid)
        .map((d) => {
          const data = d.data() as any;
          const name =
            data.fullName ||
            `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
            "Teacher";
          return {
            id: d.id,
            name,
            type: "teacher" as const,
            subtitle: data.subjects ? data.subjects.join(", ") : "Teacher",
            uids: [d.id],
          };
        });
    } catch (err) {
      console.error("fetchTeachers error:", err);
      return [];
    }
  }, [appUser?.uid]);

  // Fetch classmates for students
  const fetchClassmates = useCallback(async (): Promise<ShareRecipient[]> => {
    if (!appUser) return [];
    const studentClass = appUser.classId || (appUser as any).studentClass || (appUser as any).grade;
    try {
      let q;
      if (studentClass) {
        q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("classId", "==", studentClass)
        );
      } else {
        q = query(collection(db, "users"), where("role", "==", "student"));
      }
      const snap = await getDocs(q);
      return snap.docs
        .filter((d) => d.id !== appUser.uid)
        .map((d) => {
          const data = d.data() as any;
          const name =
            data.fullName ||
            `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() ||
            "Classmate";
          return {
            id: d.id,
            name,
            type: "classmate" as const,
            subtitle: data.className || "Classmate",
            uids: [d.id],
          };
        });
    } catch (err) {
      console.error("fetchClassmates error:", err);
      return [];
    }
  }, [appUser]);

  // Main Share Method
  const shareNote = async ({
    noteTitle,
    noteContent,
    targetType,
    recipient,
  }: {
    noteTitle: string;
    noteContent: string;
    targetType: "class" | "student" | "teacher" | "classmate";
    recipient: ShareRecipient;
  }): Promise<boolean> => {
    if (!appUser?.uid) return false;
    setSharing(true);

    try {
      let recipientUids: string[] = [];

      if (targetType === "class") {
        // Fetch all student UIDs in this class
        const studentsInClass = await fetchStudents(recipient.id);
        recipientUids = studentsInClass.map((s) => s.id);
        if (recipientUids.length === 0) {
          showToast({
            message: `No enrolled students found in class ${recipient.name}.`,
            type: "info",
          });
          setSharing(false);
          return false;
        }
      } else {
        recipientUids = [recipient.id];
      }

      const senderName =
        appUser.fullName ||
        `${appUser.profile?.firstName || ""} ${appUser.profile?.lastName || ""}`.trim() ||
        "User";

      const docData = {
        senderId: appUser.uid,
        senderName,
        senderRole: appUser.role || "teacher",
        targetType,
        targetId: recipient.id,
        targetName: recipient.name,
        recipientUids,
        title: noteTitle.trim() || "Untitled Note",
        content: noteContent || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "shared_notes"), docData);

      // Send notifications to all recipients
      const notifPromises = recipientUids.map((recipientId) =>
        sendNotification({
          recipientId,
          senderId: appUser.uid,
          senderName,
          type: "note" as any,
          title: "New Shared Note",
          body: `${senderName} shared a note with you: "${noteTitle.trim() || "Untitled Note"}"`,
          data: { type: "shared_note" },
        })
      );
      await Promise.allSettled(notifPromises);

      showToast({
        message: `Note shared successfully with ${recipient.name}!`,
        type: "success",
      });

      await fetchSharedNotes();
      return true;
    } catch (err) {
      console.error("shareNote error:", err);
      showToast({ message: "Failed to share note. Please try again.", type: "error" });
      return false;
    } finally {
      if (isMounted.current) {
        setSharing(false);
      }
    }
  };

  const deleteSharedNote = async (sharedNoteId: string) => {
    try {
      await deleteDoc(doc(db, "shared_notes", sharedNoteId));
      showToast({ message: "Shared note removed.", type: "success" });
      await fetchSharedNotes();
    } catch (err) {
      console.error("deleteSharedNote error:", err);
      showToast({ message: "Failed to remove shared note.", type: "error" });
    }
  };

  return {
    sharedNotes,
    loadingShared,
    sharing,
    fetchSharedNotes,
    fetchClasses,
    fetchStudents,
    fetchTeachers,
    fetchClassmates,
    shareNote,
    deleteSharedNote,
  };
}
