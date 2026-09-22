import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { normalizeClassLevel } from '../../constants/Curriculum';
import { lookupGESIndicator } from '../../constants/GES_Curriculum';
import moment from 'moment';

export interface WeeklyTopic {
  id: string;
  classId: string;
  className: string;
  subject: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  topic: string;
  strand?: string;
  subStrand?: string;
  indicatorCode?: string;
  subTopics?: string;
  objectives?: string;
  teacherId: string;
  academicYear: string;
  term: string;
  weekNumber?: string;
  curriculum?: string;
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
  const [weekNumber, setWeekNumber] = useState("");

  const [topicData, setTopicData] = useState<Partial<WeeklyTopic>>({
    topic: '',
    strand: '',
    subStrand: '',
    indicatorCode: '',
    subTopics: '',
    objectives: '',
  });
  const [serverTopicData, setServerTopicData] = useState<Partial<WeeklyTopic>>({});
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'success' | 'not_found'>('idle');
  const [isBrowserVisible, setIsBrowserVisible] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";
  const userCurriculum = appUser?.curriculum || "GES";

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
          if (isMounted.current) {
            const sorted = sortClasses(list);
            setTeacherClasses(sorted);
            if (sorted.length > 0 && !selectedClassId) setSelectedClassId(sorted[0].id);
          }
        }

        if (isMounted.current && availableSubjects.length > 0 && !selectedSubject) {
          setSelectedSubject(availableSubjects[0]);
        }
      } catch (err) {
        if (isMounted.current) console.error("fetchMetadata error:", err);
      } finally {
        if (isMounted.current) setLoading(false);
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

        if (!isMounted.current) return;

        if (docSnap.exists()) {
          const data = docSnap.data() as WeeklyTopic;
          setTopicData({
            topic: data.topic || '',
            strand: data.strand || '',
            subStrand: data.subStrand || '',
            indicatorCode: data.indicatorCode || '',
            subTopics: data.subTopics || '',
            objectives: data.objectives || '',
          });
          setEndDate(data.endDate || moment(startDate).add(4, 'days').format('YYYY-MM-DD'));
          setWeekNumber(data.weekNumber || "");
          setServerTopicData({
            topic: data.topic || '',
            strand: data.strand || '',
            subStrand: data.subStrand || '',
            indicatorCode: data.indicatorCode || '',
            subTopics: data.subTopics || '',
            objectives: data.objectives || '',
            endDate: data.endDate || '',
            weekNumber: data.weekNumber || "",
          });
        } else {
          setTopicData({
            topic: '',
            strand: '',
            subStrand: '',
            indicatorCode: '',
            subTopics: '',
            objectives: ''
          });
          setWeekNumber("");
          setServerTopicData({});
          // Only update end date if it's a new week selection, not just a clear
        }
      } catch (err) {
        if (isMounted.current) console.error("fetchTopic error:", err);
      }
    };

    fetchTopic();
  }, [selectedClassId, selectedSubject, startDate, academicYear, term]);

  // Auto-population logic for GES Curriculum based on Indicator Code
  const performLookup = useCallback((codeOverride?: string) => {
    const code = (codeOverride || topicData.indicatorCode || "").trim().toUpperCase();
    if (!code || code.length < 5) {
      setLookupStatus('idle');
      return;
    }

    // We only perform auto-lookup if curriculum is GES OR if the code explicitly looks like a NaCCA code
    const isNaCCACode = /^[B|J|S|K|P]\d/.test(code);
    if (userCurriculum !== "GES" && !isNaCCACode) return;

    setIsLookingUp(true);
    const selectedClassName = teacherClasses.find(c => c.id === selectedClassId)?.name || "";
    const match = lookupGESIndicator(code, selectedSubject, selectedClassName);

    if (match) {
      setTopicData(prev => {
        // Prevent redundant updates
        if (prev.strand === match.strand && prev.indicatorCode === code) return prev;

        return {
          ...prev,
          indicatorCode: code, // Ensure the code is normalized
          strand: match.strand,
          subStrand: match.subStrand,
          topic: match.contentStandard,
          subTopics: match.indicator,
          objectives: match.objectives
        };
      });
      setLookupStatus('success');
      showToast({ message: `NaCCA Match Found: ${match.code}`, type: "success" });
      setIsLookingUp(false);
      return true;
    }
    setLookupStatus('not_found');
    setIsLookingUp(false);
    return false;
  }, [topicData.indicatorCode, topicData.strand, selectedSubject, selectedClassId, userCurriculum, teacherClasses, showToast]);

  useEffect(() => {
    // Debounced auto-lookup
    const code = topicData.indicatorCode;
    if (!code || code.length < 5) return;

    const timer = setTimeout(() => {
      performLookup(code);
    }, 1000);

    return () => clearTimeout(timer);
  }, [topicData.indicatorCode, performLookup]);

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
        weekNumber: weekNumber,
        academicYear,
        term,
        topic: topicData.topic || '',
        strand: topicData.strand || '',
        subStrand: topicData.subStrand || '',
        indicatorCode: topicData.indicatorCode || '',
        subTopics: topicData.subTopics,
        objectives: topicData.objectives,
        teacherId: firebaseUser?.uid,
        curriculum: userCurriculum,
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, dataToSave, { merge: true });
      if (isMounted.current) {
        setServerTopicData({ ...topicData, endDate, weekNumber });
        showToast({ message: "Lesson plan saved successfully!", type: "success" });
      }
    } catch (err) {
      if (isMounted.current) {
        console.error("saveTopic error:", err);
        showToast({ message: "Failed to save lesson plan", type: "error" });
      }
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify({ ...topicData, endDate, weekNumber }) !== JSON.stringify(serverTopicData);
  }, [topicData, endDate, weekNumber, serverTopicData]);

  const clearTopicData = () => {
    setTopicData({
      topic: '',
      strand: '',
      subStrand: '',
      indicatorCode: '',
      subTopics: '',
      objectives: ''
    });
    setLookupStatus('idle');
  };

  const handleBrowserSelect = (match: any) => {
    setTopicData(prev => ({
      ...prev,
      indicatorCode: match.code,
      strand: match.strand,
      subStrand: match.subStrand,
      topic: match.contentStandard,
      subTopics: match.indicator,
      objectives: match.objectives
    }));
    setLookupStatus('success');
    showToast({ message: `Selection Applied: ${match.code}`, type: "success" });
  };

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
    weekNumber,
    setWeekNumber,
    topicData,
    setTopicData,
    performLookup,
    isLookingUp,
    lookupStatus,
    clearTopicData,
    isBrowserVisible,
    setIsBrowserVisible,
    handleBrowserSelect,
    saveTopic,
    hasUnsavedChanges,
    subjects: appUser?.subjects || [],
    curriculum: userCurriculum,
  };
};
