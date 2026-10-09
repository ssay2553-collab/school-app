import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  documentId,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicConfig } from '../useAcademicConfig';
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
  indicator?: string;
  weekNumber?: number | string;
  subTopics?: string;
  objectives?: string;
  teacherId: string;
  academicYear: string;
  term: string;
  curriculum?: string;
}

export interface ChildItem {
  id: string;
  name: string;
  classId: string;
  className?: string;
}

export const useStudentWeeklyTopics = () => {
  const { appUser } = useAuth();
  const acadConfig = useAcademicConfig();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<WeeklyTopic[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(moment().startOf('isoWeek').format('YYYY-MM-DD'));

  // Parent & Children resolution
  const [childrenList, setChildrenList] = useState<ChildItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const academicYear = acadConfig.academicYear || "";
  const term = acadConfig.currentTerm || "";

  // Fetch children if logged-in user is a Parent
  useEffect(() => {
    if (!appUser) return;
    const fetchChildren = async () => {
      const childIds = (appUser as any)?.childrenIds || [];
      if (childIds.length === 0) return;

      try {
        const q = query(collection(db, "users"), where(documentId(), "in", childIds.slice(0, 30)));
        const snap = await getDocs(q);
        const list: ChildItem[] = snap.docs.map(d => {
          const data = d.data() as any;
          const p = data.profile || {};
          const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || data.name || 'Child';
          return {
            id: d.id,
            name,
            classId: data.classId || p.classId || '',
            className: data.className || p.className || '',
          };
        });
        if (isMounted.current) {
          setChildrenList(list);
          if (list.length > 0 && !selectedChildId) {
            setSelectedChildId(list[0].id);
          }
        }
      } catch (e) {
        if (isMounted.current) console.error("fetchChildren error in useStudentWeeklyTopics:", e);
      }
    };
    fetchChildren();
  }, [appUser]);

  const fetchTopics = useCallback(async () => {
    let targetClassId = appUser?.classId || (appUser?.profile as any)?.classId;

    // If parent, resolve target classId from selected child
    if (childrenList.length > 0) {
      const selectedChild = childrenList.find(c => c.id === selectedChildId) || childrenList[0];
      targetClassId = selectedChild?.classId || targetClassId;
    }

    if (!targetClassId) {
      setTopics([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "weeklyTopics"),
        where("classId", "==", targetClassId),
        where("startDate", "==", selectedWeek)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WeeklyTopic[];

      if (isMounted.current) {
        setTopics(list);
      }
    } catch (err) {
      if (isMounted.current) console.error("fetchStudentWeeklyTopics error:", err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [appUser, selectedWeek, childrenList, selectedChildId]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const weekRange = {
    start: selectedWeek,
    end: moment(selectedWeek).add(4, 'days').format('YYYY-MM-DD')
  };

  return {
    loading,
    topics,
    selectedWeek,
    setSelectedWeek,
    weekRange,
    childrenList,
    selectedChildId,
    setSelectedChildId,
    refresh: fetchTopics,
    curriculum: appUser?.curriculum || "GES"
  };
};
