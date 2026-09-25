import { collection, getDocs, query, where, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * REPAIR SCRIPT: Sync missing Signup Codes and Student Parent Link Codes
 * This script finds:
 * 1. All pending users with a signupCode who have no corresponding entry in the 'signupCodes' collection.
 * 2. All student users missing a parentLinkCode and generates one for them.
 */
export const repairMissingSignupCodes = async () => {
    console.log("Starting Signup Code & Parent Link Code Repair...");

    try {
        let repairedCount = 0;
        const batch = writeBatch(db);
        let batchSize = 0;

        // 1. Fetch all pending users (avoiding inequality queries that require indexes)
        const qPending = query(
            collection(db, "users"),
            where("status", "==", "pending_activation")
        );

        const snapPending = await getDocs(qPending);
        console.log(`Found ${snapPending.docs.length} pending users to check for signup codes.`);

        for (const userDoc of snapPending.docs) {
            const userData = userDoc.data();
            const code = userData.signupCode;

            if (!code || typeof code !== "string" || code.trim() === "") continue;

            // Check if the code already exists in signupCodes
            const codeRef = doc(db, "signupCodes", code);
            const codeSnap = await getDoc(codeRef);

            if (!codeSnap.exists()) {
                console.log(`Repairing missing signup code: ${code} for user ${userData.profile?.firstName} ${userData.profile?.lastName}`);

                batch.set(codeRef, {
                    code: code,
                    intendedForRole: userData.role || 'student',
                    used: false,
                    createdBy: 'system_repair',
                    createdAt: serverTimestamp(),
                    classId: userData.classId || ""
                });

                repairedCount++;
                batchSize++;

                if (batchSize >= 450) {
                    await batch.commit();
                    batchSize = 0;
                }
            }
        }

        // 2. Fetch all student users and ensure they have a parentLinkCode
        const qStudents = query(
            collection(db, "users"),
            where("role", "==", "student")
        );
        const snapStudents = await getDocs(qStudents);
        console.log(`Found ${snapStudents.docs.length} student users to check for parentLinkCode.`);

        for (const studentDoc of snapStudents.docs) {
            const studentData = studentDoc.data();
            if (!studentData.parentLinkCode || studentData.parentLinkCode.trim() === "") {
                const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                console.log(`Repairing missing parentLinkCode: ${newCode} for student ${studentDoc.id} (${studentData.profile?.firstName || ''} ${studentData.profile?.lastName || ''})`);

                batch.update(studentDoc.ref, {
                    parentLinkCode: newCode
                });

                repairedCount++;
                batchSize++;

                if (batchSize >= 450) {
                    await batch.commit();
                    batchSize = 0;
                }
            }
        }

        if (batchSize > 0) {
            await batch.commit();
        }

        console.log(`Repair finished. Repaired/created ${repairedCount} code entries.`);
        return repairedCount;

    } catch (error) {
        console.error("Repair failed:", error);
        throw error;
    }
};
