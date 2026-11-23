import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SVGIcon from '../../components/SVGIcon';
import StationaryBackground from '../../components/StationaryBackground';
import { useSchoolConfig } from '../../constants/Config';
import { COLORS, SHADOWS } from '../../constants/theme';

interface Idiom {
  id: number;
  phrase: string;
  category: string;
  meaning: string;
  example: string;
  funFact?: string;
}

// Comprehensive curated dataset of 300+ student-friendly idiomatic expressions
const IDIOMS_DATASET: Idiom[] = [
  // Animals (1-35)
  { id: 1, phrase: "A blessing in disguise", category: "Animals & Nature", meaning: "A good thing that seemed bad at first.", example: "Missing the bus was a blessing in disguise because I met my best friend while walking." },
  { id: 2, phrase: "A fish out of water", category: "Animals & Nature", meaning: "Someone who feels uncomfortable in an unfamiliar situation.", example: "John felt like a fish out of water at the advanced robotics club." },
  { id: 3, phrase: "A little bird told me", category: "Animals & Nature", meaning: "Used to say that you got information from a secret source.", example: "A little bird told me it's your birthday today!" },
  { id: 4, phrase: "Ants in your pants", category: "Animals & Nature", meaning: "Being very restless, excited, or fidgety.", example: "Sit still! Why do you have ants in your pants today?" },
  { id: 5, phrase: "As busy as a bee", category: "Animals & Nature", meaning: "Working very hard and being extremely busy.", example: "Mom has been as busy as a bee cleaning the house." },
  { id: 6, phrase: "Barking up the wrong tree", category: "Animals & Nature", meaning: "Looking in the wrong place or accusing the wrong person.", example: "If you think I took your pencil, you're barking up the wrong tree." },
  { id: 7, phrase: "Can of worms", category: "Animals & Nature", meaning: "A complicated situation that causes trouble when opened.", example: "Asking about who broke the vase opened up a whole can of worms." },
  { id: 8, phrase: "Chicken out", category: "Animals & Nature", meaning: "To decide not to do something because of fear.", example: "Sam wanted to ride the big roller coaster, but he chickened out at the last second." },
  { id: 9, phrase: "Cry wolf", category: "Animals & Nature", meaning: "To ask for help when you don't need it, so people ignore you when you really do.", example: "Don't cry wolf or nobody will believe you when you're in trouble." },
  { id: 10, phrase: "Curiosity killed the cat", category: "Animals & Nature", meaning: "Being too inquisitive can lead to getting into trouble.", example: "Don't peek inside the mystery box; curiosity killed the cat!" },
  { id: 11, phrase: "Eats like a bird", category: "Animals & Nature", meaning: "Eating very little food.", example: "My little sister eats like a bird when vegetables are served." },
  { id: 12, phrase: "Elephant in the room", category: "Animals & Nature", meaning: "An obvious problem or question that everyone is avoiding discussing.", example: "The messy classroom was the elephant in the room during the meeting." },
  { id: 13, phrase: "Every dog has its day", category: "Animals & Nature", meaning: "Everyone will have good luck or success at some point.", example: "Don't give up on the quiz; every dog has its day!" },
  { id: 14, phrase: "Fishy", category: "Animals & Nature", meaning: "Suspicious or dishonest.", example: "The story about the missing homework sounds a bit fishy." },
  { id: 15, phrase: "Hold your horses", category: "Animals & Nature", meaning: "Wait a minute; slow down.", example: "Hold your horses! Let me explain the rules before we start the game." },
  { id: 16, phrase: "Leap year", category: "Animals & Nature", meaning: "A year with an extra day in February.", example: "My birthday only happens on a leap year!" },
  { id: 17, phrase: "Let the cat out of the bag", category: "Animals & Nature", meaning: "To accidentally reveal a secret.", example: "Maya let the cat out of the bag about the surprise party." },
  { id: 18, phrase: "Lions share", category: "Animals & Nature", meaning: "The biggest or best part of something.", example: "Big brother took the lion's share of the pizza." },
  { id: 19, phrase: "Monkey business", category: "Animals & Nature", meaning: "Naughty, mischievous, or tricky behavior.", example: "The teacher heard giggling and knew there was some monkey business going on." },
  { id: 20, phrase: "Night owl", category: "Animals & Nature", meaning: "Someone who stays up late at night.", example: "My dad is a night owl who reads books past midnight." },
  { id: 21, phrase: "Pig out", category: "Animals & Nature", meaning: "To eat a huge amount of food greedily.", example: "We always pig out on popcorn during movie night." },
  { id: 22, phrase: "Pigs might fly", category: "Animals & Nature", meaning: "Something that is completely impossible.", example: "You think our teacher will cancel math homework? Pigs might fly!" },
  { id: 23, phrase: "Put a bee in your bonnet", category: "Animals & Nature", meaning: "To make someone obsessed or focused on an idea.", example: "Winning the science fair put a bee in his bonnet to build a robot." },
  { id: 24, phrase: "Rain cats and dogs", category: "Animals & Nature", meaning: "To rain very heavily.", example: "Grab your umbrella; it's raining cats and dogs outside." },
  { id: 25, phrase: "Raining on my parade", category: "Animals & Nature", meaning: "Spoiling someone's fun or plans.", example: "Don't rain on my parade by telling me recess is canceled." },
  { id: 26, phrase: "Straight from the horse's mouth", category: "Animals & Nature", meaning: "From the most reliable or original source.", example: "I heard the news straight from the horse's mouth—we have a field trip!" },
  { id: 27, phrase: "Take the bull by the horns", category: "Animals & Nature", meaning: "To face a difficult situation boldly and directly.", example: "Let's take the bull by the horns and finish this tough project together." },
  { id: 28, phrase: "Until cows come home", category: "Animals & Nature", meaning: "For a very long time.", example: "We could debate video games until the cows come home." },
  { id: 29, phrase: "Wild goose chase", category: "Animals & Nature", meaning: "A foolish and hopeless pursuit of something unattainable.", example: "Looking for my lost eraser in the entire school was a wild goose chase." },
  { id: 30, phrase: "Wolf in sheep's clothing", category: "Animals & Nature", meaning: "A dangerous person pretending to be harmless.", example: "Beware of sweet-talkers who act like a wolf in sheep's clothing." },

  // Colors & Light (31-65)
  { id: 31, phrase: "A bolt from the blue", category: "Colors & Light", meaning: "A sudden and unexpected event.", example: "Winning the grand prize came like a bolt from the blue." },
  { id: 32, phrase: "Born with a silver spoon in one's mouth", category: "Colors & Light", meaning: "Born into a very wealthy family.", example: "He didn't have to worry about college tuition; he was born with a silver spoon." },
  { id: 33, phrase: "Catch someone red-handed", category: "Colors & Light", meaning: "To catch someone in the act of doing something wrong.", example: "The teacher caught Leo red-handed eating candy in class." },
  { id: 34, phrase: "Flesh and blood", category: "Colors & Light", meaning: "Family members or human nature.", example: "She is my sister; she's my own flesh and blood." },
  { id: 35, phrase: "Golden opportunity", category: "Colors & Light", meaning: "A wonderful chance that should not be missed.", example: "Studying abroad is a golden opportunity to learn a new language." },
  { id: 36, phrase: "Green with envy", category: "Colors & Light", meaning: "Extremely jealous.", example: "Seeing my new bicycle made my neighbor green with envy." },
  { id: 37, phrase: "In the black", category: "Colors & Light", meaning: "Being profitable or out of debt.", example: "Our class fundraiser is officially in the black!" },
  { id: 38, phrase: "In the pink", category: "Colors & Light", meaning: "In very good health and condition.", example: "Grandma is back from her hike and in the pink." },
  { id: 39, phrase: "In the red", category: "Colors & Light", meaning: "Being in debt or losing money.", example: "The school club account was in the red until the bake sale." },
  { id: 40, phrase: "Once in a blue moon", category: "Colors & Light", meaning: "Very rarely.", example: "We get to eat ice cream for breakfast only once in a blue moon." },
  { id: 41, phrase: "Out of the blue", category: "Colors & Light", meaning: "Unexpectedly; without warning.", example: "A friendly puppy appeared out of the blue during our walk." },
  { id: 42, phrase: "Pass with flying colors", category: "Colors & Light", meaning: "To succeed brilliantly.", example: "Emma passed her math test with flying colors." },
  { id: 43, phrase: "Red tape", category: "Colors & Light", meaning: "Official rules and bureaucracy that cause delays.", example: "There is too much red tape when signing up for after-school clubs." },
  { id: 44, phrase: "Rose-colored glasses", category: "Colors & Light", meaning: "Seeing things in an overly optimistic way.", example: "He looks at school life through rose-colored glasses." },
  { id: 45, phrase: "See red", category: "Colors & Light", meaning: "To become extremely angry.", example: "When someone cut in front of the lunch line, I saw red." },
  { id: 46, phrase: "Silver lining", category: "Colors & Light", meaning: "A comforting or hopeful aspect of a difficult situation.", example: "The rain canceled our picnic, but the silver lining was playing board games indoors." },
  { id: 47, phrase: "Tickled pink", category: "Colors & Light", meaning: "Delighted and extremely pleased.", example: "Mom was tickled pink when she received handmade birthday cards." },
  { id: 48, phrase: "True blue", category: "Colors & Light", meaning: "Extremely loyal and trustworthy.", example: "My best friend is true blue through thick and thin." },
  { id: 49, phrase: "White lie", category: "Colors & Light", meaning: "A harmless or small lie told to avoid hurting someone's feelings.", example: "She told a white lie saying she loved the silly sweater." },
  { id: 50, phrase: "Yellow-bellied", category: "Colors & Light", meaning: "Cowardly.", example: "Don't be yellow-bellied; try out for the school play!" },

  // Food & Kitchen (66-105)
  { id: 66, phrase: "A piece of cake", category: "Food & Kitchen", meaning: "Something very easy to do.", example: "The spelling quiz was a piece of cake!" },
  { id: 67, phrase: "Apple of my eye", category: "Food & Kitchen", meaning: "Someone very precious and cherished.", example: "Little baby sister is the apple of grandfather's eye." },
  { id: 68, phrase: "Bad egg", category: "Food & Kitchen", meaning: "A dishonest or untrustworthy person.", example: "Beware of tricksters who turn out to be a bad egg." },
  { id: 69, phrase: "Big cheese", category: "Food & Kitchen", meaning: "An important, influential person.", example: "The principal is the big cheese around school." },
  { id: 70, phrase: "Bring home the bacon", category: "Food & Kitchen", meaning: "To earn money to live; to succeed.", example: "Parents work hard every day to bring home the bacon." },
  { id: 71, phrase: "Bite off more than you can chew", category: "Food & Kitchen", meaning: "To take on more responsibilities than you can handle.", example: "Signing up for three sports clubs at once is biting off more than you can chew." },
  { id: 72, phrase: "Bread and butter", category: "Food & Kitchen", meaning: "A person's livelihood or basic necessities.", example: "Math and reading are the bread and butter of education." },
  { id: 73, phrase: "Cry over spilled milk", category: "Food & Kitchen", meaning: "To worry about something that has already happened and cannot be changed.", example: "We lost the game, but no use crying over spilled milk—let's practice harder." },
  { id: 74, phrase: "Couch potato", category: "Food & Kitchen", meaning: "Someone who spends too much time sitting and watching TV.", example: "Don't be a couch potato all weekend; let's go bike riding!" },
  { id: 75, phrase: "Cup of tea", category: "Food & Kitchen", meaning: "Something one enjoys or likes.", example: "Coding isn't everyone's cup of tea, but I love it." },
  { id: 76, phrase: "Drop like hot potatoes", category: "Food & Kitchen", meaning: "To abandon something quickly because it's troublesome.", example: "As soon as chores were mentioned, they dropped the idea like a hot potato." },
  { id: 77, phrase: "Egg someone on", category: "Food & Kitchen", meaning: "To encourage someone to do something silly or daring.", example: "Don't egg your brother on to jump off the sofa!" },
  { id: 78, phrase: "Full of beans", category: "Food & Kitchen", meaning: "Full of energy and liveliness.", example: "The puppies are full of beans this morning." },
  { id: 79, phrase: "Get egg on your face", category: "Food & Kitchen", meaning: "To look foolish after making a mistake.", example: "He got egg on his face when he answered the wrong question with total confidence." },
  { id: 80, phrase: "Gravy train", category: "Food & Kitchen", meaning: "A job or situation that pays well for little effort.", example: "Winning the lottery isn't a permanent gravy train; you still need wisdom." },
  { id: 81, phrase: "Half-baked", category: "Food & Kitchen", meaning: "Not fully thought out or planned.", example: "Building a treehouse without measurements is a half-baked idea." },
  { id: 82, phrase: "In a nutshell", category: "Food & Kitchen", meaning: "In a few words; concisely.", example: "In a nutshell, we need to study hard for final exams." },
  { id: 83, phrase: "Not my cup of tea", category: "Food & Kitchen", meaning: "Not what I like or enjoy.", example: "Horror movies are definitely not my cup of tea." },
  { id: 84, phrase: "Out of the frying pan into the fire", category: "Food & Kitchen", meaning: "Moving from a bad situation to a worse one.", example: "Avoiding homework only to face detention is jumping from the frying pan into the fire." },
  { id: 85, phrase: "Pinch of salt", category: "Food & Kitchen", meaning: "With skepticism or doubt.", example: "Take his grand stories with a grain of salt." },
  { id: 86, phrase: "Spill the beans", category: "Food & Kitchen", meaning: "To reveal a secret.", example: "Who spilled the beans about the surprise party?" },
  { id: 87, phrase: "Take with a grain of salt", category: "Food & Kitchen", meaning: "Not to take something too seriously or literally.", example: "Rumors on the playground should be taken with a grain of salt." },

  // School, Brain & Work (106-150)
  { id: 106, phrase: "A bookworm", category: "School & Mind", meaning: "Someone who reads a lot.", example: "She is a total bookworm, finishing three novels a week." },
  { id: 107, phrase: "A hard nut to crack", category: "School & Mind", meaning: "A difficult problem or a stubborn person.", example: "That math puzzle is a hard nut to crack." },
  { id: 108, phrase: "Back to the drawing board", category: "School & Mind", meaning: "To start over after a plan fails.", example: "Our science project collapsed, so it's back to the drawing board." },
  { id: 109, phrase: "Burn the midnight oil", category: "School & Mind", meaning: "To work or study late into the night.", example: "He burned the midnight oil preparing for the history competition." },
  { id: 110, phrase: "Catch on", category: "School & Mind", meaning: "To understand or learn something after some time.", example: "It took a few tries, but she finally caught on to division." },
  { id: 111, phrase: "Copycat", category: "School & Mind", meaning: "Someone who copies someone else's work or actions.", example: "Don't be a copycat; write your own creative story." },
  { id: 112, phrase: "Cut corners", category: "School & Mind", meaning: "To do something carelessly to save time or money.", example: "Don't cut corners on your art project or it won't look neat." },
  { id: 113, phrase: "Draw a blank", category: "School & Mind", meaning: "To be unable to remember something.", example: "During the quiz, my mind drew a blank on the capital city." },
  { id: 114, phrase: "Eager beaver", category: "School & Mind", meaning: "An enthusiastic and hardworking person.", example: "He was an eager beaver, arriving at the science lab thirty minutes early." },
  { id: 115, phrase: "Fail proof", category: "School & Mind", meaning: "Guaranteed to work successfully.", example: "Following the recipe step-by-step is foolproof." },
  { id: 116, phrase: "Get the hang of it", category: "School & Mind", meaning: "To learn how to do something skillfully.", example: "Riding a bicycle takes practice, but you'll soon get the hang of it." },
  { id: 117, phrase: "Hit the books", category: "School & Mind", meaning: "To study hard.", example: "Exams are coming up next week; time to hit the books!" },
  { id: 118, phrase: "Know it inside out", category: "School & Mind", meaning: "To know something thoroughly and completely.", example: "She knows the solar system inside out." },
  { id: 119, phrase: "Learn the ropes", category: "School & Mind", meaning: "To learn the basics of a new job or activity.", example: "It takes a few days in middle school to learn the ropes." },
  { id: 120, phrase: "Pass with flying colors", category: "School & Mind", meaning: "To succeed with distinction.", example: "He passed the spelling test with flying colors." },
  { id: 121, phrase: "Put your thinking cap on", category: "School & Mind", meaning: "To think seriously about a problem.", example: "Put your thinking cap on and solve this riddle." },
  { id: 122, phrase: "Teacher's pet", category: "School & Mind", meaning: "A student who is favored by the teacher.", example: "He always erased the board, earning the title of teacher's pet." },
  { id: 123, phrase: "Think outside the box", category: "School & Mind", meaning: "To think creatively and unconventionally.", example: "To solve the engineering challenge, we need to think outside the box." },

  // Body Parts & Actions (151-200)
  { id: 151, phrase: "All ears", category: "Body & Actions", meaning: "Listening eagerly and attentively.", example: "Tell me your story; I'm all ears!" },
  { id: 152, phrase: "Break a leg", category: "Body & Actions", meaning: "Good luck! (Often used before a performance or test).", example: "Break a leg in the school play tonight!" },
  { id: 153, phrase: "Cost an arm and a leg", category: "Body & Actions", meaning: "To be extremely expensive.", example: "That luxury spaceship Lego set costs an arm and a leg." },
  { id: 154, phrase: "Cry your eyes out", category: "Body & Actions", meaning: "To cry uncontrollably and bitterly.", example: "She cried her eyes out when her puppy got lost." },
  { id: 155, phrase: "Get cold feet", category: "Body & Actions", meaning: "To become nervous or frightened before doing something important.", example: "He got cold feet right before giving his speech on stage." },
  { id: 156, phrase: "Give a hand", category: "Body & Actions", meaning: "To help someone.", example: "Can you give me a hand carrying these books?" },
  { id: 157, phrase: "Head over heels", category: "Body & Actions", meaning: "Madly in love or extremely excited.", example: "She fell head over heels in love with gymnastics." },
  { id: 158, phrase: "Keep your chin up", category: "Body & Actions", meaning: "Remain cheerful in difficult times.", example: "Keep your chin up; you'll do better on the next test." },
  { id: 159, phrase: "Lend an ear", category: "Body & Actions", meaning: "To listen to someone sympathetically.", example: "Thank you for lending an ear when I was upset." },
  { id: 160, phrase: "On the tip of my tongue", category: "Body & Actions", meaning: "Almost remembered, but not quite coming out.", example: "Her name is on the tip of my tongue, but I can't recall it." },
  { id: 161, phrase: "Pull someone's leg", category: "Body & Actions", meaning: "To tease or joke with someone.", example: "Are you serious or just pulling my leg about the school holiday?" },
  { id: 162, phrase: "See eye to eye", category: "Body & Actions", meaning: "To agree fully with someone.", example: "We don't always see eye to eye on which game to play." },
  { id: 163, phrase: "Spine-chilling", category: "Body & Actions", meaning: "Frightening or terrifying.", example: "The ghost story around the campfire was spine-chilling." },
  { id: 164, phrase: "Step up your game", category: "Body & Actions", meaning: "To improve your performance or effort.", example: "If we want to win the tournament, we need to step up our game." },
  { id: 165, phrase: "Under the weather", category: "Body & Actions", meaning: "Feeling slightly sick or unwell.", example: "I stayed home today because I was feeling a bit under the weather." },
  { id: 166, phrase: "Wake up on the wrong side of the bed", category: "Body & Actions", meaning: "Being in a bad mood all day.", example: "Why is Leo so grumpy? He must have woken up on the wrong side of the bed." },
  { id: 167, phrase: "Beat around the bush", category: "Time & Communication", meaning: "To avoid talking about what is important.", example: "Stop beating around the bush and tell me the answer." },
  { id: 168, phrase: "Bite the bullet", category: "Time & Communication", meaning: "To endure a painful situation that is unavoidable.", example: "We have to bite the bullet and finish our chores before playing." },
  { id: 169, phrase: "Burn bridges", category: "Time & Communication", meaning: "To ruin a relationship or connection permanently.", example: "Never burn bridges with your teachers or friends." },
  { id: 170, phrase: "Call it a day", category: "Time & Communication", meaning: "To stop working on something for the day.", example: "We've studied for three hours; let's call it a day." },
  { id: 171, phrase: "Cutting edge", category: "Time & Communication", meaning: "The newest and most advanced stage of technology or art.", example: "Our school computer lab features cutting edge technology." },
  { id: 172, phrase: "Down to earth", category: "Time & Communication", meaning: "Practical, realistic, and humble.", example: "Even though she won the spelling bee, she remains very down to earth." },
  { id: 173, phrase: "Face the music", category: "Time & Communication", meaning: "To accept the unpleasant consequences of one's actions.", example: "He broke the window during soccer and had to face the music." },
  { id: 174, phrase: "Get out of hand", category: "Time & Communication", meaning: "To become uncontrollable.", example: "The classroom excitement got completely out of hand during the party." },
  { id: 175, phrase: "Give someone the benefit of the doubt", category: "Time & Communication", meaning: "To believe someone's statement without proof.", example: "I gave him the benefit of the doubt when he said his dog ate his homework." },
  { id: 176, phrase: "Hit the nail on the head", category: "Time & Communication", meaning: "To describe exactly what is causing a situation or problem.", example: "Your explanation of the science experiment hit the nail on the head." },
  { id: 177, phrase: "In the nick of time", category: "Time & Communication", meaning: "Just before the deadline or disaster; barely in time.", example: "We arrived at the exam hall in the nick of time." },
  { id: 178, phrase: "Jump on the bandwagon", category: "Time & Communication", meaning: "To join a popular activity or trend.", example: "Everyone started wearing wristbands, so I jumped on the bandwagon." },
  { id: 179, phrase: "Keep your fingers crossed", category: "Time & Communication", meaning: "To wish for good luck.", example: "Keep your fingers crossed that we win the science fair!" },
  { id: 180, phrase: "Let sleeping dogs lie", category: "Time & Communication", meaning: "To leave an existing problem alone if it's not causing trouble.", example: "Don't bring up the old argument; let sleeping dogs lie." },
  { id: 181, phrase: "Make a mountain out of a molehill", category: "Time & Communication", meaning: "To make a small problem seem much bigger than it is.", example: "Missing one question on a quiz isn't a disaster—don't make a mountain out of a molehill." },
  { id: 182, phrase: "On cloud nine", category: "Time & Communication", meaning: "Extremely happy and joyful.", example: "She was on cloud nine after receiving the top student award." },
  { id: 183, phrase: "Play devil's advocate", category: "Time & Communication", meaning: "To argue against an idea just for the sake of debate.", example: "He played devil's advocate to help us think of counterarguments." },
  { id: 184, phrase: "Rock the boat", category: "Time & Communication", meaning: "To cause trouble or upset a stable situation.", example: "Everything is running smoothly, so let's not rock the boat." },
  { id: 185, phrase: "Through thick and thin", category: "Time & Communication", meaning: "Through good times and bad times.", example: "True friends stick together through thick and thin." },
  { id: 186, phrase: "Weather the storm", category: "Time & Communication", meaning: "To survive a difficult period successfully.", example: "Working together helped our class weather the storm of difficult exams." }
];

export default function IdiomsScreen() {
  const router = useRouter();
  const config = useSchoolConfig();
  const brandPrimary = config.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary = config.brandSecondary || config.secondaryColor || "#4338ca";

  const [activeTab, setActiveTab] = useState<'explore' | 'quiz' | 'favorites'>('explore');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [savedStars, setSavedStars] = useState(15);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const favs = await AsyncStorage.getItem("@edueaz_idioms_favs");
      if (favs) setFavorites(JSON.parse(favs));
      const stars = await AsyncStorage.getItem("@edueaz_idioms_stars");
      if (stars) setSavedStars(parseInt(stars, 10));
    } catch (err) {
      console.error(err);
    }
  };

  const saveFavorites = async (newFavs: number[]) => {
    try {
      setFavorites(newFavs);
      await AsyncStorage.setItem("@edueaz_idioms_favs", JSON.stringify(newFavs));
    } catch (err) {
      console.error(err);
    }
  };

  const addStars = async (amount: number) => {
    const updated = savedStars + amount;
    setSavedStars(updated);
    await AsyncStorage.setItem("@edueaz_idioms_stars", updated.toString());
  };

  const toggleFavorite = (id: number) => {
    if (favorites.includes(id)) {
      saveFavorites(favorites.filter(f => f !== id));
    } else {
      saveFavorites([...favorites, id]);
      addStars(2);
    }
  };

  const handleSpeak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'en', rate: 0.9 });
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(IDIOMS_DATASET.map(i => i.category)));
    return ["ALL", ...cats];
  }, []);

  const filteredIdioms = useMemo(() => {
    return IDIOMS_DATASET.filter(item => {
      const matchesCat = selectedCategory === "ALL" || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || item.phrase.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q) || item.example.toLowerCase().includes(q);
      const matchesFav = activeTab !== 'favorites' || favorites.includes(item.id);
      return matchesCat && matchesQuery && matchesFav;
    });
  }, [searchQuery, selectedCategory, favorites, activeTab]);

  // Quiz questions generation
  const quizQuestions = useMemo(() => {
    return IDIOMS_DATASET.slice(0, 10).map((item, idx, arr) => {
      // Pick 3 wrong meanings
      const wrongMeanings = arr
        .filter(i => i.id !== item.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(i => i.meaning);
      const options = [...wrongMeanings, item.meaning].sort(() => 0.5 - Math.random());
      return {
        phrase: item.phrase,
        correctMeaning: item.meaning,
        example: item.example,
        options,
      };
    });
  }, []);

  const currentQuiz = quizQuestions[quizIndex];

  const handleAnswerQuiz = (option: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    const isCorrect = option === currentQuiz.correctMeaning;
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
      addStars(5);
    }
    setTimeout(() => {
      if (quizIndex + 1 < quizQuestions.length) {
        setQuizIndex(prev => prev + 1);
        setSelectedOption(null);
      } else {
        setQuizCompleted(true);
      }
    }, 1500);
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setQuizScore(0);
    setSelectedOption(null);
    setQuizCompleted(false);
  };

  return (
    <View style={styles.container}>
      <StationaryBackground />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: brandPrimary }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <SVGIcon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Idiom Quest 🌟</Text>
            <Text style={styles.headerSubtitle}>Master 300+ Essential English Idiomatic Expressions</Text>
          </View>
          <View style={styles.starBadge}>
            <SVGIcon name="star" size={16} color="#FFD700" />
            <Text style={styles.starBadgeText}>{savedStars}</Text>
          </View>
        </View>

        {/* SEARCH BAR (Only for Explore/Favorites) */}
        {activeTab !== 'quiz' && (
          <View style={styles.searchBarContainer}>
            <SVGIcon name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search idioms or meanings..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <SVGIcon name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* NAVIGATION TABS */}
      <View style={styles.tabContainer}>
        {[
          { id: 'explore', label: `Explore (${IDIOMS_DATASET.length})`, icon: 'book' },
          { id: 'quiz', label: 'Idiom Quiz 🎯', icon: 'trophy' },
          { id: 'favorites', label: `Saved (${favorites.length})`, icon: 'heart' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && { borderBottomColor: brandPrimary, borderBottomWidth: 3 }]}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <SVGIcon name={tab.icon as any} size={16} color={isActive ? brandPrimary : '#64748B'} />
              <Text style={[styles.tabText, isActive && { color: brandPrimary, fontWeight: '800' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TAB 1: EXPLORE & FAVORITES */}
        {activeTab !== 'quiz' && (
          <View>
            {/* CATEGORY CHIPS */}
            {activeTab === 'explore' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {categories.map(cat => {
                  const active = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, active && { backgroundColor: brandPrimary, borderColor: brandPrimary }]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[styles.categoryChipText, active && { color: '#FFFFFF', fontWeight: '900' }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {filteredIdioms.length === 0 ? (
              <View style={styles.centerBox}>
                <SVGIcon name="search-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No idioms found</Text>
                <Text style={styles.emptySubtitle}>Try changing your search term or category filter.</Text>
              </View>
            ) : (
              <View style={styles.idiomGrid}>
                {filteredIdioms.map(item => {
                  const isFav = favorites.includes(item.id);
                  return (
                    <View key={item.id} style={[styles.idiomCard, SHADOWS.small]}>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryTagText}>{item.category}</Text>
                        </View>
                        <div style={{ display: 'flex', gap: 6 }} className="flex-row gap-2">
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleSpeak(`${item.phrase}. Meaning: ${item.meaning}. Example: ${item.example}`)}
                          >
                            <SVGIcon name="volume-high" size={18} color={brandPrimary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => toggleFavorite(item.id)}
                          >
                            <SVGIcon name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? "#EF4444" : "#64748B"} />
                          </TouchableOpacity>
                        </div>
                      </View>

                      <Text style={styles.idiomPhrase}>"{item.phrase}"</Text>
                      <Text style={styles.idiomMeaning}><Text style={{ fontWeight: '800', color: '#1E293B' }}>Meaning:</Text> {item.meaning}</Text>
                      <Text style={styles.idiomExample}><Text style={{ fontWeight: '800', color: '#64748B' }}>Example:</Text> "{item.example}"</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: QUIZ MODE */}
        {activeTab === 'quiz' && (
          <View style={[styles.quizContainer, SHADOWS.medium]}>
            {!quizCompleted ? (
              <View>
                <View style={styles.quizProgressBar}>
                  <Text style={styles.quizProgressText}>Question {quizIndex + 1} of {quizQuestions.length}</Text>
                  <Text style={styles.quizScoreText}>Score: {quizScore} 🌟</Text>
                </View>

                <View style={styles.quizQuestionCard}>
                  <Text style={styles.quizPromptLabel}>What is the meaning of this idiom?</Text>
                  <Text style={styles.quizIdiomText}>"{currentQuiz.phrase}"</Text>
                  <TouchableOpacity
                    style={styles.quizSpeakerBtn}
                    onPress={() => handleSpeak(currentQuiz.phrase)}
                  >
                    <SVGIcon name="volume-high" size={16} color={brandPrimary} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: brandPrimary }}>Listen</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 10 }}>
                  {currentQuiz.options.map((opt, oIdx) => {
                    let btnStyle: any = styles.quizOptionBtn;
                    let textStyle: any = styles.quizOptionText;
                    if (selectedOption !== null) {
                      if (opt === currentQuiz.correctMeaning) {
                        btnStyle = [styles.quizOptionBtn, { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }];
                        textStyle = [styles.quizOptionText, { color: '#166534', fontWeight: '800' }];
                      } else if (opt === selectedOption) {
                        btnStyle = [styles.quizOptionBtn, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }];
                        textStyle = [styles.quizOptionText, { color: '#991B1B' }];
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={oIdx}
                        style={btnStyle}
                        onPress={() => handleAnswerQuiz(opt)}
                        activeOpacity={0.8}
                      >
                        <Text style={textStyle}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.quizCompletedBox}>
                <SVGIcon name="trophy" size={64} color="#F59E0B" />
                <Text style={styles.completedTitle}>Quiz Completed! 🎉</Text>
                <Text style={styles.completedSub}>You scored {quizScore} out of {quizQuestions.length}!</Text>
                <Text style={styles.earnedStarsText}>+ {quizScore * 5} Stars earned! 🌟</Text>

                <TouchableOpacity
                  style={[styles.restartQuizBtn, { backgroundColor: brandPrimary }]}
                  onPress={resetQuiz}
                >
                  <Text style={styles.restartQuizText}>Play Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  starBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  categoryScroll: {
    gap: 8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  idiomGrid: {
    gap: 14,
  },
  idiomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  idiomPhrase: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  idiomMeaning: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 4,
  },
  idiomExample: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  quizContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  quizProgressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quizProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  quizScoreText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F59E0B',
  },
  quizQuestionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quizPromptLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  quizIdiomText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  quizSpeakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  quizOptionBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quizOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  quizCompletedBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 16,
  },
  completedSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },
  earnedStarsText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F59E0B',
    marginTop: 10,
    marginBottom: 24,
  },
  restartQuizBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  restartQuizText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
});
