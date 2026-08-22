import React, { memo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../SVGIcon";
import { COLORS, SHADOWS } from "../../../../constants/theme";

const PreschoolFields = memo(({ q, qIndex, updatePreschoolQuestion, styles }: any) => {
  const [activeCategory, setActiveCategory] = useState<string | null>("Shapes");
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);
  const [emojiTarget, setEmojiTarget] = useState<{ type: 'visualGroup' | 'option', index?: number }>({ type: 'visualGroup' });

  const preschoolCategories = [
    {
      title: "Numeracy (Mathematics)",
      items: [
        { id: "count_objects", label: "Count Objects", icon: "calculator", hint: "Count the items and select the number" },
        { id: "fill_missing", label: "Missing Number", icon: "pencil", hint: "e.g. 1 _ 3 or 5, 6, _, 8" },
        { id: "simple_addition", label: "Simple Addition", icon: "add-circle", hint: "e.g. 2 + 1 = ?" },
      ]
    },
    {
      title: "Literacy (Language)",
      items: [
        { id: "identify_letter", label: "Identify Letter", icon: "library", hint: "e.g. Which one is letter 'B'?" },
        { id: "beginning_letter", label: "Beginning Letter", icon: "sparkles", hint: "e.g. What letter does 'Apple' start with?" },
        { id: "match_case", label: "Match Uppercase/Lowercase", icon: "link", hint: "e.g. Match 'A' to 'a'" },
      ]
    },
    {
      title: "Sensorial & Recognition",
      items: [
        { id: "identify_object", label: "Identify Object", icon: "eye", hint: "e.g. Pick the Dog from the pictures" },
        { id: "odd_one_out", label: "Odd One Out", icon: "close-circle", hint: "Which one is different?" },
        { id: "identify_shape", label: "Identify Shape", icon: "find-shapes", hint: "e.g. Which one is a Circle?" },
      ]
    },
    {
      title: "Cognitive Thinking",
      items: [
        { id: "true_false", label: "True / False", icon: "help-circle", hint: "e.g. Is this a triangle?" },
        { id: "ordering", label: "Ordering Objects", icon: "trending-down", hint: "Arrange from smallest to largest" },
        { id: "classification", label: "Classification", icon: "list", hint: "Group all the fruits together" },
      ]
    }
  ];

  const visualAssetLibrary = [
    {
      category: "Letters (Upper)",
      icon: "text",
      items: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => ({ id: l, label: `Letter ${l}` }))
    },
    {
      category: "Letters (Lower)",
      icon: "text",
      items: "abcdefghijklmnopqrstuvwxyz".split("").map(l => ({ id: l, label: `Letter ${l}` }))
    },
    {
      category: "Math & Symbols",
      icon: "calculator",
      items: [
        { id: "+", label: "Plus" },
        { id: "-", label: "Minus" },
        { id: "×", label: "Multiply" },
        { id: "÷", label: "Divide" },
        { id: "=", label: "Equals" },
        { id: "?", label: "Question Mark" },
        { id: "√", label: "Square Root", type: "sqrt" },
        { id: "/", label: "Fraction", type: "fraction" },
        { id: "(", label: "Round Brackets", type: "bracket", bracketType: "round" },
        { id: "[", label: "Square Brackets", type: "bracket", bracketType: "square" },
        { id: "{", label: "Curly Brackets", type: "bracket", bracketType: "curly" },
        { id: "^", label: "Superscript", type: "superscript" },
        { id: "_", label: "Subscript", type: "subscript" },
        { id: "1", label: "Number 1" },
        { id: "2", label: "Number 2" },
        { id: "3", label: "Number 3" },
        { id: "4", label: "Number 4" },
        { id: "5", label: "Number 5" },
        { id: "6", label: "Number 6" },
        { id: "7", label: "Number 7" },
        { id: "8", label: "Number 8" },
        { id: "9", label: "Number 9" },
        { id: "0", label: "Number 0" },
      ]
    },
    {
      category: "Shapes",
      icon: "find-shapes",
      items: [
        { id: "🔴", label: "Red Circle" },
        { id: "🔵", label: "Blue Circle" },
        { id: "🟡", label: "Yellow Circle" },
        { id: "🟢", label: "Green Circle" },
        { id: "🟠", label: "Orange Circle" },
        { id: "🟣", label: "Purple Circle" },
        { id: "🟤", label: "Brown Circle" },
        { id: "⚫", label: "Black Circle" },
        { id: "⚪", label: "White Circle" },
        { id: "🟥", label: "Red Square" },
        { id: "🟦", label: "Blue Square" },
        { id: "🟨", label: "Yellow Square" },
        { id: "🟩", label: "Green Square" },
        { id: "🟧", label: "Orange Square" },
        { id: "🟪", label: "Purple Square" },
        { id: "🟫", label: "Brown Square" },
        { id: "⬛", label: "Black Square" },
        { id: "⬜", label: "White Square" },
        { id: "🔺", label: "Red Triangle" },
        { id: "🔻", label: "Red Triangle Down" },
        { id: "💎", label: "Diamond" },
        { id: "🔶", label: "Large Orange Diamond" },
        { id: "🔷", label: "Large Blue Diamond" },
        { id: "🔸", label: "Small Orange Diamond" },
        { id: "🔹", label: "Small Blue Diamond" },
        { id: "⭐", label: "Star" },
        { id: "🌟", label: "Glowing Star" },
        { id: "✨", label: "Sparkles" },
        { id: "❤️", label: "Red Heart" },
        { id: "🧡", label: "Orange Heart" },
        { id: "💛", label: "Yellow Heart" },
        { id: "💚", label: "Green Heart" },
        { id: "💙", label: "Blue Heart" },
        { id: "💜", label: "Purple Heart" },
        { id: "🖤", label: "Black Heart" },
        { id: "🤍", label: "White Heart" },
        { id: "🤎", label: "Brown Heart" },
        { id: "⭕", label: "Hollow Circle" },
        { id: "🔘", label: "Radio Button" },
        { id: "🔳", label: "White Square Button" },
        { id: "🔲", label: "Black Square Button" },
        { id: "square-outline", label: "Square (Outline)" },
        { id: "circle-outline", label: "Circle (Outline)" },
        { id: "triangle-outline", label: "Triangle (Outline)" },
        { id: "diamond-outline", label: "Diamond (Outline)" },
        { id: "star-outline", label: "Star (Outline)" },
        { id: "heart-outline", label: "Heart (Outline)" },
        { id: "pentagon", label: "Pentagon (Filled)" },
        { id: "pentagon-outline", label: "Pentagon (Outline)" },
        { id: "hexagon", label: "Hexagon (Filled)" },
        { id: "hexagon-outline", label: "Hexagon (Outline)" },
        { id: "octagon", label: "Octagon (Filled)" },
        { id: "octagon-outline", label: "Octagon (Outline)" },
      ]
    },
    {
      category: "Animals",
      icon: "animals",
      items: [
        { id: "🐶", label: "Dog" },
        { id: "🐱", label: "Cat" },
        { id: "🐭", label: "Mouse" },
        { id: "🐹", label: "Hamster" },
        { id: "🐰", label: "Rabbit" },
        { id: "🦊", label: "Fox" },
        { id: "🐻", label: "Bear" },
        { id: "🐼", label: "Panda" },
        { id: "🦁", label: "Lion" },
        { id: "🐯", label: "Tiger" },
        { id: "🐘", label: "Elephant" },
        { id: "🦒", label: "Giraffe" },
        { id: "🦓", label: "Zebra" },
        { id: "🐮", label: "Cow" },
        { id: "🐷", label: "Pig" },
        { id: "🐑", label: "Sheep" },
        { id: "🐐", label: "Goat" },
        { id: "🐪", label: "Camel" },
        { id: "🐒", label: "Monkey" },
        { id: "🐔", label: "Chicken" },
        { id: "🐧", label: "Penguin" },
        { id: "🐦", label: "Bird" },
        { id: "🐤", label: "Chick" },
        { id: "🦆", label: "Duck" },
        { id: "🦅", label: "Eagle" },
        { id: "🦉", label: "Owl" },
        { id: "🦇", label: "Bat" },
        { id: "🐺", label: "Wolf" },
        { id: "🐗", label: "Boar" },
        { id: "🐎", label: "Horse" },
        { id: "🦄", label: "Unicorn" },
        { id: "🐝", label: "Bee" },
        { id: "🐛", label: "Bug" },
        { id: "🦋", label: "Butterfly" },
        { id: "🐌", label: "Snail" },
        { id: "🐞", label: "Ladybug" },
        { id: "🐜", label: "Ant" },
        { id: "🦟", label: "Mosquito" },
        { id: "🦗", label: "Cricket" },
        { id: "🕷️", label: "Spider" },
        { id: "🦂", label: "Scorpion" },
        { id: "🐢", label: "Turtle" },
        { id: "🐍", label: "Snake" },
        { id: "🦎", label: "Lizard" },
        { id: "🦖", label: "T-Rex" },
        { id: "🦕", label: "Brontosaurus" },
        { id: "🐙", label: "Octopus" },
        { id: "🦑", label: "Squid" },
        { id: "🦐", label: "Shrimp" },
        { id: "🦞", label: "Lobster" },
        { id: "🦀", label: "Crab" },
        { id: "🐡", label: "Blowfish" },
        { id: "🐠", label: "Tropical Fish" },
        { id: "🐟", label: "Fish" },
        { id: "🐬", label: "Dolphin" },
        { id: "🐳", label: "Whale" },
        { id: "🐋", label: "Humpback Whale" },
        { id: "🦈", label: "Shark" },
        { id: "🐊", label: "Crocodile" },
      ]
    },
    {
      category: "Fruits & Nature",
      icon: "fruits",
      items: [
        { id: "🍏", label: "Green Apple" },
        { id: "🍎", label: "Red Apple" },
        { id: "🍐", label: "Pear" },
        { id: "🍊", label: "Orange" },
        { id: "🍋", label: "Lemon" },
        { id: "🍌", label: "Banana" },
        { id: "🍉", label: "Watermelon" },
        { id: "🍇", label: "Grapes" },
        { id: "🍓", label: "Strawberry" },
        { id: "🫐", label: "Blueberries" },
        { id: "🍈", label: "Melon" },
        { id: "🍒", label: "Cherries" },
        { id: "🍑", label: "Peach" },
        { id: "🥭", label: "Mango" },
        { id: "🍍", label: "Pineapple" },
        { id: "🥥", label: "Coconut" },
        { id: "🥝", label: "Kiwi" },
        { id: "🍅", label: "Tomato" },
        { id: "🥑", label: "Avocado" },
        { id: "🥦", label: "Broccoli" },
        { id: "🥬", label: "Leafy Green" },
        { id: "🥒", label: "Cucumber" },
        { id: "🌶️", label: "Hot Pepper" },
        { id: "🌽", label: "Corn" },
        { id: "🥕", label: "Carrot" },
        { id: "🫒", label: "Olive" },
        { id: "🧄", label: "Garlic" },
        { id: "🧅", label: "Onion" },
        { id: "🥔", label: "Potato" },
        { id: "🍠", label: "Sweet Potato" },
        { id: "🍄", label: "Mushroom" },
        { id: "🥜", label: "Peanuts" },
        { id: "🌰", label: "Chestnut" },
        { id: "🍞", label: "Bread" },
        { id: "🥐", label: "Croissant" },
        { id: "🥖", label: "Baguette" },
        { id: "🥨", label: "Pretzel" },
        { id: "🥯", label: "Bagel" },
        { id: "🥞", label: "Pancakes" },
        { id: "🧇", label: "Waffle" },
        { id: "🧀", label: "Cheese" },
        { id: "🍖", label: "Meat on Bone" },
        { id: "🍗", label: "Poultry Leg" },
        { id: "🥩", label: "Cut of Meat" },
        { id: "🥓", label: "Bacon" },
        { id: "🍔", label: "Hamburger" },
        { id: "🍟", label: "French Fries" },
        { id: "🍕", label: "Pizza" },
        { id: "🌭", label: "Hot Dog" },
        { id: "🥪", label: "Sandwich" },
        { id: "🌮", label: "Taco" },
        { id: "🌯", label: "Burrito" },
        { id: "🫔", label: "Tamale" },
        { id: "🥙", label: "Stuffed Flatbread" },
        { id: "🧆", label: "Falafel" },
        { id: "🍳", label: "Cooking" },
        { id: "🥘", label: "Shallow Pan of Food" },
        { id: "🍲", label: "Pot of Food" },
        { id: "🥣", label: "Bowl with Spoon" },
        { id: "🥗", label: "Green Salad" },
        { id: "🍿", label: "Popcorn" },
        { id: "🧈", label: "Butter" },
        { id: "🧂", label: "Salt" },
        { id: "🥫", label: "Canned Food" },
        { id: "🍱", label: "Bento Box" },
        { id: "🍘", label: "Rice Cracker" },
        { id: "🍙", label: "Rice Ball" },
        { id: "🍚", label: "Cooked Rice" },
        { id: "🍛", label: "Curry Rice" },
        { id: "🍜", label: "Steaming Bowl" },
        { id: "🍝", label: "Spaghetti" },
        { id: "🍢", label: "Oden" },
        { id: "🍣", label: "Sushi" },
        { id: "🍤", label: "Fried Shrimp" },
        { id: "🍥", label: "Fish Cake with Swirl" },
        { id: "🥮", label: "Moon Cake" },
        { id: "🍡", label: "Dango" },
        { id: "🥟", label: "Dumpling" },
        { id: "🥠", label: "Fortune Cookie" },
        { id: "🥡", label: "Takeout Box" },
        { id: "🌵", label: "Cactus" },
        { id: "🎄", label: "Christmas Tree" },
        { id: "🌲", label: "Evergreen Tree" },
        { id: "🌳", label: "Deciduous Tree" },
        { id: "🌴", label: "Palm Tree" },
        { id: "🌱", label: "Seedling" },
        { id: "🌿", label: "Herb" },
        { id: "☘️", label: "Shamrock" },
        { id: "🍀", label: "Four Leaf Clover" },
        { id: "🍃", label: "Leaf Fluttering in Wind" },
        { id: "🍂", label: "Fallen Leaf" },
        { id: "🍁", label: "Maple Leaf" },
        { id: "🐚", label: "Spiral Shell" },
        { id: "🪸", label: "Coral" },
        { id: "🌾", label: "Sheaf of Rice" },
        { id: "💐", label: "Bouquet" },
        { id: "🌷", label: "Tulip" },
        { id: "🌹", label: "Rose" },
        { id: "🥀", label: "Wilted Flower" },
        { id: "🌺", label: "Hibiscus" },
        { id: "🌸", label: "Cherry Blossom" },
        { id: "🌼", label: "Blossom" },
        { id: "🌻", label: "Sunflower" },
        { id: "🌞", label: "Sun with Face" },
        { id: "🌕", label: "Full Moon" },
        { id: "🌖", label: "Waning Gibbous Moon" },
        { id: "🌗", label: "Last Quarter Moon" },
        { id: "🌘", label: "Waning Crescent Moon" },
        { id: "🌑_new", label: "New Moon" },
        { id: "🌒_waxing", label: "Waxing Crescent Moon" },
        { id: "🌓_first", label: "First Quarter Moon" },
        { id: "🌔_waxing_gibbous", label: "Waxing Gibbous Moon" },
        { id: "🌙", label: "Crescent Moon" },
        { id: "🌎", label: "Globe Showing Americas" },
        { id: "🌍", label: "Globe Showing Europe-Africa" },
        { id: "🌏", label: "Globe Showing Asia-Australia" },
        { id: "🌐", label: "Globe with Meridians" },
        { id: "🌟", label: "Glowing Star" },
        { id: "✨", label: "Sparkles" },
        { id: "⚡", label: "High Voltage" },
        { id: "☄️", label: "Comet" },
        { id: "💥", label: "Collision" },
        { id: "🔥", label: "Fire" },
        { id: "🌪️", label: "Tornado" },
        { id: "🌈", label: "Rainbow" },
        { id: "☀️", label: "Sun" },
        { id: "🌤️", label: "Sun Behind Small Cloud" },
        { id: "⛅", label: "Sun Behind Cloud" },
        { id: "🌥️", label: "Sun Behind Large Cloud" },
        { id: "☁️", label: "Cloud" },
        { id: "🌦️", label: "Sun Behind Rain Cloud" },
        { id: "🌧️", label: "Cloud with Rain" },
        { id: "⛈️", label: "Cloud with Lightning and Rain" },
        { id: "🌩️", label: "Cloud with Lightning" },
        { id: "🌨️", label: "Cloud with Snow" },
        { id: "❄️", label: "Snowflake" },
        { id: "☃️", label: "Snowman" },
        { id: "⛄", label: "Snowman Without Snow" },
        { id: "🌬️", label: "Wind Face" },
        { id: "💨", label: "Dashing Away" },
        { id: "💧", label: "Droplet" },
        { id: "💦", label: "Sweat Droplets" },
        { id: "🌊", label: "Water Wave" },
        { id: "🌫️", label: "Fog" },
      ]
    },
    {
      category: "Places",
      icon: "location-outline",
      items: [
        { id: "🏠", label: "House" },
        { id: "🏡", label: "House with Garden" },
        { id: "🏢", label: "Office Building" },
        { id: "🏣", label: "Japanese Post Office" },
        { id: "🏤", label: "Post Office" },
        { id: "🏥", label: "Hospital" },
        { id: "🏦", label: "Bank" },
        { id: "🏨", label: "Hotel" },
        { id: "🏩", label: "Love Hotel" },
        { id: "🏪", label: "Convenience Store" },
        { id: "🏫", label: "School" },
        { id: "🏬", label: "Department Store" },
        { id: "🏭", label: "Factory" },
        { id: "🏮", label: "Izakaya Lantern" },
        { id: "🏯", label: "Japanese Castle" },
        { id: "🏰", label: "Castle" },
        { id: "💒", label: "Wedding" },
        { id: "🗼", label: "Tokyo Tower" },
        { id: "🗽", label: "Statue of Liberty" },
        { id: "⛪", label: "Church" },
        { id: "🕌", label: "Mosque" },
        { id: "🛕", label: "Hindu Temple" },
        { id: "🕍", label: "Synagogue" },
        { id: "⛩️", label: "Shinto Shrine" },
        { id: "🕋", label: "Kaaba" },
        { id: "⛲", label: "Fountain" },
        { id: "⛺", label: "Tent" },
        { id: "🌁", label: "Foggy" },
        { id: "🌃", label: "Night with Stars" },
        { id: "🏙️", label: "Cityscape" },
        { id: "🌄", label: "Sunrise over Mountains" },
        { id: "🌅", label: "Sunrise" },
        { id: "🌆", label: "Cityscape at Dusk" },
        { id: "🌇", label: "Sunset" },
        { id: "🌉", label: "Bridge at Night" },
        { id: "🎠", label: "Ferris Wheel" },
        { id: "🎡", label: "Carousel Horse" },
        { id: "🎢", label: "Roller Coaster" },
        { id: "🚂", label: "Locomotive" },
      ]
    },
    {
      category: "Transport",
      icon: "vehicles",
      items: [
        { id: "🚗", label: "Car" },
        { id: "🚕", label: "Taxi" },
        { id: "🚙", label: "Blue Car" },
        { id: "🚌", label: "Bus" },
        { id: "🚎", label: "Trolleybus" },
        { id: "🏎️", label: "Racing Car" },
        { id: "🚓", label: "Police Car" },
        { id: "🚑", label: "Ambulance" },
        { id: "🚒", label: "Fire Engine" },
        { id: "🚐", label: "Minibus" },
        { id: "🛻", label: "Pickup Truck" },
        { id: "🚚", label: "Delivery Truck" },
        { id: "🚛", label: "Articulated Lorry" },
        { id: "🚜", label: "Tractor" },
        { id: "🛵", label: "Motor Scooter" },
        { id: "🚲", label: "Bicycle" },
        { id: "🛴", label: "Kick Scooter" },
        { id: "🚂", label: "Locomotive" },
        { id: "🚆", label: "Train" },
        { id: "🚅", label: "High-Speed Train" },
        { id: "🚇", label: "Metro" },
        { id: "🚋", label: "Tram" },
        { id: "✈️", label: "Airplane" },
        { id: "🛩️", label: "Small Airplane" },
        { id: "🚁", label: "Helicopter" },
        { id: "🚀", label: "Rocket" },
        { id: "🛸", label: "Flying Saucer" },
        { id: "🚢", label: "Ship" },
        { id: "🛳️", label: "Passenger Ship" },
        { id: "⛴️", label: "Ferry" },
        { id: "🚤", label: "Speedboat" },
        { id: "⛵", label: "Sailboat" },
        { id: "🛶", label: "Canoe" },
      ]
    },
    {
      category: "Classroom",
      icon: "classroom-objects",
      items: [
        { id: "✏️", label: "Pencil" },
        { id: "📖", label: "Book" },
        { id: "🧮", label: "Abacus" },
        { id: "💻", label: "Laptop" },
        { id: "🎒", label: "Backpack" },
        { id: "📏", label: "Ruler" },
        { id: "📐", label: "Triangular Ruler" },
        { id: "📌", label: "Pushpin" },
        { id: "📍", label: "Round Pushpin" },
        { id: "📎", label: "Paperclip" },
        { id: "✂️", label: "Scissors" },
        { id: "📁", label: "File Folder" },
        { id: "📂", label: "Open File Folder" },
        { id: "🗓️", label: "Spiral Calendar" },
        { id: "📅", label: "Calendar" },
        { id: "🗑️", label: "Wastebasket" },
      ]
    },
    {
      category: "People & Jobs",
      icon: "family",
      items: [
        { id: "👶", label: "Baby" },
        { id: "👧", label: "Girl" },
        { id: "👦", label: "Boy" },
        { id: "👩", label: "Woman" },
        { id: "👨", label: "Man" },
        { id: "👵", label: "Old Woman" },
        { id: "👴", label: "Old Man" },
        { id: "👨‍👩‍👧", label: "Family" },
        { id: "👮", label: "Police Officer" },
        { id: "👷", label: "Construction Worker" },
        { id: "💂", label: "Guard" },
        { id: "🕵️", label: "Detective" },
        { id: "🧑‍⚕️", label: "Health Worker" },
        { id: "🧑‍🌾", label: "Farmer" },
        { id: "🧑‍🍳", label: "Cook" },
        { id: "🧑‍🎓", label: "Student" },
        { id: "🧑‍🎤", label: "Singer" },
        { id: "🧑‍🏫", label: "Teacher" },
        { id: "🧑‍🏭", label: "Factory Worker" },
        { id: "🧑‍💻", label: "Technologist" },
        { id: "🧑‍💼", label: "Office Worker" },
        { id: "🧑‍🔧", label: "Mechanic" },
        { id: "🧑‍🔬", label: "Scientist" },
        { id: "🧑‍🎨", label: "Artist" },
        { id: "🧑‍🚒", label: "Firefighter" },
        { id: "🧑‍✈️", label: "Pilot" },
        { id: "🧑‍🚀", label: "Astronaut" },
        { id: "🧑‍⚖️", label: "Judge" },
        { id: "👰", label: "Bride" },
        { id: "🤵", label: "Groom" },
        { id: "🤴", label: "Prince" },
        { id: "👸", label: "Princess" },
        { id: "Superhero", label: "🦸" },
        { id: "Mage", label: "🧙" },
        { id: "Elf", label: "🧝" },
      ]
    }
  ];

  const allTypes = preschoolCategories.flatMap(c => c.items);
  const currentType = allTypes.find(t => t.id === q.type);

  const showOptions = q.type && !["simple_addition", "fill_missing"].includes(q.type);

  const showVisualSelector = [
    "count_objects", "identify_object", "odd_one_out", "identify_shape", "classification", "simple_addition", "beginning_letter", "true_false", "ordering", "identify_letter", "match_case"
  ].includes(q.type || "");

  if (!q.type) {
    return (
      <Animatable.View animation="fadeIn" duration={400}>
        <Text style={styles.inputLabel}>Select Activity Type</Text>
        {preschoolCategories.map((cat, cIdx) => (
          <View key={cIdx} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.primary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{cat.title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {cat.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    const update: any = { type: item.id };
                    update.options = item.id === 'true_false' ? ["Yes", "No"] : ["", ""];
                    updatePreschoolQuestion(qIndex, update);
                  }}
                  style={{
                    width: '47%',
                    backgroundColor: '#fff',
                    padding: 15,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    gap: 8,
                    ...SHADOWS.small
                  }}
                >
                  <View style={{ padding: 10, backgroundColor: COLORS.secondary + '10', borderRadius: 12 }}>
                    <SVGIcon name={item.icon} size={24} color={COLORS.secondary} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E293B', textAlign: 'center' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </Animatable.View>
    );
  }

  return (
    <Animatable.View animation="fadeIn" duration={400}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: COLORS.secondary + '15',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.secondary + '30'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SVGIcon name={currentType?.icon || 'star'} size={20} color={COLORS.secondary} />
          <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.secondary }}>{currentType?.label}</Text>
        </View>
        <TouchableOpacity onPress={() => updatePreschoolQuestion(qIndex, { type: undefined, visualGroup: [] })}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary }}>Change Activity</Text>
        </TouchableOpacity>
      </View>

      {showVisualSelector && (
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
             <Text style={styles.inputLabel}>Learning Materials (Select specific items for the task)</Text>
             {!isLibraryVisible && (
                <TouchableOpacity
                  onPress={() => {
                    setIsLibraryVisible(true);
                    setEmojiTarget({ type: 'visualGroup' });
                  }}
                  style={{ backgroundColor: COLORS.secondary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.secondary }}>+ Add Materials</Text>
                </TouchableOpacity>
             )}
          </View>

          {/* Visual Canvas Editor */}
          <View style={{
            gap: 12,
            marginBottom: 15,
            padding: 15,
            backgroundColor: '#F1F5F9',
            borderRadius: 18,
            minHeight: 100,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}>
            <View style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 15,
              minHeight: 80,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              borderStyle: 'dashed'
            }}>
              {(!q.visualGroup || q.visualGroup.length === 0) && (
                <Text style={{ color: '#94A3B8', fontSize: 12, fontStyle: 'italic', flex: 1, textAlign: 'center' }}>
                  Canvas is empty. Add learning materials or text below to build your question.
                </Text>
              )}
              {q.visualGroup?.map((item: any, idx: number) => (
                <React.Fragment key={idx}>
                  {item.isNewLine && <View style={{ width: '100%', height: 0 }} />}
                  <TouchableOpacity
                    onPress={() => {/* Selection logic could go here */}}
                    style={{
                      padding: 6,
                      borderRadius: 10,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: COLORS.secondary + '20',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {item.type === 'icon' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {[...Array(item.count || 1)].map((_, i) => (
                          <SVGIcon key={i} name={item.value} size={item.size === 'large' ? 32 : item.size === 'small' ? 18 : 24} />
                        ))}
                      </View>
                    ) : item.type === 'fraction' ? (
                      <View style={{ alignItems: 'center', minWidth: 20 }}>
                        <Text style={{ fontSize: 12 }}>{item.numerator?.map((n: any) => n.value).join('') || 'n'}</Text>
                        <View style={{ height: 1, backgroundColor: '#000', width: '100%' }} />
                        <Text style={{ fontSize: 12 }}>{item.denominator?.map((d: any) => d.value).join('') || 'd'}</Text>
                      </View>
                    ) : item.type === 'sqrt' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <SVGIcon name="sqrt" size={20} />
                        <View style={{ borderTopWidth: 1, borderTopColor: '#000', paddingTop: 2 }}>
                          <Text style={{ fontSize: 14 }}>{item.content?.map((c: any) => c.value).join('') || 'x'}</Text>
                        </View>
                      </View>
                    ) : item.type === 'bracket' ? (
                      <Text style={{ fontSize: 18, fontWeight: '800' }}>
                        {item.bracketType === 'round' ? '(' : item.bracketType === 'square' ? '[' : '{'}
                        {item.content?.map((c: any) => c.value).join('') || 'x'}
                        {item.bracketType === 'round' ? ')' : item.bracketType === 'square' ? ']' : '}'}
                      </Text>
                    ) : item.type === 'superscript' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 18, fontWeight: '800' }}>x</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', marginTop: -4 }}>{item.value || '2'}</Text>
                      </View>
                    ) : item.type === 'subscript' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 18, fontWeight: '800' }}>x</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', marginBottom: -2 }}>{item.value || '2'}</Text>
                      </View>
                    ) : (
                      <Text style={{
                        fontSize: item.size === 'large' ? 24 : item.size === 'small' ? 14 : 18,
                        fontWeight: '800',
                        color: '#1E293B'
                      }}>{item.value}</Text>
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>

            {/* List Management */}
            <View style={{ gap: 8 }}>
              <ScrollView
                nestedScrollEnabled={true}
                style={[
                  { gap: 8 },
                  (q.visualGroup?.length || 0) > 3 && { maxHeight: 200 }
                ]}
              >
                {q.visualGroup?.map((item: any, idx: number) => (
                  <View key={idx} style={{
                    backgroundColor: '#fff',
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.secondary + '15',
                    ...SHADOWS.small,
                    marginBottom: 8
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{idx + 1}</Text>
                        </View>

                        {item.type === 'icon' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <SVGIcon name={item.value} size={20} />
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 4 }}>
                                <TouchableOpacity onPress={() => {
                                  const newGroup = [...q.visualGroup];
                                  if (newGroup[idx].count > 1) {
                                    newGroup[idx].count -= 1;
                                    updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                  }
                                }} style={{ padding: 4 }}><Text style={{ fontWeight: '900' }}>-</Text></TouchableOpacity>
                                <Text style={{ fontSize: 12, fontWeight: '900', minWidth: 20, textAlign: 'center' }}>{item.count}</Text>
                                <TouchableOpacity onPress={() => {
                                  const newGroup = [...q.visualGroup];
                                  newGroup[idx].count = (newGroup[idx].count || 1) + 1;
                                  updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                }} style={{ padding: 4 }}><Text style={{ fontWeight: '900' }}>+</Text></TouchableOpacity>
                              </View>
                          </View>
                        ) : ['fraction', 'sqrt', 'bracket', 'superscript', 'subscript'].includes(item.type) ? (
                          <View style={{ flex: 1, gap: 5 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.secondary }}>{item.type.toUpperCase()}</Text>
                            {item.type === 'fraction' && (
                              <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                                <TextInput
                                  style={{ fontSize: 12, fontWeight: '700', backgroundColor: '#F8FAFC', padding: 4, borderRadius: 4, flex: 1 }}
                                  value={item.numerator?.[0]?.value}
                                  placeholder="Num"
                                  onChangeText={(t) => {
                                    const newGroup = [...q.visualGroup];
                                    newGroup[idx].numerator = [{ ...newGroup[idx].numerator[0], value: t }];
                                    updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                  }}
                                />
                                <Text>/</Text>
                                <TextInput
                                  style={{ fontSize: 12, fontWeight: '700', backgroundColor: '#F8FAFC', padding: 4, borderRadius: 4, flex: 1 }}
                                  value={item.denominator?.[0]?.value}
                                  placeholder="Den"
                                  onChangeText={(t) => {
                                    const newGroup = [...q.visualGroup];
                                    newGroup[idx].denominator = [{ ...newGroup[idx].denominator[0], value: t }];
                                    updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                  }}
                                />
                              </View>
                            )}
                            {item.type === 'sqrt' && (
                              <TextInput
                                style={{ fontSize: 12, fontWeight: '700', backgroundColor: '#F8FAFC', padding: 4, borderRadius: 4, flex: 1 }}
                                value={item.content?.[0]?.value}
                                placeholder="Content"
                                onChangeText={(t) => {
                                  const newGroup = [...q.visualGroup];
                                  newGroup[idx].content = [{ ...newGroup[idx].content[0], value: t }];
                                  updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                }}
                              />
                            )}
                            {item.type === 'bracket' && (
                              <TextInput
                                style={{ fontSize: 12, fontWeight: '700', backgroundColor: '#F8FAFC', padding: 4, borderRadius: 4, flex: 1 }}
                                value={item.content?.[0]?.value}
                                placeholder="Inside brackets"
                                onChangeText={(t) => {
                                  const newGroup = [...q.visualGroup];
                                  newGroup[idx].content = [{ ...newGroup[idx].content[0], value: t }];
                                  updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                }}
                              />
                            )}
                            {(item.type === 'superscript' || item.type === 'subscript') && (
                              <TextInput
                                style={{ fontSize: 12, fontWeight: '700', backgroundColor: '#F8FAFC', padding: 4, borderRadius: 4, flex: 1 }}
                                value={item.value}
                                placeholder={item.type === 'superscript' ? "Power" : "Index"}
                                onChangeText={(t) => {
                                  const newGroup = [...q.visualGroup];
                                  newGroup[idx].value = t;
                                  updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                }}
                              />
                            )}
                          </View>
                        ) : (
                          <TextInput
                            style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1, backgroundColor: '#F8FAFC', padding: 5, borderRadius: 6 }}
                            value={item.value}
                            onChangeText={(t) => {
                              const newGroup = [...q.visualGroup];
                              newGroup[idx].value = t;
                              updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                            }}
                          />
                        )}

                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {['S', 'M', 'L'].map((s, i) => {
                            const szMap = ['small', 'medium', 'large'];
                            return (
                              <TouchableOpacity
                                key={s}
                                onPress={() => {
                                  const newGroup = [...q.visualGroup];
                                  newGroup[idx].size = szMap[i] as any;
                                  updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                                }}
                                style={{
                                  width: 24, height: 24, borderRadius: 6,
                                  backgroundColor: item.size === szMap[i] || (!item.size && i === 1) ? COLORS.secondary : '#F1F5F9',
                                  alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '900', color: item.size === szMap[i] || (!item.size && i === 1) ? '#fff' : '#64748B' }}>{s}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].isNewLine = !newGroup[idx].isNewLine;
                            updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                          }}
                          style={{ padding: 6, backgroundColor: item.isNewLine ? COLORS.primary + '20' : '#F1F5F9', borderRadius: 8, width: 32, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <SVGIcon name="return-down-back" size={16} color={item.isNewLine ? COLORS.primary : '#64748B'} />
                        </TouchableOpacity>

                        <View style={{ gap: 2 }}>
                          {idx > 0 && (
                            <TouchableOpacity onPress={() => {
                              const newGroup = [...q.visualGroup];
                              [newGroup[idx], newGroup[idx-1]] = [newGroup[idx-1], newGroup[idx]];
                              updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                            }}><SVGIcon name="chevron-up" size={14} color={COLORS.secondary} /></TouchableOpacity>
                          )}
                          {idx < q.visualGroup.length - 1 && (
                            <TouchableOpacity onPress={() => {
                              const newGroup = [...q.visualGroup];
                              [newGroup[idx], newGroup[idx+1]] = [newGroup[idx+1], newGroup[idx]];
                              updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                            }}><SVGIcon name="chevron-down" size={14} color={COLORS.secondary} /></TouchableOpacity>
                          )}
                        </View>

                        <TouchableOpacity onPress={() => {
                          const newGroup = q.visualGroup.filter((_: any, i: number) => i !== idx);
                          updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                        }} style={{ padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8, width: 32, alignItems: 'center', justifyContent: 'center' }}>
                          <SVGIcon name="close-circle" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setIsLibraryVisible(true);
                  setEmojiTarget({ type: 'visualGroup' });
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.secondary + '15', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.secondary + '30' }}
              >
                <SVGIcon name="images" size={18} color={COLORS.secondary} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.secondary }}>Add Learning Material</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const newGroup = [...(q.visualGroup || []), { type: 'text', value: 'New Text', size: 'medium', id: Math.random().toString() }];
                  updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary + '15', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary + '30' }}
              >
                <SVGIcon name="text" size={18} color={COLORS.primary} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary }}>Add Text</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isLibraryVisible && emojiTarget.type === 'visualGroup' && (
            <Animatable.View animation="fadeInUp" duration={300} style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              overflow: 'hidden',
              ...SHADOWS.medium,
              marginTop: 10
            }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 15,
                backgroundColor: '#F8FAFC',
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0'
              }}>
                <Text style={{ fontWeight: '900', color: '#1E293B' }}>Learning Materials Library</Text>
                <TouchableOpacity onPress={() => setIsLibraryVisible(false)}>
                  <SVGIcon name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* Category Tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                {visualAssetLibrary.map((cat) => (
                  <TouchableOpacity
                    key={cat.category}
                    onPress={() => setActiveCategory(cat.category)}
                    style={[
                      styles.smallBubble,
                      { marginRight: 8, paddingHorizontal: 12 },
                      activeCategory === cat.category && { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary }
                    ]}
                  >
                    <SVGIcon name={cat.icon} size={14} color={activeCategory === cat.category ? "#FFF" : COLORS.secondary} />
                    <Text style={[styles.smallBubbleText, activeCategory === cat.category && { color: "#FFF" }]}>{cat.category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Materials Library for Active Category */}
              <ScrollView
                style={{ maxHeight: 350 }}
                contentContainerStyle={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-start',
                  gap: 10,
                  padding: 15,
                  paddingBottom: 40
                }}
              >
                {visualAssetLibrary.find(c => c.category === activeCategory)?.items.map((item: any, idx) => {
                  const iconName = item.id.split('_')[0];

                  return (
                    <TouchableOpacity
                      key={`${item.id}_${idx}`}
                      onPress={() => {
                        const iconName = item.id.split('_')[0];
                        const newGroup = [...(q.visualGroup || []), {
                          type: item.type || (item.id.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/) ? 'icon' : 'text'),
                          value: iconName,
                          count: 1,
                          size: 'medium',
                          id: Math.random().toString(),
                          bracketType: item.bracketType,
                          numerator: item.type === 'fraction' ? [{ id: Math.random().toString(), type: 'text', value: '1' }] : undefined,
                          denominator: item.type === 'fraction' ? [{ id: Math.random().toString(), type: 'text', value: '2' }] : undefined,
                          content: item.type === 'sqrt' ? [{ id: Math.random().toString(), type: 'text', value: 'x' }] : undefined,
                        }];
                        updatePreschoolQuestion(qIndex, { visualGroup: newGroup });
                      }}
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        borderRadius: 12,
                        backgroundColor: '#F8FAFC',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        width: '30%',
                        marginBottom: 5
                      }}
                    >
                      <View>
                        <SVGIcon name={iconName} size={32} />
                      </View>
                      <Text style={{ fontSize: 10, marginTop: 4, color: "#475569", fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animatable.View>
          )}
        </View>
      )}

      <Text style={styles.inputLabel}>Instructions / Task Description</Text>
      <TextInput
        style={styles.input}
        placeholder={currentType?.hint || "Type instructions for the child..."}
        value={q.text}
        onChangeText={(t) => updatePreschoolQuestion(qIndex, { text: t })}
      />

      {showOptions && (
        <View style={styles.optionsContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.inputLabel}>Options (Choices for the child)</Text>
          </View>
          {q.options?.map((opt: string, oIndex: number) => (
            <View key={oIndex} style={styles.optionRow}>
              <TextInput
                style={styles.optionInput}
                placeholder={`Option ${oIndex + 1}`}
                value={opt}
                onChangeText={(text) => {
                  const newOptions = [...(q.options || [])];
                  newOptions[oIndex] = text;
                  updatePreschoolQuestion(qIndex, { options: newOptions });
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  setEmojiTarget({ type: 'option', index: oIndex });
                  setIsLibraryVisible(true);
                  setActiveCategory("Shapes");
                }}
                style={{ padding: 5, backgroundColor: COLORS.secondary + '15', borderRadius: 8, marginRight: 5 }}
              >
                <SVGIcon name={opt && opt.length > 0 && opt.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/) ? opt : "images"} size={20} color={COLORS.secondary} />
              </TouchableOpacity>
              {q.options.length > 2 && (
                <TouchableOpacity onPress={() => {
                   const newOptions = q.options.filter((_: any, idx: number) => idx !== oIndex);
                   updatePreschoolQuestion(qIndex, { options: newOptions });
                }}>
                  <SVGIcon name="close-circle" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {q.type !== 'true_false' && (
            <TouchableOpacity
              onPress={() => {
                const newOptions = [...(q.options || []), ""];
                updatePreschoolQuestion(qIndex, { options: newOptions });
              }}
              style={styles.addOptionBtn}
            >
              <Text style={styles.addOptionText}>+ Add Another Choice</Text>
            </TouchableOpacity>
          )}
        </View>
      )}


      {isLibraryVisible && emojiTarget.type === 'option' && (
        <Animatable.View animation="fadeInUp" duration={300} style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          overflow: 'hidden',
          ...SHADOWS.medium,
          marginTop: 20,
          marginBottom: 20
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 15,
            backgroundColor: '#F8FAFC',
            borderBottomWidth: 1,
            borderBottomColor: '#E2E8F0'
          }}>
            <Text style={{ fontWeight: '900', color: '#1E293B' }}>Select Learning Material for Option {emojiTarget.index! + 1}</Text>
            <TouchableOpacity onPress={() => setIsLibraryVisible(false)}>
              <SVGIcon name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
            {visualAssetLibrary.map((cat) => (
              <TouchableOpacity
                key={cat.category}
                onPress={() => setActiveCategory(cat.category)}
                style={[
                  styles.smallBubble,
                  { marginRight: 8, paddingHorizontal: 12 },
                  activeCategory === cat.category && { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary }
                ]}
              >
                <SVGIcon name={cat.icon} size={14} color={activeCategory === cat.category ? "#FFF" : COLORS.secondary} />
                <Text style={[styles.smallBubbleText, activeCategory === cat.category && { color: "#FFF" }]}>{cat.category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={{ maxHeight: 350 }}
            contentContainerStyle={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              gap: 10,
              padding: 15,
              paddingBottom: 40
            }}
          >
            {visualAssetLibrary.find(c => c.category === activeCategory)?.items.map((item, idx) => {
              const iconName = item.id.split('_')[0];
              return (
                <TouchableOpacity
                  key={`${item.id}_${idx}`}
                  onPress={() => {
                    const newOptions = [...(q.options || [])];
                    newOptions[emojiTarget.index!] = iconName;
                    updatePreschoolQuestion(qIndex, { options: newOptions });
                    setIsLibraryVisible(false);
                  }}
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 12,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    width: '30%',
                    marginBottom: 5
                  }}
                >
                  <SVGIcon name={iconName} size={32} />
                  <Text style={{ fontSize: 10, marginTop: 4, color: "#475569", fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            onPress={() => setIsLibraryVisible(false)}
            style={{
              backgroundColor: COLORS.secondary,
              padding: 12,
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: '#E2E8F0'
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>Done Selecting Materials</Text>
          </TouchableOpacity>
        </Animatable.View>
      )}
    </Animatable.View>
  );
});

export default PreschoolFields;
