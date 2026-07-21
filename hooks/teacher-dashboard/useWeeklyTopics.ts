import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicConfig } from '../useAcademicConfig';
import { useToast } from '../../contexts/ToastContext';
import { sortClasses } from '../../lib/classHelpers';
import moment from 'moment';

export interface WeeklyTopic {
  id: string;
  classId: string;
  className: string;
  subject: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  topic: string;
  subTopics?: string;
  objectives?: string;
  teacherId: string;
  academicYear: string;
  term: string;
}

export const useWeeklyTopics = () => {
  const { appUser, firebaseUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  // Dates
  const [startDate, setStartDate] = useState(moment().startOf('isoWeek').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().startOf('isoWeek').add(4, 'days').format('YYYY-MM-DD'));

  const [topicData, setTopicData] = useState<Partial<WeeklyTopic>>({
    topic: '',
    subTopics: '',
    objectives: '',
  });
  const [serverTopicData, setServerTopicData] = useState<Partial<WeeklyTopic>>({});

  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  // Fetch teacher's classes and subjects
  useEffect(() => {
    if (!appUser) return;
    const fetchMetadata = async () => {
      setLoading(true);
      try {
        const classIds = appUser.classes || [];
        const availableSubjects = appUser.subjects || [];

        if (classIds.length > 0) {
          const q = query(collection(db, "classes"), where(documentId(), "in", classIds));
          const snap = await getDocs(q);
          const list = snap.docs.map(d => ({
            id: d.id,
            name: (d.data() as any).name || d.id,
          }));
          const sorted = sortClasses(list);
          setTeacherClasses(sorted);
          if (sorted.length > 0 && !selectedClassId) setSelectedClassId(sorted[0].id);
        }

        if (availableSubjects.length > 0 && !selectedSubject) {
          setSelectedSubject(availableSubjects[0]);
        }
      } catch (err) {
        console.error("fetchMetadata error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [appUser]);

  // Fetch topic for selected class, subject, and start date
  useEffect(() => {
    const fetchTopic = async () => {
      if (!selectedClassId || !selectedSubject || !startDate || !academicYear || !term) return;

      // We use startDate as the key to identify the week's entry
      const weekId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, '')}_${startDate}_${academicYear.replace(/\//g, '-')}`;

      try {
        const docRef = doc(db, "weeklyTopics", weekId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as WeeklyTopic;
          setTopicData({
            topic: data.topic || '',
            subTopics: data.subTopics || '',
            objectives: data.objectives || '',
          });
          setEndDate(data.endDate || moment(startDate).add(4, 'days').format('YYYY-MM-DD'));
          setServerTopicData({
            topic: data.topic || '',
            subTopics: data.subTopics || '',
            objectives: data.objectives || '',
            endDate: data.endDate || '',
          });
        } else {
          setTopicData({ topic: '', subTopics: '', objectives: '' });
          setServerTopicData({});
          // Only update end date if it's a new week selection, not just a clear
        }
      } catch (err) {
        console.error("fetchTopic error:", err);
      }
    };

    fetchTopic();
  }, [selectedClassId, selectedSubject, startDate, academicYear, term]);

  const saveTopic = async () => {
    if (!selectedClassId || !selectedSubject || !startDate || !endDate || !academicYear || !term) {
      showToast({ message: "Missing required information", type: "error" });
      return;
    }

    setSaving(true);
    const weekId = `${selectedClassId}_${selectedSubject.replace(/\s+/g, '')}_${startDate}_${academicYear.replace(/\//g, '-')}`;

    try {
      const docRef = doc(db, "weeklyTopics", weekId);
      const dataToSave = {
        id: weekId,
        classId: selectedClassId,
        className: teacherClasses.find(c => c.id === selectedClassId)?.name || '',
        subject: selectedSubject,
        startDate: startDate,
        endDate: endDate,
        academicYear,
        term,
        topic: topicData.topic,
        subTopics: topicData.subTopics,
        objectives: topicData.objectives,
        teacherId: firebaseUser?.uid,
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, dataToSave, { merge: true });
      setServerTopicData({ ...topicData, endDate });
      showToast({ message: "Lesson plan saved successfully!", type: "success" });
    } catch (err) {
      console.error("saveTopic error:", err);
      showToast({ message: "Failed to save lesson plan", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify({ ...topicData, endDate }) !== JSON.stringify(serverTopicData);
  }, [topicData, endDate, serverTopicData]);

  return {
    loading,
    saving,
    teacherClasses,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    topicData,
    setTopicData,
    saveTopic,
    hasUnsavedChanges,
    subjects: appUser?.subjects || [],
  };
};
