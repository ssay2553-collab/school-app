import axios from "axios";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

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
export const generateLessonPlan = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const {
      subject,
      strand,
      topic,
      classLevel,
      duration,
      ageRange,
      selectedIndicator,
      contentStandard,
    } = request.data;
    if (!subject || !strand || !topic || !classLevel || !duration) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const userId = request.auth.uid;
    const startOfWeek = getStartOfWeek();

    // Check usage limit (3 per subject per week)
    const usageSnap = await db
      .collection("ai_generations")
      .where("userId", "==", userId)
      .where("subject", "==", subject)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfWeek))
      .get();

    if (usageSnap.size >= 3) {
      throw new HttpsError(
        "resource-exhausted",
        `You have reached your limit of 3 generations for ${subject} this week.`,
      );
    }

    const prompt = `
You are an expert Ghanaian curriculum specialist and teacher educator. Generate a comprehensive, practical lesson plan that STRICTLY adheres to the Ghana Education Service (GES) and National Council for Curriculum and Assessment (NaCCA) standards for the Standard-Based Curriculum (SBC).

**LESSON DETAILS:**
- Subject: ${subject}
- Class: ${classLevel}
- Target Age: ${ageRange || "Age-appropriate for this class level"}
- Strand: ${strand}
- Sub-strand/Topic: ${topic}
- Duration: ${duration}
${contentStandard ? `- Content Standard: ${contentStandard}` : ""}
${selectedIndicator ? `- Learning Indicator: ${selectedIndicator}` : ""}

**CURRICULUM ALIGNMENT REQUIREMENTS:**

1. **NaCCA Standard-Based Curriculum (SBC) Framework:**
   - Structure the lesson around the 5 Es: Engage, Explore, Explain, Elaborate, Evaluate
   - Incorporate differentiated instruction for mixed-ability learners
   - Include learner-centered, activity-based approaches
   - Ensure content is developmentally appropriate for ${classLevel}

2. **Core Competencies to Integrate (select 2-3 most relevant):**
   - Critical Thinking and Problem Solving
   - Creativity and Innovation
   - Communication and Collaboration
   - Cultural Identity and Global Citizenship
   - Personal Development and Leadership
   - Digital Literacy

3. **Learning Domains to Address:**
   - Knowledge and Understanding (cognitive)
   - Skills and Processes (psychomotor)
   - Attitudes and Values (affective)

4. **Ghanaian Context Integration:**
   - Use locally available materials and resources
   - Include examples relevant to Ghanaian culture and environment
   - Reference local communities, industries, or practices where applicable
   - Consider resource limitations in typical Ghanaian classrooms

**LESSON PLAN STRUCTURE:**

Generate a JSON object with the following keys:

{
  "contentStandard": "string - The NaCCA content standard this lesson addresses",
  "indicator": "string - Specific learning indicator from NaCCA curriculum",
  "learningObjectives": [
    "By the end of the lesson, learners will be able to... (knowledge)",
    "By the end of the lesson, learners will be able to... (skill)",
    "By the end of the lesson, learners will appreciate... (attitude/value)"
  ],
  "keyVocabulary": ["term1", "term2", "term3"],
  "coreCompetencies": ["Competency 1", "Competency 2"],
  "teachingMaterials": [
    "List specific, locally available materials",
    "Include both teacher and learner resources"
  ],
  "previousKnowledge": "What learners should already know",
  "introduction": {
    "engagement": ["Hook activity to capture interest"],
    "priorKnowledgeCheck": ["Questions to assess prior knowledge"],
    "lessonLink": "How this connects to previous learning"
  },
  "mainActivities": [
    {
      "phase": "Explore",
      "activity": "Description of learner-centered activity",
      "teacherRole": "Facilitator actions",
      "duration": "Time allocation",
      "differentiation": "How to support struggling and advanced learners"
    },
    {
      "phase": "Explain",
      "activity": "Direct instruction and concept development",
      "teacherRole": "Teaching strategies",
      "duration": "Time allocation",
      "differentiation": "Scaffolding techniques"
    },
    {
      "phase": "Elaborate",
      "activity": "Application and extension activities",
      "teacherRole": "Guidance and support",
      "duration": "Time allocation",
      "differentiation": "Extension tasks"
    }
  ],
  "assessment": {
    "formative": [
      "Ongoing assessment strategies during lesson",
      "Questioning techniques",
      "Observation points"
    ],
    "summative": [
      "End-of-lesson assessment tasks",
      "Criteria for success"
    ],
    "assessmentCriteria": {
      "exemplary": "What excellent understanding looks like",
      "proficient": "What meets expectations looks like",
      "developing": "What approaching expectations looks like",
      "beginning": "What minimal understanding looks like"
    }
  },
  "conclusion": [
    "Summary of key learning points",
    "Reflection questions for learners",
    "Connection to real-life applications"
  ],
  "homework": [
    "Reinforcement activities",
    "Extension tasks",
    "Preparation for next lesson"
  ],
  "teacherReflection": [
    "What worked well?",
    "What could be improved?",
    "How will this inform future planning?"
  ],
  "safetyConsiderations": ["Any safety precautions needed"],
  "crossCurricularLinks": ["Connections to other subjects"]
}

**IMPORTANT GUIDELINES:**
- Ensure all activities are practical and achievable in a typical Ghanaian classroom
- Consider class size (often 40+ learners) in activity design
- Use simple, clear language appropriate for ${classLevel}
- Include both individual and group work opportunities
- Ensure assessment aligns with learning objectives
${contentStandard ? `- Use the provided Content Standard: "${contentStandard}"` : "- Generate appropriate NaCCA content standard based on the subject, strand and class level"}
${selectedIndicator ? `- Use the provided Learning Indicator: "${selectedIndicator}"` : "- Generate appropriate learning indicator based on the topic and class level"}
- Reference Ghanaian curriculum documents where appropriate
- Include opportunities for learners to demonstrate understanding in multiple ways

Return ONLY the JSON object, no additional text or explanations.
`;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.value()}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        },
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
  },
);

/**
 * 📺 YouTube Search Proxy
 */
export const searchYouTube = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { query: searchQuery, maxResults = 5 } = request.data;
    if (!searchQuery) {
      throw new HttpsError("invalid-argument", "Search query is empty.");
    }

    try {
      // We reuse the Gemini key if it's actually a Google API Key that works for YouTube too,
      // but usually YouTube has its own. For simplicity in this demo environment,
      // assuming the same key or that we'll add YOUTUBE_API_KEY later.
      // However, since I can't check the YOUTUBE_API_KEY secret, I'll use a placeholder or the same key.
      const YOUTUBE_API_KEY = geminiApiKey.value();

      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search`,
        {
          params: {
            part: "snippet",
            q: searchQuery + " educational",
            type: "video",
            maxResults: maxResults,
            key: YOUTUBE_API_KEY,
            videoEmbeddable: "true",
            relevanceLanguage: "en",
          },
        },
      );

      return response.data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.high.url,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        channelTitle: item.snippet.channelTitle,
      }));
    } catch (error: any) {
      console.error(
        "YouTube API Error:",
        error?.response?.data || error.message,
      );
      throw new HttpsError("internal", "YouTube search failed.");
    }
  },
);

/**
 * 🔍 AI Fact Finder (Search)
 */
export const aiSearch = onCall({ secrets: [geminiApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { queryText, schoolName, userClass } = request.data;
  if (!queryText) {
    throw new HttpsError("invalid-argument", "Query is empty.");
  }

  const userId = request.auth.uid;
  const startOfDay = getStartOfDay();

  // Check daily limit (10 per day)
  const usageSnap = await db
    .collection("ai_searches")
    .where("userId", "==", userId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .get();

  if (usageSnap.size >= 10) {
    throw new HttpsError(
      "resource-exhausted",
      "Daily AI search limit reached.",
    );
  }

  const prompt = `You are an educational assistant for the ${schoolName || "EduEaz"} app.

  The user is a student in ${userClass || "a school"}.
  Please answer this question clearly and concisely, ensuring the explanation is age-appropriate
  and suitable for the developmental level of a student in ${userClass || "their grade"}: ${queryText}

  If the student is in primary school (Basic 1-6), use simpler language and relatable analogies.
  If the student is in JHS or SHS, provide more detailed but still accessible information.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.value()}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
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
    console.error(
      "Gemini Search Error:",
      error?.response?.data || error.message,
    );
    throw new HttpsError("internal", "AI Search failed.");
  }
});
