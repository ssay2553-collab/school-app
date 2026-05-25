import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// Ensure admin is initialized in this module context
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Custom auth for non-teaching staff using Username and 4-digit PIN.
 */
export const loginWithPin = onCall({
  maxInstances: 10,
  // Note: invoker "public" is set via CLI or during deployment for V2
}, async (request) => {
  const data = request.data;
  const username = data?.username;
  const pin = data?.pin;

  if (!username || !pin) {
    throw new HttpsError("invalid-argument", "Username and PIN are required.");
  }

  const db = admin.firestore();
  const auth = admin.auth();

  try {
    const usernameStr = String(username).trim().toLowerCase();
    const pinStr = String(pin).trim();

    // Query for the user by username
    const userQuery = await db.collection("users")
      .where("username", "==", usernameStr)
      .limit(5)
      .get();

    if (userQuery.empty) {
      throw new HttpsError("not-found", "No account found with that username.");
    }

    // Filter results for matching PIN and login status
    let matchingUser = null;
    let isDisabled = false;

    for (const doc of userQuery.docs) {
      const userData = doc.data();
      if (String(userData.pin) === pinStr) {
        if (userData.hasLoginEnabled === true) {
          matchingUser = doc;
          break;
        } else {
          isDisabled = true;
        }
      }
    }

    if (!matchingUser) {
      if (isDisabled) {
        throw new HttpsError("permission-denied", "This account's login is currently disabled.");
      }
      throw new HttpsError("unauthenticated", "Incorrect PIN.");
    }

    const uid = matchingUser.id;

    // Create a custom token.
    // This requires the "Service Account Token Creator" role on the service account.
    try {
      const customToken = await auth.createCustomToken(uid);
      return { token: customToken };
    } catch (tokenErr: any) {
      console.error("CRITICAL: Token Generation Failed.", {
        error: tokenErr.message,
        code: tokenErr.code,
        uid: uid
      });
      // Return a more descriptive internal error to help the dev
      throw new HttpsError(
        "internal",
        `Auth Server Error: ${tokenErr.message}. Ensure 'Service Account Token Creator' role is assigned in IAM.`
      );
    }

  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error("LoginWithPin System Error:", error);
    throw new HttpsError("internal", error.message || "An unexpected internal error occurred.");
  }
});
