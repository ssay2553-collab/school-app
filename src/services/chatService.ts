import {
    getDownloadURL,
    ref as sRef,
    uploadBytesResumable,
} from "firebase/storage";
import { db, storage } from "../../firebaseConfig";

import {
    addDoc,
    collection,
    DocumentData,
    orderBy,
    query,
    Query,
    serverTimestamp,
} from "firebase/firestore";

// ------------------ TYPES ------------------
export type MessageType = "text" | "image" | "video" | "audio" | "file";

export interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  senderRole: "admin" | "teacher" | "parent" | "student" | string;
  type: MessageType;

  text?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileMime?: string | null;

  group: string;
  createdAt?: any;
  seenBy?: string[];
}

export type MessagePayload = Omit<Message, "id" | "createdAt" | "seenBy">;

// ------------------ COLLECTIONS ------------------
export const messagesCollection = (group: string) =>
  collection(db, "messages", group, "messages");

// ------------------ FILE UPLOAD ------------------
export async function uploadFileToStorage(localUri: string, remotePath: string) {
  try {
    const res = await fetch(localUri);
    const blob = await res.blob();

    const sref = sRef(storage, remotePath);
    const task = uploadBytesResumable(sref, blob);

    return new Promise<string>((resolve, reject) => {
      task.on(
        "state_changed",
        () => {},
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(sref);
          resolve(url);
        }
      );
    });
  } catch (err) {
    console.error("Upload failed:", err);
    throw err;
  }
}

// ------------------ SEND MESSAGE ------------------
export async function sendMessage(payload: MessagePayload) {
  const groupRef = messagesCollection(payload.group);
  return await addDoc(groupRef, {
    ...payload,
    createdAt: serverTimestamp(),
    seenBy: [],
  });
}

// ------------------ QUERY FUNCTIONS ------------------

// Generic messages query for any group
export function messagesQueryByGroup(groupName: string): Query<DocumentData> {
  return query(messagesCollection(groupName), orderBy("createdAt", "asc"));
}

// Legacy / staff chat
export function messagesQueryForStaffChat(): Query<DocumentData> {
  return messagesQueryByGroup("staffChat");
}

// Parent–Staff Group
export function messagesQueryForParentStaffGroup(): Query<DocumentData> {
  return messagesQueryByGroup("parentStaffGroup");
}

// Alias export to fix old imports
export const messagesQuery = messagesQueryByGroup;
