import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Custom auth for non-teaching staff using Username and 4-digit PIN.
 * Returns a custom token for the user to sign in with.
 */
export const loginWithPin = onCall(async (req) => {
  const { username, pin } = req.data || {};

  if (!username || !pin) {
    throw new HttpsError("invalid-argument", "Username and PIN are required.");
  }

  const db = admin.firestore();
  const auth = admin.auth();

  try {
    // Find user with matching username and pin
    const userQuery = await db.collection("users")
      .where("username", "==", username.toLowerCase())
      .where("pin", "==", pin)
      .where("role", "==", "staff")
      .where("hasLoginEnabled", "==", true)
      .limit(1)
      .get();

    if (userQuery.empty) {
      throw new HttpsError("not-found", "Invalid username or PIN.");
    }

    const userDoc = userQuery.docs[0];
    const uid = userDoc.id;

    // Create a custom token for this UID
    const customToken = await auth.createCustomToken(uid);

    return { token: customToken };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error("LoginWithPin Error:", error);
    throw new HttpsError("internal", "An error occurred during authentication.");
  }
});
