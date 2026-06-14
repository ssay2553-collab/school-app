/*
Run this after starting the Firebase emulators (Firestore + Auth).
PowerShell example:
  npx firebase emulators:start --only firestore,auth

Then run this script from the repo root with node:
  node scripts\emulator-tests\check-finance-permissions.js

What it does:
- Creates a test teacher account via the Auth emulator
- Signs in to obtain an idToken
- Attempts to write a feePayments document and increment users/{studentUid}.walletBalance via the Firestore emulator REST commit endpoint using the idToken
- Prints responses so you can see whether the rules allowed or denied the writes

Note: adjust PROJECT_ID, teacher email/password, and studentUid as needed.
*/

const fetch = require("node-fetch");

(async () => {
  try {
    const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "model-power-430de";
    const AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";
    const FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";

    // Test accounts
    const teacherEmail = "teacher-test@example.com";
    const teacherPassword = "Password123!";
    const studentUid = process.env.TEST_STUDENT_UID || "student-test-uid";

    console.log("Using project:", PROJECT_ID);

    // 1) Create teacher account via Auth emulator (signUp)
    const signUpUrl = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=any`;
    console.log("Creating test teacher account...");
    let res = await fetch(signUpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: teacherEmail,
        password: teacherPassword,
        returnSecureToken: true,
      }),
    });
    const signUp = await res.json();
    if (!res.ok) {
      console.error("SignUp failed:", signUp);
      return;
    }
    console.log("SignUp response:", signUp);

    // 2) Sign in to get idToken
    const signInUrl = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=any`;
    res = await fetch(signInUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: teacherEmail,
        password: teacherPassword,
        returnSecureToken: true,
      }),
    });
    const signIn = await res.json();
    if (!res.ok) {
      console.error("SignIn failed:", signIn);
      return;
    }

    const idToken = signIn.idToken;
    console.log(
      "Obtained idToken (truncated):",
      idToken && idToken.substring(0, 40) + "...",
    );

    // 3) Attempt Firestore commit to create feePayments doc and increment walletBalance
    const commitUrl = `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;

    // Construct resource names
    const feePaymentsDocName = `projects/${PROJECT_ID}/databases/(default)/documents/feePayments/TEST-FP-${Date.now()}`;
    const userDocName = `projects/${PROJECT_ID}/databases/(default)/documents/users/${studentUid}`;

    const nowIso = new Date().toISOString();

    // Prepare writes: 1) transform increment walletBalance 2) create feePayments doc
    const body = {
      writes: [
        {
          transform: {
            document: userDocName,
            fieldTransforms: [
              { fieldPath: "walletBalance", increment: { integerValue: 100 } },
            ],
          },
        },
        {
          update: {
            name: feePaymentsDocName,
            fields: {
              amount: { integerValue: 100 },
              method: { stringValue: "Cash" },
              description: { stringValue: "Test payment from emulator script" },
              receivedFrom: { stringValue: "Test" },
              updatedBy: { stringValue: "Test Teacher" },
              adminUid: {
                stringValue: signUp.localId || signIn.localId || "unknown",
              },
              createdAt: { stringValue: nowIso },
              receiptNo: { stringValue: `EMU-${Date.now()}` },
              date: { stringValue: nowIso.split("T")[0] },
              studentUid: { stringValue: studentUid },
              studentName: { stringValue: "Test Student" },
              classId: { stringValue: "class-1" },
              className: { stringValue: "Class 1" },
              type: { stringValue: "feeding" },
            },
          },
        },
      ],
    };

    console.log("Sending commit to Firestore emulator...");
    res = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });

    const commitRes = await res.json();
    console.log("Commit response status:", res.status);
    console.log(JSON.stringify(commitRes, null, 2));

    if (res.status >= 200 && res.status < 300) {
      console.log("✅ Emulator writes allowed — rules permit this teacher.");
    } else {
      console.error("⛔ Emulator denied write — check security rules.");
    }
  } catch (err) {
    console.error("Script error:", err);
  }
})();
