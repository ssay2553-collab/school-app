export const GES_SUBJECTS = [
  "Mathematics",
  "Science",
  "Social Studies",
  "Computing",
  "RME",
  "History",
  "Career Technology",
  "Creative Arts",
  "English",
  "French",
  "Asante Twi",
  "Akuapem Twi",
  "Fante",
  "Ga",
  "Ewe",
  "Dangme",
  "Physical Education",
];

export const CAMBRIDGE_SUBJECTS = [
  "Mathematics",
  "English",
  "Science",
  "Biology",
  "Chemistry",
  "Physics",
  "Global Perspectives",
  "ICT",
  "Art & Design",
  "Geography",
  "History",
  "Economics",
  "Business Studies",
  "Literature in English",
  "French",
  "Physical Education",
];

export const MONTESSORI_SUBJECTS = [
  "Practical Life",
  "Sensorial",
  "Language",
  "Mathematics",
  "Culture",
];

export const COMMON_ACTIVITIES = [
  "Break",
  "Lunch",
  "Library",
  "Assembly",
  "Worship",
  "Club",
];

export type CurriculumType = "GES" | "Cambridge" | "Montessori";

/**
 * GES/NaCCA Class Levels with age ranges and curriculum descriptions
 */
export const CLASS_LEVELS = {
  "Basic 1": {
    ageRange: "6-7 years",
    level: "early_grade",
    description: "Lower Primary - Foundation literacy and numeracy",
  },
  "Basic 2": {
    ageRange: "7-8 years",
    level: "early_grade",
    description: "Lower Primary - Building foundational skills",
  },
  "Basic 3": {
    ageRange: "8-9 years",
    level: "early_grade",
    description: "Lower Primary - Transition to intermediate",
  },
  "Basic 4": {
    ageRange: "9-10 years",
    level: "upper_primary",
    description: "Upper Primary - Intermediate concepts",
  },
  "Basic 5": {
    ageRange: "10-11 years",
    level: "upper_primary",
    description: "Upper Primary - Advanced foundational skills",
  },
  "Basic 6": {
    ageRange: "11-12 years",
    level: "upper_primary",
    description: "Upper Primary - Preparation for JHS",
  },
  "JHS 1": {
    ageRange: "12-13 years",
    level: "jhs",
    description: "Junior High - Beginning of secondary education",
  },
  "JHS 2": {
    ageRange: "13-14 years",
    level: "jhs",
    description: "Junior High - Intermediate secondary concepts",
  },
  "JHS 3": {
    ageRange: "14-15 years",
    level: "jhs",
    description: "Junior High - BECE preparation year",
  },
  "SHS 1": {
    ageRange: "15-16 years",
    level: "shs",
    description: "Senior High - First year secondary education",
  },
  "SHS 2": {
    ageRange: "16-17 years",
    level: "shs",
    description: "Senior High - Advanced secondary concepts",
  },
  "SHS 3": {
    ageRange: "17-18 years",
    level: "shs",
    description: "Senior High - WASSCE preparation year",
  },
};

/**
 * NaCCA Learning Domains
 */
export const LEARNING_DOMAINS = [
  "Knowledge and Understanding",
  "Skills and Processes",
  "Attitudes and Values",
];

/**
 * NaCCA Core Competencies (21st Century Skills)
 */
export const CORE_COMPETENCIES = [
  "Critical Thinking and Problem Solving",
  "Creativity and Innovation",
  "Communication and Collaboration",
  "Cultural Identity and Global Citizenship",
  "Personal Development and Leadership",
  "Digital Literacy",
];

/**
 * NaCCA Content Standards and Indicators by Subject, Class Level, Strand and Sub-strand
 * Based on the official NaCCA Standard-Based Curriculum (SBC) for Ghana
 */
export const NACCA_CONTENT_STANDARDS = {
  Mathematics: {
    "Basic 1": {
      "Number Sense": {
        subStrands: {
          "Counting and Number Recognition": {
            contentStandard:
              "B1.1.1.1: Demonstrate understanding of whole numbers up to 100",
            indicators: [
              "B1.1.1.1.1: Count, read and write numbers up to 100 in numerals and words",
              "B1.1.1.1.2: Compare and order numbers up to 100",
              "B1.1.1.1.3: Identify place values of digits in numbers up to 100",
              "B1.1.1.1.4: Use concrete objects to represent numbers up to 100",
            ],
          },
          "Number Operations": {
            contentStandard:
              "B1.1.1.2: Demonstrate understanding of addition and subtraction",
            indicators: [
              "B1.1.1.2.1: Add and subtract single-digit numbers",
              "B1.1.1.2.2: Solve simple word problems involving addition and subtraction",
              "B1.1.1.2.3: Use number bonds to 10 and 20",
            ],
          },
        },
      },
      "Patterns and Algebra": {
        subStrands: {
          Patterns: {
            contentStandard:
              "B1.1.2.1: Demonstrate understanding of patterns and relationships",
            indicators: [
              "B1.1.2.1.1: Identify and extend simple repeating patterns",
              "B1.1.2.1.2: Create and describe patterns using objects and numbers",
              "B1.1.2.1.3: Recognize patterns in the environment",
            ],
          },
          "Algebraic Thinking": {
            contentStandard:
              "B1.1.2.2: Demonstrate understanding of simple relationships",
            indicators: [
              "B1.1.2.2.1: Use symbols to represent unknown quantities",
              "B1.1.2.2.2: Describe relationships using words and pictures",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          Length: {
            contentStandard: "B1.1.3.1: Demonstrate understanding of length",
            indicators: [
              "B1.1.3.1.1: Compare lengths using non-standard units",
              "B1.1.3.1.2: Estimate and measure using appropriate non-standard units",
              "B1.1.3.1.3: Order objects by length",
            ],
          },
          Mass: {
            contentStandard: "B1.1.3.2: Demonstrate understanding of mass",
            indicators: [
              "B1.1.3.2.1: Compare masses using non-standard units",
              "B1.1.3.2.2: Use balance scales to compare masses",
            ],
          },
          Capacity: {
            contentStandard: "B1.1.3.3: Demonstrate understanding of capacity",
            indicators: [
              "B1.1.3.3.1: Compare capacities using non-standard units",
              "B1.1.3.3.2: Estimate and measure capacity using containers",
            ],
          },
          Time: {
            contentStandard: "B1.1.3.4: Demonstrate understanding of time",
            indicators: [
              "B1.1.3.4.1: Tell time to the hour",
              "B1.1.3.4.2: Sequence events using days of the week",
              "B1.1.3.4.3: Understand the concept of yesterday, today and tomorrow",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "2-D Shapes": {
            contentStandard:
              "B1.1.4.1: Demonstrate understanding of 2-D shapes",
            indicators: [
              "B1.1.4.1.1: Identify and name common 2-D shapes (circle, square, rectangle, triangle)",
              "B1.1.4.1.2: Sort and classify 2-D shapes by their properties",
              "B1.1.4.1.3: Draw 2-D shapes",
            ],
          },
          "3-D Objects": {
            contentStandard:
              "B1.1.4.2: Demonstrate understanding of 3-D objects",
            indicators: [
              "B1.1.4.2.1: Identify and name common 3-D objects (cube, cuboid, sphere, cylinder)",
              "B1.1.4.2.2: Sort and classify 3-D objects by their properties",
              "B1.1.4.2.3: Relate 3-D objects to real-life objects",
            ],
          },
        },
      },
      "Data Handling": {
        subStrands: {
          "Data Collection": {
            contentStandard:
              "B1.1.5.1: Demonstrate understanding of data collection",
            indicators: [
              "B1.1.5.1.1: Collect and organize data using simple tables",
              "B1.1.5.1.2: Use tally marks to record data",
            ],
          },
          "Data Representation": {
            contentStandard:
              "B1.1.5.2: Demonstrate understanding of data representation",
            indicators: [
              "B1.1.5.2.1: Interpret simple pictographs",
              "B1.1.5.2.2: Answer questions based on pictographs",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Number Sense": {
        subStrands: {
          "Whole Numbers": {
            contentStandard:
              "B2.1.1.1: Demonstrate understanding of whole numbers up to 1000",
            indicators: [
              "B2.1.1.1.1: Count, read and write numbers up to 1000 in numerals and words",
              "B2.1.1.1.2: Compare and order numbers up to 1000",
              "B2.1.1.1.3: Identify place values of digits in numbers up to 1000",
              "B2.1.1.1.4: Round numbers to the nearest 10 and 100",
            ],
          },
          Operations: {
            contentStandard:
              "B2.1.1.2: Demonstrate understanding of the four operations",
            indicators: [
              "B2.1.1.2.1: Add and subtract 2-digit numbers with and without regrouping",
              "B2.1.1.2.2: Multiply using repeated addition",
              "B2.1.1.2.3: Divide using sharing and grouping",
              "B2.1.1.2.4: Solve word problems involving the four operations",
            ],
          },
          Fractions: {
            contentStandard: "B2.1.1.3: Demonstrate understanding of fractions",
            indicators: [
              "B2.1.1.3.1: Identify and name fractions (halves, thirds, quarters)",
              "B2.1.1.3.2: Compare fractions with the same denominator",
              "B2.1.1.3.3: Represent fractions using concrete objects and diagrams",
            ],
          },
        },
      },
      "Patterns and Algebra": {
        subStrands: {
          Patterns: {
            contentStandard:
              "B2.1.2.1: Demonstrate understanding of patterns and simple equations",
            indicators: [
              "B2.1.2.1.1: Identify and extend number patterns",
              "B2.1.2.1.2: Create patterns using numbers and shapes",
              "B2.1.2.1.3: Describe rules for patterns",
            ],
          },
          "Algebraic Thinking": {
            contentStandard:
              "B2.1.2.2: Demonstrate understanding of simple equations",
            indicators: [
              "B2.1.2.2.1: Solve simple missing number problems",
              "B2.1.2.2.2: Use boxes or symbols to represent unknown numbers",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          Length: {
            contentStandard: "B2.1.3.1: Demonstrate understanding of length",
            indicators: [
              "B2.1.3.1.1: Measure and compare using standard units (cm, m)",
              "B2.1.3.1.2: Estimate lengths in cm and m",
              "B2.1.3.1.3: Convert between cm and m",
            ],
          },
          Mass: {
            contentStandard: "B2.1.3.2: Demonstrate understanding of mass",
            indicators: [
              "B2.1.3.2.1: Measure and compare using standard units (g, kg)",
              "B2.1.3.2.2: Estimate masses in g and kg",
            ],
          },
          Capacity: {
            contentStandard: "B2.1.3.3: Demonstrate understanding of capacity",
            indicators: [
              "B2.1.3.3.1: Measure and compare using standard units (ml, l)",
              "B2.1.3.3.2: Estimate capacities in ml and l",
            ],
          },
          Time: {
            contentStandard: "B2.1.3.4: Demonstrate understanding of time",
            indicators: [
              "B2.1.3.4.1: Tell time to the half hour",
              "B2.1.3.4.2: Read and use calendars",
              "B2.1.3.4.3: Solve problems involving time",
            ],
          },
          Money: {
            contentStandard: "B2.1.3.5: Demonstrate understanding of money",
            indicators: [
              "B2.1.3.5.1: Identify Ghanaian coins and notes",
              "B2.1.3.5.2: Add and subtract amounts of money",
              "B2.1.3.5.3: Solve simple problems involving money",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "2-D Shapes": {
            contentStandard:
              "B2.1.4.1: Demonstrate understanding of 2-D shapes",
            indicators: [
              "B2.1.4.1.1: Describe properties of 2-D shapes (sides and corners)",
              "B2.1.4.1.2: Draw and construct 2-D shapes",
              "B2.1.4.1.3: Identify lines of symmetry in shapes",
            ],
          },
          "3-D Objects": {
            contentStandard:
              "B2.1.4.2: Demonstrate understanding of 3-D objects",
            indicators: [
              "B2.1.4.2.1: Describe properties of 3-D objects (faces, edges, vertices)",
              "B2.1.4.2.2: Make models of 3-D objects",
            ],
          },
        },
      },
      "Data Handling": {
        subStrands: {
          "Data Representation": {
            contentStandard:
              "B2.1.5.1: Demonstrate understanding of data representation",
            indicators: [
              "B2.1.5.1.1: Construct and interpret simple bar graphs",
              "B2.1.5.1.2: Solve simple problems using data from graphs",
              "B2.1.5.1.3: Collect and organize data in frequency tables",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Number Sense": {
        subStrands: {
          "Whole Numbers": {
            contentStandard:
              "B3.1.1.1: Demonstrate understanding of whole numbers up to 10,000",
            indicators: [
              "B3.1.1.1.1: Count, read and write numbers up to 10,000",
              "B3.1.1.1.2: Round numbers to the nearest 10, 100, or 1000",
              "B3.1.1.1.3: Identify factors and multiples of numbers",
              "B3.1.1.1.4: Distinguish between odd and even numbers",
            ],
          },
          Operations: {
            contentStandard:
              "B3.1.1.2: Demonstrate mastery of the four operations",
            indicators: [
              "B3.1.1.2.1: Add and subtract numbers up to 4 digits",
              "B3.1.1.2.2: Multiply 2-digit by 2-digit numbers",
              "B3.1.1.2.3: Divide 3-digit by 1-digit numbers",
              "B3.1.1.2.4: Solve multi-step word problems",
            ],
          },
          Fractions: {
            contentStandard: "B3.1.1.3: Demonstrate understanding of fractions",
            indicators: [
              "B3.1.1.3.1: Compare and order fractions with different denominators",
              "B3.1.1.3.2: Add and subtract fractions with the same denominator",
              "B3.1.1.3.3: Convert between mixed numbers and improper fractions",
            ],
          },
          Decimals: {
            contentStandard: "B3.1.1.4: Demonstrate understanding of decimals",
            indicators: [
              "B3.1.1.4.1: Read and write decimals to 2 decimal places",
              "B3.1.1.4.2: Relate decimals to fractions and money",
              "B3.1.1.4.3: Add and subtract decimals",
            ],
          },
        },
      },
      "Patterns and Algebra": {
        subStrands: {
          Patterns: {
            contentStandard:
              "B3.1.2.1: Demonstrate understanding of patterns and algebraic expressions",
            indicators: [
              "B3.1.2.1.1: Extend and create number patterns",
              "B3.1.2.1.2: Find the rule for a number pattern",
              "B3.1.2.1.3: Use patterns to solve problems",
            ],
          },
          "Algebraic Expressions": {
            contentStandard:
              "B3.1.2.2: Demonstrate understanding of algebraic thinking",
            indicators: [
              "B3.1.2.2.1: Use symbols to represent unknown numbers",
              "B3.1.2.2.2: Write simple algebraic expressions",
              "B3.1.2.2.3: Solve simple equations",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          "Length, Mass and Capacity": {
            contentStandard:
              "B3.1.3.1: Demonstrate understanding of measurement concepts",
            indicators: [
              "B3.1.3.1.1: Convert between units of length, mass and capacity",
              "B3.1.3.1.2: Calculate perimeter and area of rectangles",
              "B3.1.3.1.3: Solve problems involving measurement",
            ],
          },
          Time: {
            contentStandard: "B3.1.3.2: Demonstrate understanding of time",
            indicators: [
              "B3.1.3.2.1: Tell time to the minute",
              "B3.1.3.2.2: Calculate time intervals",
              "B3.1.3.2.3: Use timetables and schedules",
            ],
          },
          Money: {
            contentStandard: "B3.1.3.3: Demonstrate understanding of money",
            indicators: [
              "B3.1.3.3.1: Solve problems involving money and change",
              "B3.1.3.3.2: Calculate simple discounts",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          Angles: {
            contentStandard:
              "B3.1.4.1: Demonstrate understanding of angles and symmetry",
            indicators: [
              "B3.1.4.1.1: Identify and draw right angles",
              "B3.1.4.1.2: Identify lines of symmetry in shapes",
              "B3.1.4.1.3: Recognize angles in the environment",
            ],
          },
          Transformations: {
            contentStandard:
              "B3.1.4.2: Demonstrate understanding of transformations",
            indicators: [
              "B3.1.4.2.1: Perform simple translations and reflections",
              "B3.1.4.2.2: Identify symmetrical shapes",
            ],
          },
        },
      },
      "Data Handling": {
        subStrands: {
          "Data Analysis": {
            contentStandard:
              "B3.1.5.1: Demonstrate understanding of data analysis",
            indicators: [
              "B3.1.5.1.1: Construct and interpret bar graphs and pie charts",
              "B3.1.5.1.2: Calculate mode of simple data sets",
              "B3.1.5.1.3: Draw conclusions from data",
            ],
          },
          Probability: {
            contentStandard:
              "B3.1.5.2: Demonstrate understanding of probability",
            indicators: [
              "B3.1.5.2.1: Describe likelihood using words (certain, likely, unlikely, impossible)",
              "B3.1.5.2.2: Conduct simple probability experiments",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Number and Numeration": {
        subStrands: {
          "Whole Numbers": {
            contentStandard:
              "B4.1.1.1: Demonstrate understanding of numbers up to 1,000,000",
            indicators: [
              "B4.1.1.1.1: Read, write and order numbers up to 1,000,000",
              "B4.1.1.1.2: Round numbers to any given place value",
              "B4.1.1.1.3: Identify place values up to millions",
            ],
          },
          "Fractions and Decimals": {
            contentStandard:
              "B4.1.1.2: Demonstrate understanding of fractions and decimals",
            indicators: [
              "B4.1.1.2.1: Compare and order fractions",
              "B4.1.1.2.2: Convert between fractions and decimals",
              "B4.1.1.2.3: Add and subtract fractions with unlike denominators",
            ],
          },
        },
      },
      Operations: {
        subStrands: {
          "Four Operations": {
            contentStandard:
              "B4.1.2.1: Demonstrate understanding of the four operations",
            indicators: [
              "B4.1.2.1.1: Multiply 3-digit numbers by 2-digit numbers",
              "B4.1.2.1.2: Divide up to 4-digit numbers by 2-digit numbers",
              "B4.1.2.1.3: Apply order of operations (BODMAS)",
            ],
          },
          "Problem Solving": {
            contentStandard: "B4.1.2.2: Demonstrate ability to solve problems",
            indicators: [
              "B4.1.2.2.1: Solve multi-step word problems",
              "B4.1.2.2.2: Use estimation to check answers",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          "Length, Mass, Capacity": {
            contentStandard:
              "B4.1.3.1: Demonstrate understanding of measurement",
            indicators: [
              "B4.1.3.1.1: Calculate area and perimeter of composite shapes",
              "B4.1.3.1.2: Convert between metric units",
              "B4.1.3.1.3: Solve problems involving measurement",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "Shapes and Angles": {
            contentStandard:
              "B4.1.4.1: Demonstrate understanding of geometric concepts",
            indicators: [
              "B4.1.4.1.1: Identify and draw different types of triangles and quadrilaterals",
              "B4.1.4.1.2: Understand and use properties of angles",
              "B4.1.4.1.3: Construct angles using a protractor",
            ],
          },
        },
      },
      "Patterns and Algebra": {
        subStrands: {
          "Patterns and Sequences": {
            contentStandard:
              "B4.1.5.1: Demonstrate understanding of patterns and algebra",
            indicators: [
              "B4.1.5.1.1: Generate and describe number patterns",
              "B4.1.5.1.2: Use letters to represent numbers in simple expressions",
              "B4.1.5.1.3: Find the nth term of a sequence",
            ],
          },
        },
      },
      "Data Handling": {
        subStrands: {
          "Data Representation": {
            contentStandard:
              "B4.1.6.1: Demonstrate understanding of data handling",
            indicators: [
              "B4.1.6.1.1: Construct and interpret line graphs",
              "B4.1.6.1.2: Calculate mean, median and mode",
              "B4.1.6.1.3: Interpret data from tables and charts",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Number and Numeration": {
        subStrands: {
          "Large Numbers and Integers": {
            contentStandard:
              "B5.1.1.1: Demonstrate understanding of large numbers and integers",
            indicators: [
              "B5.1.1.1.1: Work with numbers beyond 1,000,000",
              "B5.1.1.1.2: Understand and use negative numbers",
              "B5.1.1.1.3: Use number lines to represent integers",
            ],
          },
          "Fractions, Decimals and Percentages": {
            contentStandard:
              "B5.1.1.2: Demonstrate understanding of fractions, decimals and percentages",
            indicators: [
              "B5.1.1.2.1: Multiply and divide fractions",
              "B5.1.1.2.2: Convert between fractions, decimals and percentages",
              "B5.1.1.2.3: Solve problems involving percentages",
            ],
          },
        },
      },
      Operations: {
        subStrands: {
          "Mastery of Operations": {
            contentStandard: "B5.1.2.1: Demonstrate mastery of operations",
            indicators: [
              "B5.1.2.1.1: Solve multi-step word problems",
              "B5.1.2.1.2: Apply order of operations (BODMAS)",
              "B5.1.2.1.3: Use mental math strategies",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          "Volume and Capacity": {
            contentStandard:
              "B5.1.3.1: Demonstrate understanding of volume and capacity",
            indicators: [
              "B5.1.3.1.1: Calculate volume of cubes and cuboids",
              "B5.1.3.1.2: Solve problems involving capacity",
              "B5.1.3.1.3: Convert between units of volume",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "Coordinates and Transformations": {
            contentStandard:
              "B5.1.4.1: Demonstrate understanding of coordinates and transformations",
            indicators: [
              "B5.1.4.1.1: Plot and read coordinates in the first quadrant",
              "B5.1.4.1.2: Perform reflections and translations",
              "B5.1.4.1.3: Describe transformations",
            ],
          },
        },
      },
      "Patterns and Algebra": {
        subStrands: {
          "Algebraic Expressions": {
            contentStandard:
              "B5.1.5.1: Demonstrate understanding of algebraic expressions",
            indicators: [
              "B5.1.5.1.1: Simplify algebraic expressions",
              "B5.1.5.1.2: Solve simple linear equations",
              "B5.1.5.1.3: Substitute values into formulae",
            ],
          },
        },
      },
      "Data Handling": {
        subStrands: {
          Probability: {
            contentStandard:
              "B5.1.6.1: Demonstrate understanding of probability",
            indicators: [
              "B5.1.6.1.1: Calculate probability of simple events",
              "B5.1.6.1.2: Express probability as fraction, decimal or percentage",
              "B5.1.6.1.3: Understand the probability scale from 0 to 1",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Number and Numeration": {
        subStrands: {
          "Number Systems": {
            contentStandard:
              "B6.1.1.1: Demonstrate understanding of number systems",
            indicators: [
              "B6.1.1.1.1: Work with integers, fractions, decimals and percentages",
              "B6.1.1.1.2: Apply number concepts to real-world situations",
              "B6.1.1.1.3: Understand ratio and proportion",
            ],
          },
        },
      },
      Operations: {
        subStrands: {
          "Fluency in Operations": {
            contentStandard:
              "B6.1.2.1: Demonstrate fluency in numerical operations",
            indicators: [
              "B6.1.2.1.1: Perform complex calculations mentally and in writing",
              "B6.1.2.1.2: Estimate and check reasonableness of answers",
              "B6.1.2.1.3: Use calculators appropriately",
            ],
          },
        },
      },
      "Fractions and Decimals": {
        subStrands: {
          "Advanced Fractions and Decimals": {
            contentStandard:
              "B6.1.3.1: Demonstrate mastery of fractions, decimals and percentages",
            indicators: [
              "B6.1.3.1.1: Solve problems involving percentage increase and decrease",
              "B6.1.3.1.2: Apply ratio and proportion",
              "B6.1.3.1.3: Solve problems involving rates",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          "Circles and Compound Shapes": {
            contentStandard:
              "B6.1.4.1: Demonstrate understanding of circles and compound shapes",
            indicators: [
              "B6.1.4.1.1: Calculate circumference and area of circles",
              "B6.1.4.1.2: Find area and perimeter of compound shapes",
              "B6.1.4.1.3: Solve problems involving circles",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "Nets and 3-D Shapes": {
            contentStandard:
              "B6.1.5.1: Demonstrate understanding of nets and 3-D shapes",
            indicators: [
              "B6.1.5.1.1: Draw and construct nets of 3-D shapes",
              "B6.1.5.1.2: Calculate surface area of cubes and cuboids",
              "B6.1.5.1.3: Calculate volume of cubes and cuboids",
            ],
          },
        },
      },
      "Patterns and Algebra": {
        subStrands: {
          "Algebraic Problem Solving": {
            contentStandard:
              "B6.1.6.1: Demonstrate understanding of algebraic problem solving",
            indicators: [
              "B6.1.6.1.1: Form and solve equations from word problems",
              "B6.1.6.1.2: Use formulae and substitute values",
              "B6.1.6.1.3: Solve simultaneous equations graphically",
            ],
          },
        },
      },
      "Data Handling": {
        subStrands: {
          "Data Interpretation": {
            contentStandard:
              "B6.1.7.1: Demonstrate understanding of data interpretation",
            indicators: [
              "B6.1.7.1.1: Interpret complex graphs and tables",
              "B6.1.7.1.2: Make predictions based on data",
              "B6.1.7.1.3: Critique data presentations",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Number and Numeration": {
        subStrands: {
          "Real Numbers": {
            contentStandard:
              "J1.1.1.1: Demonstrate understanding of real numbers",
            indicators: [
              "J1.1.1.1.1: Classify numbers as natural, whole, integers, rational and irrational",
              "J1.1.1.1.2: Perform operations with integers",
              "J1.1.1.1.3: Use number lines to represent real numbers",
            ],
          },
          "Fractions, Decimals and Percentages": {
            contentStandard:
              "J1.1.1.2: Demonstrate mastery of fractions, decimals and percentages",
            indicators: [
              "J1.1.1.2.1: Convert between fractions, decimals and percentages",
              "J1.1.1.2.2: Solve problems involving percentages",
              "J1.1.1.2.3: Calculate percentage increase and decrease",
            ],
          },
        },
      },
      Algebra: {
        subStrands: {
          "Algebraic Expressions": {
            contentStandard:
              "J1.1.2.1: Demonstrate understanding of algebraic expressions",
            indicators: [
              "J1.1.2.1.1: Simplify algebraic expressions",
              "J1.1.2.1.2: Expand and factorize expressions",
              "J1.1.2.1.3: Substitute values into algebraic expressions",
            ],
          },
          "Linear Equations": {
            contentStandard:
              "J1.1.2.2: Demonstrate understanding of linear equations",
            indicators: [
              "J1.1.2.2.1: Solve linear equations in one variable",
              "J1.1.2.2.2: Form equations from word problems",
              "J1.1.2.2.3: Solve simultaneous linear equations",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "Plane Geometry": {
            contentStandard:
              "J1.1.3.1: Demonstrate understanding of plane geometry",
            indicators: [
              "J1.1.3.1.1: Identify and construct angles",
              "J1.1.3.1.2: Understand properties of triangles and quadrilaterals",
              "J1.1.3.1.3: Use geometric reasoning to solve problems",
            ],
          },
          "Transformation Geometry": {
            contentStandard:
              "J1.1.3.2: Demonstrate understanding of transformations",
            indicators: [
              "J1.1.3.2.1: Perform reflections, rotations and translations",
              "J1.1.3.2.2: Understand enlargement and similarity",
              "J1.1.3.2.3: Use coordinates to describe transformations",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          "Perimeter, Area and Volume": {
            contentStandard:
              "J1.1.4.1: Demonstrate understanding of measurement",
            indicators: [
              "J1.1.4.1.1: Calculate perimeter and area of plane shapes",
              "J1.1.4.1.2: Calculate surface area and volume of solids",
              "J1.1.4.1.3: Solve problems involving measurement",
            ],
          },
        },
      },
      "Statistics and Probability": {
        subStrands: {
          Statistics: {
            contentStandard:
              "J1.1.5.1: Demonstrate understanding of statistics",
            indicators: [
              "J1.1.5.1.1: Collect, organize and represent data",
              "J1.1.5.1.2: Calculate measures of central tendency",
              "J1.1.5.1.3: Interpret statistical graphs and charts",
            ],
          },
          Probability: {
            contentStandard:
              "J1.1.5.2: Demonstrate understanding of probability",
            indicators: [
              "J1.1.5.2.1: Calculate probability of simple and compound events",
              "J1.1.5.2.2: Use probability to make predictions",
              "J1.1.5.2.3: Understand mutually exclusive and independent events",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Number and Numeration": {
        subStrands: {
          "Rational and Irrational Numbers": {
            contentStandard:
              "J2.1.1.1: Demonstrate understanding of rational and irrational numbers",
            indicators: [
              "J2.1.1.1.1: Distinguish between rational and irrational numbers",
              "J2.1.1.1.2: Work with surds",
              "J2.1.1.1.3: Use standard form",
            ],
          },
          "Ratio and Proportion": {
            contentStandard:
              "J2.1.1.2: Demonstrate understanding of ratio and proportion",
            indicators: [
              "J2.1.1.2.1: Solve problems involving ratio and proportion",
              "J2.1.1.2.2: Understand direct and inverse proportion",
              "J2.1.1.2.3: Apply proportion to real-world problems",
            ],
          },
        },
      },
      Algebra: {
        subStrands: {
          "Quadratic Expressions and Equations": {
            contentStandard:
              "J2.1.2.1: Demonstrate understanding of quadratic expressions",
            indicators: [
              "J2.1.2.1.1: Factorize quadratic expressions",
              "J2.1.2.1.2: Solve quadratic equations",
              "J2.1.2.1.3: Form and solve quadratic equations from word problems",
            ],
          },
          Inequalities: {
            contentStandard:
              "J2.1.2.2: Demonstrate understanding of inequalities",
            indicators: [
              "J2.1.2.2.1: Solve linear inequalities",
              "J2.1.2.2.2: Represent inequalities on number lines",
              "J2.1.2.2.3: Solve simultaneous inequalities",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "Circle Geometry": {
            contentStandard:
              "J2.1.3.1: Demonstrate understanding of circle geometry",
            indicators: [
              "J2.1.3.1.1: Understand properties of circles",
              "J2.1.3.1.2: Calculate arc length and sector area",
              "J2.1.3.1.3: Use circle theorems",
            ],
          },
          "Similarity and Congruence": {
            contentStandard:
              "J2.1.3.2: Demonstrate understanding of similarity and congruence",
            indicators: [
              "J2.1.3.2.1: Identify congruent and similar shapes",
              "J2.1.3.2.2: Use conditions for congruence and similarity",
              "J2.1.3.2.3: Solve problems involving similar shapes",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          Trigonometry: {
            contentStandard:
              "J2.1.4.1: Demonstrate understanding of trigonometry",
            indicators: [
              "J2.1.4.1.1: Use sine, cosine and tangent ratios",
              "J2.1.4.1.2: Solve problems involving right-angled triangles",
              "J2.1.4.1.3: Use angles of elevation and depression",
            ],
          },
        },
      },
      "Statistics and Probability": {
        subStrands: {
          "Data Analysis": {
            contentStandard:
              "J2.1.5.1: Demonstrate understanding of data analysis",
            indicators: [
              "J2.1.5.1.1: Calculate measures of dispersion",
              "J2.1.5.1.2: Interpret cumulative frequency graphs",
              "J2.1.5.1.3: Use box plots to represent data",
            ],
          },
          "Probability Distributions": {
            contentStandard:
              "J2.1.5.2: Demonstrate understanding of probability",
            indicators: [
              "J2.1.5.2.1: Use tree diagrams for probability",
              "J2.1.5.2.2: Calculate conditional probability",
              "J2.1.5.2.3: Understand probability distributions",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Number and Numeration": {
        subStrands: {
          "Advanced Number Work": {
            contentStandard: "J3.1.1.1: Demonstrate mastery of number concepts",
            indicators: [
              "J3.1.1.1.1: Solve problems involving number sequences",
              "J3.1.1.1.2: Use logarithms",
              "J3.1.1.1.3: Apply number theory to solve problems",
            ],
          },
        },
      },
      Algebra: {
        subStrands: {
          "Advanced Algebra": {
            contentStandard: "J3.1.2.1: Demonstrate mastery of algebra",
            indicators: [
              "J3.1.2.2.1: Solve cubic and higher order equations",
              "J3.1.2.2.2: Work with algebraic fractions",
              "J3.1.2.2.3: Solve problems involving variation",
            ],
          },
          Graphs: {
            contentStandard: "J3.1.2.2: Demonstrate understanding of graphs",
            indicators: [
              "J3.1.2.2.1: Draw and interpret graphs of functions",
              "J3.1.2.2.2: Find gradient and area under graphs",
              "J3.1.2.2.3: Use graphs to solve equations",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          Vectors: {
            contentStandard: "J3.1.3.1: Demonstrate understanding of vectors",
            indicators: [
              "J3.1.3.1.1: Perform vector operations",
              "J3.1.3.1.2: Use vectors in geometry",
              "J3.1.3.1.3: Apply vectors to solve problems",
            ],
          },
        },
      },
      Measurement: {
        subStrands: {
          "Advanced Measurement": {
            contentStandard: "J3.1.4.1: Demonstrate mastery of measurement",
            indicators: [
              "J3.1.4.1.1: Solve complex measurement problems",
              "J3.1.4.1.2: Use trigonometry in 3-D",
              "J3.1.4.1.3: Calculate volumes of complex solids",
            ],
          },
        },
      },
      "Statistics and Probability": {
        subStrands: {
          "Advanced Statistics": {
            contentStandard:
              "J3.1.5.1: Demonstrate mastery of statistics and probability",
            indicators: [
              "J3.1.5.1.1: Conduct statistical investigations",
              "J3.1.5.1.2: Use normal distribution",
              "J3.1.5.1.3: Make inferences from data",
            ],
          },
        },
      },
    },
    "SHS 1": {
      "Number and Numeration": {
        subStrands: {
          "Number Systems": {
            contentStandard:
              "S1.1.1.1: Demonstrate understanding of number systems",
            indicators: [
              "S1.1.1.1.1: Work with different number bases",
              "S1.1.1.1.2: Understand modular arithmetic",
              "S1.1.1.1.3: Apply number theory",
            ],
          },
        },
      },
      Algebra: {
        subStrands: {
          "Advanced Algebra": {
            contentStandard: "S1.1.2.1: Demonstrate mastery of algebra",
            indicators: [
              "S1.1.2.1.1: Solve polynomial equations",
              "S1.1.2.1.2: Work with partial fractions",
              "S1.1.2.1.3: Use mathematical induction",
            ],
          },
        },
      },
      Geometry: {
        subStrands: {
          "Coordinate Geometry": {
            contentStandard:
              "S1.1.3.1: Demonstrate understanding of coordinate geometry",
            indicators: [
              "S1.1.3.1.1: Find equations of lines and circles",
              "S1.1.3.1.2: Use coordinate geometry to solve problems",
              "S1.1.3.1.3: Understand conic sections",
            ],
          },
        },
      },
      "Statistics and Probability": {
        subStrands: {
          "Statistical Methods": {
            contentStandard:
              "S1.1.4.1: Demonstrate understanding of statistical methods",
            indicators: [
              "S1.1.4.1.1: Use correlation and regression",
              "S1.1.4.1.2: Understand sampling distributions",
              "S1.1.4.1.3: Conduct hypothesis tests",
            ],
          },
        },
      },
    },
    "SHS 2": {
      "Core Mathematics": {
        subStrands: {
          "Advanced Topics": {
            contentStandard:
              "S2.1.1.1: Demonstrate mastery of core mathematics",
            indicators: [
              "S2.1.1.1.1: Apply calculus concepts",
              "S2.1.1.1.2: Use vectors and matrices",
              "S2.1.1.1.3: Solve differential equations",
            ],
          },
        },
      },
      "Elective Mathematics": {
        subStrands: {
          "Pure Mathematics": {
            contentStandard:
              "S2.1.2.1: Demonstrate understanding of pure mathematics",
            indicators: [
              "S2.1.2.1.1: Work with complex numbers",
              "S2.1.2.1.2: Understand series and sequences",
              "S2.1.2.1.3: Apply integration techniques",
            ],
          },
          "Applied Mathematics": {
            contentStandard:
              "S2.1.2.2: Demonstrate understanding of applied mathematics",
            indicators: [
              "S2.1.2.2.1: Use mechanics principles",
              "S2.1.2.2.2: Apply statistics to real problems",
              "S2.1.2.2.3: Use mathematical modeling",
            ],
          },
        },
      },
    },
    "SHS 3": {
      "Core Mathematics": {
        subStrands: {
          "Revision and Examination Preparation": {
            contentStandard:
              "S3.1.1.1: Demonstrate mastery of core mathematics for WASSCE",
            indicators: [
              "S3.1.1.1.1: Solve past WASSCE questions",
              "S3.1.1.1.2: Apply mathematical concepts to novel problems",
              "S3.1.1.1.3: Demonstrate examination techniques",
            ],
          },
        },
      },
      "Elective Mathematics": {
        subStrands: {
          "Advanced Pure Mathematics": {
            contentStandard:
              "S3.1.2.1: Demonstrate mastery of pure mathematics",
            indicators: [
              "S3.1.2.1.1: Solve advanced calculus problems",
              "S3.1.2.1.2: Work with differential equations",
              "S3.1.2.1.3: Apply numerical methods",
            ],
          },
          "Advanced Applied Mathematics": {
            contentStandard:
              "S3.1.2.2: Demonstrate mastery of applied mathematics",
            indicators: [
              "S3.1.2.2.1: Solve mechanics problems",
              "S3.1.2.2.2: Use statistical inference",
              "S3.1.2.2.3: Apply decision mathematics",
            ],
          },
        },
      },
    },
  },
  Science: {
    "Basic 1": {
      "Diversity of Matter": {
        subStrands: {
          "Living and Non-living Things": {
            contentStandard:
              "B1.2.1.1: Demonstrate understanding of living and non-living things",
            indicators: [
              "B1.2.1.1.1: Identify and classify living and non-living things",
              "B1.2.1.1.2: Describe characteristics of living things",
              "B1.2.1.1.3: Understand the needs of living things",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          "Life Cycles": {
            contentStandard:
              "B1.2.2.1: Demonstrate understanding of life cycles",
            indicators: [
              "B1.2.2.1.1: Describe the life cycle of plants and animals",
              "B1.2.2.1.2: Understand growth and change in living things",
              "B1.2.2.1.3: Observe and record changes in living things",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Body Parts and Senses": {
            contentStandard:
              "B1.2.3.1: Demonstrate understanding of body parts and senses",
            indicators: [
              "B1.2.3.1.1: Identify parts of the body and their functions",
              "B1.2.3.1.2: Use the five senses to explore the environment",
              "B1.2.3.1.3: Understand the importance of keeping the body clean",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          "Light and Sound": {
            contentStandard:
              "B1.2.4.1: Demonstrate understanding of forces and energy",
            indicators: [
              "B1.2.4.1.1: Identify sources of light and sound",
              "B1.2.4.1.2: Understand push and pull forces",
              "B1.2.4.1.3: Explore how things move",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          "Our Environment": {
            contentStandard:
              "B1.2.5.1: Demonstrate understanding of the environment",
            indicators: [
              "B1.2.5.1.1: Identify natural and man-made features",
              "B1.2.5.1.2: Understand day and night",
              "B1.2.5.1.3: Observe weather patterns",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Diversity of Matter": {
        subStrands: {
          "Materials and Properties": {
            contentStandard:
              "B2.2.1.1: Demonstrate understanding of materials and their properties",
            indicators: [
              "B2.2.1.1.1: Classify materials by their properties",
              "B2.2.1.1.2: Understand states of matter (solid, liquid, gas)",
              "B2.2.1.1.3: Investigate changes in materials",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          "Water Cycle and Seasons": {
            contentStandard:
              "B2.2.2.1: Demonstrate understanding of water cycle and seasons",
            indicators: [
              "B2.2.2.1.1: Describe the water cycle",
              "B2.2.2.1.2: Understand seasonal changes",
              "B2.2.2.1.3: Relate weather to daily activities",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Human Body Systems": {
            contentStandard:
              "B2.2.3.1: Demonstrate understanding of human body systems",
            indicators: [
              "B2.2.3.1.1: Identify major organs and their functions",
              "B2.2.3.1.2: Understand basic health and hygiene",
              "B2.2.3.1.3: Understand the importance of exercise",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          "Energy Sources": {
            contentStandard:
              "B2.2.4.1: Demonstrate understanding of energy sources",
            indicators: [
              "B2.2.4.1.1: Identify different forms of energy",
              "B2.2.4.1.2: Understand simple machines",
              "B2.2.4.1.3: Explore energy transfer",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          "Soil and Rocks": {
            contentStandard:
              "B2.2.5.1: Demonstrate understanding of soil and rocks",
            indicators: [
              "B2.2.5.1.1: Classify different types of soil",
              "B2.2.5.1.2: Understand the importance of soil",
              "B2.2.5.1.3: Investigate properties of rocks",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Diversity of Matter": {
        subStrands: {
          "Mixtures and Separation": {
            contentStandard:
              "B3.2.1.1: Demonstrate understanding of mixtures and separation",
            indicators: [
              "B3.2.1.1.1: Identify mixtures and solutions",
              "B3.2.1.1.2: Use methods to separate mixtures",
              "B3.2.1.1.3: Understand the properties of solutions",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          Reproduction: {
            contentStandard:
              "B3.2.2.1: Demonstrate understanding of reproduction in plants and animals",
            indicators: [
              "B3.2.2.1.1: Describe reproduction in flowering plants",
              "B3.2.2.1.2: Understand reproduction in common animals",
              "B3.2.2.1.3: Understand the human reproductive system",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Digestive and Respiratory Systems": {
            contentStandard:
              "B3.2.3.1: Demonstrate understanding of digestive and respiratory systems",
            indicators: [
              "B3.2.3.1.1: Describe the digestive system",
              "B3.2.3.1.2: Understand breathing and respiration",
              "B3.2.3.1.3: Understand the importance of healthy eating",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          "Electricity and Magnetism": {
            contentStandard:
              "B3.2.4.1: Demonstrate understanding of electricity and magnetism",
            indicators: [
              "B3.2.4.1.1: Build simple electrical circuits",
              "B3.2.4.1.2: Understand magnetic properties",
              "B3.2.4.1.3: Explore static electricity",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          "Solar System": {
            contentStandard:
              "B3.2.5.1: Demonstrate understanding of the solar system",
            indicators: [
              "B3.2.5.1.1: Identify planets in the solar system",
              "B3.2.5.1.2: Understand Earth's movement and seasons",
              "B3.2.5.1.3: Understand the moon and its phases",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Diversity of Matter": {
        subStrands: {
          "Classification of Living Things": {
            contentStandard:
              "B4.2.1.1: Demonstrate understanding of classification",
            indicators: [
              "B4.2.1.1.1: Classify living things into groups",
              "B4.2.1.1.2: Understand the characteristics of vertebrates and invertebrates",
              "B4.2.1.1.3: Use dichotomous keys",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          "Nutrient Cycles": {
            contentStandard:
              "B4.2.2.1: Demonstrate understanding of nutrient cycles",
            indicators: [
              "B4.2.2.1.1: Describe the carbon cycle",
              "B4.2.2.1.2: Understand the nitrogen cycle",
              "B4.2.2.1.3: Understand the water cycle in detail",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Circulatory System": {
            contentStandard:
              "B4.2.3.1: Demonstrate understanding of the circulatory system",
            indicators: [
              "B4.2.3.1.1: Describe the structure and function of the heart",
              "B4.2.3.1.2: Understand blood circulation",
              "B4.2.3.1.3: Understand the importance of blood donation",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          "Heat Energy": {
            contentStandard:
              "B4.2.4.1: Demonstrate understanding of heat energy",
            indicators: [
              "B4.2.4.1.1: Understand heat transfer",
              "B4.2.4.1.2: Investigate conductors and insulators",
              "B4.2.4.1.3: Understand temperature and its measurement",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          "Rocks and Minerals": {
            contentStandard:
              "B4.2.5.1: Demonstrate understanding of rocks and minerals",
            indicators: [
              "B4.2.5.1.1: Classify rocks into igneous, sedimentary and metamorphic",
              "B4.2.5.1.2: Understand the rock cycle",
              "B4.2.5.1.3: Identify common minerals",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Diversity of Matter": {
        subStrands: {
          "Cells and Organization": {
            contentStandard: "B5.2.1.1: Demonstrate understanding of cells",
            indicators: [
              "B5.2.1.1.1: Understand cell structure",
              "B5.2.1.1.2: Compare plant and animal cells",
              "B5.2.1.1.3: Understand levels of organization",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          Ecosystems: {
            contentStandard:
              "B5.2.2.1: Demonstrate understanding of ecosystems",
            indicators: [
              "B5.2.2.1.1: Understand food chains and food webs",
              "B5.2.2.1.2: Understand energy flow in ecosystems",
              "B5.2.2.1.3: Understand human impact on ecosystems",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Nervous System": {
            contentStandard:
              "B5.2.3.1: Demonstrate understanding of the nervous system",
            indicators: [
              "B5.2.3.1.1: Understand the structure of the nervous system",
              "B5.2.3.1.2: Understand how we sense the world",
              "B5.2.3.1.3: Understand reflex actions",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          Light: {
            contentStandard: "B5.2.4.1: Demonstrate understanding of light",
            indicators: [
              "B5.2.4.1.1: Understand reflection and refraction",
              "B5.2.4.1.2: Understand how we see",
              "B5.2.4.1.3: Investigate lenses and mirrors",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          "Weather and Climate": {
            contentStandard:
              "B5.2.5.1: Demonstrate understanding of weather and climate",
            indicators: [
              "B5.2.5.1.1: Understand weather instruments",
              "B5.2.5.1.2: Understand climate zones",
              "B5.2.5.1.3: Understand climate change",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Diversity of Matter": {
        subStrands: {
          "Chemical Changes": {
            contentStandard:
              "B6.2.1.1: Demonstrate understanding of chemical changes",
            indicators: [
              "B6.2.1.1.1: Distinguish between physical and chemical changes",
              "B6.2.1.1.2: Understand acids and bases",
              "B6.2.1.1.3: Investigate reactions",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          "Environmental Cycles": {
            contentStandard:
              "B6.2.2.1: Demonstrate understanding of environmental cycles",
            indicators: [
              "B6.2.2.1.1: Understand the interdependence of cycles",
              "B6.2.2.1.2: Understand human impact on cycles",
              "B6.2.2.1.3: Propose solutions to environmental problems",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Excretory System": {
            contentStandard:
              "B6.2.3.1: Demonstrate understanding of the excretory system",
            indicators: [
              "B6.2.3.1.1: Understand the structure and function of the kidneys",
              "B6.2.3.1.2: Understand other excretory organs",
              "B6.2.3.1.3: Understand the importance of excretion",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          Electricity: {
            contentStandard:
              "B6.2.4.1: Demonstrate understanding of electricity",
            indicators: [
              "B6.2.4.1.1: Understand electrical circuits",
              "B6.2.4.1.2: Understand conductors and insulators",
              "B6.2.4.1.3: Understand electrical safety",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          "The Universe": {
            contentStandard:
              "B6.2.5.1: Demonstrate understanding of the universe",
            indicators: [
              "B6.2.5.1.1: Understand the solar system in detail",
              "B6.2.5.1.2: Understand stars and galaxies",
              "B6.2.5.1.3: Understand space exploration",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Diversity of Matter": {
        subStrands: {
          Classification: {
            contentStandard:
              "J1.2.1.1: Demonstrate understanding of classification of matter",
            indicators: [
              "J1.2.1.1.1: Classify matter as elements, compounds and mixtures",
              "J1.2.1.1.2: Understand the periodic table",
              "J1.2.1.1.3: Separate mixtures using various techniques",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          "Biogeochemical Cycles": {
            contentStandard:
              "J1.2.2.1: Demonstrate understanding of biogeochemical cycles",
            indicators: [
              "J1.2.2.1.1: Describe the carbon, nitrogen and water cycles",
              "J1.2.2.1.2: Understand the importance of these cycles",
              "J1.2.2.1.3: Investigate human impact on cycles",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Plant Systems": {
            contentStandard:
              "J1.2.3.1: Demonstrate understanding of plant systems",
            indicators: [
              "J1.2.3.1.1: Understand plant structure and function",
              "J1.2.3.1.2: Understand photosynthesis",
              "J1.2.3.1.3: Understand plant reproduction",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          Energy: {
            contentStandard: "J1.2.4.1: Demonstrate understanding of energy",
            indicators: [
              "J1.2.4.1.1: Understand different forms of energy",
              "J1.2.4.1.2: Understand energy transformation",
              "J1.2.4.1.3: Understand renewable and non-renewable energy",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          "Earth Systems": {
            contentStandard:
              "J1.2.5.1: Demonstrate understanding of Earth systems",
            indicators: [
              "J1.2.5.1.1: Understand the structure of the Earth",
              "J1.2.5.1.2: Understand plate tectonics",
              "J1.2.5.1.3: Understand natural hazards",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Diversity of Matter": {
        subStrands: {
          "Atomic Structure": {
            contentStandard:
              "J2.2.1.1: Demonstrate understanding of atomic structure",
            indicators: [
              "J2.2.1.1.1: Understand the structure of atoms",
              "J2.2.1.1.2: Understand electronic configuration",
              "J2.2.1.1.3: Relate atomic structure to chemical properties",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          "Human Reproduction": {
            contentStandard:
              "J2.2.2.1: Demonstrate understanding of human reproduction",
            indicators: [
              "J2.2.2.1.1: Understand the human reproductive system",
              "J2.2.2.1.2: Understand puberty and adolescence",
              "J2.2.2.1.3: Understand reproductive health",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Control and Coordination": {
            contentStandard:
              "J2.2.3.1: Demonstrate understanding of control and coordination",
            indicators: [
              "J2.2.3.1.1: Understand the endocrine system",
              "J2.2.3.1.2: Understand hormones",
              "J2.2.3.1.3: Understand homeostasis",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          Waves: {
            contentStandard: "J2.2.4.1: Demonstrate understanding of waves",
            indicators: [
              "J2.2.4.1.1: Understand wave properties",
              "J2.2.4.1.2: Understand sound waves",
              "J2.2.4.1.3: Understand electromagnetic waves",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          Resources: {
            contentStandard:
              "J2.2.5.1: Demonstrate understanding of Earth resources",
            indicators: [
              "J2.2.5.1.1: Understand natural resources",
              "J2.2.5.1.2: Understand sustainable use of resources",
              "J2.2.5.1.3: Understand conservation",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Diversity of Matter": {
        subStrands: {
          "Chemical Reactions": {
            contentStandard:
              "J3.2.1.1: Demonstrate understanding of chemical reactions",
            indicators: [
              "J3.2.1.1.1: Understand types of chemical reactions",
              "J3.2.1.1.2: Write chemical equations",
              "J3.2.1.1.3: Understand reaction rates",
            ],
          },
        },
      },
      Cycles: {
        subStrands: {
          Genetics: {
            contentStandard: "J3.2.2.1: Demonstrate understanding of genetics",
            indicators: [
              "J3.2.2.1.1: Understand inheritance",
              "J3.2.2.1.2: Understand DNA and genes",
              "J3.2.2.1.3: Understand genetic variation",
            ],
          },
        },
      },
      Systems: {
        subStrands: {
          "Immune System": {
            contentStandard:
              "J3.2.3.1: Demonstrate understanding of the immune system",
            indicators: [
              "J3.2.3.1.1: Understand how the body fights disease",
              "J3.2.3.1.2: Understand vaccination",
              "J3.2.3.1.3: Understand public health",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          "Electricity and Magnetism": {
            contentStandard:
              "J3.2.4.1: Demonstrate understanding of electricity and magnetism",
            indicators: [
              "J3.2.4.1.1: Understand electric fields",
              "J3.2.4.1.2: Understand magnetic fields",
              "J3.2.4.1.3: Understand electromagnetic induction",
            ],
          },
        },
      },
      "Earth and Space": {
        subStrands: {
          Astronomy: {
            contentStandard: "J3.2.5.1: Demonstrate understanding of astronomy",
            indicators: [
              "J3.2.5.1.1: Understand the life cycle of stars",
              "J3.2.5.1.2: Understand the origin of the universe",
              "J3.2.5.1.3: Understand space technology",
            ],
          },
        },
      },
    },
    "SHS 1": {
      "Scientific Inquiry": {
        subStrands: {
          "Nature of Science": {
            contentStandard:
              "S1.2.1.1: Demonstrate understanding of the nature of science",
            indicators: [
              "S1.2.1.1.1: Understand scientific methods",
              "S1.2.1.1.2: Design and conduct experiments",
              "S1.2.1.1.3: Analyze and interpret data",
            ],
          },
        },
      },
      Matter: {
        subStrands: {
          "Atomic Theory": {
            contentStandard:
              "S1.2.2.1: Demonstrate understanding of atomic theory",
            indicators: [
              "S1.2.2.1.1: Understand quantum theory",
              "S1.2.2.1.2: Understand chemical bonding",
              "S1.2.2.1.3: Predict chemical behavior",
            ],
          },
        },
      },
      "Living Things": {
        subStrands: {
          Biodiversity: {
            contentStandard:
              "S1.2.3.1: Demonstrate understanding of biodiversity",
            indicators: [
              "S1.2.3.1.1: Understand taxonomy",
              "S1.2.3.1.2: Understand evolution",
              "S1.2.3.1.3: Understand conservation biology",
            ],
          },
        },
      },
      "Forces and Energy": {
        subStrands: {
          Mechanics: {
            contentStandard: "S1.2.4.1: Demonstrate understanding of mechanics",
            indicators: [
              "S1.2.4.1.1: Understand motion",
              "S1.2.4.1.2: Understand forces",
              "S1.2.4.1.3: Understand energy and momentum",
            ],
          },
        },
      },
    },
    "SHS 2": {
      Biology: {
        subStrands: {
          "Cell Biology": {
            contentStandard:
              "S2.2.1.1: Demonstrate understanding of cell biology",
            indicators: [
              "S2.2.1.1.1: Understand cell structure and function",
              "S2.2.1.1.2: Understand cell division",
              "S2.2.1.1.3: Understand cell metabolism",
            ],
          },
        },
      },
      Chemistry: {
        subStrands: {
          "Organic Chemistry": {
            contentStandard:
              "S2.2.2.1: Demonstrate understanding of organic chemistry",
            indicators: [
              "S2.2.2.1.1: Understand hydrocarbons",
              "S2.2.2.1.2: Understand functional groups",
              "S2.2.2.1.3: Understand reaction mechanisms",
            ],
          },
        },
      },
      Physics: {
        subStrands: {
          Thermodynamics: {
            contentStandard:
              "S2.2.3.1: Demonstrate understanding of thermodynamics",
            indicators: [
              "S2.2.3.1.1: Understand heat and temperature",
              "S2.2.3.1.2: Understand the laws of thermodynamics",
              "S2.2.3.1.3: Apply thermodynamics to engines",
            ],
          },
        },
      },
    },
    "SHS 3": {
      Biology: {
        subStrands: {
          Ecology: {
            contentStandard: "S3.2.1.1: Demonstrate understanding of ecology",
            indicators: [
              "S3.2.1.1.1: Understand ecosystems",
              "S3.2.1.1.2: Understand population dynamics",
              "S3.2.1.1.3: Understand environmental issues",
            ],
          },
        },
      },
      Chemistry: {
        subStrands: {
          "Industrial Chemistry": {
            contentStandard:
              "S3.2.2.1: Demonstrate understanding of industrial chemistry",
            indicators: [
              "S3.2.2.1.1: Understand industrial processes",
              "S3.2.2.1.2: Understand green chemistry",
              "S3.2.2.1.3: Understand quality control",
            ],
          },
        },
      },
      Physics: {
        subStrands: {
          "Modern Physics": {
            contentStandard:
              "S3.2.3.1: Demonstrate understanding of modern physics",
            indicators: [
              "S3.2.3.1.1: Understand nuclear physics",
              "S3.2.3.1.2: Understand quantum mechanics",
              "S3.2.3.1.3: Understand particle physics",
            ],
          },
        },
      },
    },
  },
  English: {
    "Basic 1": {
      "Listening and Speaking": {
        subStrands: {
          "Listening Comprehension": {
            contentStandard:
              "B1.3.1.1: Demonstrate understanding of spoken English",
            indicators: [
              "B1.3.1.1.1: Listen and respond to simple instructions",
              "B1.3.1.1.2: Identify main ideas in spoken texts",
              "B1.3.1.1.3: Follow simple stories",
            ],
          },
          Speaking: {
            contentStandard:
              "B1.3.1.2: Demonstrate ability to speak in English",
            indicators: [
              "B1.3.1.2.1: Speak in simple sentences about familiar topics",
              "B1.3.1.2.2: Use appropriate greetings and expressions",
              "B1.3.1.2.3: Participate in simple conversations",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "Reading Readiness": {
            contentStandard:
              "B1.3.2.1: Demonstrate understanding of basic reading skills",
            indicators: [
              "B1.3.2.1.1: Recognize and read simple words",
              "B1.3.2.1.2: Read simple sentences with understanding",
              "B1.3.2.1.3: Use pictures to aid comprehension",
            ],
          },
          Phonics: {
            contentStandard: "B1.3.2.2: Demonstrate understanding of phonics",
            indicators: [
              "B1.3.2.2.1: Recognize letter sounds",
              "B1.3.2.2.2: Blend sounds to read words",
              "B1.3.2.2.3: Segment words into sounds",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          Handwriting: {
            contentStandard:
              "B1.3.3.1: Demonstrate understanding of basic writing skills",
            indicators: [
              "B1.3.3.1.1: Write simple words and sentences",
              "B1.3.3.1.2: Use correct letter formation",
              "B1.3.3.1.3: Write legibly",
            ],
          },
          Composition: {
            contentStandard: "B1.3.3.2: Demonstrate ability to write",
            indicators: [
              "B1.3.3.2.1: Write simple sentences",
              "B1.3.3.2.2: Use capital letters and full stops",
              "B1.3.3.2.3: Write about personal experiences",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          "Parts of Speech": {
            contentStandard:
              "B1.3.4.1: Demonstrate understanding of basic grammar",
            indicators: [
              "B1.3.4.1.1: Use nouns and verbs correctly",
              "B1.3.4.1.2: Form simple sentences",
              "B1.3.4.1.3: Use adjectives to describe nouns",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Listening and Speaking": {
        subStrands: {
          "Listening Skills": {
            contentStandard:
              "B2.3.1.1: Demonstrate understanding of spoken English in context",
            indicators: [
              "B2.3.1.1.1: Follow multi-step instructions",
              "B2.3.1.1.2: Identify details in spoken texts",
              "B2.3.1.1.3: Make predictions based on listening",
            ],
          },
          "Oral Communication": {
            contentStandard: "B2.3.1.2: Demonstrate oral communication skills",
            indicators: [
              "B2.3.1.2.1: Participate in simple conversations",
              "B2.3.1.2.2: Describe people and events",
              "B2.3.1.2.3: Ask and answer questions",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "Reading Fluency": {
            contentStandard:
              "B2.3.2.1: Demonstrate understanding of short texts",
            indicators: [
              "B2.3.2.1.1: Read short stories with fluency",
              "B2.3.2.1.2: Answer questions about text",
              "B2.3.2.1.3: Read aloud with expression",
            ],
          },
          Comprehension: {
            contentStandard: "B2.3.2.2: Demonstrate reading comprehension",
            indicators: [
              "B2.3.2.2.1: Identify main ideas and details",
              "B2.3.2.2.2: Make simple inferences",
              "B2.3.2.2.3: Sequence events in a story",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Sentence Writing": {
            contentStandard:
              "B2.3.3.1: Demonstrate understanding of paragraph writing",
            indicators: [
              "B2.3.3.1.1: Write simple paragraphs",
              "B2.3.3.1.2: Use punctuation correctly",
              "B2.3.3.1.3: Write in complete sentences",
            ],
          },
          "Creative Writing": {
            contentStandard: "B2.3.3.2: Demonstrate creative writing skills",
            indicators: [
              "B2.3.3.2.1: Write short stories",
              "B2.3.3.2.2: Write simple poems",
              "B2.3.3.2.3: Write personal letters",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          "Grammar Structures": {
            contentStandard:
              "B2.3.4.1: Demonstrate understanding of grammar structures",
            indicators: [
              "B2.3.4.1.1: Use adjectives and adverbs",
              "B2.3.4.1.2: Form questions and negatives",
              "B2.3.4.1.3: Use pronouns correctly",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Listening and Speaking": {
        subStrands: {
          "Advanced Listening": {
            contentStandard:
              "B3.3.1.1: Demonstrate understanding of extended spoken English",
            indicators: [
              "B3.3.1.1.1: Understand main ideas in spoken texts",
              "B3.3.1.1.2: Express opinions and ideas clearly",
              "B3.3.1.1.3: Participate in discussions",
            ],
          },
          "Oral Presentation": {
            contentStandard: "B3.3.1.2: Demonstrate oral presentation skills",
            indicators: [
              "B3.3.1.2.1: Give short presentations",
              "B3.3.1.2.2: Use appropriate body language",
              "B3.3.1.2.3: Speak clearly and confidently",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "Reading Strategies": {
            contentStandard:
              "B3.3.2.1: Demonstrate understanding of various text types",
            indicators: [
              "B3.3.2.1.1: Read and comprehend different text types",
              "B3.3.2.1.2: Make inferences from text",
              "B3.3.2.1.3: Use context clues to understand new words",
            ],
          },
          "Critical Reading": {
            contentStandard: "B3.3.2.2: Demonstrate critical reading skills",
            indicators: [
              "B3.3.2.2.1: Distinguish fact from opinion",
              "B3.3.2.2.2: Identify author's purpose",
              "B3.3.2.2.3: Evaluate information",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Paragraph Writing": {
            contentStandard:
              "B3.3.3.1: Demonstrate understanding of composition writing",
            indicators: [
              "B3.3.3.1.1: Write short compositions",
              "B3.3.3.1.2: Use paragraphs effectively",
              "B3.3.3.1.3: Use linking words",
            ],
          },
          "Writing Process": {
            contentStandard:
              "B3.3.3.2: Demonstrate understanding of the writing process",
            indicators: [
              "B3.3.3.2.1: Plan and draft writing",
              "B3.3.3.2.2: Revise and edit work",
              "B3.3.3.2.3: Publish final drafts",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          "Complex Grammar": {
            contentStandard:
              "B3.3.4.1: Demonstrate understanding of complex grammar",
            indicators: [
              "B3.3.4.1.1: Use tenses correctly",
              "B3.3.4.1.2: Use conjunctions to connect ideas",
              "B3.3.4.1.3: Use prepositions correctly",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Listening and Speaking": {
        subStrands: {
          "Listening for Information": {
            contentStandard:
              "B4.3.1.1: Demonstrate understanding of extended spoken English",
            indicators: [
              "B4.3.1.1.1: Extract specific information from spoken texts",
              "B4.3.1.1.2: Take notes from spoken information",
              "B4.3.1.1.3: Follow arguments and explanations",
            ],
          },
          "Discussion Skills": {
            contentStandard: "B4.3.1.2: Demonstrate discussion skills",
            indicators: [
              "B4.3.1.2.1: Participate in group discussions",
              "B4.3.1.2.2: Express and justify opinions",
              "B4.3.1.2.3: Respond to others' ideas",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "Reading for Pleasure": {
            contentStandard: "B4.3.2.1: Demonstrate reading for pleasure",
            indicators: [
              "B4.3.2.1.1: Read a variety of texts",
              "B4.3.2.1.2: Express preferences",
              "B4.3.2.1.3: Recommend books to others",
            ],
          },
          "Study Skills": {
            contentStandard: "B4.3.2.2: Demonstrate study reading skills",
            indicators: [
              "B4.3.2.2.1: Skim and scan texts",
              "B4.3.2.2.2: Use reference materials",
              "B4.3.2.2.3: Summarize information",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Functional Writing": {
            contentStandard: "B4.3.3.1: Demonstrate functional writing skills",
            indicators: [
              "B4.3.3.1.1: Write letters and emails",
              "B4.3.3.1.2: Write reports",
              "B4.3.3.1.3: Write instructions",
            ],
          },
          "Narrative Writing": {
            contentStandard: "B4.3.3.2: Demonstrate narrative writing skills",
            indicators: [
              "B4.3.3.2.1: Write stories with plot and characters",
              "B4.3.3.2.2: Use descriptive language",
              "B4.3.3.2.3: Create dialogue",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          "Advanced Grammar": {
            contentStandard: "B4.3.4.1: Demonstrate mastery of grammar",
            indicators: [
              "B4.3.4.1.1: Use complex sentences",
              "B4.3.4.1.2: Use passive voice",
              "B4.3.4.1.3: Use reported speech",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Listening and Speaking": {
        subStrands: {
          "Critical Listening": {
            contentStandard: "B5.3.1.1: Demonstrate critical listening skills",
            indicators: [
              "B5.3.1.1.1: Evaluate spoken arguments",
              "B5.3.1.1.2: Identify bias in spoken texts",
              "B5.3.1.1.3: Analyze persuasive techniques",
            ],
          },
          "Formal Speaking": {
            contentStandard: "B5.3.1.2: Demonstrate formal speaking skills",
            indicators: [
              "B5.3.1.2.1: Give formal presentations",
              "B5.3.1.2.2: Participate in debates",
              "B5.3.1.2.3: Use appropriate register",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "Literary Analysis": {
            contentStandard: "B5.3.2.1: Demonstrate literary analysis skills",
            indicators: [
              "B5.3.2.1.1: Analyze literary devices",
              "B5.3.2.1.2: Understand themes and symbols",
              "B5.3.2.1.3: Compare texts",
            ],
          },
          "Information Literacy": {
            contentStandard: "B5.3.2.2: Demonstrate information literacy",
            indicators: [
              "B5.3.2.2.1: Evaluate sources",
              "B5.3.2.2.2: Synthesize information",
              "B5.3.2.2.3: Avoid plagiarism",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Persuasive Writing": {
            contentStandard: "B5.3.3.1: Demonstrate persuasive writing skills",
            indicators: [
              "B5.3.3.1.1: Write persuasive essays",
              "B5.3.3.1.2: Use rhetorical devices",
              "B5.3.3.1.3: Support arguments with evidence",
            ],
          },
          "Research Writing": {
            contentStandard: "B5.3.3.2: Demonstrate research writing skills",
            indicators: [
              "B5.3.3.2.1: Conduct research",
              "B5.3.3.2.2: Write research reports",
              "B5.3.3.2.3: Use citations",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          "Style and Usage": {
            contentStandard: "B5.3.4.1: Demonstrate understanding of style",
            indicators: [
              "B5.3.4.1.1: Vary sentence structure",
              "B5.3.4.1.2: Use appropriate vocabulary",
              "B5.3.4.1.3: Edit for clarity and style",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Listening and Speaking": {
        subStrands: {
          "Media Literacy": {
            contentStandard: "B6.3.1.1: Demonstrate media literacy",
            indicators: [
              "B6.3.1.1.1: Analyze media messages",
              "B6.3.1.1.2: Understand media techniques",
              "B6.3.1.1.3: Create media products",
            ],
          },
          "Public Speaking": {
            contentStandard: "B6.3.1.2: Demonstrate public speaking skills",
            indicators: [
              "B6.3.1.2.1: Deliver speeches",
              "B6.3.1.2.2: Use visual aids",
              "B6.3.1.2.3: Handle Q&A sessions",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "Advanced Comprehension": {
            contentStandard: "B6.3.2.1: Demonstrate advanced comprehension",
            indicators: [
              "B6.3.2.1.1: Analyze complex texts",
              "B6.3.2.1.2: Evaluate arguments",
              "B6.3.2.1.3: Draw sophisticated inferences",
            ],
          },
          "Independent Reading": {
            contentStandard: "B6.3.2.2: Demonstrate independent reading",
            indicators: [
              "B6.3.2.2.1: Read challenging texts",
              "B6.3.2.2.2: Read for different purposes",
              "B6.3.2.2.3: Develop reading habits",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Expository Writing": {
            contentStandard: "B6.3.3.1: Demonstrate expository writing skills",
            indicators: [
              "B6.3.3.1.1: Write explanatory essays",
              "B6.3.3.1.2: Use various organizational patterns",
              "B6.3.3.1.3: Write clear explanations",
            ],
          },
          "Creative Writing": {
            contentStandard: "B6.3.3.2: Demonstrate advanced creative writing",
            indicators: [
              "B6.3.3.2.1: Write various literary forms",
              "B6.3.3.2.2: Develop personal style",
              "B6.3.3.2.3: Revise for effect",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          Mastery: {
            contentStandard:
              "B6.3.4.1: Demonstrate mastery of grammar and usage",
            indicators: [
              "B6.3.4.1.1: Use grammar for effect",
              "B6.3.4.1.2: Understand language variation",
              "B6.3.4.1.3: Edit own and others' writing",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Listening and Speaking": {
        subStrands: {
          "Academic Listening": {
            contentStandard: "J1.3.1.1: Demonstrate academic listening skills",
            indicators: [
              "J1.3.1.1.1: Take notes from lectures",
              "J1.3.1.1.2: Follow academic discussions",
              "J1.3.1.1.3: Understand academic vocabulary",
            ],
          },
          "Academic Speaking": {
            contentStandard: "J1.3.1.2: Demonstrate academic speaking skills",
            indicators: [
              "J1.3.1.2.1: Participate in seminars",
              "J1.3.1.2.2: Present research findings",
              "J1.3.1.2.3: Use academic language",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          Literature: {
            contentStandard:
              "J1.3.2.1: Demonstrate understanding of literature",
            indicators: [
              "J1.3.2.1.1: Read literary texts",
              "J1.3.2.1.2: Analyze literary elements",
              "J1.3.2.1.3: Write literary responses",
            ],
          },
          "Non-fiction": {
            contentStandard:
              "J1.3.2.2: Demonstrate understanding of non-fiction",
            indicators: [
              "J1.3.2.2.1: Read informational texts",
              "J1.3.2.2.2: Analyze text structures",
              "J1.3.2.2.3: Evaluate arguments",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Academic Writing": {
            contentStandard: "J1.3.3.1: Demonstrate academic writing skills",
            indicators: [
              "J1.3.3.1.1: Write academic essays",
              "J1.3.3.1.2: Use academic conventions",
              "J1.3.3.1.3: Cite sources properly",
            ],
          },
          "Creative Writing": {
            contentStandard: "J1.3.3.2: Demonstrate creative writing skills",
            indicators: [
              "J1.3.3.2.1: Write short stories",
              "J1.3.3.2.2: Write poetry",
              "J1.3.3.2.3: Write drama",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          "Advanced Usage": {
            contentStandard: "J1.3.4.1: Demonstrate advanced grammar and usage",
            indicators: [
              "J1.3.4.1.1: Use complex grammatical structures",
              "J1.3.4.1.2: Understand nuances of meaning",
              "J1.3.4.1.3: Edit for grammatical accuracy",
            ],
          },
        },
      },
      Literature: {
        subStrands: {
          Prose: {
            contentStandard: "J1.3.5.1: Demonstrate understanding of prose",
            indicators: [
              "J1.3.5.1.1: Analyze novels",
              "J1.3.5.1.2: Understand narrative techniques",
              "J1.3.5.1.3: Write critical essays",
            ],
          },
          Poetry: {
            contentStandard: "J1.3.5.2: Demonstrate understanding of poetry",
            indicators: [
              "J1.3.5.2.1: Analyze poems",
              "J1.3.5.2.2: Understand poetic devices",
              "J1.3.5.2.3: Write poetry",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Listening and Speaking": {
        subStrands: {
          "Critical Discourse": {
            contentStandard: "J2.3.1.1: Demonstrate critical discourse skills",
            indicators: [
              "J2.3.1.1.1: Engage in critical discussions",
              "J2.3.1.1.2: Analyze spoken arguments",
              "J2.3.1.1.3: Construct logical arguments",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "World Literature": {
            contentStandard:
              "J2.3.2.1: Demonstrate understanding of world literature",
            indicators: [
              "J2.3.2.1.1: Read texts from different cultures",
              "J2.3.2.1.2: Compare literary traditions",
              "J2.3.2.1.3: Understand cultural contexts",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Argumentative Writing": {
            contentStandard:
              "J2.3.3.1: Demonstrate argumentative writing skills",
            indicators: [
              "J2.3.3.1.1: Write argumentative essays",
              "J2.3.3.1.2: Use evidence effectively",
              "J2.3.3.1.3: Address counterarguments",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          Stylistics: {
            contentStandard:
              "J2.3.4.1: Demonstrate understanding of stylistics",
            indicators: [
              "J2.3.4.1.1: Analyze style",
              "J2.3.4.1.2: Adapt style to purpose",
              "J2.3.4.1.3: Develop personal voice",
            ],
          },
        },
      },
      Literature: {
        subStrands: {
          Drama: {
            contentStandard: "J2.3.5.1: Demonstrate understanding of drama",
            indicators: [
              "J2.3.5.1.1: Analyze plays",
              "J2.3.5.1.2: Understand dramatic conventions",
              "J2.3.5.1.3: Perform dramatic scenes",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Listening and Speaking": {
        subStrands: {
          "Professional Communication": {
            contentStandard:
              "J3.3.1.1: Demonstrate professional communication skills",
            indicators: [
              "J3.3.1.1.1: Write formal letters",
              "J3.3.1.1.2: Conduct interviews",
              "J3.3.1.1.3: Make formal presentations",
            ],
          },
        },
      },
      Reading: {
        subStrands: {
          "Exam Preparation": {
            contentStandard: "J3.3.2.1: Demonstrate exam reading skills",
            indicators: [
              "J3.3.2.1.1: Answer comprehension questions",
              "J3.3.2.1.2: Analyze unseen texts",
              "J3.3.2.1.3: Write critical responses",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Exam Writing": {
            contentStandard: "J3.3.3.1: Demonstrate exam writing skills",
            indicators: [
              "J3.3.3.1.1: Write under time pressure",
              "J3.3.3.1.2: Address exam prompts",
              "J3.3.3.1.3: Produce polished writing",
            ],
          },
        },
      },
      "Grammar and Usage": {
        subStrands: {
          "Exam Grammar": {
            contentStandard: "J3.3.4.1: Demonstrate exam grammar skills",
            indicators: [
              "J3.3.4.1.1: Complete grammar exercises",
              "J3.3.4.1.2: Correct errors",
              "J3.3.4.1.3: Transform sentences",
            ],
          },
        },
      },
      Literature: {
        subStrands: {
          "Set Texts": {
            contentStandard: "J3.3.5.1: Demonstrate understanding of set texts",
            indicators: [
              "J3.3.5.1.1: Analyze set texts",
              "J3.3.5.1.2: Write critical essays",
              "J3.3.5.1.3: Answer exam questions",
            ],
          },
        },
      },
    },
    "SHS 1": {
      "Reading Comprehension": {
        subStrands: {
          "Advanced Comprehension": {
            contentStandard:
              "S1.3.1.1: Demonstrate advanced reading comprehension",
            indicators: [
              "S1.3.1.1.1: Analyze complex texts",
              "S1.3.1.1.2: Evaluate arguments",
              "S1.3.1.1.3: Synthesize information",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Academic Writing": {
            contentStandard: "S1.3.2.1: Demonstrate academic writing skills",
            indicators: [
              "S1.3.2.1.1: Write research papers",
              "S1.3.2.1.2: Use academic conventions",
              "S1.3.2.1.3: Cite sources correctly",
            ],
          },
        },
      },
      Grammar: {
        subStrands: {
          "Advanced Grammar": {
            contentStandard: "S1.3.3.1: Demonstrate advanced grammar",
            indicators: [
              "S1.3.3.1.1: Use complex structures",
              "S1.3.3.1.2: Understand grammatical nuances",
              "S1.3.3.1.3: Edit for style",
            ],
          },
        },
      },
      Literature: {
        subStrands: {
          "Literary Criticism": {
            contentStandard:
              "S1.3.4.1: Demonstrate understanding of literary criticism",
            indicators: [
              "S1.3.4.1.1: Apply critical theories",
              "S1.3.4.1.2: Write critical essays",
              "S1.3.4.1.3: Engage in literary debates",
            ],
          },
        },
      },
    },
    "SHS 2": {
      "Reading Comprehension": {
        subStrands: {
          "Critical Reading": {
            contentStandard: "S2.3.1.1: Demonstrate critical reading skills",
            indicators: [
              "S2.3.1.1.1: Read critically",
              "S2.3.1.1.2: Evaluate sources",
              "S2.3.1.1.3: Synthesize multiple texts",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "Professional Writing": {
            contentStandard:
              "S2.3.2.1: Demonstrate professional writing skills",
            indicators: [
              "S2.3.2.1.1: Write professional documents",
              "S2.3.2.1.2: Use appropriate register",
              "S2.3.2.1.3: Edit for publication",
            ],
          },
        },
      },
      Grammar: {
        subStrands: {
          "Applied Grammar": {
            contentStandard: "S2.3.3.1: Demonstrate applied grammar skills",
            indicators: [
              "S2.3.3.1.1: Apply grammar rules",
              "S2.3.3.1.2: Understand language variation",
              "S2.3.3.1.3: Edit for clarity",
            ],
          },
        },
      },
      Literature: {
        subStrands: {
          "Comparative Literature": {
            contentStandard:
              "S2.3.4.1: Demonstrate understanding of comparative literature",
            indicators: [
              "S2.3.4.1.1: Compare texts",
              "S2.3.4.1.2: Understand literary movements",
              "S2.3.4.1.3: Write comparative essays",
            ],
          },
        },
      },
    },
    "SHS 3": {
      "Reading Comprehension": {
        subStrands: {
          "WASSCE Preparation": {
            contentStandard: "S3.3.1.1: Demonstrate WASSCE reading skills",
            indicators: [
              "S3.3.1.1.1: Answer WASSCE comprehension questions",
              "S3.3.1.1.2: Analyze WASSCE texts",
              "S3.3.1.1.3: Manage time effectively",
            ],
          },
        },
      },
      Writing: {
        subStrands: {
          "WASSCE Writing": {
            contentStandard: "S3.3.2.1: Demonstrate WASSCE writing skills",
            indicators: [
              "S3.3.2.1.1: Write WASSCE essays",
              "S3.3.2.1.2: Address WASSCE prompts",
              "S3.3.2.1.3: Achieve high scores",
            ],
          },
        },
      },
      Grammar: {
        subStrands: {
          "WASSCE Grammar": {
            contentStandard: "S3.3.3.1: Demonstrate WASSCE grammar skills",
            indicators: [
              "S3.3.3.1.1: Complete WASSCE grammar exercises",
              "S3.3.3.1.2: Correct WASSCE errors",
              "S3.3.3.1.3: Achieve high scores",
            ],
          },
        },
      },
      Literature: {
        subStrands: {
          "WASSCE Literature": {
            contentStandard: "S3.3.4.1: Demonstrate WASSCE literature skills",
            indicators: [
              "S3.3.4.1.1: Analyze WASSCE set texts",
              "S3.3.4.1.2: Write WASSCE essays",
              "S3.3.4.1.3: Achieve high scores",
            ],
          },
        },
      },
    },
  },
  "Social Studies": {
    "Basic 4": {
      "Culture and Identity": {
        subStrands: {
          "Ghanaian Culture": {
            contentStandard:
              "B4.4.1.1: Demonstrate understanding of Ghanaian culture",
            indicators: [
              "B4.4.1.1.1: Identify elements of Ghanaian culture",
              "B4.4.1.1.2: Understand cultural diversity",
              "B4.4.1.1.3: Appreciate cultural heritage",
            ],
          },
        },
      },
      "Time, Continuity and Change": {
        subStrands: {
          "Ghana History": {
            contentStandard:
              "B4.4.2.1: Demonstrate understanding of Ghana's history",
            indicators: [
              "B4.4.2.1.1: Understand pre-colonial Ghana",
              "B4.4.2.1.2: Understand colonial period",
              "B4.4.2.1.3: Understand independence",
            ],
          },
        },
      },
      "People and Environment": {
        subStrands: {
          Environment: {
            contentStandard:
              "B4.4.3.1: Demonstrate understanding of the environment",
            indicators: [
              "B4.4.3.1.1: Understand Ghana's geography",
              "B4.4.3.1.2: Understand environmental issues",
              "B4.4.3.1.3: Promote environmental conservation",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          Citizenship: {
            contentStandard:
              "B4.4.4.1: Demonstrate understanding of citizenship",
            indicators: [
              "B4.4.4.1.1: Understand rights and responsibilities",
              "B4.4.4.1.2: Understand democratic values",
              "B4.4.4.1.3: Participate in community",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Culture and Identity": {
        subStrands: {
          "Cultural Identity": {
            contentStandard:
              "B5.4.1.1: Demonstrate understanding of cultural identity",
            indicators: [
              "B5.4.1.1.1: Understand cultural identity formation",
              "B5.4.1.1.2: Appreciate cultural diversity",
              "B5.4.1.1.3: Promote cultural tolerance",
            ],
          },
        },
      },
      "Time, Continuity and Change": {
        subStrands: {
          "Historical Inquiry": {
            contentStandard:
              "B5.4.2.1: Demonstrate understanding of historical inquiry",
            indicators: [
              "B5.4.2.1.1: Use historical sources",
              "B5.4.2.1.2: Understand cause and effect",
              "B5.4.2.1.3: Make historical connections",
            ],
          },
        },
      },
      "People and Environment": {
        subStrands: {
          "Sustainable Development": {
            contentStandard:
              "B5.4.3.1: Demonstrate understanding of sustainable development",
            indicators: [
              "B5.4.3.1.1: Understand sustainable practices",
              "B5.4.3.1.2: Promote sustainability",
              "B5.4.3.1.3: Take environmental action",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "Democratic Governance": {
            contentStandard:
              "B5.4.4.1: Demonstrate understanding of democratic governance",
            indicators: [
              "B5.4.4.1.1: Understand democratic institutions",
              "B5.4.4.1.2: Participate in democracy",
              "B5.4.4.1.3: Promote good governance",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Culture and Identity": {
        subStrands: {
          "Global Citizenship": {
            contentStandard:
              "B6.4.1.1: Demonstrate understanding of global citizenship",
            indicators: [
              "B6.4.1.1.1: Understand global interconnectedness",
              "B6.4.1.1.2: Appreciate global diversity",
              "B6.4.1.1.3: Act as global citizens",
            ],
          },
        },
      },
      "Time, Continuity and Change": {
        subStrands: {
          "Contemporary Issues": {
            contentStandard:
              "B6.4.2.1: Demonstrate understanding of contemporary issues",
            indicators: [
              "B6.4.2.1.1: Analyze current events",
              "B6.4.2.1.2: Understand historical context",
              "B6.4.2.1.3: Propose solutions",
            ],
          },
        },
      },
      "People and Environment": {
        subStrands: {
          "Resource Management": {
            contentStandard:
              "B6.4.3.1: Demonstrate understanding of resource management",
            indicators: [
              "B6.4.3.1.1: Understand resource distribution",
              "B6.4.3.1.2: Promote equitable use",
              "B6.4.3.1.3: Manage resources sustainably",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "Rule of Law": {
            contentStandard:
              "B6.4.4.1: Demonstrate understanding of the rule of law",
            indicators: [
              "B6.4.4.1.1: Understand legal systems",
              "B6.4.4.1.2: Respect the law",
              "B6.4.4.1.3: Promote justice",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Culture and Identity": {
        subStrands: {
          "Cultural Analysis": {
            contentStandard:
              "J1.4.1.1: Demonstrate understanding of cultural analysis",
            indicators: [
              "J1.4.1.1.1: Analyze cultural phenomena",
              "J1.4.1.1.2: Understand cultural change",
              "J1.4.1.1.3: Promote cultural understanding",
            ],
          },
        },
      },
      "Time, Continuity and Change": {
        subStrands: {
          "Historical Interpretation": {
            contentStandard:
              "J1.4.2.1: Demonstrate understanding of historical interpretation",
            indicators: [
              "J1.4.2.1.1: Interpret historical events",
              "J1.4.2.1.2: Understand multiple perspectives",
              "J1.4.2.1.3: Construct historical arguments",
            ],
          },
        },
      },
      "People and Environment": {
        subStrands: {
          "Population Studies": {
            contentStandard:
              "J1.4.3.1: Demonstrate understanding of population studies",
            indicators: [
              "J1.4.3.1.1: Understand population dynamics",
              "J1.4.3.1.2: Analyze population trends",
              "J1.4.3.1.3: Address population challenges",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "Political Systems": {
            contentStandard:
              "J1.4.4.1: Demonstrate understanding of political systems",
            indicators: [
              "J1.4.4.1.1: Compare political systems",
              "J1.4.4.1.2: Understand Ghana's political system",
              "J1.4.4.1.3: Participate in politics",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Culture and Identity": {
        subStrands: {
          "Cultural Diplomacy": {
            contentStandard:
              "J2.4.1.1: Demonstrate understanding of cultural diplomacy",
            indicators: [
              "J2.4.1.1.1: Understand cultural exchange",
              "J2.4.1.1.2: Promote cultural understanding",
              "J2.4.1.1.3: Engage in cultural diplomacy",
            ],
          },
        },
      },
      "Time, Continuity and Change": {
        subStrands: {
          "Economic History": {
            contentStandard:
              "J2.4.2.1: Demonstrate understanding of economic history",
            indicators: [
              "J2.4.2.1.1: Understand economic development",
              "J2.4.2.1.2: Analyze economic change",
              "J2.4.2.1.3: Learn from economic history",
            ],
          },
        },
      },
      "People and Environment": {
        subStrands: {
          "Urban Studies": {
            contentStandard:
              "J2.4.3.1: Demonstrate understanding of urban studies",
            indicators: [
              "J2.4.3.1.1: Understand urbanization",
              "J2.4.3.1.2: Analyze urban problems",
              "J2.4.3.1.3: Plan sustainable cities",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "Human Rights": {
            contentStandard:
              "J2.4.4.1: Demonstrate understanding of human rights",
            indicators: [
              "J2.4.4.1.1: Understand human rights",
              "J2.4.4.1.2: Promote human rights",
              "J2.4.4.1.3: Defend human rights",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Culture and Identity": {
        subStrands: {
          "National Identity": {
            contentStandard:
              "J3.4.1.1: Demonstrate understanding of national identity",
            indicators: [
              "J3.4.1.1.1: Understand Ghanaian identity",
              "J3.4.1.1.2: Promote national unity",
              "J3.4.1.1.3: Build national pride",
            ],
          },
        },
      },
      "Time, Continuity and Change": {
        subStrands: {
          "Development Studies": {
            contentStandard:
              "J3.4.2.1: Demonstrate understanding of development studies",
            indicators: [
              "J3.4.2.1.1: Understand development theories",
              "J3.4.2.1.2: Analyze development challenges",
              "J3.4.2.1.3: Propose development solutions",
            ],
          },
        },
      },
      "People and Environment": {
        subStrands: {
          "Global Issues": {
            contentStandard:
              "J3.4.3.1: Demonstrate understanding of global issues",
            indicators: [
              "J3.4.3.1.1: Understand global challenges",
              "J3.4.3.1.2: Analyze global responses",
              "J3.4.3.1.3: Take global action",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "Civic Engagement": {
            contentStandard:
              "J3.4.4.1: Demonstrate understanding of civic engagement",
            indicators: [
              "J3.4.4.1.1: Understand civic responsibility",
              "J3.4.4.1.2: Engage in civic action",
              "J3.4.4.1.3: Lead community development",
            ],
          },
        },
      },
    },
    "SHS 1": {
      "Culture and Identity": {
        subStrands: {
          "Cultural Studies": {
            contentStandard:
              "S1.4.1.1: Demonstrate understanding of cultural studies",
            indicators: [
              "S1.4.1.1.1: Analyze culture critically",
              "S1.4.1.1.2: Understand cultural theory",
              "S1.4.1.1.3: Conduct cultural research",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "Political Philosophy": {
            contentStandard:
              "S1.4.2.1: Demonstrate understanding of political philosophy",
            indicators: [
              "S1.4.2.1.1: Understand political theories",
              "S1.4.2.1.2: Analyze political ideas",
              "S1.4.2.1.3: Construct political arguments",
            ],
          },
        },
      },
      "Economics and Development": {
        subStrands: {
          "Development Economics": {
            contentStandard:
              "S1.4.3.1: Demonstrate understanding of development economics",
            indicators: [
              "S1.4.3.1.1: Understand economic development",
              "S1.4.3.1.2: Analyze development policies",
              "S1.4.3.1.3: Propose development strategies",
            ],
          },
        },
      },
    },
    "SHS 2": {
      "Culture and Identity": {
        subStrands: {
          "Intercultural Communication": {
            contentStandard:
              "S2.4.1.1: Demonstrate understanding of intercultural communication",
            indicators: [
              "S2.4.1.1.1: Understand cultural differences",
              "S2.4.1.1.2: Communicate across cultures",
              "S2.4.1.1.3: Mediate cultural conflicts",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "International Relations": {
            contentStandard:
              "S2.4.2.1: Demonstrate understanding of international relations",
            indicators: [
              "S2.4.2.1.1: Understand international systems",
              "S2.4.2.1.2: Analyze international issues",
              "S2.4.2.1.3: Engage in international affairs",
            ],
          },
        },
      },
      "Economics and Development": {
        subStrands: {
          "Sustainable Development": {
            contentStandard:
              "S2.4.3.1: Demonstrate understanding of sustainable development",
            indicators: [
              "S2.4.3.1.1: Understand sustainability",
              "S2.4.3.1.2: Implement sustainable practices",
              "S2.4.3.1.3: Promote sustainable development",
            ],
          },
        },
      },
    },
    "SHS 3": {
      "Culture and Identity": {
        subStrands: {
          "African Studies": {
            contentStandard:
              "S3.4.1.1: Demonstrate understanding of African studies",
            indicators: [
              "S3.4.1.1.1: Understand African cultures",
              "S3.4.1.1.2: Analyze African issues",
              "S3.4.1.1.3: Promote African development",
            ],
          },
        },
      },
      "Governance and Citizenship": {
        subStrands: {
          "Public Policy": {
            contentStandard:
              "S3.4.2.1: Demonstrate understanding of public policy",
            indicators: [
              "S3.4.2.1.1: Understand policy processes",
              "S3.4.2.1.2: Analyze policies",
              "S3.4.2.1.3: Formulate policies",
            ],
          },
        },
      },
      "Economics and Development": {
        subStrands: {
          "Project Management": {
            contentStandard:
              "S3.4.3.1: Demonstrate understanding of project management",
            indicators: [
              "S3.4.3.1.1: Understand project cycles",
              "S3.4.3.1.2: Manage projects",
              "S3.4.3.1.3: Evaluate projects",
            ],
          },
        },
      },
    },
  },
  Computing: {
    "Basic 1": {
      "Digital Literacy": {
        subStrands: {
          "Computer Basics": {
            contentStandard:
              "B1.5.1.1: Demonstrate understanding of computer basics",
            indicators: [
              "B1.5.1.1.1: Identify parts of a computer",
              "B1.5.1.1.2: Use a mouse and keyboard",
              "B1.5.1.1.3: Follow basic computer rules",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          "Problem Solving": {
            contentStandard:
              "B1.5.2.1: Demonstrate basic problem-solving skills",
            indicators: [
              "B1.5.2.1.1: Follow step-by-step instructions",
              "B1.5.2.1.2: Recognize patterns",
              "B1.5.2.1.3: Break problems into parts",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Digital Literacy": {
        subStrands: {
          "Using Software": {
            contentStandard:
              "B2.5.1.1: Demonstrate ability to use basic software",
            indicators: [
              "B2.5.1.1.1: Use drawing software",
              "B2.5.1.1.2: Use educational games",
              "B2.5.1.1.3: Save and open files",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          Algorithms: {
            contentStandard:
              "B2.5.2.1: Demonstrate understanding of algorithms",
            indicators: [
              "B2.5.2.1.1: Write simple instructions",
              "B2.5.2.1.2: Follow algorithms",
              "B2.5.2.1.3: Debug simple errors",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Digital Literacy": {
        subStrands: {
          "Internet Safety": {
            contentStandard:
              "B3.5.1.1: Demonstrate understanding of internet safety",
            indicators: [
              "B3.5.1.1.1: Understand online risks",
              "B3.5.1.1.2: Practice safe online behavior",
              "B3.5.1.1.3: Report online problems",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          Logic: {
            contentStandard: "B3.5.2.1: Demonstrate logical thinking",
            indicators: [
              "B3.5.2.1.1: Use if-then statements",
              "B3.5.2.1.2: Make logical decisions",
              "B3.5.2.1.3: Solve logic puzzles",
            ],
          },
        },
      },
      Programming: {
        subStrands: {
          "Block Programming": {
            contentStandard:
              "B3.5.3.1: Demonstrate understanding of block programming",
            indicators: [
              "B3.5.3.1.1: Use block-based programming",
              "B3.5.3.1.2: Create simple programs",
              "B3.5.3.1.3: Debug programs",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Digital Literacy": {
        subStrands: {
          "Productivity Tools": {
            contentStandard:
              "B4.5.1.1: Demonstrate ability to use productivity tools",
            indicators: [
              "B4.5.1.1.1: Use word processing software",
              "B4.5.1.1.2: Create presentations",
              "B4.5.1.1.3: Use spreadsheets",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          "Data Representation": {
            contentStandard:
              "B4.5.2.1: Demonstrate understanding of data representation",
            indicators: [
              "B4.5.2.1.1: Understand binary numbers",
              "B4.5.2.1.2: Represent data visually",
              "B4.5.2.1.3: Organize data",
            ],
          },
        },
      },
      Programming: {
        subStrands: {
          "Introduction to Coding": {
            contentStandard: "B4.5.3.1: Demonstrate understanding of coding",
            indicators: [
              "B4.5.3.1.1: Write simple code",
              "B4.5.3.1.2: Use variables",
              "B4.5.3.1.3: Create interactive programs",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Digital Literacy": {
        subStrands: {
          "Digital Citizenship": {
            contentStandard: "B5.5.1.1: Demonstrate digital citizenship",
            indicators: [
              "B5.5.1.1.1: Understand digital footprint",
              "B5.5.1.1.2: Practice ethical online behavior",
              "B5.5.1.1.3: Respect digital rights",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          Abstraction: {
            contentStandard:
              "B5.5.2.1: Demonstrate understanding of abstraction",
            indicators: [
              "B5.5.2.1.1: Identify relevant information",
              "B5.5.2.1.2: Generalize patterns",
              "B5.5.2.1.3: Create models",
            ],
          },
        },
      },
      Programming: {
        subStrands: {
          "Text-based Programming": {
            contentStandard:
              "B5.5.3.1: Demonstrate understanding of text-based programming",
            indicators: [
              "B5.5.3.1.1: Write text-based code",
              "B5.5.3.1.2: Use control structures",
              "B5.5.3.1.3: Create functions",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Digital Literacy": {
        subStrands: {
          "Information Management": {
            contentStandard:
              "B6.5.1.1: Demonstrate ability to manage information",
            indicators: [
              "B6.5.1.1.1: Search effectively",
              "B6.5.1.1.2: Evaluate online sources",
              "B6.5.1.1.3: Organize digital information",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          "Systems Thinking": {
            contentStandard: "B6.5.2.1: Demonstrate systems thinking",
            indicators: [
              "B6.5.2.1.1: Understand system components",
              "B6.5.2.1.2: Analyze system interactions",
              "B6.5.2.1.3: Design systems",
            ],
          },
        },
      },
      Programming: {
        subStrands: {
          "App Development": {
            contentStandard: "B6.5.3.1: Demonstrate ability to develop apps",
            indicators: [
              "B6.5.3.1.1: Design app interfaces",
              "B6.5.3.1.2: Program app functionality",
              "B6.5.3.1.3: Test and debug apps",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Digital Literacy": {
        subStrands: {
          "Advanced Productivity": {
            contentStandard:
              "J1.5.1.1: Demonstrate advanced productivity skills",
            indicators: [
              "J1.5.1.1.1: Use advanced software features",
              "J1.5.1.1.2: Automate tasks",
              "J1.5.1.1.3: Collaborate digitally",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          "Algorithm Design": {
            contentStandard: "J1.5.2.1: Demonstrate algorithm design skills",
            indicators: [
              "J1.5.2.1.1: Design efficient algorithms",
              "J1.5.2.1.2: Analyze algorithm complexity",
              "J1.5.2.1.3: Optimize algorithms",
            ],
          },
        },
      },
      Programming: {
        subStrands: {
          "Python Programming": {
            contentStandard: "J1.5.3.1: Demonstrate Python programming skills",
            indicators: [
              "J1.5.3.1.1: Write Python code",
              "J1.5.3.1.2: Use data structures",
              "J1.5.3.1.3: Create Python applications",
            ],
          },
        },
      },
      "ICT and Society": {
        subStrands: {
          "Technology Impact": {
            contentStandard:
              "J1.5.4.1: Demonstrate understanding of technology impact",
            indicators: [
              "J1.5.4.1.1: Analyze technology effects",
              "J1.5.4.1.2: Understand digital divide",
              "J1.5.4.1.3: Promote responsible technology use",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Digital Literacy": {
        subStrands: {
          "Web Development": {
            contentStandard: "J2.5.1.1: Demonstrate web development skills",
            indicators: [
              "J2.5.1.1.1: Create web pages",
              "J2.5.1.1.2: Use HTML and CSS",
              "J2.5.1.1.3: Publish websites",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          "Data Analysis": {
            contentStandard: "J2.5.2.1: Demonstrate data analysis skills",
            indicators: [
              "J2.5.2.1.1: Collect and analyze data",
              "J2.5.2.1.2: Visualize data",
              "J2.5.2.1.3: Draw conclusions",
            ],
          },
        },
      },
      Programming: {
        subStrands: {
          "Database Programming": {
            contentStandard:
              "J2.5.3.1: Demonstrate database programming skills",
            indicators: [
              "J2.5.3.1.1: Design databases",
              "J2.5.3.1.2: Write SQL queries",
              "J2.5.3.1.3: Create database applications",
            ],
          },
        },
      },
      "ICT and Society": {
        subStrands: {
          Cybersecurity: {
            contentStandard:
              "J2.5.4.1: Demonstrate understanding of cybersecurity",
            indicators: [
              "J2.5.4.1.1: Understand security threats",
              "J2.5.4.1.2: Implement security measures",
              "J2.5.4.1.3: Promote cyber safety",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Digital Literacy": {
        subStrands: {
          "Multimedia Production": {
            contentStandard:
              "J3.5.1.1: Demonstrate multimedia production skills",
            indicators: [
              "J3.5.1.1.1: Create digital media",
              "J3.5.1.1.2: Edit audio and video",
              "J3.5.1.1.3: Publish multimedia content",
            ],
          },
        },
      },
      "Computational Thinking": {
        subStrands: {
          "AI Fundamentals": {
            contentStandard:
              "J3.5.2.1: Demonstrate understanding of AI fundamentals",
            indicators: [
              "J3.5.2.1.1: Understand AI concepts",
              "J3.5.2.1.2: Use AI tools",
              "J3.5.2.1.3: Develop AI applications",
            ],
          },
        },
      },
      Programming: {
        subStrands: {
          "Game Development": {
            contentStandard: "J3.5.3.1: Demonstrate game development skills",
            indicators: [
              "J3.5.3.1.1: Design games",
              "J3.5.3.1.2: Program game mechanics",
              "J3.5.3.1.3: Publish games",
            ],
          },
        },
      },
      "ICT and Society": {
        subStrands: {
          "Digital Entrepreneurship": {
            contentStandard: "J3.5.4.1: Demonstrate digital entrepreneurship",
            indicators: [
              "J3.5.4.1.1: Identify digital opportunities",
              "J3.5.4.1.2: Develop digital products",
              "J3.5.4.1.3: Market digital solutions",
            ],
          },
        },
      },
    },
    "SHS 1": {
      "Computer Studies": {
        subStrands: {
          "Computer Systems": {
            contentStandard:
              "S1.5.1.1: Demonstrate understanding of computer systems",
            indicators: [
              "S1.5.1.1.1: Understand hardware components",
              "S1.5.1.1.2: Understand operating systems",
              "S1.5.1.1.3: Troubleshoot problems",
            ],
          },
        },
      },
      "ICT Applications": {
        subStrands: {
          "Office Automation": {
            contentStandard: "S1.5.2.1: Demonstrate office automation skills",
            indicators: [
              "S1.5.2.1.1: Use advanced office software",
              "S1.5.2.1.2: Automate office tasks",
              "S1.5.2.1.3: Manage digital workflows",
            ],
          },
        },
      },
    },
    "SHS 2": {
      "Computer Studies": {
        subStrands: {
          "Network Systems": {
            contentStandard:
              "S2.5.1.1: Demonstrate understanding of network systems",
            indicators: [
              "S2.5.1.1.1: Understand network architecture",
              "S2.5.1.1.2: Configure networks",
              "S2.5.1.1.3: Manage network security",
            ],
          },
        },
      },
      "ICT Applications": {
        subStrands: {
          "E-commerce": {
            contentStandard: "S2.5.2.1: Demonstrate e-commerce skills",
            indicators: [
              "S2.5.2.1.1: Understand e-commerce models",
              "S2.5.2.1.2: Build e-commerce sites",
              "S2.5.2.1.3: Manage online businesses",
            ],
          },
        },
      },
    },
    "SHS 3": {
      "Computer Studies": {
        subStrands: {
          "Software Engineering": {
            contentStandard:
              "S3.5.1.1: Demonstrate software engineering skills",
            indicators: [
              "S3.5.1.1.1: Follow software development lifecycle",
              "S3.5.1.1.2: Use version control",
              "S3.5.1.1.3: Test software",
            ],
          },
        },
      },
      "ICT Applications": {
        subStrands: {
          "Capstone Project": {
            contentStandard: "S3.5.2.1: Demonstrate ICT project management",
            indicators: [
              "S3.5.2.1.1: Plan ICT projects",
              "S3.5.2.1.2: Implement projects",
              "S3.5.2.1.3: Evaluate project outcomes",
            ],
          },
        },
      },
    },
  },
  RME: {
    "Basic 1": {
      "Beliefs and Practices": {
        subStrands: {
          "Introduction to Religion": {
            contentStandard:
              "B1.6.1.1: Demonstrate understanding of religious beliefs",
            indicators: [
              "B1.6.1.1.1: Identify major religions",
              "B1.6.1.1.2: Understand basic religious practices",
              "B1.6.1.1.3: Respect religious diversity",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          "Good Character": {
            contentStandard:
              "B1.6.2.1: Demonstrate understanding of good character",
            indicators: [
              "B1.6.2.1.1: Identify good values",
              "B1.6.2.1.2: Practice good behavior",
              "B1.6.2.1.3: Show respect to others",
            ],
          },
        },
      },
      "Religious Figures": {
        subStrands: {
          "Important People": {
            contentStandard:
              "B1.6.3.1: Demonstrate understanding of religious figures",
            indicators: [
              "B1.6.3.1.1: Know important religious leaders",
              "B1.6.3.1.2: Learn from their examples",
              "B1.6.3.1.3: Emulate good qualities",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Beliefs and Practices": {
        subStrands: {
          "Religious Stories": {
            contentStandard:
              "B2.6.1.1: Demonstrate understanding of religious stories",
            indicators: [
              "B2.6.1.1.1: Retell religious stories",
              "B2.6.1.1.2: Understand moral lessons",
              "B2.6.1.1.3: Apply lessons to life",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          "Honesty and Integrity": {
            contentStandard: "B2.6.2.1: Demonstrate understanding of honesty",
            indicators: [
              "B2.6.2.1.1: Understand the value of truth",
              "B2.6.2.1.2: Practice honesty",
              "B2.6.2.1.3: Stand for truth",
            ],
          },
        },
      },
      "Religious Figures": {
        subStrands: {
          "Prophets and Heroes": {
            contentStandard:
              "B2.6.3.1: Demonstrate understanding of prophets and heroes",
            indicators: [
              "B2.6.3.1.1: Know stories of prophets",
              "B2.6.3.1.2: Learn from their courage",
              "B2.6.3.1.3: Develop leadership qualities",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Beliefs and Practices": {
        subStrands: {
          Worship: {
            contentStandard: "B3.6.1.1: Demonstrate understanding of worship",
            indicators: [
              "B3.6.1.1.1: Understand forms of worship",
              "B3.6.1.1.2: Participate in worship",
              "B3.6.1.1.3: Appreciate worship diversity",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          Responsibility: {
            contentStandard:
              "B3.6.2.1: Demonstrate understanding of responsibility",
            indicators: [
              "B3.6.2.1.1: Understand duties",
              "B3.6.2.1.2: Fulfill responsibilities",
              "B3.6.2.1.3: Be accountable",
            ],
          },
        },
      },
      "Sacred Texts": {
        subStrands: {
          "Holy Books": {
            contentStandard:
              "B3.6.3.1: Demonstrate understanding of sacred texts",
            indicators: [
              "B3.6.3.1.1: Know about holy books",
              "B3.6.3.1.2: Read sacred texts",
              "B3.6.3.1.3: Apply teachings",
            ],
          },
        },
      },
      "Worship and Rituals": {
        subStrands: {
          "Religious Ceremonies": {
            contentStandard:
              "B3.6.4.1: Demonstrate understanding of religious ceremonies",
            indicators: [
              "B3.6.4.1.1: Understand religious festivals",
              "B3.6.4.1.2: Participate in ceremonies",
              "B3.6.4.1.3: Respect religious traditions",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Beliefs and Practices": {
        subStrands: {
          "Faith Systems": {
            contentStandard:
              "B4.6.1.1: Demonstrate understanding of faith systems",
            indicators: [
              "B4.6.1.1.1: Compare religious beliefs",
              "B4.6.1.1.2: Understand religious doctrines",
              "B4.6.1.1.3: Respect different faiths",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          "Social Ethics": {
            contentStandard:
              "B4.6.2.1: Demonstrate understanding of social ethics",
            indicators: [
              "B4.6.2.1.1: Understand moral principles",
              "B4.6.2.1.2: Make ethical decisions",
              "B4.6.2.1.3: Promote social justice",
            ],
          },
        },
      },
      "Sacred Texts": {
        subStrands: {
          "Scripture Study": {
            contentStandard: "B4.6.3.1: Demonstrate understanding of scripture",
            indicators: [
              "B4.6.3.1.1: Study sacred texts",
              "B4.6.3.1.2: Interpret teachings",
              "B4.6.3.1.3: Live by scripture",
            ],
          },
        },
      },
      "Worship and Rituals": {
        subStrands: {
          "Prayer and Meditation": {
            contentStandard:
              "B4.6.4.1: Demonstrate understanding of prayer and meditation",
            indicators: [
              "B4.6.4.1.1: Understand prayer forms",
              "B4.6.4.1.2: Practice prayer",
              "B4.6.4.1.3: Develop spiritual life",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Beliefs and Practices": {
        subStrands: {
          "Religious Pluralism": {
            contentStandard:
              "B5.6.1.1: Demonstrate understanding of religious pluralism",
            indicators: [
              "B5.6.1.1.1: Understand religious diversity",
              "B5.6.1.1.2: Promote interfaith dialogue",
              "B5.6.1.1.3: Build religious harmony",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          "Moral Reasoning": {
            contentStandard: "B5.6.2.1: Demonstrate moral reasoning",
            indicators: [
              "B5.6.2.1.1: Analyze moral dilemmas",
              "B5.6.2.1.2: Apply ethical frameworks",
              "B5.6.2.1.3: Make moral choices",
            ],
          },
        },
      },
      "Sacred Texts": {
        subStrands: {
          "Comparative Scripture": {
            contentStandard:
              "B5.6.3.1: Demonstrate understanding of comparative scripture",
            indicators: [
              "B5.6.3.1.1: Compare sacred texts",
              "B5.6.3.1.2: Find common themes",
              "B5.6.3.1.3: Appreciate diversity",
            ],
          },
        },
      },
      "Worship and Rituals": {
        subStrands: {
          "Religious Festivals": {
            contentStandard:
              "B5.6.4.1: Demonstrate understanding of religious festivals",
            indicators: [
              "B5.6.4.1.1: Understand festival meanings",
              "B5.6.4.1.2: Celebrate festivals",
              "B5.6.4.1.3: Share celebrations",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Beliefs and Practices": {
        subStrands: {
          Theology: {
            contentStandard: "B6.6.1.1: Demonstrate understanding of theology",
            indicators: [
              "B6.6.1.1.1: Explore theological questions",
              "B6.6.1.1.2: Understand religious doctrines",
              "B6.6.1.1.3: Form personal beliefs",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          "Character Development": {
            contentStandard: "B6.6.2.1: Demonstrate character development",
            indicators: [
              "B6.6.2.1.1: Develop virtues",
              "B6.6.2.1.2: Build character",
              "B6.6.2.1.3: Lead by example",
            ],
          },
        },
      },
      "Sacred Texts": {
        subStrands: {
          Hermeneutics: {
            contentStandard:
              "B6.6.3.1: Demonstrate understanding of interpretation",
            indicators: [
              "B6.6.3.1.1: Use interpretation methods",
              "B6.6.3.1.2: Understand context",
              "B6.6.3.1.3: Apply interpretations",
            ],
          },
        },
      },
      "Worship and Rituals": {
        subStrands: {
          Spirituality: {
            contentStandard:
              "B6.6.4.1: Demonstrate understanding of spirituality",
            indicators: [
              "B6.6.4.1.1: Explore spiritual practices",
              "B6.6.4.1.2: Develop spiritual discipline",
              "B6.6.4.1.3: Nurture spiritual growth",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Beliefs and Practices": {
        subStrands: {
          "World Religions": {
            contentStandard:
              "J1.6.1.1: Demonstrate understanding of world religions",
            indicators: [
              "J1.6.1.1.1: Study major world religions",
              "J1.6.1.1.2: Compare religious practices",
              "J1.6.1.1.3: Promote religious tolerance",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          "Applied Ethics": {
            contentStandard: "J1.6.2.1: Demonstrate applied ethics",
            indicators: [
              "J1.6.2.1.1: Apply ethics to real situations",
              "J1.6.2.1.2: Resolve ethical conflicts",
              "J1.6.2.1.3: Advocate for ethics",
            ],
          },
        },
      },
      "Sacred Texts": {
        subStrands: {
          "Textual Analysis": {
            contentStandard: "J1.6.3.1: Demonstrate textual analysis skills",
            indicators: [
              "J1.6.3.1.1: Analyze sacred texts",
              "J1.6.3.1.2: Understand literary forms",
              "J1.6.3.1.3: Extract meanings",
            ],
          },
        },
      },
      "Worship and Rituals": {
        subStrands: {
          "Comparative Worship": {
            contentStandard:
              "J1.6.4.1: Demonstrate understanding of comparative worship",
            indicators: [
              "J1.6.4.1.1: Compare worship practices",
              "J1.6.4.1.2: Understand worship meanings",
              "J1.6.4.1.3: Respect worship diversity",
            ],
          },
        },
      },
      "Religious Leadership": {
        subStrands: {
          "Leadership Qualities": {
            contentStandard:
              "J1.6.5.1: Demonstrate understanding of religious leadership",
            indicators: [
              "J1.6.5.1.1: Understand leadership roles",
              "J1.6.5.1.2: Develop leadership skills",
              "J1.6.5.1.3: Serve others",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Beliefs and Practices": {
        subStrands: {
          "Religious Experience": {
            contentStandard:
              "J2.6.1.1: Demonstrate understanding of religious experience",
            indicators: [
              "J2.6.1.1.1: Explore religious experiences",
              "J2.6.1.1.2: Understand mystical traditions",
              "J2.6.1.1.3: Respect spiritual experiences",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          Bioethics: {
            contentStandard: "J2.6.2.1: Demonstrate understanding of bioethics",
            indicators: [
              "J2.6.2.1.1: Understand bioethical issues",
              "J2.6.2.1.2: Analyze ethical dimensions",
              "J2.6.2.1.3: Form ethical positions",
            ],
          },
        },
      },
      "Sacred Texts": {
        subStrands: {
          Prophecy: {
            contentStandard: "J2.6.3.1: Demonstrate understanding of prophecy",
            indicators: [
              "J2.6.3.1.1: Study prophetic traditions",
              "J2.6.3.1.2: Understand prophetic messages",
              "J2.6.3.1.3: Apply prophetic insights",
            ],
          },
        },
      },
      "Worship and Rituals": {
        subStrands: {
          Sacraments: {
            contentStandard:
              "J2.6.4.1: Demonstrate understanding of sacraments",
            indicators: [
              "J2.6.4.1.1: Understand sacramental theology",
              "J2.6.4.1.2: Participate in sacraments",
              "J2.6.4.1.3: Appreciate sacramental life",
            ],
          },
        },
      },
      "Religious Leadership": {
        subStrands: {
          Ministry: {
            contentStandard: "J2.6.5.1: Demonstrate understanding of ministry",
            indicators: [
              "J2.6.5.1.1: Understand ministry roles",
              "J2.6.5.1.2: Develop ministry skills",
              "J2.6.5.1.3: Engage in service",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Beliefs and Practices": {
        subStrands: {
          "Religion and Society": {
            contentStandard:
              "J3.6.1.1: Demonstrate understanding of religion and society",
            indicators: [
              "J3.6.1.1.1: Analyze religion's social role",
              "J3.6.1.1.2: Understand secularism",
              "J3.6.1.1.3: Promote religious contribution",
            ],
          },
        },
      },
      "Morals and Values": {
        subStrands: {
          "Professional Ethics": {
            contentStandard:
              "J3.6.2.1: Demonstrate understanding of professional ethics",
            indicators: [
              "J3.6.2.1.1: Understand professional codes",
              "J3.6.2.1.2: Apply ethical standards",
              "J3.6.2.1.3: Maintain integrity",
            ],
          },
        },
      },
      "Sacred Texts": {
        subStrands: {
          "Contemporary Application": {
            contentStandard:
              "J3.6.3.1: Demonstrate contemporary application of scripture",
            indicators: [
              "J3.6.3.1.1: Apply ancient texts to modern issues",
              "J3.6.3.1.2: Address contemporary challenges",
              "J3.6.3.1.3: Provide religious guidance",
            ],
          },
        },
      },
      "Worship and Rituals": {
        subStrands: {
          "Life Cycle Rituals": {
            contentStandard:
              "J3.6.4.1: Demonstrate understanding of life cycle rituals",
            indicators: [
              "J3.6.4.1.1: Understand rites of passage",
              "J3.6.4.1.2: Participate in rituals",
              "J3.6.4.1.3: Mark life transitions",
            ],
          },
        },
      },
      "Religious Leadership": {
        subStrands: {
          "Community Leadership": {
            contentStandard: "J3.6.5.1: Demonstrate community leadership",
            indicators: [
              "J3.6.5.1.1: Lead community initiatives",
              "J3.6.5.1.2: Mobilize resources",
              "J3.6.5.1.3: Build community capacity",
            ],
          },
        },
      },
    },
    "SHS 1": {
      "Religious Beliefs": {
        subStrands: {
          "Philosophy of Religion": {
            contentStandard:
              "S1.6.1.1: Demonstrate understanding of philosophy of religion",
            indicators: [
              "S1.6.1.1.1: Explore philosophical questions",
              "S1.6.1.1.2: Analyze religious arguments",
              "S1.6.1.1.3: Construct philosophical positions",
            ],
          },
        },
      },
      "Ethics and Morality": {
        subStrands: {
          "Ethical Theories": {
            contentStandard:
              "S1.6.2.1: Demonstrate understanding of ethical theories",
            indicators: [
              "S1.6.2.1.1: Study ethical frameworks",
              "S1.6.2.1.2: Apply ethical theories",
              "S1.6.2.1.3: Develop ethical reasoning",
            ],
          },
        },
      },
      "Religious Practices": {
        subStrands: {
          "Comparative Religion": {
            contentStandard:
              "S1.6.3.1: Demonstrate understanding of comparative religion",
            indicators: [
              "S1.6.3.1.1: Compare religious traditions",
              "S1.6.3.1.2: Understand religious phenomena",
              "S1.6.3.1.3: Promote interreligious understanding",
            ],
          },
        },
      },
    },
    "SHS 2": {
      "Religious Beliefs": {
        subStrands: {
          Theology: {
            contentStandard: "S2.6.1.1: Demonstrate understanding of theology",
            indicators: [
              "S2.6.1.1.1: Study theological systems",
              "S2.6.1.1.2: Engage in theological reflection",
              "S2.6.1.1.3: Contribute to theological discourse",
            ],
          },
        },
      },
      "Ethics and Morality": {
        subStrands: {
          "Social Ethics": {
            contentStandard:
              "S2.6.2.1: Demonstrate understanding of social ethics",
            indicators: [
              "S2.6.2.1.1: Analyze social issues",
              "S2.6.2.1.2: Apply ethical principles",
              "S2.6.2.1.3: Advocate for justice",
            ],
          },
        },
      },
      "Religious Practices": {
        subStrands: {
          "Religious Studies": {
            contentStandard:
              "S2.6.3.1: Demonstrate understanding of religious studies",
            indicators: [
              "S2.6.3.1.1: Use academic methods",
              "S2.6.3.1.2: Conduct religious research",
              "S2.6.3.1.3: Publish findings",
            ],
          },
        },
      },
    },
    "SHS 3": {
      "Religious Beliefs": {
        subStrands: {
          Apologetics: {
            contentStandard:
              "S3.6.1.1: Demonstrate understanding of apologetics",
            indicators: [
              "S3.6.1.1.1: Defend religious beliefs",
              "S3.6.1.1.2: Engage in dialogue",
              "S3.6.1.1.3: Build faith",
            ],
          },
        },
      },
      "Ethics and Morality": {
        subStrands: {
          "Global Ethics": {
            contentStandard:
              "S3.6.2.1: Demonstrate understanding of global ethics",
            indicators: [
              "S3.6.2.1.1: Understand global ethical issues",
              "S3.6.2.1.2: Develop global ethical frameworks",
              "S3.6.2.1.3: Promote global ethical action",
            ],
          },
        },
      },
      "Religious Practices": {
        subStrands: {
          "Religious Counseling": {
            contentStandard:
              "S3.6.3.1: Demonstrate understanding of religious counseling",
            indicators: [
              "S3.6.3.1.1: Understand counseling principles",
              "S3.6.3.1.2: Provide pastoral care",
              "S3.6.3.1.3: Support spiritual growth",
            ],
          },
        },
      },
    },
  },
  History: {
    "Basic 1": {
      "Understanding the Past": {
        subStrands: {
          "Personal and Family History": {
            contentStandard:
              "B1.7.1.1: Demonstrate understanding of personal and family history",
            indicators: [
              "B1.7.1.1.1: Identify family members and relationships",
              "B1.7.1.1.2: Understand family traditions and celebrations",
              "B1.7.1.1.3: Share personal stories and experiences",
            ],
          },
        },
      },
      "Time and Change": {
        subStrands: {
          "Understanding Time": {
            contentStandard:
              "B1.7.2.1: Demonstrate understanding of time concepts",
            indicators: [
              "B1.7.2.1.1: Use words like before, after, now, then",
              "B1.7.2.1.2: Sequence events in order",
              "B1.7.2.1.3: Understand past, present and future",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Understanding the Past": {
        subStrands: {
          "Community History": {
            contentStandard:
              "B2.7.1.1: Demonstrate understanding of community history",
            indicators: [
              "B2.7.1.1.1: Identify important people in the community",
              "B2.7.1.1.2: Understand community traditions",
              "B2.7.1.1.3: Explore local landmarks and their significance",
            ],
          },
        },
      },
      "Time and Change": {
        subStrands: {
          "Changes Over Time": {
            contentStandard:
              "B2.7.2.1: Demonstrate understanding of changes over time",
            indicators: [
              "B2.7.2.1.1: Compare past and present ways of life",
              "B2.7.2.1.2: Identify things that change and stay the same",
              "B2.7.2.1.3: Use timelines to show sequence",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Understanding the Past": {
        subStrands: {
          "Ghana's Early History": {
            contentStandard:
              "B3.7.1.1: Demonstrate understanding of Ghana's early history",
            indicators: [
              "B3.7.1.1.1: Know about early settlements in Ghana",
              "B3.7.1.1.2: Understand traditional occupations",
              "B3.7.1.1.3: Explore oral traditions and stories",
            ],
          },
        },
      },
      "Sources of History": {
        subStrands: {
          "Historical Evidence": {
            contentStandard:
              "B3.7.2.1: Demonstrate understanding of historical evidence",
            indicators: [
              "B3.7.2.1.1: Identify different sources of history",
              "B3.7.2.1.2: Use artifacts to learn about the past",
              "B3.7.2.1.3: Understand oral history as a source",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Ghana's Kingdoms and Empires": {
        subStrands: {
          "Pre-Colonial States": {
            contentStandard:
              "B4.7.1.1: Demonstrate understanding of pre-colonial states",
            indicators: [
              "B4.7.1.1.1: Know about Ghana, Mali and Songhai empires",
              "B4.7.1.1.2: Understand trade routes and commerce",
              "B4.7.1.1.3: Explore political organization of empires",
            ],
          },
        },
      },
      "Cultural Heritage": {
        subStrands: {
          "Traditional Culture": {
            contentStandard:
              "B4.7.2.1: Demonstrate understanding of traditional culture",
            indicators: [
              "B4.7.2.1.1: Identify cultural symbols and meanings",
              "B4.7.2.1.2: Understand traditional festivals",
              "B4.7.2.1.3: Appreciate cultural diversity",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Colonial Period": {
        subStrands: {
          "European Contact": {
            contentStandard:
              "B5.7.1.1: Demonstrate understanding of European contact",
            indicators: [
              "B5.7.1.1.1: Know about early European explorers",
              "B5.7.1.1.2: Understand the slave trade",
              "B5.7.1.1.3: Explore impact of colonialism",
            ],
          },
        },
      },
      "Resistance and Nationalism": {
        subStrands: {
          "Freedom Struggles": {
            contentStandard:
              "B5.7.2.1: Demonstrate understanding of freedom struggles",
            indicators: [
              "B5.7.2.1.1: Know about resistance movements",
              "B5.7.2.1.2: Understand nationalist leaders",
              "B5.7.2.1.3: Appreciate the journey to independence",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Independence and Beyond": {
        subStrands: {
          "Ghana's Independence": {
            contentStandard:
              "B6.7.1.1: Demonstrate understanding of Ghana's independence",
            indicators: [
              "B6.7.1.1.1: Know key events leading to independence",
              "B6.7.1.1.2: Understand the role of Nkrumah",
              "B6.7.1.1.3: Appreciate independence achievements",
            ],
          },
        },
      },
      "Modern Ghana": {
        subStrands: {
          "Post-Independence Development": {
            contentStandard:
              "B6.7.2.1: Demonstrate understanding of post-independence Ghana",
            indicators: [
              "B6.7.2.1.1: Know about development projects",
              "B6.7.2.1.2: Understand political changes",
              "B6.7.2.1.3: Appreciate Ghana's role in Africa",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Historical Inquiry": {
        subStrands: {
          "Historical Methods": {
            contentStandard:
              "J1.7.1.1: Demonstrate understanding of historical methods",
            indicators: [
              "J1.7.1.1.1: Use primary and secondary sources",
              "J1.7.1.1.2: Evaluate historical evidence",
              "J1.7.1.1.3: Construct historical arguments",
            ],
          },
        },
      },
      "West African Civilizations": {
        subStrands: {
          "Ancient Civilizations": {
            contentStandard:
              "J1.7.2.1: Demonstrate understanding of West African civilizations",
            indicators: [
              "J1.7.2.1.1: Study ancient West African empires",
              "J1.7.2.1.2: Understand social and economic systems",
              "J1.7.2.1.3: Analyze cultural achievements",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Trans-Atlantic Trade": {
        subStrands: {
          "Slave Trade Era": {
            contentStandard:
              "J2.7.1.1: Demonstrate understanding of the trans-Atlantic slave trade",
            indicators: [
              "J2.7.1.1.1: Understand the triangular trade",
              "J2.7.1.1.2: Analyze impact on African societies",
              "J2.7.1.1.3: Study abolition movements",
            ],
          },
        },
      },
      "Colonial Rule": {
        subStrands: {
          "Colonial Administration": {
            contentStandard:
              "J2.7.2.1: Demonstrate understanding of colonial rule",
            indicators: [
              "J2.7.2.1.1: Understand colonial systems",
              "J2.7.2.1.2: Analyze economic exploitation",
              "J2.7.2.1.3: Study resistance and collaboration",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Nationalism and Independence": {
        subStrands: {
          "Independence Movements": {
            contentStandard:
              "J3.7.1.1: Demonstrate understanding of independence movements",
            indicators: [
              "J3.7.1.1.1: Study nationalist movements across Africa",
              "J3.7.1.1.2: Understand Pan-Africanism",
              "J3.7.1.1.3: Analyze decolonization processes",
            ],
          },
        },
      },
      "Contemporary Issues": {
        subStrands: {
          "Post-Colonial Challenges": {
            contentStandard:
              "J3.7.2.1: Demonstrate understanding of post-colonial challenges",
            indicators: [
              "J3.7.2.1.1: Analyze nation-building efforts",
              "J3.7.2.1.2: Understand development challenges",
              "J3.7.2.1.3: Explore solutions for progress",
            ],
          },
        },
      },
    },
  },
  "Career Technology": {
    "Basic 1": {
      "Exploring Careers": {
        subStrands: {
          "People and Their Work": {
            contentStandard:
              "B1.8.1.1: Demonstrate understanding of different occupations",
            indicators: [
              "B1.8.1.1.1: Identify different jobs in the community",
              "B1.8.1.1.2: Understand what people do at work",
              "B1.8.1.1.3: Appreciate all types of work",
            ],
          },
        },
      },
      "Basic Skills": {
        subStrands: {
          "Hand-Eye Coordination": {
            contentStandard: "B1.8.2.1: Demonstrate basic manual skills",
            indicators: [
              "B1.8.2.1.1: Use hands for simple tasks",
              "B1.8.2.1.2: Follow simple instructions",
              "B1.8.2.1.3: Complete basic projects",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Exploring Careers": {
        subStrands: {
          "Community Workers": {
            contentStandard:
              "B2.8.1.1: Demonstrate understanding of community workers",
            indicators: [
              "B2.8.1.1.1: Identify essential community workers",
              "B2.8.1.1.2: Understand their contributions",
              "B2.8.1.1.3: Show respect for all workers",
            ],
          },
        },
      },
      "Basic Skills": {
        subStrands: {
          "Tool Use": {
            contentStandard: "B2.8.2.1: Demonstrate safe use of simple tools",
            indicators: [
              "B2.8.2.1.1: Identify common tools",
              "B2.8.2.1.2: Use tools safely",
              "B2.8.2.1.3: Care for tools properly",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Career Awareness": {
        subStrands: {
          "Skills and Interests": {
            contentStandard:
              "B3.8.1.1: Demonstrate awareness of personal skills and interests",
            indicators: [
              "B3.8.1.1.1: Identify personal strengths",
              "B3.8.1.1.2: Explore different interests",
              "B3.8.1.1.3: Connect skills to careers",
            ],
          },
        },
      },
      "Technical Skills": {
        subStrands: {
          "Basic Craft Skills": {
            contentStandard: "B3.8.2.1: Demonstrate basic craft skills",
            indicators: [
              "B3.8.2.1.1: Create simple craft items",
              "B3.8.2.1.2: Follow step-by-step instructions",
              "B3.8.2.1.3: Complete projects with care",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Career Exploration": {
        subStrands: {
          "Career Clusters": {
            contentStandard:
              "B4.8.1.1: Demonstrate understanding of career clusters",
            indicators: [
              "B4.8.1.1.1: Identify different career fields",
              "B4.8.1.1.2: Understand education requirements",
              "B4.8.1.1.3: Explore career opportunities",
            ],
          },
        },
      },
      "Technical Skills": {
        subStrands: {
          "Basic Technology": {
            contentStandard:
              "B4.8.2.1: Demonstrate understanding of basic technology",
            indicators: [
              "B4.8.2.1.1: Use simple machines",
              "B4.8.2.1.2: Understand basic mechanics",
              "B4.8.2.1.3: Apply technology to solve problems",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Career Planning": {
        subStrands: {
          "Goal Setting": {
            contentStandard:
              "B5.8.1.1: Demonstrate ability to set career goals",
            indicators: [
              "B5.8.1.1.1: Set short-term and long-term goals",
              "B5.8.1.1.2: Create action plans",
              "B5.8.1.1.3: Monitor progress",
            ],
          },
        },
      },
      "Technical Skills": {
        subStrands: {
          "Applied Technology": {
            contentStandard: "B5.8.2.1: Demonstrate applied technology skills",
            indicators: [
              "B5.8.2.1.1: Apply technical knowledge",
              "B5.8.2.1.2: Solve practical problems",
              "B5.8.2.1.3: Innovate and improve designs",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Career Development": {
        subStrands: {
          "Workplace Skills": {
            contentStandard:
              "B6.8.1.1: Demonstrate understanding of workplace skills",
            indicators: [
              "B6.8.1.1.1: Understand workplace expectations",
              "B6.8.1.1.2: Develop professional behavior",
              "B6.8.1.1.3: Practice teamwork and communication",
            ],
          },
        },
      },
      "Technical Skills": {
        subStrands: {
          "Project Management": {
            contentStandard:
              "B6.8.2.1: Demonstrate basic project management skills",
            indicators: [
              "B6.8.2.1.1: Plan projects effectively",
              "B6.8.2.1.2: Manage time and resources",
              "B6.8.2.1.3: Evaluate project outcomes",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Career Exploration": {
        subStrands: {
          "Career Research": {
            contentStandard:
              "J1.8.1.1: Demonstrate ability to research careers",
            indicators: [
              "J1.8.1.1.1: Conduct career research",
              "J1.8.1.1.2: Analyze career information",
              "J1.8.1.1.3: Make informed career choices",
            ],
          },
        },
      },
      "Technical Skills": {
        subStrands: {
          "Design Thinking": {
            contentStandard: "J1.8.2.1: Demonstrate design thinking skills",
            indicators: [
              "J1.8.2.1.1: Identify problems and needs",
              "J1.8.2.1.2: Generate creative solutions",
              "J1.8.2.1.3: Prototype and test ideas",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Career Preparation": {
        subStrands: {
          "Skills Development": {
            contentStandard: "J2.8.1.1: Demonstrate career-related skills",
            indicators: [
              "J2.8.1.1.1: Develop technical skills",
              "J2.8.1.1.2: Build soft skills",
              "J2.8.1.1.3: Gain practical experience",
            ],
          },
        },
      },
      "Technical Skills": {
        subStrands: {
          "Advanced Applications": {
            contentStandard:
              "J2.8.2.1: Demonstrate advanced technical applications",
            indicators: [
              "J2.8.2.1.1: Apply advanced techniques",
              "J2.8.2.1.2: Use specialized tools",
              "J2.8.2.1.3: Complete complex projects",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Career Transition": {
        subStrands: {
          "Post-Basic Options": {
            contentStandard:
              "J3.8.1.1: Demonstrate understanding of post-basic options",
            indicators: [
              "J3.8.1.1.1: Explore SHS and TVET options",
              "J3.8.1.1.2: Understand entry requirements",
              "J3.8.1.1.3: Prepare for transitions",
            ],
          },
        },
      },
      "Technical Skills": {
        subStrands: {
          "Capstone Projects": {
            contentStandard:
              "J3.8.2.1: Demonstrate mastery of technical skills",
            indicators: [
              "J3.8.2.1.1: Complete comprehensive projects",
              "J3.8.2.1.2: Integrate multiple skills",
              "J3.8.2.1.3: Present and defend work",
            ],
          },
        },
      },
    },
  },
  "Creative Arts": {
    "Basic 1": {
      "Visual Arts": {
        subStrands: {
          "Drawing and Painting": {
            contentStandard:
              "B1.9.1.1: Demonstrate understanding of visual arts",
            indicators: [
              "B1.9.1.1.1: Use basic art materials",
              "B1.9.1.1.2: Create simple drawings and paintings",
              "B1.9.1.1.3: Express ideas through art",
            ],
          },
        },
      },
      "Music and Movement": {
        subStrands: {
          "Singing and Dancing": {
            contentStandard:
              "B1.9.2.1: Demonstrate understanding of music and movement",
            indicators: [
              "B1.9.2.1.1: Sing simple songs",
              "B1.9.2.1.2: Move to music rhythmically",
              "B1.9.2.1.3: Enjoy musical activities",
            ],
          },
        },
      },
    },
    "Basic 2": {
      "Visual Arts": {
        subStrands: {
          "Crafts and Modeling": {
            contentStandard: "B2.9.1.1: Demonstrate understanding of crafts",
            indicators: [
              "B2.9.1.1.1: Create craft items",
              "B2.9.1.1.2: Use various materials",
              "B2.9.1.1.3: Develop fine motor skills",
            ],
          },
        },
      },
      "Music and Movement": {
        subStrands: {
          "Rhythm and Beat": {
            contentStandard: "B2.9.2.1: Demonstrate understanding of rhythm",
            indicators: [
              "B2.9.2.1.1: Clap and keep beat",
              "B2.9.2.1.2: Play simple percussion instruments",
              "B2.9.2.1.3: Create simple rhythms",
            ],
          },
        },
      },
    },
    "Basic 3": {
      "Visual Arts": {
        subStrands: {
          "Art Elements": {
            contentStandard:
              "B3.9.1.1: Demonstrate understanding of art elements",
            indicators: [
              "B3.9.1.1.1: Identify line, shape, color",
              "B3.9.1.1.2: Use art elements in work",
              "B3.9.1.1.3: Appreciate beauty in art",
            ],
          },
        },
      },
      "Music and Movement": {
        subStrands: {
          "Musical Expression": {
            contentStandard: "B3.9.2.1: Demonstrate musical expression",
            indicators: [
              "B3.9.2.1.1: Express feelings through music",
              "B3.9.2.1.2: Interpret musical moods",
              "B3.9.2.1.3: Perform for others",
            ],
          },
        },
      },
    },
    "Basic 4": {
      "Visual Arts": {
        subStrands: {
          "Ghanaian Art": {
            contentStandard:
              "B4.9.1.1: Demonstrate understanding of Ghanaian art",
            indicators: [
              "B4.9.1.1.1: Identify Ghanaian art forms",
              "B4.9.1.1.2: Create traditional art",
              "B4.9.1.1.3: Appreciate cultural heritage",
            ],
          },
        },
      },
      "Performing Arts": {
        subStrands: {
          "Drama and Storytelling": {
            contentStandard: "B4.9.2.1: Demonstrate understanding of drama",
            indicators: [
              "B4.9.2.1.1: Act out stories",
              "B4.9.2.1.2: Use voice and gesture",
              "B4.9.2.1.3: Work collaboratively",
            ],
          },
        },
      },
    },
    "Basic 5": {
      "Visual Arts": {
        subStrands: {
          "Art Techniques": {
            contentStandard:
              "B5.9.1.1: Demonstrate understanding of art techniques",
            indicators: [
              "B5.9.1.1.1: Use various art techniques",
              "B5.9.1.1.2: Experiment with media",
              "B5.9.1.1.3: Develop personal style",
            ],
          },
        },
      },
      "Performing Arts": {
        subStrands: {
          "Traditional Performance": {
            contentStandard:
              "B5.9.2.1: Demonstrate understanding of traditional performance",
            indicators: [
              "B5.9.2.1.1: Learn traditional dances",
              "B5.9.2.1.2: Understand cultural meanings",
              "B5.9.2.1.3: Perform traditional arts",
            ],
          },
        },
      },
    },
    "Basic 6": {
      "Visual Arts": {
        subStrands: {
          "Art Criticism": {
            contentStandard:
              "B6.9.1.1: Demonstrate understanding of art criticism",
            indicators: [
              "B6.9.1.1.1: Analyze artworks",
              "B6.9.1.1.2: Express informed opinions",
              "B6.9.1.1.3: Appreciate diverse art forms",
            ],
          },
        },
      },
      "Performing Arts": {
        subStrands: {
          "Creative Performance": {
            contentStandard:
              "B6.9.2.1: Demonstrate creative performance skills",
            indicators: [
              "B6.9.2.1.1: Create original performances",
              "B6.9.2.1.2: Combine art forms",
              "B6.9.2.1.3: Present to audiences",
            ],
          },
        },
      },
    },
    "JHS 1": {
      "Visual Arts": {
        subStrands: {
          "Advanced Art": {
            contentStandard: "J1.9.1.1: Demonstrate advanced art skills",
            indicators: [
              "J1.9.1.1.1: Create sophisticated artworks",
              "J1.9.1.1.2: Use advanced techniques",
              "J1.9.1.1.3: Develop artistic voice",
            ],
          },
        },
      },
      "Performing Arts": {
        subStrands: {
          "Music Theory": {
            contentStandard:
              "J1.9.2.1: Demonstrate understanding of music theory",
            indicators: [
              "J1.9.2.1.1: Read musical notation",
              "J1.9.2.1.2: Understand musical structure",
              "J1.9.2.1.3: Apply theory to performance",
            ],
          },
        },
      },
    },
    "JHS 2": {
      "Visual Arts": {
        subStrands: {
          "Art History": {
            contentStandard:
              "J2.9.1.1: Demonstrate understanding of art history",
            indicators: [
              "J2.9.1.1.1: Study art movements",
              "J2.9.1.1.2: Understand historical context",
              "J2.9.1.1.3: Connect past and present",
            ],
          },
        },
      },
      "Performing Arts": {
        subStrands: {
          "Ensemble Performance": {
            contentStandard:
              "J2.9.2.1: Demonstrate ensemble performance skills",
            indicators: [
              "J2.9.2.1.1: Perform in groups",
              "J2.9.2.1.2: Listen and respond",
              "J2.9.2.1.3: Create cohesive performances",
            ],
          },
        },
      },
    },
    "JHS 3": {
      "Visual Arts": {
        subStrands: {
          "Portfolio Development": {
            contentStandard:
              "J3.9.1.1: Demonstrate ability to develop a portfolio",
            indicators: [
              "J3.9.1.1.1: Curate best work",
              "J3.9.1.1.2: Present work professionally",
              "J3.9.1.1.3: Reflect on artistic growth",
            ],
          },
        },
      },
      "Performing Arts": {
        subStrands: {
          "Final Performance": {
            contentStandard: "J3.9.2.1: Demonstrate mastery of performing arts",
            indicators: [
              "J3.9.2.1.1: Plan and execute performances",
              "J3.9.2.1.2: Integrate multiple skills",
              "J3.9.2.1.3: Demonstrate artistic excellence",
            ],
          },
        },
      },
    },
  },
};

/**
 * Montessori Curriculum Areas and Activities
 */
export const MONTESSORI_AREAS = {
  "Practical Life": {
    "Early Years": {
      "Care of Person": {
        contentStandard: "Developing independence and self-care skills",
        indicators: [
          "Dressing (buttons, zips, laces)",
          "Washing hands",
          "Combing hair",
          "Polishing shoes",
        ],
      },
      "Care of Environment": {
        contentStandard: "Learning to respect and care for surroundings",
        indicators: [
          "Dusting",
          "Sweeping",
          "Watering plants",
          "Table setting",
        ],
      },
      "Grace and Courtesy": {
        contentStandard: "Developing social skills and polite behavior",
        indicators: [
          "Greeting others",
          "Excuse me",
          "Walking around a mat",
          "Carrying a chair",
        ],
      },
    },
  },
  Sensorial: {
    "Early Years": {
      "Visual Discrimination": {
        contentStandard: "Refining the sense of sight",
        indicators: [
          "Pink Tower (dimensions)",
          "Brown Stair (width)",
          "Red Rods (length)",
          "Knobbed Cylinders (size)",
        ],
      },
      "Tactile Sense": {
        contentStandard: "Refining the sense of touch",
        indicators: [
          "Rough and Smooth boards",
          "Fabric box",
          "Thermic tablets",
        ],
      },
    },
  },
  Language: {
    "Early Years": {
      "Oral Language": {
        contentStandard: "Developing spoken communication",
        indicators: [
          "Enrichment of vocabulary",
          "Storytelling",
          "I Spy game (sound identification)",
        ],
      },
      "Phonetic Awareness": {
        contentStandard: "Connecting sounds to symbols",
        indicators: [
          "Sandpaper Letters",
          "Moveable Alphabet",
          "Object Boxes",
        ],
      },
    },
  },
  Mathematics: {
    "Early Years": {
      "Numbers to 10": {
        contentStandard: "Understanding quantity and symbol 1-10",
        indicators: [
          "Number Rods",
          "Sandpaper Numbers",
          "Spindle Box",
          "Cards and Counters",
        ],
      },
      "Decimal System": {
        contentStandard: "Understanding hierarchy of numbers",
        indicators: [
          "Golden Bead Material",
          "Large Number Cards",
          "Bird's Eye View",
        ],
      },
    },
  },
  Culture: {
    "Early Years": {
      Geography: {
        contentStandard: "Understanding the world",
        indicators: [
          "Land and Water globes",
          "Puzzle maps",
          "Land and Water forms",
        ],
      },
      Science: {
        contentStandard: "Exploring the natural world",
        indicators: [
          "Living and Non-living",
          "Plant/Animal puzzles",
          "Classification cards",
        ],
      },
    },
  },
};

/**
 * Cambridge International Curriculum Standards
 */
export const CAMBRIDGE_STANDARDS = {
  Mathematics: {
    "Stage 1": {
      Number: {
        contentStandard: "Count, read and write numbers",
        indicators: [
          "1Nn1: Count on and back in ones from any number to 20",
          "1Nn2: Count at least 20 objects reliably",
          "1Nn3: Read and write numerals to at least 20",
        ],
      },
      Geometry: {
        contentStandard: "Identify and describe shapes",
        indicators: [
          "1Gs1: Name and identify common 2D shapes",
          "1Gs2: Name and identify common 3D shapes",
        ],
      },
    },
    "Stage 2": {
      Number: {
        contentStandard: "Understanding numbers to 100",
        indicators: [
          "2Nn1: Count on and back in ones and tens from any number to 100",
          "2Nn2: Understand that 'teen' numbers are ten and some more",
        ],
      },
    },
  },
  English: {
    "Stage 1": {
      Reading: {
        contentStandard: "Phonics and word recognition",
        indicators: [
          "1Rf1: Recognize and use the most common letter sounds",
          "1Rf2: Blend sounds to read simple words",
        ],
      },
      Writing: {
        contentStandard: "Handwriting and spelling",
        indicators: [
          "1Wf1: Form letters correctly",
          "1Wf2: Spell simple words using phonics",
        ],
      },
    },
  },
};

/**
 * Generic helper to get curriculum-specific data structure
 */
export const getCurriculumData = (curriculum: string) => {
  switch (curriculum?.toUpperCase()) {
    case "MONTESSORI":
      return MONTESSORI_AREAS;
    case "CAMBRIDGE":
      return CAMBRIDGE_STANDARDS;
    case "GES":
    default:
      return NACCA_CONTENT_STANDARDS;
  }
};

/**
 * Generic helper to get labels based on curriculum
 */
export const getCurriculumLabels = (curriculum: string) => {
  switch (curriculum?.toUpperCase()) {
    case "MONTESSORI":
      return {
        strand: "Area",
        subStrand: "Activity Group",
        contentStandard: "Learning Goal",
        indicator: "Activity/Indicator",
      };
    case "CAMBRIDGE":
      return {
        strand: "Strand",
        subStrand: "Sub-strand",
        contentStandard: "Learning Objective",
        indicator: "Success Criteria",
      };
    case "GES":
    default:
      return {
        strand: "Strand",
        subStrand: "Sub-strand",
        contentStandard: "Content Standard",
        indicator: "Indicator",
      };
  }
};

/**
 * Get strands/areas for any curriculum
 */
export const getCurriculumStrands = (
  curriculum: string,
  subject: string,
  classLevel: string,
): string[] => {
  const data = getCurriculumData(curriculum);
  const normalizedLevel = normalizeClassLevel(classLevel);

  const subjectData = data[subject as keyof typeof data];
  if (!subjectData) return [];

  const levelData = subjectData[normalizedLevel as keyof typeof subjectData];
  if (!levelData) {
    // Fallback for Montessori which might use "Early Years" for multiple classes
    if (curriculum?.toUpperCase() === "MONTESSORI") {
      const earlyYearsData = (subjectData as any)["Early Years"];
      if (earlyYearsData) return Object.keys(earlyYearsData);
    }
    return [];
  }

  return Object.keys(levelData);
};

/**
 * Get indicators/success criteria for any curriculum
 */
export const getCurriculumIndicators = (
  curriculum: string,
  subject: string,
  classLevel: string,
  strand: string,
  subStrand?: string,
): { contentStandard: string; indicators: string[] } | null => {
  const data = getCurriculumData(curriculum);
  const normalizedLevel = normalizeClassLevel(classLevel);

  const subjectData = data[subject as keyof typeof data];
  if (!subjectData) return null;

  let levelData: any = subjectData[normalizedLevel as keyof typeof subjectData];

  // Fallback for Montessori
  if (!levelData && curriculum?.toUpperCase() === "MONTESSORI") {
    levelData = (subjectData as any)["Early Years"];
  }

  if (!levelData) return null;

  const strandData = (levelData as any)[strand];
  if (!strandData) return null;

  // If it has subStrands (GES/NaCCA style)
  if (strandData.subStrands) {
    if (subStrand) return strandData.subStrands[subStrand] || null;

    const allIndicators: string[] = [];
    const allContentStandards: string[] = [];

    Object.values(strandData.subStrands).forEach((ss: any) => {
      if (ss.contentStandard && !allContentStandards.includes(ss.contentStandard)) {
        allContentStandards.push(ss.contentStandard);
      }
      if (ss.indicators) allIndicators.push(...ss.indicators);
    });

    return {
      contentStandard: allContentStandards.join(" | "),
      indicators: allIndicators,
    };
  }

  // If it's a direct area/strand with indicators (Montessori/Cambridge simplified)
  return {
    contentStandard: strandData.contentStandard || "",
    indicators: strandData.indicators || [],
  };
};

/**
 * NaCCA Assessment Criteria Descriptors
 */
export const ASSESSMENT_CRITERIA = {
  exemplary:
    "Exceeds expectations - demonstrates deep understanding and can apply knowledge in new contexts",
  proficient:
    "Meets expectations - demonstrates solid understanding and can apply knowledge appropriately",
  developing:
    "Approaching expectations - demonstrates partial understanding with some gaps",
  beginning:
    "Below expectations - demonstrates minimal understanding and requires significant support",
};

/**
 * Centralized normalization for class levels (e.g., "basic-1" -> "Basic 1")
 */
export const normalizeClassLevel = (classLevel: string): string => {
  if (!classLevel) return classLevel;

  const cleaned = classLevel
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Try exact match first
  if (CLASS_LEVELS[cleaned as keyof typeof CLASS_LEVELS]) {
    return cleaned;
  }

  // Try case-insensitive match
  const found = Object.keys(CLASS_LEVELS).find(
    (key) => key.toLowerCase() === cleaned.toLowerCase(),
  );

  return found || cleaned;
};

/**
 * Get class level info with fallback
 */
export const getClassLevelInfo = (classLevel: string) => {
  const normalizedLevel = normalizeClassLevel(classLevel);
  if (CLASS_LEVELS[normalizedLevel as keyof typeof CLASS_LEVELS]) {
    return CLASS_LEVELS[normalizedLevel as keyof typeof CLASS_LEVELS];
  }

  const lower = normalizedLevel.toLowerCase();
  if (lower.includes("nursery"))
    return {
      ageRange: "3-4 years",
      level: "creche",
      description: "Early Childhood Education",
    };
  if (lower.includes("kg1"))
    return {
      ageRange: "4-5 years",
      level: "creche",
      description: "Kindergarten 1",
    };
  if (lower.includes("kg2"))
    return {
      ageRange: "5-6 years",
      level: "creche",
      description: "Kindergarten 2",
    };
  return {
    ageRange: "Unknown",
    level: "unknown",
    description: "Class level not in NaCCA system",
  };
};

/**
 * Get NaCCA strands for a subject and class level
 */
export const getNaCCAStrands = (
  subject: string,
  classLevel: string,
): string[] => {
  const normalizedLevel = normalizeClassLevel(classLevel);
  const subjectStrands = NACCA_STRANDS[subject as keyof typeof NACCA_STRANDS];
  if (!subjectStrands) return [];
  const levelStrands =
    subjectStrands[normalizedLevel as keyof typeof subjectStrands];
  return levelStrands || [];
};

/**
 * Format class level for display
 */
export const formatClassLevel = (classLevel: string): string => {
  const normalized = normalizeClassLevel(classLevel);
  const info = getClassLevelInfo(normalized);
  return `${normalized} (${info.ageRange})`;
};

/**
 * Helper function to get content standards and indicators for a strand
 * Returns all indicators from all sub-strands within the strand
 */
export const getContentStandards = (
  subject: string,
  classLevel: string,
  strand: string,
  subStrand?: string,
): { contentStandard: string; indicators: string[] } | null => {
  const normalizedLevel = normalizeClassLevel(classLevel);
  const subjectStandards =
    NACCA_CONTENT_STANDARDS[subject as keyof typeof NACCA_CONTENT_STANDARDS];
  if (!subjectStandards) return null;
  const classStandards =
    subjectStandards[normalizedLevel as keyof typeof subjectStandards];
  if (!classStandards) return null;
  const strandData = classStandards[strand as keyof typeof classStandards] as
    | {
        subStrands: Record<
          string,
          { contentStandard: string; indicators: string[] }
        >;
      }
    | undefined;
  if (!strandData) return null;

  // If a specific sub-strand is requested, return only that
  if (subStrand) return strandData.subStrands[subStrand] || null;

  // Otherwise, aggregate ALL indicators from ALL sub-strands in this strand
  const allIndicators: string[] = [];
  const allContentStandards: string[] = [];

  Object.values(strandData.subStrands).forEach((subStrandData) => {
    if (
      subStrandData.contentStandard &&
      !allContentStandards.includes(subStrandData.contentStandard)
    ) {
      allContentStandards.push(subStrandData.contentStandard);
    }
    allIndicators.push(...subStrandData.indicators);
  });

  return {
    contentStandard: allContentStandards.join(" | "),
    indicators: allIndicators,
  };
};

/**
 * Helper function to get all indicators for a subject and class level
 */
export const getAllIndicators = (
  subject: string,
  classLevel: string,
): {
  strand: string;
  subStrand: string;
  contentStandard: string;
  indicators: string[];
}[] => {
  const normalizedLevel = normalizeClassLevel(classLevel);
  const subjectStandards =
    NACCA_CONTENT_STANDARDS[subject as keyof typeof NACCA_CONTENT_STANDARDS];
  if (!subjectStandards) return [];
  const classStandards =
    subjectStandards[normalizedLevel as keyof typeof subjectStandards];
  if (!classStandards) return [];
  const results: {
    strand: string;
    subStrand: string;
    contentStandard: string;
    indicators: string[];
  }[] = [];
  Object.entries(classStandards).forEach(([strand, strandData]) => {
    if ("subStrands" in strandData) {
      Object.entries(strandData.subStrands).forEach(([subStrand, data]) => {
        const indicatorData = data as {
          contentStandard: string;
          indicators: string[];
        };
        results.push({
          strand,
          subStrand,
          contentStandard: indicatorData.contentStandard,
          indicators: indicatorData.indicators,
        });
      });
    }
  });
  return results;
};

/**
 * Get all strands for a subject and class level
 */
export const getStrands = (subject: string, classLevel: string): string[] => {
  const normalizedLevel = normalizeClassLevel(classLevel);
  const subjectStandards =
    NACCA_CONTENT_STANDARDS[subject as keyof typeof NACCA_CONTENT_STANDARDS];
  if (!subjectStandards) return [];
  const classStandards =
    subjectStandards[normalizedLevel as keyof typeof subjectStandards];
  if (!classStandards) return [];
  return Object.keys(classStandards);
};

/**
 * Get all sub-strands for a subject, class level and strand
 */
export const getSubStrands = (
  subject: string,
  classLevel: string,
  strand: string,
): string[] => {
  const normalizedLevel = normalizeClassLevel(classLevel);
  const subjectStandards =
    NACCA_CONTENT_STANDARDS[subject as keyof typeof NACCA_CONTENT_STANDARDS];
  if (!subjectStandards) return [];
  const classStandards =
    subjectStandards[normalizedLevel as keyof typeof subjectStandards];
  if (!classStandards) return [];
  const strandData = classStandards[strand as keyof typeof classStandards] as
    | {
        subStrands: Record<
          string,
          { contentStandard: string; indicators: string[] }
        >;
      }
    | undefined;
  if (!strandData) return [];
  return Object.keys(strandData.subStrands);
};

/**
 * NaCCA Strands by Subject for quick reference
 */
export const NACCA_STRANDS = {
  Mathematics: {
    "Basic 1": [
      "Number Sense",
      "Patterns and Algebra",
      "Measurement",
      "Geometry",
      "Data Handling",
    ],
    "Basic 2": [
      "Number Sense",
      "Patterns and Algebra",
      "Measurement",
      "Geometry",
      "Data Handling",
    ],
    "Basic 3": [
      "Number Sense",
      "Patterns and Algebra",
      "Measurement",
      "Geometry",
      "Data Handling",
    ],
    "Basic 4": [
      "Number and Numeration",
      "Operations",
      "Fractions and Decimals",
      "Measurement",
      "Geometry",
      "Patterns and Algebra",
      "Data Handling",
    ],
    "Basic 5": [
      "Number and Numeration",
      "Operations",
      "Fractions and Decimals",
      "Measurement",
      "Geometry",
      "Patterns and Algebra",
      "Data Handling",
    ],
    "Basic 6": [
      "Number and Numeration",
      "Operations",
      "Fractions and Decimals",
      "Measurement",
      "Geometry",
      "Patterns and Algebra",
      "Data Handling",
    ],
    "JHS 1": [
      "Number and Numeration",
      "Algebra",
      "Geometry",
      "Measurement",
      "Statistics and Probability",
    ],
    "JHS 2": [
      "Number and Numeration",
      "Algebra",
      "Geometry",
      "Measurement",
      "Statistics and Probability",
    ],
    "JHS 3": [
      "Number and Numeration",
      "Algebra",
      "Geometry",
      "Measurement",
      "Statistics and Probability",
    ],
    "SHS 1": [
      "Number and Numeration",
      "Algebra",
      "Geometry",
      "Statistics and Probability",
    ],
    "SHS 2": ["Core Mathematics", "Elective Mathematics"],
    "SHS 3": ["Core Mathematics", "Elective Mathematics"],
  },
  Science: {
    "Basic 1": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "Basic 2": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "Basic 3": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "Basic 4": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "Basic 5": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "Basic 6": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "JHS 1": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "JHS 2": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "JHS 3": [
      "Diversity of Matter",
      "Cycles",
      "Systems",
      "Forces and Energy",
      "Earth and Space",
    ],
    "SHS 1": [
      "Scientific Inquiry",
      "Matter",
      "Living Things",
      "Forces and Energy",
    ],
    "SHS 2": ["Biology", "Chemistry", "Physics"],
    "SHS 3": ["Biology", "Chemistry", "Physics"],
  },
  English: {
    "Basic 1": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
    ],
    "Basic 2": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
    ],
    "Basic 3": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
    ],
    "Basic 4": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
    ],
    "Basic 5": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
    ],
    "Basic 6": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
    ],
    "JHS 1": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
      "Literature",
    ],
    "JHS 2": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
      "Literature",
    ],
    "JHS 3": [
      "Listening and Speaking",
      "Reading",
      "Writing",
      "Grammar and Usage",
      "Literature",
    ],
    "SHS 1": ["Reading Comprehension", "Writing", "Grammar", "Literature"],
    "SHS 2": ["Reading Comprehension", "Writing", "Grammar", "Literature"],
    "SHS 3": ["Reading Comprehension", "Writing", "Grammar", "Literature"],
  },
  "Social Studies": {
    "Basic 4": [
      "Culture and Identity",
      "Time, Continuity and Change",
      "People and Environment",
      "Governance and Citizenship",
    ],
    "Basic 5": [
      "Culture and Identity",
      "Time, Continuity and Change",
      "People and Environment",
      "Governance and Citizenship",
    ],
    "Basic 6": [
      "Culture and Identity",
      "Time, Continuity and Change",
      "People and Environment",
      "Governance and Citizenship",
    ],
    "JHS 1": [
      "Culture and Identity",
      "Time, Continuity and Change",
      "People and Environment",
      "Governance and Citizenship",
    ],
    "JHS 2": [
      "Culture and Identity",
      "Time, Continuity and Change",
      "People and Environment",
      "Governance and Citizenship",
    ],
    "JHS 3": [
      "Culture and Identity",
      "Time, Continuity and Change",
      "People and Environment",
      "Governance and Citizenship",
    ],
    "SHS 1": [
      "Culture and Identity",
      "Governance and Citizenship",
      "Economics and Development",
    ],
    "SHS 2": [
      "Culture and Identity",
      "Governance and Citizenship",
      "Economics and Development",
    ],
    "SHS 3": [
      "Culture and Identity",
      "Governance and Citizenship",
      "Economics and Development",
    ],
  },
  Computing: {
    "Basic 1": ["Digital Literacy", "Computational Thinking"],
    "Basic 2": ["Digital Literacy", "Computational Thinking"],
    "Basic 3": ["Digital Literacy", "Computational Thinking"],
    "Basic 4": ["Digital Literacy", "Computational Thinking", "Programming"],
    "Basic 5": ["Digital Literacy", "Computational Thinking", "Programming"],
    "Basic 6": ["Digital Literacy", "Computational Thinking", "Programming"],
    "JHS 1": [
      "Digital Literacy",
      "Computational Thinking",
      "Programming",
      "ICT and Society",
    ],
    "JHS 2": [
      "Digital Literacy",
      "Computational Thinking",
      "Programming",
      "ICT and Society",
    ],
    "JHS 3": [
      "Digital Literacy",
      "Computational Thinking",
      "Programming",
      "ICT and Society",
    ],
    "SHS 1": ["Computer Studies", "ICT Applications"],
    "SHS 2": ["Computer Studies", "ICT Applications"],
    "SHS 3": ["Computer Studies", "ICT Applications"],
  },
  RME: {
    "Basic 1": [
      "Beliefs and Practices",
      "Morals and Values",
      "Religious Figures",
    ],
    "Basic 2": [
      "Beliefs and Practices",
      "Morals and Values",
      "Religious Figures",
    ],
    "Basic 3": [
      "Beliefs and Practices",
      "Morals and Values",
      "Religious Figures",
    ],
    "Basic 4": [
      "Beliefs and Practices",
      "Morals and Values",
      "Sacred Texts",
      "Worship and Rituals",
    ],
    "Basic 5": [
      "Beliefs and Practices",
      "Morals and Values",
      "Sacred Texts",
      "Worship and Rituals",
    ],
    "Basic 6": [
      "Beliefs and Practices",
      "Morals and Values",
      "Sacred Texts",
      "Worship and Rituals",
    ],
    "JHS 1": [
      "Beliefs and Practices",
      "Morals and Values",
      "Sacred Texts",
      "Worship and Rituals",
      "Religious Leadership",
    ],
    "JHS 2": [
      "Beliefs and Practices",
      "Morals and Values",
      "Sacred Texts",
      "Worship and Rituals",
      "Religious Leadership",
    ],
    "JHS 3": [
      "Beliefs and Practices",
      "Morals and Values",
      "Sacred Texts",
      "Worship and Rituals",
      "Religious Leadership",
    ],
    "SHS 1": [
      "Religious Beliefs",
      "Ethics and Morality",
      "Religious Practices",
    ],
    "SHS 2": [
      "Religious Beliefs",
      "Ethics and Morality",
      "Religious Practices",
    ],
    "SHS 3": [
      "Religious Beliefs",
      "Ethics and Morality",
      "Religious Practices",
    ],
  },
  History: {
    "Basic 1": ["Understanding the Past", "Time and Change"],
    "Basic 2": ["Understanding the Past", "Time and Change"],
    "Basic 3": ["Understanding the Past", "Sources of History"],
    "Basic 4": ["Ghana's Kingdoms and Empires", "Cultural Heritage"],
    "Basic 5": ["Colonial Period", "Resistance and Nationalism"],
    "Basic 6": ["Independence and Beyond", "Modern Ghana"],
    "JHS 1": ["Historical Inquiry", "West African Civilizations"],
    "JHS 2": ["Trans-Atlantic Trade", "Colonial Rule"],
    "JHS 3": ["Nationalism and Independence", "Contemporary Issues"],
  },
  "Career Technology": {
    "Basic 1": ["Exploring Careers", "Basic Skills"],
    "Basic 2": ["Exploring Careers", "Basic Skills"],
    "Basic 3": ["Career Awareness", "Technical Skills"],
    "Basic 4": ["Career Exploration", "Technical Skills"],
    "Basic 5": ["Career Planning", "Technical Skills"],
    "Basic 6": ["Career Development", "Technical Skills"],
    "JHS 1": ["Career Exploration", "Technical Skills"],
    "JHS 2": ["Career Preparation", "Technical Skills"],
    "JHS 3": ["Career Transition", "Technical Skills"],
  },
  "Creative Arts": {
    "Basic 1": ["Visual Arts", "Music and Movement"],
    "Basic 2": ["Visual Arts", "Music and Movement"],
    "Basic 3": ["Visual Arts", "Music and Movement"],
    "Basic 4": ["Visual Arts", "Performing Arts"],
    "Basic 5": ["Visual Arts", "Performing Arts"],
    "Basic 6": ["Visual Arts", "Performing Arts"],
    "JHS 1": ["Visual Arts", "Performing Arts"],
    "JHS 2": ["Visual Arts", "Performing Arts"],
    "JHS 3": ["Visual Arts", "Performing Arts"],
  },
};
