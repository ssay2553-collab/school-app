import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  documentId,
  getDocsFromServer,
  query,
  serverTimestamp,
  where,
  addDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getTeacherClasses, sortClasses } from '../../lib/classHelpers';
import { sendNotification } from '../../src/services/notificationService';
import * as DocumentPicker from 'expo-document-picker';
import moment from 'moment';

export type AssignmentType = "standard" | "mcq" | "short_answer";

export interface Question {
  text: string;
  options: string[];
}

export interface ClassData {
  id: string;
  name: string;
}

export const useUploadAssignment = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);

  // Form State
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssignmentType>("standard");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 7)); // Default 1 week

  // File Upload State
  const [file, setFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Interactive Questions
  const [mcqQuestions, setMcqQuestions] = useState<Question[]>([]);
  const [shortAnswerQuestions, setShortAnswerQuestions] = useState<Question[]>([]);

  const questions = useMemo(() => type === "mcq" ? mcqQuestions : shortAnswerQuestions, [type, mcqQuestions, shortAnswerQuestions]);

  const hasUnsavedChanges = useMemo(() => {
    return title !== "" || description !== "" || mcqQuestions.length > 0 || shortAnswerQuestions.length > 0 || file !== null;
  }, [title, description, mcqQuestions, shortAnswerQuestions, file]);

  useEffect(() => {
    if (!appUser) {
      setFetchingMetadata(false);
      return;
    }

    const fetchData = async () => {
      setFetchingMetadata(true);
      try {
        const classIds = getTeacherClasses(appUser);
        if (classIds.length > 0) {
          const results: any[] = [];
          for (let i = 0; i < classIds.length; i += 10) {
            const chunk = classIds.slice(i, i + 10);
            const q = query(collection(db, "classes"), where(documentId(), "in", chunk));
            const snap = await getDocsFromServer(q);
            results.push(...snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || d.id })));
          }

          const sorted = sortClasses(results);
          setTeacherClasses(sorted);
          if (sorted.length > 0 && !selectedClassId) setSelectedClassId(sorted[0].id);
        }
        if (appUser.subjects && appUser.subjects.length > 0 && !selectedSubject) {
          setSelectedSubject(appUser.subjects[0]);
        }
      } catch (err) {
        console.error("fetchData Error:", err);
      } finally {
        setFetchingMetadata(false);
      }
    };
    fetchData();
  }, [appUser, selectedClassId, selectedSubject]);

  const setQuestions = useCallback((val: React.SetStateAction<Question[]>) => {
    if (type === "mcq") {
      setMcqQuestions(val);
    } else {
      setShortAnswerQuestions(val);
    }
  }, [type]);

  const addQuestion = useCallback(() => {
    setQuestions(prev => [...prev, { text: "", options: ["", ""] }]);
  }, [setQuestions]);

  const updateQuestion = useCallback((index: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, text } : q));
  }, [setQuestions]);

  const updateOption = useCallback((qIndex: number, oIndex: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === qIndex) {
        const newOptions = [...q.options];
        newOptions[oIndex] = text;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  }, [setQuestions]);

  const addOption = useCallback((qIndex: number) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qIndex ? { ...q, options: [...q.options, ""] } : q
    ));
  }, [setQuestions]);

  const removeQuestion = useCallback((index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  }, [setQuestions]);

  const handleUpload = async () => {
    if (!title || !selectedClassId || !selectedSubject) {
      showToast({ message: "Please fill in all required fields.", type: "error" });
      return false;
    }

    if (type === "standard" && !file && !description) {
      showToast({ message: "Please provide either instructions or a file.", type: "error" });
      return false;
    }

    if ((type === "mcq" || type === "short_answer") && questions.length === 0) {
      showToast({ message: "Please add at least one question.", type: "error" });
      return false;
    }

    setLoading(true);
    try {
      let fileUrl = "";
      let fileName = "";

      if (file && !file.canceled && file.assets && file.assets[0]) {
        setUploadingFile(true);
        const asset = file.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `assignments/${Date.now()}_${asset.name}`);
        await uploadBytes(storageRef, blob);
        fileUrl = await getDownloadURL(storageRef);
        fileName = asset.name;
        setUploadingFile(false);
      }

      const assignmentData = {
        title,
        description,
        type,
        classId: selectedClassId,
        subjectId: selectedSubject,
        teacherId: appUser?.uid,
        fileUrl,
        fileName,
        questions: type === "standard" ? null : questions,
        dueDate: dueDate,
        createdAt: serverTimestamp(),
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      };

      const docRef = await addDoc(collection(db, "assignments"), assignmentData);

      // Notify students in the class
      const studentsQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", selectedClassId)
      );
      const studentsSnap = await getDocsFromServer(studentsQuery);

      const notificationPromises = studentsSnap.docs.map(studentDoc =>
        sendNotification({
          recipientId: studentDoc.id,
          senderId: appUser!.uid,
          senderName: appUser!.displayName || "Teacher",
          type: "assignment",
          title: "New Assignment",
          body: `${selectedSubject}: ${title}`,
          data: { assignmentId: docRef.id, classId: selectedClassId }
        })
      );
      await Promise.all(notificationPromises);

      showToast({ message: "Assignment posted successfully!", type: "success" });
      return true;
    } catch (err) {
      console.error("handleUpload Error:", err);
      showToast({ message: "Failed to post assignment.", type: "error" });
      return false;
    } finally {
      setLoading(false);
      setUploadingFile(false);
    }
  };

  const handleWebDateChange = (val: string) => {
    const parsed = moment(val, ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY", "MM/DD/YYYY"], true);
    if (parsed.isValid()) {
      const next = new Date(dueDate);
      next.setFullYear(parsed.year(), parsed.month(), parsed.date());
      setDueDate(next);
    }
  };

  const handleWebTimeChange = (val: string) => {
    const parsed = moment(val, ["HH:mm", "h:mm A", "H:mm"], true);
    if (parsed.isValid()) {
      const next = new Date(dueDate);
      next.setHours(parsed.hour(), parsed.minute());
      setDueDate(next);
    }
  };

  return {
    loading,
    fetchingMetadata,
    teacherClasses,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    title,
    setTitle,
    description,
    setDescription,
    type,
    setType,
    dueDate,
    setDueDate,
    file,
    setFile,
    uploadingFile,
    questions,
    hasUnsavedChanges,
    addQuestion,
    updateQuestion,
    updateOption,
    addOption,
    removeQuestion,
    handleUpload,
    handleWebDateChange,
    handleWebTimeChange,
    subjects: appUser?.subjects || [],
  };
};
