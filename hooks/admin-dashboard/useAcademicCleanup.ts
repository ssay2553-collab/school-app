import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import { db } from "../../firebaseConfig";
import { getGradeDetails } from "../../lib/classHelpers";

export const useAcademicCleanup = (showToast: (props: any) => void) => {
  const [cleaning, setCleaning] = useState(false);
  const [report, setReport] = useState<{
    scoresFixed: number;
    reportsFixed: number;
    summaryFixed: number;
    submissionsFixed: number;
    attendanceFixed: number;
    behavioralFixed: number;
    groupsFixed: number;
    attendanceSummaryFixed: number;
    orphanedScores: number;
    statusFixed: number;
  } | null>(null);

  const runCleanup = useCallback(async (targetStudentId?: string) => {
    setCleaning(true);
    setReport(null);
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitBatch = async () => {
      if (opCount > 0) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    try {
      console.log(targetStudentId ? `Starting academic integrity scan for student: ${targetStudentId}` : "Starting academic integrity scan...");

      // 1. Fetch relevant data (Filtered if targetStudentId provided)
      let scoresSnap, reportsSnap, summarySnap, usersSnap, submissionsSnap, groupsSnap, attSummarySnap;
      let aliases: string[] = [];

      if (targetStudentId) {
        const userDoc = await getDoc(doc(db, "users", targetStudentId));
        if (!userDoc.exists()) throw new Error("Student not found");
        const userData = userDoc.data();
        aliases = [targetStudentId];
        if (userData?.migratedFrom) aliases.push(userData.migratedFrom);
        const sID = userData?.profile?.studentID || userData?.profile?.studentId || userData?.studentID || userData?.studentId;
        if (sID) aliases.push(String(sID));

        [scoresSnap, reportsSnap, summarySnap, usersSnap, submissionsSnap, groupsSnap, attSummarySnap] = await Promise.all([
          getDocs(query(collection(db, "scores"), where("studentId", "in", aliases))),
          getDocs(query(collection(db, "student-reports"), where("studentId", "in", aliases))),
          getDocs(query(collection(db, "academicRecordsSummary"), where("studentId", "in", aliases))),
          getDocs(query(collection(db, "users"), where("__name__", "in", aliases))),
          getDocs(query(collection(db, "submissions"), where("studentId", "in", aliases))),
          getDocs(query(collection(db, "studentGroups"), where("studentIds", "array-contains-any", aliases))),
          getDocs(query(collection(db, "attendanceSummary"), where("studentId", "in", aliases))),
        ]);
      } else {
        [scoresSnap, reportsSnap, summarySnap, usersSnap, submissionsSnap, groupsSnap, attSummarySnap] = await Promise.all([
          getDocs(collection(db, "scores")),
          getDocs(collection(db, "student-reports")),
          getDocs(collection(db, "academicRecordsSummary")),
          getDocs(query(collection(db, "users"), where("role", "==", "student"))),
          getDocs(collection(db, "submissions")),
          getDocs(collection(db, "studentGroups")),
          getDocs(collection(db, "attendanceSummary")),
        ]);
      }

      const validStudentIds = new Set(usersSnap.docs.map((d) => d.id));
      const claimedMapping = new Map<string, string>(); // Maps legacy IDs to new Auth UIDs
      const studentNameMap = new Map<string, string>();
      const studentIDMap = new Map<string, string>();

      usersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.status === "claimed" && data.claimedBy) {
          claimedMapping.set(d.id, data.claimedBy);
        } else if (data.migratedFrom && data.role === "student") {
          // Backwards mapping for already migrated students
          claimedMapping.set(data.migratedFrom, d.id);
        }

        const firstName = (data.profile?.firstName || "").trim().toLowerCase();
        const lastName = (data.profile?.lastName || "").trim().toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) {
          // For claimed/migrated users, we want to map to the newest UID
          studentNameMap.set(fullName, d.id);
        }

        const studentID = data.profile?.studentID || data.profile?.studentId || data.studentID || data.studentId;
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

      const mergeAcademicData = (target: any, source: any) => {
        const merged = { ...target };
        if (source.scores && typeof source.scores === "object") {
          if (!merged.scores || typeof merged.scores !== "object") merged.scores = {};
          Object.keys(source.scores).forEach((sub) => {
            const s1 = merged.scores[sub] || {};
            const s2 = source.scores[sub] || {};
            const v1 = parseFloat(s1.finalScore || s1.total || "0") || 0;
            const v2 = parseFloat(s2.finalScore || s2.total || "0") || 0;
            if (v2 > v1) merged.scores[sub] = { ...s1, ...s2 };
          });
        }
        const textFields = ["teacherRemark", "principalRemark", "remark", "promotedTo", "attendance", "position", "teacherName"];
        textFields.forEach((f) => {
          const v1 = (target[f] || "").toString().trim();
          const v2 = (source[f] || "").toString().trim();
          if (v2.length > v1.length) merged[f] = source[f];
        });
        const numFields = ["overallAverage", "average", "totalScore", "total"];
        numFields.forEach((f) => {
          const v1 = parseFloat(target[f] || "0") || 0;
          const v2 = parseFloat(source[f] || "0") || 0;
          if (v2 > v1) merged[f] = source[f];
        });
        return merged;
      };

      // Build Lookups for Healing
      console.log("Building academic recovery lookups...");
      const summaryLookup = new Map<string, any>();
      summarySnap.docs.forEach((d) => {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved) {
          const yearSlug = (data.academicYear || "").replace(/\//g, "_");
          const termSlug = (data.term || "").replace(/\s/g, "");
          const key = `${resolved}_${yearSlug}_${termSlug}`;
          summaryLookup.set(key, data.scores || {});
        }
      });

      const scoresLookup = new Map<string, any>();
      scoresSnap.docs.forEach((d) => {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved) {
          const yearSlug = (data.academicYear || "").replace(/\//g, "-");
          const termSlug = (data.term || "").replace(/\s/g, "");
          const subSlug = (data.subject || "").replace(/\s+/g, "_");
          const typeSlug = (data.reportType || "").replace(/\s+/g, "");
          const key = `${resolved}_${data.classId}_${yearSlug}_${termSlug}_${subSlug}_${typeSlug}`;
          scoresLookup.set(key, data);
        }
      });

      let scoresFixed = 0;
      let reportsFixed = 0;
      let summaryFixed = 0;
      let submissionsFixed = 0;
      let attendanceFixed = 0;
      let behavioralFixed = 0;
      let groupsFixed = 0;
      let attendanceSummaryFixed = 0;
      let orphanedScores = 0;
      let statusFixed = 0;

      // New: Identity & Status Recovery Phase
      for (const d of usersSnap.docs) {
        const data = d.data();

        // 1. Migrate Claimed User Profile to Auth UID document ID
        if (data.status === "claimed" && data.claimedBy && d.id !== data.claimedBy) {
          const newDocRef = doc(db, "users", data.claimedBy);
          currentBatch.set(newDocRef, {
            ...data,
            uid: data.claimedBy,
            authUid: data.claimedBy, // Ensure authUid is present
            status: "active", // Finalize claim
            migratedFrom: d.id,
            lastIdentityFix: serverTimestamp(),
          }, { merge: true });
          currentBatch.delete(d.ref);
          statusFixed++;
          opCount += 2;
        }

        // 2. Fix accidentally activated accounts
        if (data.status === "active" && data.signupCode && !data.authUid && !data.claimedBy) {
          currentBatch.update(doc(db, "users", d.id), {
            status: "pending_activation",
            lastStatusFix: serverTimestamp(),
          });
          statusFixed++;
          opCount++;
        }
        if (opCount >= 450) await commitBatch();
      }

      const scoreUpdates = new Map<string, any>();
      const reportUpdates = new Map<string, any>();
      const summaryUpdates = new Map<string, any>();
      const recordUpdates = new Map<string, any>();
      const submissionUpdates = new Map<string, any>();
      const attendanceUpdates = new Map<string, any>();
      const behavioralUpdates = new Map<string, any>();
      const groupUpdates = new Map<string, any>();
      const attendanceSummaryMigrated = new Set<string>();

      // 2. Scan Scores & Consolidate (Deduplication)
      const scoreKeyMap = new Map<string, { id: string; total: number; ref: any }>();
      scoresSnap.docs.forEach((d) => {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (!resolved) {
          orphanedScores++;
          return;
        }

        const yearSlug = (data.academicYear || "").replace(/\//g, "-");
        const termSlug = (data.term || "").replace(/\s/g, "");
        const subSlug = (data.subject || "").replace(/\s+/g, "_");
        const typeSlug = (data.reportType || "").replace(/\s+/g, "");
        const key = `${resolved}_${data.classId}_${yearSlug}_${termSlug}_${subSlug}_${typeSlug}`;

        const currentTotal = parseFloat(data.total || data.finalScore || "0") || 0;
        const existing = scoreKeyMap.get(key);

        if (existing) {
          if (currentTotal > existing.total) {
            currentBatch.delete(existing.ref);
            scoreKeyMap.set(key, { id: d.id, total: currentTotal, ref: d.ref });
            scoreUpdates.set(d.id, { studentId: resolved, lastCleaned: serverTimestamp() });
          } else {
            currentBatch.delete(d.ref);
          }
          scoresFixed++;
          opCount++;
        } else {
          scoreKeyMap.set(key, { id: d.id, total: currentTotal, ref: d.ref });
          if (resolved !== data.studentId) {
            scoreUpdates.set(d.id, { studentId: resolved, lastCleaned: serverTimestamp() });
            scoresFixed++;
          }
        }
        if (opCount >= 450) commitBatch();
      });

      // 3. Scan Student Reports & Consolidate
      const consolidatedReports = new Map<string, any>();
      const reportsToDelete = new Set<any>();

      for (const d of reportsSnap.docs) {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved) {
          const yearSlug = (data.academicYear || "").replace(/\//g, "-");
          const termSlug = (data.term || "").replace(/\s/g, "");
          const typeSlug = (data.reportType || "End of Term").replace(/\s/g, "");
          const newDocId = `${resolved}_${yearSlug}_${termSlug}_${typeSlug}`.replace(/\//g, "-");

          const existing = consolidatedReports.get(newDocId);
          if (existing) {
            consolidatedReports.set(newDocId, mergeAcademicData(existing, data));
          } else {
            consolidatedReports.set(newDocId, { ...data, studentId: resolved });
          }
          if (d.id !== newDocId) reportsToDelete.add(d.ref);
        }
      }

      for (const [newId, mergedData] of consolidatedReports.entries()) {
        currentBatch.set(doc(db, "student-reports", newId), {
          ...mergedData,
          lastCleaned: serverTimestamp(),
        }, { merge: true });
        reportsFixed++;
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const ref of reportsToDelete) {
        currentBatch.delete(ref);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }

      // 4. Scan Academic Records (Class Level Gradebooks)
      const recordsSnap = targetStudentId
        ? await getDocs(query(collection(db, "academicRecords"), where("studentIds", "array-contains-any", aliases)))
        : await getDocs(collection(db, "academicRecords"));

      recordsSnap.docs.forEach((d) => {
        const data = d.data();
        let changed = false;
        let studentsArr = Array.isArray(data.students) ? [...data.students] : [];
        const updatedIds = Array.isArray(data.studentIds) ? [...data.studentIds] : [];

        // Fix: Force array type if it was malformed (e.g., an empty object {})
        if (!Array.isArray(data.students) || !Array.isArray(data.studentIds)) {
          changed = true;
        }

        // 4a. Resolve UIDs in students array
        studentsArr = studentsArr.map((s: any) => {
          if (s && s.studentId && claimedMapping.has(s.studentId)) {
            changed = true;
            return { ...s, studentId: claimedMapping.get(s.studentId)! };
          }
          return s;
        });

        // 4b. Resolve UIDs in studentIds array
        updatedIds.forEach((id, idx) => {
          if (id && claimedMapping.has(id)) {
            updatedIds[idx] = claimedMapping.get(id)!;
            changed = true;
          }
        });

        // 4c. HEALING: Sync students array with studentIds and restore scores from Lookups
        const existingStudentMap = new Map<string, any>();
        studentsArr.forEach((s: any) => {
          if (s && s.studentId) {
            const sid = resolveUid(s.studentId, s.fullName) || s.studentId;
            const existing = existingStudentMap.get(sid);
            if (existing) {
              const v1 = parseFloat(existing.finalScore || "0") || 0;
              const v2 = parseFloat(s.finalScore || "0") || 0;
              if (v2 > v1) existingStudentMap.set(sid, { ...s, studentId: sid });
            } else {
              existingStudentMap.set(sid, { ...s, studentId: sid });
            }
          }
        });

        const finalStudents: any[] = [];
        updatedIds.forEach((sid) => {
          let s = existingStudentMap.get(sid);

          // Check if we need to heal this student (either missing or zeroed out)
          const fScoreStr = s?.finalScore || s?.total || "0";
          const val = parseFloat(fScoreStr);

          // Enhanced check: Also heal if we have a finalScore but raw scores are missing/zeroed
          const cScoreVal = parseFloat(s?.classScore) || 0;
          const eScoreVal = parseFloat(s?.exam50 || s?.examsMark) || 0;
          const isZeroed = val > 0 && cScoreVal === 0 && eScoreVal === 0;

          if (!s || isNaN(val) || val === 0 || isZeroed) {
            const yearSlug = (data.academicYear || "").replace(/\//g, "-");
            const termSlug = (data.term || "").replace(/\s/g, "");
            const subSlug = (data.subject || "").replace(/\s+/g, "_");
            const typeSlug = (data.reportType || "").replace(/\s+/g, "");
            const scoreKey = `${sid}_${data.classId}_${yearSlug}_${termSlug}_${subSlug}_${typeSlug}`;
            const recoveredScore = scoresLookup.get(scoreKey);

            const summaryYearSlug = (data.academicYear || "").replace(/\//g, "_");
            const summaryKey = `${sid}_${summaryYearSlug}_${termSlug}`;
            const studentSummaryScores = summaryLookup.get(summaryKey) || {};
            const subjectKey = `${subSlug}_${typeSlug}`;
            const recoveredSummary = studentSummaryScores[subjectKey] || studentSummaryScores[subSlug] || studentSummaryScores[data.subject || ""];

            if (recoveredScore || recoveredSummary) {
              changed = true;
              const userDoc = usersSnap.docs.find((u) => u.id === sid);
              const userData = userDoc?.data();
              const fullName = userData
                ? `${userData.profile?.firstName || ""} ${userData.profile?.lastName || ""}`.trim()
                : s?.fullName || "Unknown Student";

              const fScore = recoveredScore?.total || recoveredSummary?.finalScore || "0";
              const cScore = recoveredScore?.classScore || recoveredSummary?.classScore || "0";
              const eScore = recoveredScore?.examsMark || recoveredSummary?.exam50 || recoveredSummary?.examsMark || "0";
              const grade = recoveredScore?.grade || recoveredSummary?.grade || getGradeDetails(parseFloat(fScore)).grade;

              s = {
                studentId: sid,
                fullName: fullName,
                classScore: String(cScore),
                exam50: data.reportType === "End of Term" ? String(eScore) : "0",
                examsMark: data.reportType !== "End of Term" ? String(eScore) : "0",
                finalScore: String(fScore),
                grade: String(grade),
                position: recoveredSummary?.position || s?.position || "-",
              };
            } else if (!s) {
              // Still missing but no recovery data, create placeholder
              changed = true;
              const userDoc = usersSnap.docs.find((u) => u.id === sid);
              const userData = userDoc?.data();
              const fullName = userData
                ? `${userData.profile?.firstName || ""} ${userData.profile?.lastName || ""}`.trim()
                : "Unknown Student";
              s = {
                studentId: sid,
                fullName: fullName,
                classScore: "0",
                exam50: "0",
                finalScore: "0",
                grade: "9",
                position: "-",
              };
            }
          }
          if (s) finalStudents.push(s);
        });

        if (changed) {
          recordUpdates.set(d.id, {
            students: finalStudents,
            studentIds: updatedIds,
            lastCleaned: serverTimestamp(),
          });
        }
      });

      // 5. Scan Academic Summaries & Consolidate
      const consolidatedSummaries = new Map<string, any>();
      const summariesToDelete = new Set<any>();

      for (const d of summarySnap.docs) {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved) {
          const yearSlug = (data.academicYear || "").replace(/\//g, "_");
          const termSlug = (data.term || "").replace(/\s/g, "");
          const newDocId = `${resolved}_${yearSlug}_${termSlug}`;

          const existing = consolidatedSummaries.get(newDocId);
          if (existing) {
            consolidatedSummaries.set(newDocId, mergeAcademicData(existing, data));
          } else {
            consolidatedSummaries.set(newDocId, { ...data, studentId: resolved });
          }
          if (d.id !== newDocId) summariesToDelete.add(d.ref);
        }
      }

      for (const [newId, mergedData] of consolidatedSummaries.entries()) {
        currentBatch.set(doc(db, "academicRecordsSummary", newId), {
          ...mergedData,
          lastCleaned: serverTimestamp(),
        }, { merge: true });
        summaryFixed++;
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const ref of summariesToDelete) {
        currentBatch.delete(ref);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }

      // 6. Scan Submissions
      submissionsSnap.docs.forEach((d) => {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved && resolved !== data.studentId) {
          submissionUpdates.set(d.id, { studentId: resolved, lastCleaned: serverTimestamp() });
          submissionsFixed++;
        }
      });

      // 7. Scan Attendance
      const attendanceSnap = targetStudentId
        ? await getDocs(query(collection(db, "attendance"), where(`students.${targetStudentId}`, "!=", null))) // Note: This might not catch all legacy IDs if they aren't the key anymore, but it's the best filterable approach
        : await getDocs(collection(db, "attendance"));

      // Fallback: If targetStudentId filter returns nothing but we have aliases, we might need a broader scan or just skip if performance is key
      // For now, we'll try to scan based on the main target ID.

      attendanceSnap.docs.forEach((d) => {
        const data = d.data();
        let changed = false;
        const updatedStudents = { ...(data.students || {}) };

        Object.keys(updatedStudents).forEach(oldId => {
          if (claimedMapping.has(oldId)) {
            const newId = claimedMapping.get(oldId)!;
            updatedStudents[newId] = updatedStudents[oldId];
            delete updatedStudents[oldId];
            changed = true;
          }
        });

        if (changed) {
          attendanceUpdates.set(d.id, {
            students: updatedStudents,
            lastCleaned: serverTimestamp()
          });
          attendanceFixed++;
        }
      });

      // 8. Scan Behavioral Records
      const behavioralSnap = targetStudentId
        ? await getDocs(query(collection(db, "behavioralRecords"), where("studentIds", "array-contains-any", aliases)))
        : await getDocs(collection(db, "behavioralRecords"));

      behavioralSnap.docs.forEach((d) => {
        const data = d.data();
        let changed = false;
        const studentsArr = Array.isArray(data.students) ? data.students : [];
        const idsArr = Array.isArray(data.studentIds) ? data.studentIds : [];

        const updatedStudents = [...studentsArr];
        const updatedIds = [...idsArr];

        if (!Array.isArray(data.students) || !Array.isArray(data.studentIds)) {
          changed = true;
        }

        updatedStudents.forEach((s: any, idx: number) => {
          if (s && s.studentId && claimedMapping.has(s.studentId)) {
            updatedStudents[idx] = { ...s, studentId: claimedMapping.get(s.studentId)! };
            changed = true;
          }
        });

        updatedIds.forEach((id, idx) => {
          if (id && claimedMapping.has(id)) {
            updatedIds[idx] = claimedMapping.get(id)!;
            changed = true;
          }
        });

        if (changed) {
          behavioralUpdates.set(d.id, {
            students: updatedStudents,
            studentIds: updatedIds,
            lastCleaned: serverTimestamp()
          });
          behavioralFixed++;
        }
      });

      // 9. Attendance Summary Consolidation
      const consolidatedAttSummary = new Map<string, any>();
      const attSummaryToDelete = new Set<any>();
      for (const d of attSummarySnap.docs) {
        const data = d.data();
        const resolved = resolveUid(data.studentId, data.studentName);
        if (resolved) {
          const yearSlug = (data.academicYear || "").replace(/\//g, "-");
          const termSlug = (data.term || "").replace(/\s/g, "");
          const newDocId = `${resolved}_${yearSlug}_${termSlug}`;

          const existing = consolidatedAttSummary.get(newDocId);
          if (existing) {
            const m = { ...existing };
            ["present", "absent", "late", "total"].forEach((k) => {
              const v1 = parseInt(existing[k] || "0") || 0;
              const v2 = parseInt(data[k] || "0") || 0;
              if (v2 > v1) m[k] = data[k];
            });
            consolidatedAttSummary.set(newDocId, m);
          } else {
            consolidatedAttSummary.set(newDocId, { ...data, studentId: resolved });
          }
          if (d.id !== newDocId) attSummaryToDelete.add(d.ref);
        }
      }

      for (const [newId, mergedData] of consolidatedAttSummary.entries()) {
        currentBatch.set(doc(db, "attendanceSummary", newId), {
          ...mergedData,
          lastCleaned: serverTimestamp(),
        }, { merge: true });
        attendanceSummaryFixed++;
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const ref of attSummaryToDelete) {
        currentBatch.delete(ref);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }

      // 11. Student Group Healing
      groupsSnap.docs.forEach((d) => {
        const data = d.data();
        let changed = false;
        const idsArr = Array.isArray(data.studentIds) ? data.studentIds : [];
        const updatedStudentIds = [...idsArr];

        if (!Array.isArray(data.studentIds)) {
          changed = true;
        }

        updatedStudentIds.forEach((id, idx) => {
          if (id && claimedMapping.has(id)) {
            updatedStudentIds[idx] = claimedMapping.get(id)!;
            changed = true;
          }
        });

        if (changed) {
          groupUpdates.set(d.id, {
            studentIds: updatedStudentIds,
            lastCleaned: serverTimestamp()
          });
          groupsFixed++;
        }
      });

      // 12. Execute Updates
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
      for (const [id, updates] of submissionUpdates.entries()) {
        currentBatch.update(doc(db, "submissions", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [id, updates] of attendanceUpdates.entries()) {
        currentBatch.update(doc(db, "attendance", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [id, updates] of behavioralUpdates.entries()) {
        currentBatch.update(doc(db, "behavioralRecords", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }
      for (const [id, updates] of groupUpdates.entries()) {
        currentBatch.update(doc(db, "studentGroups", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }

      await commitBatch();

      setReport({ scoresFixed, reportsFixed, summaryFixed, submissionsFixed, attendanceFixed, behavioralFixed, groupsFixed, attendanceSummaryFixed, orphanedScores, statusFixed });
      showToast({ message: `Academic scan complete. Fixed ${scoresFixed + reportsFixed + summaryFixed + submissionsFixed + attendanceFixed + behavioralFixed + groupsFixed + attendanceSummaryFixed + statusFixed} records.`, type: "success" });

    } catch (error) {
      console.error("Academic Cleanup error:", error);
      showToast({ message: "Academic scan failed: " + (error as Error).message, type: "error" });
    } finally {
      setCleaning(false);
    }
  }, [showToast]);

  return { cleaning, runCleanup, report };
};
