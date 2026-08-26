import { collection, getDocs, query, where, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * REPAIR SCRIPT: Sync missing Signup Codes
 * This script finds all users with 'pending_activation' status who have a signupCode
 * but no corresponding entry in the 'signupCodes' collection.
 */
export const repairMissingSignupCodes = async () => {
    console.log("Starting Signup Code Repair...");

    try {
        // 1. Fetch all pending users with a signupCode
        const q = query(
            collection(db, "users"),
            where("status", "==", "pending_activation"),
            where("signupCode", "!=", "")
        );

        const snap = await getDocs(q);
        console.log(`Found ${snap.docs.length} pending users to check.`);

        let repairedCount = 0;
        const batch = writeBatch(db);
        let batchSize = 0;

        for (const userDoc of snap.docs) {
            const userData = userDoc.data();
            const code = userData.signupCode;

            if (!code) continue;

            // 2. Check if the code already exists in signupCodes
            const codeRef = doc(db, "signupCodes", code);
            const codeSnap = await getDoc(codeRef);

            if (!codeSnap.exists()) {
                console.log(`Repairing missing code: ${code} for user ${userData.profile?.firstName} ${userData.profile?.lastName}`);

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

                // Firestore batch limit is 500
                if (batchSize >= 450) {
                    await batch.commit();
                    batchSize = 0;
                }
            }
        }

        if (batchSize > 0) {
            await batch.commit();
        }

        console.log(`Repair finished. Created ${repairedCount} missing signup code entries.`);
        return repairedCount;

    } catch (error) {
        console.error("Repair failed:", error);
        throw error;
    }
};
