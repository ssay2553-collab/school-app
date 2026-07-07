import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  where,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicConfig } from '../useAcademicConfig';
import { useToast } from '../../contexts/ToastContext';
import { getTeacherClasses, isClassTeacher, sortClasses } from '../../lib/classHelpers';
import { AppUser } from '../../types/users';
import moment from 'moment';
import { sendNotification } from '../../src/services/notificationService';

export const useDailyAttendance = (initialClassId: string | null, initialDate: string) => {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [students, setStudents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classId, setClassId] = useState<string | null>(initialClassId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string; classTeacherId?: string }[]>([]);
  const [localAttendance, setLocalAttendance] = useState<Record<string, any>>({});
  const [serverAttendance, setServerAttendance] = useState<Record<string, any>>({});

  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(localAttendance) !== JSON.stringify(serverAttendance);
  }, [localAttendance, serverAttendance]);

  const isOfficialClassTeacher = useMemo(() => {
    if (!classId || !appUser) return false;
    return isClassTeacher(appUser, classId);
  }, [classId, appUser]);

  useEffect(() => {
    if (!appUser) return;
    const loadClasses = async () => {
      try {
        let q;
        const userRole = (appUser.role || "").toLowerCase();
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
          classTeacherId: (d.data() as any).classTeacherId
        }));
        const sorted = sortClasses(list);
        setAvailableClasses(sorted);
        if (sorted.length > 0 && !classId) {
          setClassId(sorted[0].id);
        }
      } catch (e) {
        console.error("Load classes error:", e);
      }
    };
    loadClasses();
  }, [appUser, classId]);

  const fetchStudents = useCallback(async () => {
    if (!classId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", classId)
      );
      const snap = await getDocsFromServer(q);
      const data = snap.docs
        .map((d: any) => ({ uid: d.id, ...(d.data() as any) }))
        .filter((d: any) => ["active", "pending_activation"].includes(d.status))
        .sort((a: any, b: any) => (a.profile?.firstName || "").localeCompare(b.profile?.firstName || ""));
      setStudents(data);
    } catch (e) {
      console.error("Fetch students error:", e);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (!classId || !academicYear || !term || !selectedDate) return;

    setServerAttendance({});
    setLocalAttendance({});

    const loadAttendance = async () => {
      try {
        const cleanYear = academicYear.replace(/\//g, "-");
        const cleanTerm = term.replace(/\s/g, "");
        const attendanceId = `${classId}_${cleanYear}_${cleanTerm}_${selectedDate}`;
        const ref = doc(db, "attendance", attendanceId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() as any) : { students: {} };
        setServerAttendance(data.students || {});
        setLocalAttendance(data.students || {});
      } catch (e) {
        console.error("Load attendance error:", e);
      }
    };
    loadAttendance();
  }, [classId, selectedDate, academicYear, term]);

  const markLocal = (studentId: string, status: "present" | "absent" | "late") => {
    if (!isOfficialClassTeacher) {
      showToast({ message: "Only assigned Class Teacher/Admin can mark attendance.", type: "error" });
      return;
    }
    setLocalAttendance(prev => ({
      ...prev,
      [studentId]: { status, markedAt: new Date().toISOString() }
    }));
  };

  const saveToFirestore = async () => {
    if (!classId || !appUser || !academicYear || !term) return;

    const currentHour = new Date().getUTCHours();
    const userRole = (appUser.role || "").toLowerCase();
    const isAdminUser = ["admin", "superadmin", "super admin"].includes(userRole) || !!(appUser as any).adminRole;

    if (!isAdminUser && (currentHour < 6 || currentHour >= 18)) {
      showToast({ message: "Attendance marking is only allowed between 6:00 AM and 6:00 PM Ghana Time.", type: "error" });
      return;
    }

    if (!isOfficialClassTeacher) {
      showToast({ message: "Only assigned Class Teacher/Admin can save attendance.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const cleanYear = academicYear.replace(/\//g, "-");
      const cleanTerm = term.replace(/\s/g, "");
      const attendanceId = `${classId}_${cleanYear}_${cleanTerm}_${selectedDate}`;
      const batch = writeBatch(db);
      const ref = doc(db, "attendance", attendanceId);

      const staffName = `${appUser.profile?.firstName || ''} ${appUser.profile?.lastName || ''}`.trim() || "Staff";
      const updatedBy = `${staffName} (${appUser.role || 'Teacher'})`;

      batch.set(ref, {
        classId,
        date: selectedDate,
        academicYear,
        term,
        markedBy: appUser.uid,
        updatedBy,
        lastUpdated: serverTimestamp(),
        students: localAttendance
      }, { merge: true });

      Object.keys(localAttendance).forEach(studentId => {
        const oldStatus = serverAttendance[studentId]?.status;
        const newStatus = localAttendance[studentId]?.status;

        if (oldStatus !== newStatus) {
          const studentSummaryRef = doc(db, "attendanceSummary", `${studentId}_${cleanYear}_${cleanTerm}`);
          const classSummaryRef = doc(db, "attendanceSummary", `${classId}_${cleanYear}_${cleanTerm}`);
          const updates: Record<string, any> = {};
          if (oldStatus) updates[oldStatus] = increment(-1);
          if (newStatus) updates[newStatus] = increment(1);

          if (Object.keys(updates).length > 0) {
            batch.set(studentSummaryRef, { studentId, classId, academicYear, term, ...updates, lastUpdated: serverTimestamp() }, { merge: true });
            batch.set(classSummaryRef, { classId, academicYear, term, ...updates, lastUpdated: serverTimestamp() }, { merge: true });
          }
        }
      });

      await batch.commit();

      const changedStudents = students.filter(s =>
        localAttendance[s.uid]?.status !== serverAttendance[s.uid]?.status &&
        (localAttendance[s.uid]?.status === "absent" || localAttendance[s.uid]?.status === "late")
      );

      for (const student of changedStudents) {
        if (student.parentUids && Array.isArray(student.parentUids)) {
          const status = localAttendance[student.uid]?.status;
          const studentName = `${student.profile?.firstName || ''} ${student.profile?.lastName || ''}`.trim();
          const statusLabel = status?.toUpperCase();

          for (const parentId of student.parentUids) {
            sendNotification({
              recipientId: parentId,
              senderId: appUser.uid,
              senderName: staffName,
              type: "attendance",
              title: `Attendance Alert: ${statusLabel}`,
              body: `${studentName} was marked ${statusLabel} today, ${moment(selectedDate).format("MMM Do")}.`,
              data: { studentId: student.uid, date: selectedDate, status }
            });
          }
        }
      }

      setServerAttendance(localAttendance);
      showToast({ message: "Attendance saved successfully", type: "success" });
    } catch (e: any) {
      console.error("Save error:", e);
      showToast({ message: "Failed to save attendance.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return {
    students,
    loading,
    saving,
    classId,
    setClassId,
    selectedDate,
    setSelectedDate,
    availableClasses,
    localAttendance,
    serverAttendance,
    hasUnsavedChanges,
    isOfficialClassTeacher,
    academicYear,
    term,
    markLocal,
    saveToFirestore,
    refresh: fetchStudents,
  };
};
