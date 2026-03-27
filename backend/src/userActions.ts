import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Callable admin helper to delete a user's Auth account and Firestore document.
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

  const db = admin.firestore();
  const hasAdminClaim = auth.token && (auth.token.admin === true || auth.token.role === "admin");
  let authorized = hasAdminClaim;

  if (!authorized) {
    const callerDoc = await db.collection("users").doc(auth.uid).get();
    if (callerDoc.exists && (callerDoc.data()?.role === "admin" || callerDoc.data()?.adminRole)) {
      authorized = true;
    }
  }

  if (!authorized) {
    throw new HttpsError("permission-denied", "Unauthorized: Only administrators can delete accounts.");
  }

  try {
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
    }
    await db.collection("users").doc(uid).delete();
    return { status: 200, message: `Successfully deleted user ${uid}` };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to delete user account.");
  }
});

export const adminBulkDelete = onCall(async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Unauthenticated");

  const { collectionPath, docIds } = req.data || {};
  if (!collectionPath || !Array.isArray(docIds) || docIds.length === 0) {
    throw new HttpsError("invalid-argument", "Invalid payload");
  }

  const db = admin.firestore();
  const callerDoc = await db.collection("users").doc(auth.uid).get();
  if (!(auth.token?.role === "admin" || callerDoc.data()?.role === "admin")) {
    throw new HttpsError("permission-denied", "Unauthorized");
  }

  try {
    const chunkSize = 450;
    for (let i = 0; i < docIds.length; i += chunkSize) {
      const chunk = docIds.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach((id: string) => batch.delete(db.doc(`${collectionPath}/${id}`)));
      await batch.commit();
    }
    return { status: 200, message: `Deleted ${docIds.length} documents.` };
  } catch (error) {
    throw new HttpsError("internal", "Server error");
  }
});
