import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  where,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicConfig } from '../useAcademicConfig';
import { useToast } from '../../contexts/ToastContext';
import { getTeacherClasses, sortClasses } from '../../lib/classHelpers';

export interface BehavioralRecord {
  studentId: string;
  fullName: string;
  conduct: string;
  interest: string;
  attitude: string;
  teacherRemarks: string;
  promotedTo?: string;
  physicalDev?: Record<string, string>;
  assessments?: Record<string, string>;
}

export const useBehavioralRecords = () => {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [myClasses, setMyClasses] = useState<{ id: string; name: string; classTeacherId?: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [allStudents, setAllStudents] = useState<BehavioralRecord[]>([]);

  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  useEffect(() => {
    if (!appUser) return;
    const fetchClasses = async () => {
      try {
        const userRole = (appUser.role || "").toLowerCase();
        let q;
        if (userRole === "admin" || userRole === "superadmin") {
          q = query(collection(db, "classes"));
        } else {
          const teacherClasses = getTeacherClasses(appUser);
          if (teacherClasses.length === 0) {
            setLoading(false);
            return;
          }
          q = query(collection(db, "classes"), where("__name__", "in", teacherClasses.slice(0, 30)));
        }
        const snap = await getDocsFromServer(q);
        const list = snap.docs.map(d => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
          classTeacherId: (d.data() as any).classTeacherId,
        }));
        const sorted = sortClasses(list);
        setMyClasses(sorted);
        if (sorted.length > 0) setSelectedClassId(sorted[0].id);
      } catch (err) {
        console.error("fetchClasses error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [appUser]);

  useEffect(() => {
    if (!selectedClassId || !academicYear || !term) return;
    const fetchRecords = async () => {
      setSyncing(true);
      try {
        const yearSlug = academicYear.replace(/\//g, "-");
        const docId = `behavioral_${selectedClassId}_${yearSlug}_${term.replace(/\s+/g, "")}`;
        const docSnap = await getDoc(doc(db, "behavioralRecords", docId));

        if (docSnap.exists()) {
          setAllStudents(docSnap.data().students || []);
        } else {
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId)
          );
          const snap = await getDocsFromServer(q);
          const mapped = snap.docs
            .map((d: any) => ({ uid: d.id, ...d.data() }))
            .filter((data: any) => ["active", "pending_activation"].includes(data.status))
            .map((data: any) => ({
              studentId: data.uid,
              fullName: `${data.profile?.firstName || ""} ${data.profile?.lastName || ""}`.trim() || "Unknown Student",
              conduct: "Good",
              interest: "N/A",
              attitude: "Positive",
              teacherRemarks: "",
              promotedTo: "",
            }));
          mapped.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setAllStudents(mapped);
        }
      } catch (err) {
        console.error("fetchRecords error:", err);
      } finally {
        setSyncing(false);
      }
    };
    fetchRecords();
  }, [selectedClassId, academicYear, term]);

  const updateRecord = (studentId: string, field: keyof BehavioralRecord, value: any) => {
    setAllStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, [field]: value } : s));
  };

  const saveRecords = async () => {
    if (!selectedClassId || !academicYear || !term) return;
    try {
      const yearSlug = academicYear.replace(/\//g, "-");
      const docId = `behavioral_${selectedClassId}_${yearSlug}_${term.replace(/\s+/g, "")}`;
      await setDoc(doc(db, "behavioralRecords", docId), {
        docId,
        classId: selectedClassId,
        academicYear,
        term,
        students: allStudents,
        studentIds: allStudents.map(s => s.studentId),
        updatedBy: appUser?.uid,
        timestamp: serverTimestamp(),
      });
      showToast({ message: "Records saved successfully!", type: "success" });
      return true;
    } catch (err) {
      showToast({ message: "Save failed.", type: "error" });
      return false;
    }
  };

  return {
    loading,
    syncing,
    myClasses,
    selectedClassId,
    setSelectedClassId,
    allStudents,
    updateRecord,
    saveRecords,
    academicYear,
    term,
  };
};
