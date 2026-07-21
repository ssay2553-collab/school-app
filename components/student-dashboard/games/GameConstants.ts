export const REMARKS = [
  "Awesome! 🌟",
  "Excellent! ✨",
  "Brilliant! 🧠",
  "Very Good! 👍",
  "Fantastic! 🌈",
  "Great Job! 🎉",
  "Superstar! ⭐",
  "Way to go! 🚀",
];

export const WRONG_REMARKS = [
  "Not quite, but keep trying! 💪",
  "Oops! You'll get it next time! ✨",
  "So close! Try again! 🌈",
  "Don't give up! You're learning! 🧠",
  "Almost there! Keep going! 🚀",
  "Keep your chin up! You can do it! ⭐",
];

export type GameMode = "menu" | "quiz" | "word" | "memory" | "math" | "scramble" | "writing" | "scoreboard";

export const GAME_BG = {
  quiz: "#0EA5E9",
  word: "#10B981",
  memory: "#F59E0B",
  math: "#8B5CF6",
  scramble: "#F43F5E",
  writing: "#EC4899",
  menu: "#FDFDFD",
  scoreboard: "#F8FAFC",
};

export const PEN_COLORS = [
  "#EC4899", // Pink (Default)
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#EF4444", // Red
  "#8B5CF6", // Purple
];

export const QUIZ_DATA = [
  // Level 1
  {
    topic: "Science 🧪",
    question: "Which organ pumps blood through the body?",
    options: ["Lungs", "Heart", "Brain", "Liver"],
    answer: "Heart",
    level: 1,
  },
  {
    topic: "Math 🔢",
    question: "What is 7 + 8?",
    options: ["14", "15", "16", "13"],
    answer: "15",
    level: 1,
  },
  {
    topic: "English 📖",
    question: "Which of these is a noun?",
    options: ["Run", "Blue", "Happiness", "Quickly"],
    answer: "Happiness",
    level: 1,
  },
  {
    topic: "Geography 🌍",
    question: "What is the capital city of Ghana?",
    options: ["Accra", "Kumasi", "Takoradi", "Tamale"],
    answer: "Accra",
    level: 1,
  },
  {
    topic: "Science 🚀",
    question: "What planet do we live on?",
    options: ["Mars", "Venus", "Earth", "Jupiter"],
    answer: "Earth",
    level: 1,
  },
  // Level 2
  {
    topic: "Science 🧬",
    question: "What is the hardest natural substance on Earth?",
    options: ["Gold", "Iron", "Diamond", "Quartz"],
    answer: "Diamond",
    level: 2,
  },
  {
    topic: "Math ➗",
    question: "What is 12 x 12?",
    options: ["124", "144", "164", "134"],
    answer: "144",
    level: 2,
  },
  {
    topic: "History 🏛️",
    question: "Who was the first President of Ghana?",
    options: ["J.B Danquah", "Kwame Nkrumah", "Jerry Rawlings", "John Kufuor"],
    answer: "Kwame Nkrumah",
    level: 2,
  },
  {
    topic: "General 💡",
    question: "How many colors are in a rainbow?",
    options: ["5", "6", "7", "8"],
    answer: "7",
    level: 2,
  },
  {
    topic: "English ✍️",
    question: "A person who writes books is called a/an...",
    options: ["Artist", "Author", "Actor", "Architect"],
    answer: "Author",
    level: 2,
  },
  // Level 3
  {
    topic: "Science 🌡️",
    question: "At what temperature does water boil?",
    options: ["50°C", "90°C", "100°C", "120°C"],
    answer: "100°C",
    level: 3,
  },
  {
    topic: "Math ✖️",
    question: "What is 50 multiplied by 4?",
    options: ["150", "200", "250", "300"],
    answer: "200",
    level: 3,
  },
  {
    topic: "History 🇬🇭",
    question: "In which year did Ghana gain independence?",
    options: ["1950", "1957", "1960", "1966"],
    answer: "1957",
    level: 3,
  },
  {
    topic: "Geography 🗺️",
    question: "Which is the longest river in the world?",
    options: ["Amazon", "Nile", "Mississippi", "Volta"],
    answer: "Nile",
    level: 3,
  },
  {
    topic: "English 💬",
    question: "Which word is a synonym for 'Joyful'?",
    options: ["Sad", "Angry", "Happy", "Tired"],
    answer: "Happy",
    level: 3,
  },
  // Level 4
  {
    topic: "Science 🌬️",
    question: "Which gas do humans need to breathe in to survive?",
    options: ["Nitrogen", "Carbon Dioxide", "Oxygen", "Helium"],
    answer: "Oxygen",
    level: 4,
  },
  {
    topic: "Math 📐",
    question: "What is the square root of 81?",
    options: ["7", "8", "9", "10"],
    answer: "9",
    level: 4,
  },
  {
    topic: "General 🐆",
    question: "What is the fastest land animal?",
    options: ["Lion", "Cheetah", "Horse", "Tiger"],
    answer: "Cheetah",
    level: 4,
  },
  {
    topic: "ICT 💻",
    question: "What does 'WWW' stand for?",
    options: ["World Wide Web", "World Word Web", "Western Wide Web", "World Wide Win"],
    answer: "World Wide Web",
    level: 4,
  },
  {
    topic: "Geography 🌏",
    question: "What is the largest continent on Earth?",
    options: ["Africa", "Europe", "Asia", "North America"],
    answer: "Asia",
    level: 4,
  },
];

export const WORD_DATA = [
  { hint: "A common fruit that's also a color 🍎", word: "ORANGE", level: 1 },
  { hint: "A device used to type ⌨️", word: "KEYBOARD", level: 1 },
  { hint: "A large body of water 🌊", word: "OCEAN", level: 1 },
  { hint: "Place where students learn 🏫", word: "SCHOOL", level: 1 },
  { hint: "The capital of Ghana 🇬🇭", word: "ACCRA", level: 1 },
  { hint: "King of the jungle 🦁", word: "LION", level: 2 },
  { hint: "Opposite of cold ☀️", word: "HOT", level: 2 },
  { hint: "Something you use to brush your teeth 🦷", word: "TOOTHBRUSH", level: 2 },
  { hint: "The star at the center of our solar system ☀️", word: "SUN", level: 2 },
  { hint: "A very tall animal with a long neck 🦒", word: "GIRAFFE", level: 2 },
  { hint: "Earth's only natural satellite 🌙", word: "MOON", level: 3 },
  { hint: "A person who treats sick people 🩺", word: "DOCTOR", level: 3 },
  { hint: "The building where you live 🏠", word: "HOUSE", level: 3 },
  { hint: "You use this to keep dry in rain ☂️", word: "UMBRELLA", level: 3 },
  { hint: "A large animal with a trunk 🐘", word: "ELEPHANT", level: 3 },
];

export const SCRAMBLE_DATA = [
  { word: "APPLE", level: 1 },
  { word: "BANANA", level: 1 },
  { word: "CHAIR", level: 1 },
  { word: "TABLE", level: 1 },
  { word: "WINDOW", level: 1 },
  { word: "COMPUTER", level: 2 },
  { word: "ELEPHANT", level: 2 },
  { word: "MOUNTAIN", level: 2 },
  { word: "UNIVERSE", level: 2 },
  { word: "FOOTBALL", level: 2 },
];

export const MEMORY_EMOJIS = [
  "🍎",
  "🐶",
  "🚀",
  "🌈",
  "🎈",
  "🍦",
  "🦁",
  "🎨",
  "⚽",
  "🍕",
  "🎸",
  "🦋",
];

export const WRITING_DATA = [
  { char: "A", type: "letter", startPos: { top: "15%", left: "48%" }, dir: "down" },
  { char: "B", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "C", type: "letter", startPos: { top: "20%", left: "65%" }, dir: "left" },
  { char: "D", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "E", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "right" },
  { char: "F", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "right" },
  { char: "G", type: "letter", startPos: { top: "20%", left: "65%" }, dir: "left" },
  { char: "H", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "I", type: "letter", startPos: { top: "15%", left: "48%" }, dir: "down" },
  { char: "J", type: "letter", startPos: { top: "15%", left: "60%" }, dir: "down" },
  { char: "K", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "L", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "M", type: "letter", startPos: { top: "15%", left: "20%" }, dir: "down" },
  { char: "N", type: "letter", startPos: { top: "15%", left: "25%" }, dir: "down" },
  { char: "O", type: "letter", startPos: { top: "15%", left: "48%" }, dir: "left" },
  { char: "P", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "Q", type: "letter", startPos: { top: "15%", left: "48%" }, dir: "left" },
  { char: "R", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "S", type: "letter", startPos: { top: "20%", left: "65%" }, dir: "left" },
  { char: "T", type: "letter", startPos: { top: "15%", left: "48%" }, dir: "down" },
  { char: "U", type: "letter", startPos: { top: "15%", left: "25%" }, dir: "down" },
  { char: "V", type: "letter", startPos: { top: "15%", left: "25%" }, dir: "down" },
  { char: "W", type: "letter", startPos: { top: "15%", left: "20%" }, dir: "down" },
  { char: "X", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "Y", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "Z", type: "letter", startPos: { top: "15%", left: "30%" }, dir: "right" },
  { char: "1", type: "number", startPos: { top: "15%", left: "48%" }, dir: "down" },
  { char: "2", type: "number", startPos: { top: "20%", left: "35%" }, dir: "right" },
  { char: "3", type: "number", startPos: { top: "20%", left: "35%" }, dir: "right" },
  { char: "4", type: "number", startPos: { top: "15%", left: "65%" }, dir: "down" },
  { char: "5", type: "number", startPos: { top: "15%", left: "65%" }, dir: "left" },
  { char: "6", type: "number", startPos: { top: "15%", left: "60%" }, dir: "left" },
  { char: "7", type: "number", startPos: { top: "15%", left: "35%" }, dir: "right" },
  { char: "8", type: "number", startPos: { top: "15%", left: "48%" }, dir: "left" },
  { char: "9", type: "number", startPos: { top: "15%", left: "60%" }, dir: "left" },
  { char: "10", type: "number", startPos: { top: "15%", left: "30%" }, dir: "down" },
  { char: "11", type: "number", startPos: { top: "15%", left: "40%" }, dir: "down" },
  { char: "12", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "13", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "14", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "15", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "16", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "17", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "18", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "19", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
  { char: "20", type: "number", startPos: { top: "15%", left: "35%" }, dir: "down" },
];
