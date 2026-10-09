import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Question, AssignmentType } from "../../types/assignments";

export interface SentAssignment {
  id: string;
  title: string;
  description: string;
  type: AssignmentType;
  classId: string;
  className?: string;
  subjectId: string;
  questions: Question[];
  dueDate: string; // ISO string
  createdAt: string; // ISO string
  fileName?: string;
  fileUrl?: string;
  code?: string;
}

const getStorageKey = (userId: string) => `@teacher_sent_assignments_${userId}`;

export const useSentAssignments = (teacherId?: string) => {
  const [sentAssignments, setSentAssignments] = useState<SentAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const storageKey = getStorageKey(teacherId || "default");

  const loadSentAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSentAssignments(Array.isArray(parsed) ? parsed : []);
      } else {
        setSentAssignments([]);
      }
    } catch (e) {
      console.error("Failed to load sent assignments from storage:", e);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (teacherId) {
      loadSentAssignments();
    }
  }, [teacherId, loadSentAssignments]);

  const saveAssignmentToHistory = useCallback(async (assignmentData: Omit<SentAssignment, "id" | "createdAt">) => {
    try {
      const newItem: SentAssignment = {
        ...assignmentData,
        id: `sent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      };

      const raw = await AsyncStorage.getItem(storageKey);
      const existing: SentAssignment[] = raw ? JSON.parse(raw) : [];
      const updated = [newItem, ...existing];

      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      setSentAssignments(updated);
      return newItem;
    } catch (e) {
      console.error("Failed to save assignment to local history:", e);
      return null;
    }
  }, [storageKey]);

  const deleteAssignmentFromHistory = useCallback(async (id: string) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const existing: SentAssignment[] = raw ? JSON.parse(raw) : [];
      const updated = existing.filter(item => item.id !== id);

      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      setSentAssignments(updated);
    } catch (e) {
      console.error("Failed to delete assignment from local history:", e);
    }
  }, [storageKey]);

  const deleteBulkAssignments = useCallback(async (ids: string[]) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const existing: SentAssignment[] = raw ? JSON.parse(raw) : [];
      const updated = existing.filter(item => !ids.includes(item.id));

      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      setSentAssignments(updated);
    } catch (e) {
      console.error("Failed to delete bulk assignments from local history:", e);
    }
  }, [storageKey]);

  return {
    sentAssignments,
    loading,
    loadSentAssignments,
    saveAssignmentToHistory,
    deleteAssignmentFromHistory,
    deleteBulkAssignments,
  };
};
