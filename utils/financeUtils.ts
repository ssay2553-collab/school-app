import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, writeBatch, doc, increment, serverTimestamp } from "firebase/firestore";

const termWeight = (term: string) => {
    if (!term) return 0;
    const t = term.toLowerCase();
    if (t.includes("1")) return 1;
    if (t.includes("2")) return 2;
    if (t.includes("3")) return 3;
    return 0;
};

const yearWeight = (year: string) => {
    if (!year) return 0;
    // Handle formats like "2023/2024" or "2023-2024"
    const startYear = parseInt(year.split(/[\/-]/)[0]);
    return isNaN(startYear) ? 0 : startYear;
};

/**
 * Propagates a balance change from a past term record to all subsequent term records.
 * This ensures that 'arrears', 'amountPaid', category balances, and the global 'balance'
 * fields in future snapshots remain consistent with the net wallet balance.
 *
 * @param studentUid The student's unique ID
 * @param changedYear The academic year of the record that was modified
 * @param changedTerm The term of the record that was modified
 * @param amountChange The net change in balance (positive for new charges, negative for payments/discounts)
 * @param type Whether this change is a 'bill' or a 'payment' (affects tuition arrears vs amountPaid)
 * @param category Optional category name (e.g., 'pta', 'admission')
 */
export const propagateArrears = async (
    studentUid: string,
    changedYear: string,
    changedTerm: string,
    amountChange: number,
    type: 'bill' | 'payment' = 'bill',
    category?: string
) => {
    if (!studentUid || !changedYear || !changedTerm || Math.abs(amountChange) < 0.01) return;

    try {
        const q = query(
            collection(db, "studentFeeRecords"),
            where("studentUid", "==", studentUid)
        );
        const snap = await getDocs(q);
        if (snap.empty) return;

        const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const changedScore = yearWeight(changedYear) * 10 + termWeight(changedTerm);

        const followingRecords = records.filter(r => {
            const rScore = yearWeight(r.academicYear) * 10 + termWeight(r.term);
            return rScore > changedScore;
        });

        if (followingRecords.length === 0) return;

        const batch = writeBatch(db);
        followingRecords.forEach(r => {
            const rRef = doc(db, "studentFeeRecords", r.id);
            const updateData: any = {
                balance: increment(amountChange),
                lastUpdated: serverTimestamp()
            };

            if (category) {
                // Category-specific logic
                const catPrefix = category.toLowerCase();
                updateData[`${catPrefix}Balance`] = increment(amountChange);
                if (type === 'payment') {
                    // amountChange is negative for payments, so we subtract it from 'Paid'
                    updateData[`${catPrefix}Paid`] = increment(-amountChange);
                } else {
                    updateData[`${catPrefix}Bill`] = increment(amountChange);
                }
            } else {
                // Tuition logic
                if (type === 'bill') {
                    // Bills increase the 'arrears' (accumulated bills) for future terms
                    updateData.arrears = increment(amountChange);
                } else {
                    // Payments increase the 'amountPaid' (total tuition payments) for future terms
                    // amountChange is negative for payments/discounts, so we subtract it
                    updateData.amountPaid = increment(-amountChange);
                }
            }

            batch.update(rRef, updateData);
        });

        await batch.commit();
        console.log(`Propagated ${amountChange} (${type}${category ? ':' + category : ''}) to ${followingRecords.length} subsequent records for ${studentUid}`);
    } catch (error) {
        console.error("Error propagating arrears:", error);
    }
};
