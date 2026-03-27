import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// Export function modules
export * from "./academics";
export * from "./news";
export * from "./chat";
export * from "./attendance";
export * from "./userActions"; 
export * from "./finance";
export * from "./birthdays"; // Added Birthday function

/**
 * 🚀 CLOUD FUNCTION (V2): Aggregate Score Stats
 */
export const onScoreWrite = onDocumentWritten("scores/{scoreId}", async (event) => {
    const data = event.data?.after.exists ? event.data.after.data() : event.data?.before.data();
    
    if (!data) return;

    const { classId, subject, term, academicYear } = data;
    if (!classId || !subject || !term || !academicYear) return;

    const statsId = `stats_${classId}_${subject}_${term}_${academicYear.replace(/\//g, "-")}`;
    const statsRef = db.collection("metadata").doc(statsId);

    const scoresSnap = await db.collection("scores")
        .where("classId", "==", classId)
        .where("subject", "==", subject)
        .where("term", "==", term)
        .where("academicYear", "==", academicYear)
        .get();

    if (scoresSnap.empty) {
        await statsRef.delete();
        return;
    }

    let totalScore = 0;
    let passes = 0;
    const count = scoresSnap.size;

    scoresSnap.forEach((doc) => {
        const score = doc.data().total || 0;
        totalScore += score;
        if (score >= 50) passes++;
    });

    const average = totalScore / count;
    const passRate = (passes / count) * 100;

    await statsRef.set({
        average: parseFloat(average.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(1)),
        studentCount: count,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        classId, 
        subject, 
        term, 
        academicYear
    }, { merge: true });
});
