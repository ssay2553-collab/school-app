/**
 * Pedagogical Suggestions and Framework for GES/NaCCA Curriculum (Basic 1 to Basic 9)
 */

export interface PedagogyTier {
  tierName: string;
  description: string;
  teachingMethods: string[];
  tlms: string[];
  starterActivities: string[];
  coreActivities: string[];
  assessmentMethods: string[];
}

export const LOWER_PRIMARY_PEDAGOGY: PedagogyTier = {
  tierName: "Lower Primary (Basic 1 - Basic 3)",
  description: "Play-based, concrete manipulatives, storytelling and foundational literacy & numeracy.",
  teachingMethods: [
    "Play-Based Learning",
    "Storytelling & Role Play",
    "Concrete Demonstration",
    "Songs & Action Rhymes",
    "Guided Discovery",
    "Pair Work",
  ],
  tlms: [
    "Counters & Bottle Caps",
    "Abacus & Base-Ten Blocks",
    "Alphabet & Number Flashcards",
    "Real Objects (Realia)",
    "Picture Charts & Posters",
    "Sentence Cards",
  ],
  starterActivities: [
    "Sing an action song / rhyme related to topic",
    "Show a real object and ask 'What is this?' (RPK)",
    "Quick 2-minute diagnostic mental game",
    "Tell a short introductory story",
  ],
  coreActivities: [
    "Guide learners in small groups to manipulate TLMs and explore concept",
    "Demonstrate step-by-step on board/chart while learners observe & try",
    "Engage learners in pair activities to practice and share answers",
    "Lead interactive question-and-answer session with real objects",
  ],
  assessmentMethods: [
    "Oral Question & Answer",
    "Observation Checklist",
    "Individual Class Exercise",
    "Peer Demonstration",
  ],
};

export const UPPER_PRIMARY_PEDAGOGY: PedagogyTier = {
  tierName: "Upper Primary (Basic 4 - Basic 6)",
  description: "Transition to semi-concrete & abstract concepts, group discussions, and guided discovery.",
  teachingMethods: [
    "Small Group Discussions",
    "Demonstration & Experimentation",
    "Problem-Solving & Brainstorming",
    "Cooperative Learning",
    "Think-Pair-Share",
    "Interactive Board Work",
  ],
  tlms: [
    "Wall Maps & Geographical Charts",
    "3D Geometric Models & Globe",
    "Science Mini-Kits & Magnets",
    "Dictionaries & Flash Diagrams",
    "Rulers, Protractors & Sets",
    "Worksheets & Cut-outs",
  ],
  starterActivities: [
    "Display a diagram / chart and ask guiding questions",
    "Pose a real-life problem scenario to solve",
    "Quick RPK review quiz on board",
    "Brainstorming key vocabulary terms",
  ],
  coreActivities: [
    "Form small groups to analyze task worksheet and report findings",
    "Guide learners to discover rules/concepts through step-by-step tasks",
    "Demonstrate experiment/process with student participation",
    "Facilitate class discussion and solve practice problems on board",
  ],
  assessmentMethods: [
    "Group Presentation",
    "Written Class Assignment",
    "Peer Assessment",
    "Short Diagnostic Quiz",
  ],
};

export const JHS_PEDAGOGY: PedagogyTier = {
  tierName: "Junior High School (Basic 7 - Basic 9)",
  description: "Inquiry-based learning, critical thinking, practical labs, and BECE examination skills.",
  teachingMethods: [
    "Inquiry-Based Learning & Research",
    "Problem-Based Learning (PBL)",
    "Practical Lab / Field Work",
    "Class Debate & Discussion",
    "ICT-Integrated Demonstration",
    "BECE Answering Strategies",
  ],
  tlms: [
    "Laboratory Apparatus & Beakers",
    "Computer / Projector & Digital Charts",
    "BECE Past Question Bank & Worksheets",
    "Anatomical / Technological Models",
    "Specimens & Field Tools",
    "Scientific Calculators & Sets",
  ],
  starterActivities: [
    "Present a BECE-style teaser question",
    "Watch a short video or analyze a diagram",
    "Pose a real-world case study or challenge",
    "Diagnostic quick-fire mental drill",
  ],
  coreActivities: [
    "Organize group research / practical investigation using lab tools / ICT",
    "Facilitate problem-based learning and critical discussion",
    "Demonstrate complex concept/experiment and analyze results with class",
    "Guide students through BECE-style problem-solving and presentation",
  ],
  assessmentMethods: [
    "BECE-style Written Test",
    "Practical Assessment / Experiment",
    "Project Work & Research Report",
    "Class Debate / Oral Defense",
  ],
};

export const DEFAULT_PEDAGOGY: PedagogyTier = {
  tierName: "General Education",
  description: "Standard pedagogical delivery strategies.",
  teachingMethods: [
    "Interactive Lecture",
    "Group Discussion",
    "Demonstration",
    "Question & Answer",
    "Practical Activity",
  ],
  tlms: [
    "Textbook & Worksheets",
    "Wall Charts & Diagrams",
    "Whiteboard / Blackboard",
    "Audio-Visual Aids",
  ],
  starterActivities: [
    "Review previous lesson (RPK)",
    "Introductory discussion question",
    "Key vocabulary preview",
  ],
  coreActivities: [
    "Guide learners through core concepts and practice tasks",
    "Demonstrate step-by-step examples on board",
    "Engage students in group discussion and exercises",
  ],
  assessmentMethods: [
    "Classwork Exercise",
    "Oral Questions",
    "Homework / Assignment",
  ],
};

/**
 * Returns pedagogical suggestions based on class name or level (e.g. "Basic 1", "Basic 5", "JHS 2")
 */
export function getPedagogySuggestions(className?: string): PedagogyTier {
  if (!className) return DEFAULT_PEDAGOGY;

  const normalized = className.trim().toLowerCase();

  // Check Lower Primary (Basic 1 - Basic 3)
  if (
    normalized.includes("basic 1") ||
    normalized.includes("basic 2") ||
    normalized.includes("basic 3") ||
    normalized.includes("bs1") ||
    normalized.includes("bs2") ||
    normalized.includes("bs3") ||
    normalized.includes("kg") ||
    normalized.includes("nursery") ||
    normalized.includes("creche") ||
    normalized.includes("p1") ||
    normalized.includes("p2") ||
    normalized.includes("p3") ||
    normalized.includes("primary 1") ||
    normalized.includes("primary 2") ||
    normalized.includes("primary 3")
  ) {
    return LOWER_PRIMARY_PEDAGOGY;
  }

  // Check Upper Primary (Basic 4 - Basic 6)
  if (
    normalized.includes("basic 4") ||
    normalized.includes("basic 5") ||
    normalized.includes("basic 6") ||
    normalized.includes("bs4") ||
    normalized.includes("bs5") ||
    normalized.includes("bs6") ||
    normalized.includes("p4") ||
    normalized.includes("p5") ||
    normalized.includes("p6") ||
    normalized.includes("primary 4") ||
    normalized.includes("primary 5") ||
    normalized.includes("primary 6")
  ) {
    return UPPER_PRIMARY_PEDAGOGY;
  }

  // Check JHS (Basic 7 - Basic 9 / JHS 1 - JHS 3)
  if (
    normalized.includes("basic 7") ||
    normalized.includes("basic 8") ||
    normalized.includes("basic 9") ||
    normalized.includes("bs7") ||
    normalized.includes("bs8") ||
    normalized.includes("bs9") ||
    normalized.includes("jhs") ||
    normalized.includes("j.h.s")
  ) {
    return JHS_PEDAGOGY;
  }

  return DEFAULT_PEDAGOGY;
}
