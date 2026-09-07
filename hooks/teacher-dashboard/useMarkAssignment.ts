import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  Timestamp,
  documentId,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getTeacherClasses } from '../../lib/classHelpers';
import { sendNotification } from '../../src/services/notificationService';

export interface Question {
  text: string;
  options?: string[];
  type?: string;
  visualGroup?: any[];
}

export interface Assignment {
  id: string;
  title: string;
  deadline?: Timestamp;
  type?: "mcq" | "short_answer" | "preschool" | "mathematics";
  questions?: Question[];
  subjectId: string;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  fileUrl?: string;
  responses?: Record<string | number, any>;
  type: "mcq" | "short_answer" | "preschool" | "rich-text" | "mathematics";
  marked: boolean;
  marks?: number;
  questionScores?: Record<number, number>;
  isLate?: boolean;
  submittedAt?: Timestamp;
  contentHtml?: string;
}

export interface ClassInfo {
  id: string;
  name: string;
}

export const useMarkAssignment = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const teacherId = appUser?.uid;

  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [answerKey, setAnswerKey] = useState<any>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [qScoreInputs, setQScoreInputs] = useState<Record<string, Record<number, string>>>({});
  const [standardMarksInput, setStandardMarksInput] = useState<Record<string, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingSubmissions, setFetchingSubmissions] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const qScoreInputsRef = useRef(qScoreInputs);
  const standardMarksInputRef = useRef(standardMarksInput);
  const feedbackInputsRef = useRef(feedbackInputs);

  useEffect(() => { qScoreInputsRef.current = qScoreInputs; }, [qScoreInputs]);
  useEffect(() => { standardMarksInputRef.current = standardMarksInput; }, [standardMarksInput]);
  useEffect(() => { feedbackInputsRef.current = feedbackInputs; }, [feedbackInputs]);

  const lastVisibleRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Fetch classes
  useEffect(() => {
    if (!appUser) return;
    const userRole = appUser?.role?.toLowerCase() || "";
    const adminRole = appUser?.adminRole?.toLowerCase() || "";
    const isManagerOrAdmin =
        userRole === "admin" ||
        ["manager", "headmaster", "headmistress", "administrator", "director", "proprietor", "proprietress", "accountant", "bursar"].includes(adminRole);

    const fetchClasses = async () => {
      try {
        let results: ClassInfo[] = [];

        if (isManagerOrAdmin) {
          // Fetch ALL classes for managers/admins
          const q = query(collection(db, "classes"));
          const snap = await getDocs(q);
          results = snap.docs.map(item => ({
            id: item.id,
            name: (item.data() as any).name || item.id
          }));
        } else {
          // Fetch only assigned classes for teachers
          const classIds = getTeacherClasses(appUser);
          if (classIds.length === 0) {
            setAvailableClasses([]);
            return;
          }

          for (let i = 0; i < classIds.length; i += 30) {
            const chunk = classIds.slice(i, i + 30);
            const q = query(
              collection(db, "classes"),
              where(documentId(), "in", chunk)
            );
            const snap = await getDocs(q);
            results.push(...snap.docs.map(item => ({
              id: item.id,
              name: (item.data() as any).name || item.id
            })));
          }
        }

        if (isMounted.current) {
          const sorted = results.sort((a, b) => a.name.localeCompare(b.name));
          setAvailableClasses(sorted);
          if (sorted.length > 0 && !selectedClass) setSelectedClass(sorted[0].id);
        }
      } catch (err) {
        if (isMounted.current) console.error("Error fetching class names:", err);
      }
    };

    fetchClasses();
  }, [appUser, selectedClass]);

  useEffect(() => {
    if (!appUser) return;
    const userRole = appUser?.role?.toLowerCase() || "";
    const adminRole = appUser?.adminRole?.toLowerCase() || "";
    const isManagerOrAdmin =
        userRole === "admin" ||
        ["manager", "headmaster", "headmistress", "administrator", "director", "proprietor", "proprietress", "accountant", "bursar"].includes(adminRole);

    if (isManagerOrAdmin) {
       const fetchAllSubjects = async () => {
         try {
           const q = query(collection(db, "subjects"));
           const snap = await getDocs(q);
           const list = snap.docs.map(d => d.id);
           if (isMounted.current) {
             const combined = Array.from(new Set([...list, ...(appUser.subjects || [])]));
             setAvailableSubjects(combined);
             if (combined.length > 0 && !selectedSubject) setSelectedSubject(combined[0]);
           }
         } catch (e) { console.error(e); }
       };
       fetchAllSubjects();
    } else {
      const userSubjects = appUser?.subjects || [];
      setAvailableSubjects(userSubjects);
      if (userSubjects.length > 0 && !selectedSubject) {
        setSelectedSubject(userSubjects[0]);
      }
    }
  }, [appUser, selectedSubject]);

  const fetchAssignments = useCallback(async (isFirstLoad = false) => {
    if (!selectedClass || !selectedSubject || !teacherId) {
      if (isFirstLoad) {
        setAssignments([]);
        lastVisibleRef.current = null;
        hasMoreRef.current = false;
      }
      return;
    }

    if (isFetchingRef.current && !isFirstLoad) return;
    if (!isFirstLoad && !hasMoreRef.current) return;

    isFetchingRef.current = true;
    if (isFirstLoad) {
      setLoading(true);
      lastVisibleRef.current = null;
      hasMoreRef.current = true;
    } else {
      setLoadingMore(true);
    }

    try {
      const userRole = appUser?.role?.toLowerCase() || "";
      const adminRole = appUser?.adminRole?.toLowerCase() || "";

      const isManagerOrAdmin =
        userRole === "admin" ||
        ["manager", "headmaster", "headmistress", "administrator", "director", "proprietor", "proprietress", "accountant", "bursar"].includes(adminRole);

      // Managers and Admins should see ALL assignments for the class/subject
      // Teachers should also see assignments for their subjects even if created by admins
      const queryConstraints: any[] = [
        where("classId", "==", selectedClass),
        where("subjectId", "==", selectedSubject),
      ];

      // Only apply teacherId filter if NOT a manager/admin AND we want to restrict strictly to own
      // However, the request is to allow seeing admin assignments, so we relax this.
      if (!isManagerOrAdmin && !appUser?.subjects?.includes(selectedSubject)) {
        queryConstraints.push(where("teacherId", "==", teacherId));
      }

      queryConstraints.push(orderBy("createdAt", "desc"));
      queryConstraints.push(limit(50));

      if (!isFirstLoad && lastVisibleRef.current) {
        queryConstraints.push(startAfter(lastVisibleRef.current));
      }

      const q = query(collection(db, "assignments"), ...queryConstraints);
      const snap = await getDocs(q);

      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Assignment[];

      if (isMounted.current) {
        if (isFirstLoad) {
          setAssignments(data);
          if (data.length > 0) setSelectedAssignment(data[0]);
          else setSelectedAssignment(null);
        } else {
          setAssignments((prev) => [...prev, ...data]);
        }

        lastVisibleRef.current = snap.docs[snap.docs.length - 1] || null;
        hasMoreRef.current = snap.docs.length === 50;
      }
    } catch (e: any) {
      if (isMounted.current) {
        console.error("fetchAssignments Error:", e);
        if (e.message?.includes("index")) {
          showToast({ message: "Database error: Missing query index. Please notify admin.", type: "error" });
        } else {
          showToast({ message: "Failed to load assignments. Check subject/class filter.", type: "error" });
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, [selectedClass, selectedSubject, teacherId, appUser?.adminRole, appUser?.role]);

  useEffect(() => {
    fetchAssignments(true);
  }, [fetchAssignments]);

  const onRefresh = () => {
    if (isFetchingRef.current) return;
    setRefreshing(true);
    fetchAssignments(true);
  };

  useEffect(() => {
    if (!selectedAssignment) {
      setSubmissions([]);
      setAnswerKey(null);
      return;
    }

    const fetchSubs = async () => {
      setFetchingSubmissions(true);
      try {
        // Fetch Answer Key
        const akDoc = await getDoc(doc(db, "assignmentAnswerKeys", selectedAssignment.id));
        const currentAnswerKey = akDoc.exists() ? akDoc.data() : null;

        if (!isMounted.current) return;
        setAnswerKey(currentAnswerKey);

        const q = query(
          collection(db, "submissions"),
          where("assignmentId", "==", selectedAssignment.id),
          where("marked", "==", false),
        );

        const snap = await getDocs(q);
        if (!isMounted.current) return;

        const fetchedSubmissions = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as Submission[];

        fetchedSubmissions.sort(
          (a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0),
        );

        setSubmissions(fetchedSubmissions);

        const initialQInputs: Record<string, Record<number, string>> = {};
        fetchedSubmissions.forEach((sub) => {
          if (sub.responses) {
            initialQInputs[sub.id] = {};
            Object.keys(sub.responses).forEach((key) => {
              initialQInputs[sub.id][parseInt(key)] = "";
            });
          }
        });

        setQScoreInputs(initialQInputs);
      } catch (e: any) {
        if (isMounted.current) console.error("Fetch submissions error:", e);
      } finally {
        if (isMounted.current) setFetchingSubmissions(false);
      }
    };

    fetchSubs();
  }, [selectedAssignment]);

  const submitMark = useCallback(async (sub: Submission) => {
    let totalScore = 0;
    const finalQuestionScores: Record<number, number> = {};

    const currentStandardMarks = standardMarksInputRef.current;
    const currentQScores = qScoreInputsRef.current;
    const currentFeedback = feedbackInputsRef.current;

    if ((sub.type as string) === "standard" || (sub.type as string) === "preschool") {
      const val = currentStandardMarks[sub.id];
      if (!val || isNaN(Number(val))) {
        showToast({ message: "Please enter a numeric score.", type: "error" });
        return;
      }
      totalScore = Number(val);
    } else {
      const submissionQInputs = currentQScores[sub.id] || {};
      const questionIndices = Object.keys(sub.responses || {});

      for (const idx of questionIndices) {
        const i = parseInt(idx);
        const scoreStr = submissionQInputs[i];
        if (!scoreStr || isNaN(Number(scoreStr))) {
          showToast({ message: `Please score question ${i + 1}.`, type: "error" });
          return;
        }
        const score = Number(scoreStr);
        finalQuestionScores[i] = score;
        totalScore += score;
      }
    }

    try {
      await updateDoc(doc(db, "submissions", sub.id), {
        marks: totalScore,
        questionScores: finalQuestionScores,
        marked: true,
        feedback: currentFeedback[sub.id] || "",
        markedAt: serverTimestamp(),
      });

      const studentSnap = await getDoc(doc(db, "users", sub.studentId));
      if (studentSnap.exists()) {
        const studentData = studentSnap.data() as any;
        const parentUids = studentData.parentUids || [];
        const notifications = [];

        // Prepare parent notifications
        for (const pUid of parentUids) {
          notifications.push(sendNotification({
            recipientId: pUid,
            senderId: appUser!.uid,
            senderName: appUser!.displayName || "Teacher",
            type: "score",
            title: "New Assignment Grade",
            body: `${sub.studentName} scored ${totalScore} in their ${selectedAssignment?.title || "assignment"}.`,
            data: { studentId: sub.studentId, assignmentId: selectedAssignment?.id },
          }));
        }

        // Student notification
        notifications.push(sendNotification({
          recipientId: sub.studentId,
          senderId: appUser!.uid,
          senderName: appUser!.displayName || "Teacher",
          type: "score",
          title: "Assignment Marked",
          body: `You scored ${totalScore} in ${selectedAssignment?.title || "your assignment"}.`,
          data: { assignmentId: selectedAssignment?.id },
        }));

        await Promise.allSettled(notifications);
      }

      if (isMounted.current) {
        setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
        showToast({
          message: `Assignment marked! Total Score: ${totalScore}. Parent has been notified.`,
          type: "success"
        });
      }
    } catch (error) {
      if (isMounted.current) {
        console.error("Marking Error:", error);
        showToast({ message: "Failed to submit marks.", type: "error" });
      }
    }
  }, [selectedAssignment, appUser, showToast]);

  const updateQScore = useCallback((subId: string, qIdx: number, text: string) => {
    setQScoreInputs((prev) => ({
      ...prev,
      [subId]: {
        ...(prev[subId] || {}),
        [qIdx]: text,
      },
    }));
  }, []);

  const updateStandardMark = useCallback((subId: string, text: string) => {
    setStandardMarksInput((prev) => ({ ...prev, [subId]: text }));
  }, []);

  const updateFeedback = useCallback((subId: string, text: string) => {
    setFeedbackInputs((prev) => ({ ...prev, [subId]: text }));
  }, []);

  return {
    availableClasses,
    selectedClass,
    setSelectedClass,
    selectedSubject,
    setSelectedSubject,
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    submissions,
    qScoreInputs,
    standardMarksInput,
    feedbackInputs,
    answerKey,
    loading,
    loadingMore,
    refreshing,
    fetchingSubmissions,
    onRefresh,
    submitMark,
    updateQScore,
    updateStandardMark,
    updateFeedback,
    subjects: availableSubjects,
  };
};
