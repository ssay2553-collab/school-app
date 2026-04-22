import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { defineSecret } from "firebase-functions/params";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const db = admin.firestore();

/**
 * Helper to get start of the day
 */
const getStartOfDay = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

/**
 * Helper to get start of the week
 */
const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const startOfWeek = new Date(now.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
};

/**
 * 🪄 AI Lesson Generator
 */
export const generateLessonPlan = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { subject, strand, topic, classLevel, duration } = request.data;
  if (!subject || !strand || !topic || !classLevel || !duration) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const userId = request.auth.uid;
  const startOfWeek = getStartOfWeek();

  // Check usage limit (3 per subject per week)
  const usageSnap = await db.collection("ai_generations")
    .where("userId", "==", userId)
    .where("subject", "==", subject)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfWeek))
    .get();

  if (usageSnap.size >= 3) {
    throw new HttpsError("resource-exhausted", `You have reached your limit of 3 generations for ${subject} this week.`);
  }

  const prompt = `
    Act as an expert teacher. Generate a simple, practical lesson plan for:
    Subject: ${subject}
    Class: ${classLevel}
    Strand: ${strand}
    Sub-strand (Topic): ${topic}
    Duration: ${duration}

    The lesson must be suitable for the class level. Avoid long explanations.
    Use clear bullet points.

    Return ONLY a JSON object with these keys:
    - objectives (array of strings)
    - introduction (array of strings)
    - teachingActivities (array of strings)
    - materials (array of strings)
    - classActivities (array of strings)
    - assessment (array of strings)
    - conclusion (array of strings)
    - homework (array of strings)
  `;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.value()}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }
    );

    const rawText = response.data.candidates[0].content.parts[0].text;
    const parsedPlan = JSON.parse(rawText);

    // Track usage
    await db.collection("ai_generations").add({
      userId,
      subject,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return parsedPlan;
  } catch (error: any) {
    console.error("Gemini Error:", error?.response?.data || error.message);
    throw new HttpsError("internal", "AI Generation failed.");
  }
});

/**
 * 🔍 AI Fact Finder (Search)
 */
export const aiSearch = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { queryText, schoolName } = request.data;
  if (!queryText) {
    throw new HttpsError("invalid-argument", "Query is empty.");
  }

  const userId = request.auth.uid;
  const startOfDay = getStartOfDay();

  // Check daily limit (10 per day)
  const usageSnap = await db.collection("ai_searches")
    .where("userId", "==", userId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .get();

  if (usageSnap.size >= 10) {
    throw new HttpsError("resource-exhausted", "Daily AI search limit reached.");
  }

  const prompt = `You are an educational assistant for the ${schoolName || "EduEaz"} app.
  Answer this question clearly and concisely for a student or teacher: ${queryText}`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.value()}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response from AI");

    // Track usage
    await db.collection("ai_searches").add({
      userId,
      query: queryText,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { text };
  } catch (error: any) {
    console.error("Gemini Search Error:", error?.response?.data || error.message);
    throw new HttpsError("internal", "AI Search failed.");
  }
});
