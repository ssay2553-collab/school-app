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

export const useFinanceCleanup = (showToast: (props: any) => void) => {
  const [cleaning, setCleaning] = useState(false);
  const [report, setReport] = useState<{
    orphanedRecords: number;
    fixedRecords: number;
    orphanedPayments: number;
    deletedPayments: number;
    reconciledBalances: number;
  } | null>(null);

  const runCleanup = useCallback(async () => {
    setCleaning(true);
    setReport(null);
    try {
      console.log("Starting financial data integrity scan...");

      // 1. Fetch all relevant data
      const [recordsSnap, paymentsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "studentFeeRecords")),
        getDocs(collection(db, "feePayments")),
        getDocs(query(collection(db, "users"), where("role", "==", "student"))),
      ]);

      console.log(
        `Fetched ${recordsSnap.size} records, ${paymentsSnap.size} payments, and ${usersSnap.size} students.`,
      );

      const validStudentIds = new Set(usersSnap.docs.map((d) => d.id));
      const claimedMapping = new Map<string, string>(); // Maps legacy IDs to new Auth UIDs

      const recordUpdates = new Map<string, any>();
      const userUpdates = new Map<string, any>();
      const paymentDeletions = new Set<string>();

      let orphanedRecordsCount = 0;
      let fixedRecordsCount = 0;
      let orphanedPaymentsCount = 0;
      let deletedPaymentsCount = 0;
      let reconciledBalancesCount = 0;

      const studentNameMap = new Map<string, string>();
      const studentIDMap = new Map<string, string>();
      usersSnap.docs.forEach((d) => {
        const data = d.data();

        // Track claimed accounts to resolve legacy records to the new Auth UID
        if (data.status === "claimed" && data.claimedBy) {
          claimedMapping.set(d.id, data.claimedBy);
        }

        const firstName = (data.profile?.firstName || "").trim().toLowerCase();
        const lastName = (data.profile?.lastName || "").trim().toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const fullNameReverse = `${lastName} ${firstName}`.trim();

        if (fullName) studentNameMap.set(fullName, d.id);
        if (fullNameReverse && fullNameReverse !== fullName)
          studentNameMap.set(fullNameReverse, d.id);

        const studentID =
          data.profile?.studentID || data.studentID || data.studentId;
        if (studentID)
          studentIDMap.set(String(studentID).trim().toLowerCase(), d.id);
      });

      const normalizeCategory = (p: any) => {
        if (!p) return "tuition";
        const cand = (p.type || p.category || p.purpose || p.memo || "tuition")
          .toString()
          .toLowerCase()
          .trim();
        const cleaned = cand.replace(/[^a-z0-9]/g, "");
        if (cleaned.includes("pta")) return "pta";
        if (cleaned.includes("maintenance")) return "maintenance";
        if (cleaned.includes("admission")) return "admission";
        if (cleaned.includes("book") || cleaned.includes("books"))
          return "books";
        if (cleaned.includes("uniform")) return "uniform";
        if (cleaned.includes("other")) return "other";
        // fall back to tuition for anything else
        return "tuition";
      };

      const resolvePaymentUid = (
        p: any,
        fallbackUid?: string,
        recordDocId?: string,
      ) => {
        const uidFromPayment = p?.studentUid || p?.studentID || p?.studentId;
        const name = p?.studentName || p?.receivedFrom || p?.paidBy;
        const resolved = resolveUid(uidFromPayment, name, recordDocId);
        if (resolved) return resolved;
        if (fallbackUid) return fallbackUid;
        return null;
      };

      const resolveUid = (
        uidOrId: string | undefined,
        name?: string,
        docId?: string,
      ) => {
        if (!uidOrId || uidOrId === "undefined" || uidOrId === "null") {
          if (name) {
            const cleanedName = name.toLowerCase().trim();
            const fromName = studentNameMap.get(cleanedName);
            if (fromName) return claimedMapping.get(fromName) || fromName;
          }
          if (docId) {
            const firstPart = docId.split("_")[0];
            if (firstPart) {
              const fromID = studentIDMap.get(firstPart.toLowerCase().trim());
              if (fromID) return claimedMapping.get(fromID) || fromID;
              if (validStudentIds.has(firstPart))
                return claimedMapping.get(firstPart) || firstPart;
            }
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

      // 2. Metadata Cleanup Phase
      recordsSnap.docs.forEach((d) => {
        const data = d.data();
        const id = d.id;

        const currentUid = data.studentUid || id.split("_")[0];
        const resolvedUid = resolveUid(currentUid, data.studentName, id);

        const isMissingMetadata =
          !data.academicYear ||
          !data.term ||
          !data.studentUid ||
          (resolvedUid && resolvedUid !== data.studentUid);

        if (isMissingMetadata) {
          orphanedRecordsCount++;
          const parts = id.split("_");
          if (parts.length >= 3) {
            const academicYearStr = parts[1].replace(/-/g, "/");
            const termStr = parts[2];

            if (
              resolvedUid &&
              academicYearStr.includes("/") &&
              termStr.toLowerCase().includes("term")
            ) {
              recordUpdates.set(id, {
                academicYear: academicYearStr,
                term: termStr,
                studentUid: resolvedUid,
                lastUpdated: serverTimestamp(),
              });
              fixedRecordsCount++;
            }
          } else if (resolvedUid) {
            recordUpdates.set(id, {
              studentUid: resolvedUid,
              lastUpdated: serverTimestamp(),
            });
            fixedRecordsCount++;
          }
        }
      });

      // 3. Payment Integrity Phase
      paymentsSnap.docs.forEach((d) => {
        const data = d.data();
        const resolvedUid = resolveUid(
          data.studentUid || data.studentID || data.studentId,
          data.studentName || data.receivedFrom || data.paidBy,
        );
        if (!resolvedUid) {
          orphanedPaymentsCount++;
        }
      });

      // 4. Data Grouping for Reconciliation
      const recordsByStudent: Record<string, any[]> = {};
      recordsSnap.docs.forEach((d) => {
        const data = d.data();
        const fixed = recordUpdates.get(d.id);
        const uid =
          fixed?.studentUid ||
          resolveUid(data.studentUid, data.studentName, d.id);

        if (uid) {
          if (!recordsByStudent[uid]) recordsByStudent[uid] = [];
          recordsByStudent[uid].push({
            id: d.id,
            ref: d.ref,
            data: { ...data, ...fixed },
          });
        }
      });

      const paymentsByStudent: Record<string, any[]> = {};
      const knownPaymentIdsByStudent: Record<string, Set<string>> = {};

      const addPayment = (uid: string, p: any, sourceId?: string) => {
        if (!uid || uid === "undefined") return;
        if (!paymentsByStudent[uid]) paymentsByStudent[uid] = [];
        if (!knownPaymentIdsByStudent[uid])
          knownPaymentIdsByStudent[uid] = new Set();

        const pId = String(
          p.receiptNo ||
            p.id ||
            sourceId ||
            `legacy-${uid}-${p.amount ?? p.amountPaid ?? p.value ?? ""}-${p.date || p.createdAt || ""}-${paymentsByStudent[uid].length}`,
        );

        if (!knownPaymentIdsByStudent[uid].has(pId)) {
          const cloned = { ...p, id: pId };
          // attach normalized category to speed later processing
          cloned._category = normalizeCategory(cloned);
          paymentsByStudent[uid].push(cloned);
          knownPaymentIdsByStudent[uid].add(pId);
        }
      };

      // Harvest from feePayments collection
      paymentsSnap.docs.forEach((d) => {
        const data = d.data();
        const uid = resolvePaymentUid(data, undefined, d.id);

        if (uid) {
          addPayment(uid, data, d.id);
        }
      });

      // Harvest from studentFeeRecords
      recordsSnap.docs.forEach((d) => {
        const data = d.data();
        const fixed = recordUpdates.get(d.id);
        const recordUid =
          fixed?.studentUid ||
          resolveUid(data.studentUid, data.studentName, d.id);

        if (!recordUid) return;

        // 1. Process explicit payments array
        if (Array.isArray(data.payments)) {
          data.payments.forEach((p: any) => {
            const pUid = resolvePaymentUid(p, recordUid, d.id);
            if (pUid) addPayment(pUid, p);
          });
        }

        // 2. REFACTORING LOGIC: Handle legacy amountPaid field
        // If amountPaid > 0 but payments array is empty or smaller,
        // create a synthetic payment to ensure money isn't lost.
        const explicitSum = (data.payments || []).reduce((acc: number, p: any) => acc + Number(p.amount || p.amountPaid || 0), 0);
        const legacyAmount = Number(data.amountPaid || 0);

        if (legacyAmount > explicitSum + 0.01) {
          const diff = legacyAmount - explicitSum;
          addPayment(recordUid, {
            amount: diff,
            type: "tuition_payment",
            date: data.date || data.createdAt || new Date().toISOString(),
            method: "Legacy Migration",
            receiptNo: `LEGACY-${d.id}`,
            note: "Refactored from legacy amountPaid field"
          });
        }
      });

      // Harvest from user documents (legacy)
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        if (Array.isArray(data.payments)) {
          data.payments.forEach((p: any) => {
            const pUid = resolvePaymentUid(p, d.id);
            if (pUid) addPayment(pUid, p);
          });
        }
      });

      const termOrder = ["Term 1", "Term 2", "Term 3"];
      const isolatedKeys = [
        "pta",
        "maintenance",
        "admission",
        "books",
        "uniform",
        "other",
      ];

      // 5. Balance Reconciliation Phase
      const allStudentUids = new Set([
        ...Object.keys(recordsByStudent),
        ...Object.keys(paymentsByStudent),
      ]);

      for (const uid of allStudentUids) {
        const studentRecords = (recordsByStudent[uid] || []).sort((a, b) => {
          const ay = a.data.academicYear || "";
          const by = b.data.academicYear || "";
          if (ay !== by) return ay.localeCompare(by);

          const getTermIndex = (t: string) => {
            const lower = t.toLowerCase();
            if (lower.includes("1")) return 0;
            if (lower.includes("2")) return 1;
            if (lower.includes("3")) return 2;
            return termOrder.indexOf(t);
          };

          return (
            getTermIndex(a.data.term || "") - getTermIndex(b.data.term || "")
          );
        });

        const studentPayments = paymentsByStudent[uid] || [];

        let totalTuitionPaid = 0;
        const totalCategoryPaid: Record<string, number> = {};
        isolatedKeys.forEach((k) => (totalCategoryPaid[k] = 0));

        studentPayments.forEach((p) => {
          const amt = Number(p.amount ?? p.amountPaid ?? p.value ?? 0);
          const category = p._category || normalizeCategory(p);

          if (isolatedKeys.includes(category)) {
            totalCategoryPaid[category] += amt;
          } else {
            totalTuitionPaid += amt;
          }
        });

        let accumulatedTuitionBills = 0;
        let accumulatedTotalBills = 0;
        const accumulatedCategoryBills: Record<string, number> = {};
        isolatedKeys.forEach((k) => (accumulatedCategoryBills[k] = 0));
        let lastFinalBalance = 0;

        if (studentRecords.length === 0) {
          // If no records, update the wallet balance based on payments alone (negative balance)
          const totalPaidAllBuckets =
            totalTuitionPaid +
            Object.values(totalCategoryPaid).reduce((a, b) => a + b, 0);
          userUpdates.set(uid, {
            walletBalance: -totalPaidAllBuckets,
            financeLastReconciled: serverTimestamp(),
          });
          continue;
        }

        for (const record of studentRecords) {
          const data = record.data;

          // Arrears is the balance BEFORE this term's bills are added
          const tuitionArrears = Math.max(0, accumulatedTuitionBills - totalTuitionPaid);

          const currentTuitionBill =
            Number(data.termBill || 0) - Number(data.discount || 0);
          accumulatedTuitionBills += currentTuitionBill;

          let currentRecordCategoryBills = 0;
          const updates: any = {
            arrears: tuitionArrears,
            lastUpdated: serverTimestamp(),
            payments: studentPayments
          };

          isolatedKeys.forEach((k) => {
            const termBill = Number(data[`${k}Bill`] || 0);
            accumulatedCategoryBills[k] += termBill;
            currentRecordCategoryBills += termBill;

            const totalPaid = totalCategoryPaid[k];
            const bal = accumulatedCategoryBills[k] - totalPaid;

            updates[`${k}Paid`] = totalPaid;
            updates[`${k}Balance`] = bal;
          });

          const totalPaidAllBuckets =
            totalTuitionPaid +
            Object.values(totalCategoryPaid).reduce((a, b) => a + b, 0);
          accumulatedTotalBills +=
            currentTuitionBill + currentRecordCategoryBills;

          const finalBalance = accumulatedTotalBills - totalPaidAllBuckets;

          updates.balance = finalBalance;
          updates.amountPaid = totalTuitionPaid;
          updates.totalPayable = accumulatedTotalBills;

          const existingUpdates = recordUpdates.get(record.id) || {};
          const needsUpdate =
            Math.abs((data.amountPaid || 0) - totalTuitionPaid) > 0.01 ||
            Math.abs((data.balance || 0) - finalBalance) > 0.01 ||
            Math.abs((data.arrears || 0) - tuitionArrears) > 0.01 ||
            (data.payments?.length || 0) !== studentPayments.length ||
            (fixedRecordsCount > 0 && !!recordUpdates.get(record.id));

          if (needsUpdate) {
            recordUpdates.set(record.id, { ...existingUpdates, ...updates });
            reconciledBalancesCount++;
          }

          lastFinalBalance = finalBalance;
        }

        userUpdates.set(uid, {
          walletBalance: lastFinalBalance,
          financeLastReconciled: serverTimestamp(),
        });
      }

      // 6. Batch Commit Operations
      let currentBatch = writeBatch(db);
      let opCount = 0;

      const commitBatch = async () => {
        if (opCount > 0) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      };

      for (const [id, updates] of recordUpdates.entries()) {
        currentBatch.update(doc(db, "studentFeeRecords", id), updates);
        opCount++;
        if (opCount >= 450) await commitBatch();
      }

      for (const id of paymentDeletions) {
        currentBatch.delete(doc(db, "feePayments", id));
        opCount++;
        if (opCount >= 450) await commitBatch();
      }

      for (const [uid, updates] of userUpdates.entries()) {
        if (validStudentIds.has(uid)) {
          currentBatch.update(doc(db, "users", uid), updates);
          opCount++;
          if (opCount >= 450) await commitBatch();
        }
      }

      await commitBatch();

      setReport({
        orphanedRecords: orphanedRecordsCount,
        fixedRecords: fixedRecordsCount,
        orphanedPayments: orphanedPaymentsCount,
        deletedPayments: deletedPaymentsCount,
        reconciledBalances: reconciledBalancesCount,
      });

      showToast({
        message: `Cleanup complete. Reconciled ${reconciledBalancesCount} balances.`,
        type: "success",
      });
    } catch (error) {
      console.error("Cleanup error:", error);
      showToast({
        message: "Cleanup failed: " + (error as Error).message,
        type: "error",
      });
    } finally {
      setCleaning(false);
    }
  }, [showToast]);

  return { cleaning, runCleanup, report };
};
