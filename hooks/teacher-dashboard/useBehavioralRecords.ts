import { useState, useEffect, useRef } from 'react';
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
  attendance?: string;
  tas?: string;
  nextTermBegins?: string;
  physicalDev?: Record<string, string>;
  assessments?: Record<string, string>;
}

export const useBehavioralRecords = () => {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [myClasses, setMyClasses] = useState<{ id: string; name: string; classTeacherId?: string; department?: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [allStudents, setAllStudents] = useState<BehavioralRecord[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

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
          department: (d.data() as any).department,
        }));
        if (isMounted.current) {
          const sorted = sortClasses(list);
          setMyClasses(sorted);
          if (sorted.length > 0) setSelectedClassId(sorted[0].id);
        }
      } catch (err) {
        if (isMounted.current) console.error("fetchClasses error:", err);
      } finally {
        if (isMounted.current) setLoading(false);
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

        if (!isMounted.current) return;

        let loadedStudents: BehavioralRecord[] = [];

        if (docSnap.exists()) {
          loadedStudents = docSnap.data().students || [];
        } else {
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("classId", "==", selectedClassId)
          );
          const snap = await getDocsFromServer(q);
          loadedStudents = snap.docs
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
          loadedStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
        }

        // Auto-fill attendance and TAS from marked daily attendance
        try {
          const qAtt = query(
            collection(db, "attendance"),
            where("classId", "==", selectedClassId),
            where("academicYear", "==", academicYear),
            where("term", "==", term)
          );
          const attSnap = await getDocsFromServer(qAtt);
          if (!attSnap.empty) {
            const totalSchoolDays = attSnap.docs.length;
            const attendanceMap: Record<string, number> = {};

            attSnap.docs.forEach((d) => {
              const dayData = d.data();
              const studentsInDay = dayData.students || {};
              Object.keys(studentsInDay).forEach((sId) => {
                if (studentsInDay[sId]?.status === "present") {
                  attendanceMap[sId] = (attendanceMap[sId] || 0) + 1;
                }
              });
            });

            loadedStudents = loadedStudents.map((s) => {
              const presentCount = attendanceMap[s.studentId] || 0;
              const calculatedAttendance = `${presentCount} / ${totalSchoolDays}`;
              const calculatedTas = `${totalSchoolDays}`;

              return {
                ...s,
                attendance: s.attendance && s.attendance.trim() !== "" ? s.attendance : calculatedAttendance,
                tas: s.tas && s.tas.trim() !== "" ? s.tas : calculatedTas,
              };
            });
          }
        } catch (attErr) {
          console.error("Error auto-filling attendance from marked records:", attErr);
        }

        if (isMounted.current) setAllStudents(loadedStudents);
      } catch (err) {
        if (isMounted.current) console.error("fetchRecords error:", err);
      } finally {
        if (isMounted.current) setSyncing(false);
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
