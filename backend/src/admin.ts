import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Callable admin helper to delete a user's Auth account and Firestore document.
 * payload: { uid: string }
 * Requires the caller to be authenticated and have an admin claim OR an "admin" role in Firestore.
 */
export const deleteUserAccount = onCall(async (req) => {
  const auth = req.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to delete an account.");
  }

  const { uid } = req.data || {};
  if (!uid) {
    throw new HttpsError("invalid-argument", "The function must be called with a valid 'uid'.");
  }

  // Check Authorization: Admin Claim or Firestore Role
  const db = admin.firestore();
  const hasAdminClaim = auth.token && (auth.token.admin === true || auth.token.role === "admin");
  let authorized = hasAdminClaim;

  if (!authorized) {
    // Fallback: Check Firestore document for admin role
    const callerDoc = await db.collection("users").doc(auth.uid).get();
    if (callerDoc.exists && (callerDoc.data()?.role === "admin" || callerDoc.data()?.adminRole)) {
      authorized = true;
    }
  }

  if (!authorized) {
    console.warn(`Unauthorized deletion attempt by UID: ${auth.uid} against UID: ${uid}`);
    throw new HttpsError("permission-denied", "Unauthorized: Only administrators can delete accounts.");
  }

  try {
    // 1. Delete Auth Account first - if this fails, we don't proceed to Firestore
    try {
      await admin.auth().deleteUser(uid);
      console.log(`Auth account deleted for UID: ${uid}`);
    } catch (authErr: any) {
      // If user is already gone from Auth, proceed to Firestore cleanup anyway
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
      console.log(`User ${uid} not found in Auth, proceeding to delete Firestore doc.`);
    }

    // 2. Delete Firestore User Document
    await db.collection("users").doc(uid).delete();
    console.log(`Firestore document deleted for UID: ${uid}`);

    // 3. Optional: Cleanup sub-collections or references if needed
    // (Could add logic here for chats, notifications, etc.)

    return { status: 200, message: `Successfully deleted user ${uid} from Auth and Firestore.` };
  } catch (error: any) {
    console.error("deleteUserAccount error:", error);
    throw new HttpsError("internal", error.message || "Failed to delete user account.");
  }
});

/**
 * Callable admin helper to delete many documents server-side.
 * payload: { collectionPath: string, docIds: string[] }
 */
export const adminBulkDelete = onCall(async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Unauthenticated");

  const { collectionPath, docIds } = req.data || {};
  if (!collectionPath || !Array.isArray(docIds) || docIds.length === 0) {
    throw new HttpsError("invalid-argument", "Invalid payload");
  }

  const db = admin.firestore();
  
  // Quick auth check
  const callerDoc = await db.collection("users").doc(auth.uid).get();
  if (!(auth.token?.role === "admin" || callerDoc.data()?.role === "admin")) {
    throw new HttpsError("permission-denied", "Unauthorized");
  }

  try {
    const chunkSize = 450;
    for (let i = 0; i < docIds.length; i += chunkSize) {
      const chunk = docIds.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach((id: string) =>
        batch.delete(db.doc(`${collectionPath}/${id}`)),
      );
      await batch.commit();
    }
    return { status: 200, message: `Deleted ${docIds.length} documents.` };
  } catch (error) {
    console.error("adminBulkDelete error:", error);
    throw new HttpsError("internal", "Server error");
  }
});
