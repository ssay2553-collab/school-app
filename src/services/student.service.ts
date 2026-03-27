// services/student.service.ts

import bcrypt from "bcryptjs";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

interface StudentCreatePayload {
  studentID: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "Other" | "";
  classId: string;
  pin: string;
}

/**
 * CREATE STUDENT
 */
export async function createStudent(data: StudentCreatePayload) {
  const classRef = doc(db, "classes", data.classId);
  const classSnap = await getDoc(classRef);

  if (!classSnap.exists()) {
    throw new Error("Selected class does not exist");
  }

  const pinHash = await bcrypt.hash(data.pin, 10);

  await addDoc(collection(db, "students"), {
    studentID: data.studentID,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    classId: data.classId,
    pinHash,
    status: "active",
    createdAt: serverTimestamp(),
  });
}

/**
 * TRANSFER STUDENT (CLASS CHANGE)
 */
export async function transferStudent(
  studentDocId: string,
  newClassId: string
) {
  const classRef = doc(db, "classes", newClassId);
  const classSnap = await getDoc(classRef);

  if (!classSnap.exists()) {
    throw new Error("Target class does not exist");
  }

  await updateDoc(doc(db, "students", studentDocId), {
    classId: newClassId,
    updatedAt: serverTimestamp(),
  });
}
