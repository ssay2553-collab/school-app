import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

// Export function modules
export * from "./academics";
export * from "./news";
export * from "./chat";
export * from "./attendance";
export * from "./finance";
export * from "./birthdays";
export * from "./ai";
export * from "./auth";
export * from "./admin";
export * from "./lifecycle";
