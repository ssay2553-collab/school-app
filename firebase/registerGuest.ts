import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, AuthUser } from "../firebaseConfig";

export async function registerGuest(fullName: string, phone: string) {
  // Use AuthUser(true) to ensure an anonymous session is created if not present
  const user = await AuthUser(true);
  
  if (!user) {
    throw new Error("Could not initialize guest session.");
  }

  const userId = user.uid;
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return user;
  }

  await setDoc(userRef, {
    uid: userId,
    role: "guest",
    isAnonymous: true,
    status: "active",
    profile: {
      fullName: fullName.trim(),
      phone: phone.trim(),
    },
    createdAt: serverTimestamp(),
  });

  return user;
}
