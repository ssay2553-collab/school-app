import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import { db } from "../../firebaseConfig";

export const useAcademicCleanup = (showToast: (props: any) => void) => {
  const [cleaning, setCleaning] = useState(false);
  const [report, setReport] = useState<{
    scoresFixed: number;
    reportsFixed: number;
    summaryFixed: number;
    orphanedScores: number;
  } | null>(null);

  const runCleanup = useCallback(async () => {
    setCleaning(true);
    setReport(null);
    try {
      console.log("Starting academic integrity scan...");

      // 1. Fetch all relevant data
      const [scoresSnap, reportsSnap, summarySnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "scores")),
        getDocs(collection(db, "student-reports")),
        getDocs(collection(db, "academicRecordsSummary")),
        getDocs(query(collection(db, "users"), where("role", "==", "student"))),
      ]);

      const validStudentIds = new Set(usersSnap.docs.map((d) => d.id));
      const claimedMapping = new Map<string, string>(); // Maps legacy IDs to new Auth UIDs
      const studentNameMap = new Map<string, string>();
      const studentIDMap = new Map<string, string>();

      usersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.status === "claimed" && data.claimedBy) {
          claimedMapping.set(d.id, data.claimedBy);
        }
        const firstName = (data.profile?.firstName || "").trim().toLowerCase();
        const lastName = (data.profile?.lastName || "").trim().toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) studentNameMap.set(fullName, d.id);

        const studentID = data.profile?.studentID || data.studentID || data.studentId;
        if (studentID) studentIDMap.set(String(studentID).trim().toLowerCase(), d.id);
      });

      const resolveUid = (uidOrId: string | undefined, name?: string) => {
        if (!uidOrId || uidOrId === "undefined" || uidOrId === "null") {
          if (name) {
            const cleanedName = name.toLowerCase().trim();
            const fromName = studentNameMap.get(cleanedName);
            if (fromName) return claimedMapping.get(fromName) || fromName;
          }
          return null;
        }
        const trimmed = String(uidOrId).trim();
        if (validStudentIds.has(trimmed)) return claimedMapping.get(trimmed) || trimmed;
        const fromID = studentIDMap.get(trimmed.toLowerCase());
        if (fromID) return claimedMapping.get(fromID) || fromID;
        if (name) {
          const cleanedName = name.toLowerCase().trim();
          const fromName = studentNameMap.get(cleanedName);
          if (fromName) return claimedMapping.get(fromName) || fromName;
        }
        return null;
      };

      let scoresFixed = 0;
      let reportsFixed = 0;
      let summaryFixed = 0;
      let orphanedScores = 0;

      const scoreUpdates = new Map<string, any>();
      const reportUpdates = new Map<string, any>();
      const summaryUpdates = new Map<string, any>();

      // 2. Scan Scores
      scoresSnap.docs.forEach((d) => {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved && resolved !== data.studentId) {
          scoreUpdates.set(d.id, { studentId: resolved, lastCleaned: serverTimestamp() });
          scoresFixed++;
        } else if (!resolved) {
          orphanedScores++;
        }
      });

      // 3. Scan Student Reports
      reportsSnap.docs.forEach((d) => {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved && resolved !== data.studentId) {
          reportUpdates.set(d.id, { studentId: resolved, lastCleaned: serverTimestamp() });
          reportsFixed++;
        }
      });

      // 4. Scan Academic Records (Class Level Gradebooks)
      const recordsSnap = await getDocs(collection(db, "academicRecords"));
      recordsSnap.docs.forEach((d) => {
        const data = d.data();
        let changed = false;
        const updatedStudents = { ...(data.students || {}) };
        const updatedIds = [...(data.studentIds || [])];

        // Check if any student in this record has been claimed
        Object.keys(updatedStudents).forEach(oldId => {
          if (claimedMapping.has(oldId)) {
            const newId = claimedMapping.get(oldId)!;
            updatedStudents[newId] = updatedStudents[oldId];
            delete updatedStudents[oldId];
            changed = true;
          }
        });

        updatedIds.forEach((id, idx) => {
          if (claimedMapping.has(id)) {
            updatedIds[idx] = claimedMapping.get(id)!;
            changed = true;
          }
        });

        if (changed) {
          recordUpdates.set(d.id, {
            students: updatedStudents,
            studentIds: updatedIds,
            lastCleaned: serverTimestamp()
          });
        }
      });

      // 5. Parent Link Healing
      const parentsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "parent")));
      parentsSnap.docs.forEach(d => {
        const data = d.data();
        const childrenIds = data.childrenIds || [];
        let changed = false;
        const newChildrenIds = childrenIds.map((id: string) => {
          if (claimedMapping.has(id)) {
            changed = true;
            return claimedMapping.get(id);
          }
          return id;
        });

        if (changed) {
          // Update the parent's children list to point to the new Auth UID
          currentBatch.update(doc(db, "users", d.id), { childrenIds: newChildrenIds });
          opCount++;
        }
      });

      // 6. Batch Commit
      const commitBatch = async () => {
        if (opCount > 0) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      };

      for (const [id, updates] of recordUpdates.entries()) {
        currentBatch.update(doc(db, "academicRecords", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [id, updates] of scoreUpdates.entries()) {
        currentBatch.update(doc(db, "scores", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [id, updates] of reportUpdates.entries()) {
        currentBatch.update(doc(db, "student-reports", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [id, updates] of summaryUpdates.entries()) {
        currentBatch.update(doc(db, "academicRecordsSummary", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }

      await commitBatch();

      setReport({ scoresFixed, reportsFixed, summaryFixed, orphanedScores });
      showToast({ message: `Academic scan complete. Fixed ${scoresFixed + reportsFixed + summaryFixed} records.`, type: "success" });

    } catch (error) {
      console.error("Academic Cleanup error:", error);
      showToast({ message: "Academic scan failed: " + (error as Error).message, type: "error" });
    } finally {
      setCleaning(false);
    }
  }, [showToast]);

  return { cleaning, runCleanup, report };
};
