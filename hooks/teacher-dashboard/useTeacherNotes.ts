import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";

const NOTES_KEY = "@teacher_notes_v1";

export type Note = {
  id: string;
  uid: string;
  title: string;
  content: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt?: number;
  synced?: boolean;
  docId?: string | null;
};

export const useTeacherNotes = () => {
  const { appUser, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const isMounted = useRef(true);

  const loadLocalNotes = useCallback(async () => {
    if (!appUser) return;
    try {
      const raw = await AsyncStorage.getItem(NOTES_KEY);
      const parsed: Note[] = raw ? JSON.parse(raw) : [];
      const userNotes = parsed.filter((n) => n.uid === appUser.uid);
      setNotes(userNotes);
    } catch (e) {
      console.warn("loadLocalNotes", e);
      setNotes([]);
    }
  }, [appUser]);

  const persistLocalNotes = useCallback(
    async (next: Note[]) => {
      if (!appUser) return;
      try {
        const raw = await AsyncStorage.getItem(NOTES_KEY);
        const all: Note[] = raw ? JSON.parse(raw) : [];
        const others = all.filter((n) => n.uid !== appUser.uid);
        const merged = [...others, ...next];
        await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(merged));
        setNotes(next);
      } catch (e) {
        console.warn("persistLocalNotes", e);
      }
    },
    [appUser],
  );

  const fetchFromFirestoreAndMerge = useCallback(async () => {
    if (!appUser) return;
    try {
      const q = query(
        collection(db, "teacher_notes"),
        where("uid", "==", appUser.uid),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);

      const remote: Note[] = snap.docs.map((d) => ({
        docId: d.id,
        id: d.id + "_remote",
        uid: appUser.uid,
        title: (d.data() as any).title,
        content: (d.data() as any).content,
        pinned: (d.data() as any).pinned ?? false,
        createdAt: (d.data() as any).createdAt?.toMillis() ?? Date.now(),
        updatedAt: (d.data() as any).updatedAt?.toMillis(),
        synced: true,
      }));

      const localRaw = await AsyncStorage.getItem(NOTES_KEY);
      const localAll: Note[] = localRaw ? JSON.parse(localRaw) : [];
      const localForUser = localAll.filter((n) => n.uid === appUser.uid);

      const map = new Map<string, Note>();
      for (const r of remote) {
        map.set(r.docId ?? r.id, r);
      }
      for (const l of localForUser) {
        const key = l.docId ?? l.id;
        const existing = map.get(key);
        if (
          !existing ||
          l.synced === false ||
          (l.updatedAt ?? l.createdAt) >
            (existing.updatedAt ?? existing.createdAt)
        ) {
          map.set(key, l);
        }
      }

      const merged = Array.from(map.values()).sort(
        (a, b) =>
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt,
      );

      if (isMounted.current) {
        await persistLocalNotes(merged);
      }
    } catch (e) {
      if (isMounted.current) console.warn("fetchFromFirestoreAndMerge", e);
    }
  }, [appUser, persistLocalNotes]);

  useEffect(() => {
    isMounted.current = true;
    (async () => {
      await loadLocalNotes();
      await fetchFromFirestoreAndMerge();
      if (isMounted.current) setLoading(false);
    })();
    const interval = setInterval(() => {
      fetchFromFirestoreAndMerge();
    }, 15000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [loadLocalNotes, fetchFromFirestoreAndMerge]);

  const createNote = async (title: string, htmlContent: string) => {
    if (!appUser) return;
    setSaving(true);
    const newNote: Note = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      uid: appUser.uid,
      title: title.trim() || "Untitled Note",
      content: htmlContent,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
      docId: null,
    };

    const next = [newNote, ...notes];
    await persistLocalNotes(next);

    try {
      const docRef = await addDoc(collection(db, "teacher_notes"), {
        uid: appUser.uid,
        title: newNote.title,
        content: newNote.content,
        pinned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const syncedNext = next.map(n => n.id === newNote.id ? { ...n, docId: docRef.id, synced: true } : n);
      if (isMounted.current) {
        await persistLocalNotes(syncedNext);
      }
    } catch (e) {
      if (isMounted.current) console.warn("Firestore sync failed:", e);
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const updateNote = async (id: string, title: string, htmlContent: string) => {
    if (!appUser) return;
    setSaving(true);
    const next = notes.map((n) =>
      n.id === id
        ? {
            ...n,
            title: title.trim() || n.title,
            content: htmlContent,
            updatedAt: Date.now(),
            synced: false,
          }
        : n,
    );
    await persistLocalNotes(next);

    const noteToUpdate = next.find(n => n.id === id);
    if (noteToUpdate?.docId) {
      try {
        await updateDoc(doc(db, "teacher_notes", noteToUpdate.docId), {
          title: noteToUpdate.title,
          content: noteToUpdate.content,
          updatedAt: serverTimestamp(),
        });

        const syncedNext = next.map(n => n.id === id ? { ...n, synced: true } : n);
        if (isMounted.current) {
          await persistLocalNotes(syncedNext);
        }
      } catch (e) {
        if (isMounted.current) console.warn("Firestore update sync failed:", e);
      } finally {
        if (isMounted.current) setSaving(false);
      }
    } else {
      if (isMounted.current) setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    await persistLocalNotes(next);

    const removed = notes.find((n) => n.id === id);
    if (removed?.docId) {
      try {
        await deleteDoc(doc(db, "teacher_notes", removed.docId));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const togglePin = async (id: string) => {
    const next = notes.map((n) =>
      n.id === id
        ? { ...n, pinned: !n.pinned, synced: false }
        : n,
    );
    await persistLocalNotes(next);
    // Optional: sync pin status to firestore
    const note = next.find(n => n.id === id);
    if (note?.docId) {
       try {
        await updateDoc(doc(db, "teacher_notes", note.docId), {
          pinned: note.pinned,
          updatedAt: serverTimestamp(),
        });
        const syncedNext = next.map(n => n.id === id ? { ...n, synced: true } : n);
        await persistLocalNotes(syncedNext);
      } catch (e) {
        console.warn("Firestore pin sync failed:", e);
      }
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()),
  );

  return {
    notes: filteredNotes,
    loading: loading || authLoading,
    saving,
    search,
    setSearch,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    appUser,
  };
};
