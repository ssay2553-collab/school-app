import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// All FAQ keys
const faqKeys = [
  "mission_vision",
  "established",
  "school_hours",
  "location",
  "grades_offered",
  "student_teacher_ratio",
  "apply_admission",
  "admission_requirements",
  "entrance_exam",
  "school_fees",
  "scholarships",
  "academic_year_start",
  "curriculum",
  "extra_classes",
  "learning_support",
  "sports_programs",
  "clubs_societies",
  "arts_programs",
  "safety_measures",
  "transportation",
];

export async function initializeFAQ() {
  try {
    for (const key of faqKeys) {
      const ref = doc(db, "faqs", key); // Changed from faqAnswers to faqs for consistency
      const snap = await getDoc(ref);

      // If document does NOT exist, create it automatically
      if (!snap.exists()) {
        await setDoc(ref, {
          answer: "Answer not provided yet."
        });
      }
    }
  } catch (err) {
    console.error("Error initializing FAQ:", err);
  }
}
