import { BEGINNER_TUTORIAL_LESSON } from './beginnerTutorial';

export interface Lesson {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  architectureDetails: string;
  codeExample?: string;
  keyPoints: string[];
  illustrationIcon?: string;
  diagramImageBase64?: string;
  diagramTitle?: string;
  diagramCaption?: string;

  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export const LESSONS: Lesson[] = [

  // =========================================================
  // LESSON 1: INTRODUCTION TO ROBOTICS
  // =========================================================

  {
    id: 'l1',

    diagramImageBase64: 'data:image/png;base64,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',

    diagramTitle: 'Robot System Architecture & Sense-Think-Act Loop',

    diagramCaption: 'Visual schematic of a robot control loop: 1. Sensors gather environmental data, 2. The Microcontroller (CPU) processes inputs using code algorithms, 3. Actuators & motors execute physical movements with continuous feedback.',

    title: 'Lesson 1: Introduction to Robotics',

    category: 'Introduction',

    summary:
      'Discover what robots are, what they do, and how they help people in everyday life.',

    illustrationIcon: 'robot',

    content: `**LESSON 1: INTRODUCTION TO ROBOTICS**

**1. What Is a Robot?**

A robot is a machine that can be programmed to perform tasks.

Some robots follow instructions given by humans, while others can use sensors and computer programs to make simple decisions.

Robots help people perform tasks that may be difficult, dangerous, boring, or repetitive.

**Examples of Robots**

🤖 A robot that moves around a classroom.

🏭 A factory robot that helps assemble cars.

🏥 A hospital robot that helps deliver medicine.

🚀 A space robot that explores planets.

🧹 A robot vacuum cleaner that cleans floors.

**2. What Is Robotics?**

Robotics is the branch of science and technology that deals with designing, building, programming, and using robots.

Robotics combines several subjects:

• Science helps us understand how things work.
• Mathematics helps us measure and calculate.
• Engineering helps us design and build robots.
• Computer programming gives robots instructions.

**3. How Are Robots Different from Humans?**

Robots do not think and feel exactly like human beings.

Humans can use their senses, experiences, emotions, and understanding to make decisions.

Robots follow instructions from their programs and use information from their sensors.

A robot may appear intelligent, but its actions depend on how it was designed and programmed.

**4. Types of Robots**

**A. Industrial Robots**

These robots work in factories.

They may lift heavy objects, paint cars, or assemble products.

**B. Educational Robots**

These robots help students learn science, mathematics, engineering, and programming.

**C. Service Robots**

These robots help people in homes, hospitals, hotels, and other places.

**D. Exploration Robots**

These robots explore places that may be difficult or dangerous for humans to visit.

Examples include robots used in space and underwater exploration.

**5. Why Are Robots Important?**

Robots can:

1. Help people complete tasks faster.
2. Perform repetitive work.
3. Carry heavy objects.
4. Work in dangerous environments.
5. Help scientists explore difficult places.
6. Support learning and education.

However, robots also need electricity, maintenance, programming, and human supervision.

**6. Important Words**

Robot: A machine that can be programmed to perform tasks.

Robotics: The study and use of robots.

Program: A set of instructions given to a computer or robot.

Automation: Using machines or technology to perform tasks with little or no continuous human control.

**7. Classroom Activity**

Look around your home, school, or community.

Write down three machines that perform tasks automatically.

For each machine, explain:

• What task does it perform?
• Does it follow instructions?
• Does it use sensors?
• How does it help people?

Discuss whether each machine is a robot or an automated machine.

**8. Summary**

Robotics helps people design, build, and program machines that perform useful tasks.

Robots are used in homes, schools, hospitals, factories, farms, and exploration.

The main purpose of robotics is to use technology to solve problems and make work easier.`,

    architectureDetails: `TEACHER'S NOTE

For Lower Primary:
Allow pupils to identify robots from pictures and describe what they do.

For Upper Primary:
Let pupils compare robots with ordinary machines.

For JHS:
Introduce the relationship between robotics, engineering, computer science, and automation.

Discussion Question:
Should robots replace humans in every type of work? Give reasons for your answer.`,

    keyPoints: [
      'A robot is a machine that can be programmed to perform tasks.',
      'Robotics combines science, mathematics, engineering, and programming.',
      'Robots help people perform useful tasks.',
      'Robots are used in many areas of everyday life.',
      'Robots depend on their programs and design.'
    ],

    quiz: {
      question: 'What is robotics?',

      options: [
        'The study of plants and animals',
        'The study and use of robots',
        'The study of weather only',
        'The study of human languages'
      ],

      correctIndex: 1,

      explanation:
        'Robotics involves designing, building, programming, and using robots.'
    }
  },


  // =========================================================
  // LESSON 2: PARTS OF A ROBOT
  // =========================================================

  {
    id: 'l2',

    diagramImageBase64: 'data:image/png;base64,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',

    diagramTitle: 'Microcontroller & Hardware Component Wiring Schematic',

    diagramCaption: 'Electrical hardware layout detailing the 5V power supply, Ground (GND) return line, GPIO digital PWM control lines, dual H-Bridge motor driver (L298N), and DC motor terminals.',

    title: 'Lesson 2: Parts of a Robot',

    category: 'Robot Components',

    summary:
      'Learn about the important parts of a robot and how they work together.',

    illustrationIcon: 'settings',

    content: `**LESSON 2: PARTS OF A ROBOT**

**1. Introduction**

A robot is made up of different parts that work together.

A simple robot needs a source of power, a controller, a program, and a way to move or perform a task.

Some robots also have sensors that help them understand their surroundings.

**2. Main Parts of a Robot**

**A. Power Source**

The power source supplies energy to the robot.

Many small educational robots use batteries.

Larger robots may use electricity from a power supply.

Without power, most robots cannot operate.

**B. Controller**

The controller is the electronic part that manages the robot's actions.

It receives information, processes instructions, and sends commands to other parts.

A microcontroller is a common type of controller used in educational robots.

**C. Program**

A program is a set of instructions that tells the robot what to do.

For example:

1. Move forward.
2. Turn right.
3. Stop.

The robot follows these instructions when the program runs.

**D. Sensors**

Sensors help robots collect information about their surroundings.

A robot may use sensors to detect:

• Objects.
• Light.
• Sound.
• Temperature.
• Distance.
• Touch.

**E. Motors and Actuators**

Motors help robots move.

Some motors turn wheels, while others move robotic arms.

An actuator is a device that produces movement or action.

**F. Body or Frame**

The body is the structure that holds the robot's parts together.

It may be made from plastic, metal, or other materials.

The body protects the parts and gives the robot its shape.

**G. Output Devices**

Some robots use lights, speakers, or screens to communicate information.

For example, a robot may flash a light when it detects an obstacle.

**3. A Simple Robot Diagram**

             ┌─────────────────┐
             │   POWER SOURCE  │
             │    BATTERY      │
             └────────┬────────┘
                      │
                      ▼
             ┌─────────────────┐
             │   CONTROLLER    │
             │  Robot's Brain  │
             └────────┬────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   ┌────────────┐          ┌────────────┐
   │   SENSORS  │          │   MOTORS   │
   │ Information│          │  Movement  │
   └────────────┘          └────────────┘

The controller receives information from sensors and sends instructions to the motors.

**4. How the Parts Work Together**

Imagine a robot that must move towards a wall and stop before hitting it.

1. The battery supplies power.
2. The sensor measures the distance to the wall.
3. The controller receives the information.
4. The program checks whether the wall is too close.
5. The controller tells the motors to stop.

This is how different parts of a robot work together.

**5. Important Words**

Controller: The electronic device that manages the robot's actions.

Sensor: A device that detects information.

Motor: A device that produces movement.

Actuator: A device that creates physical movement or action.

Frame: The structure that holds the robot's parts together.

**6. Classroom Activity**

Draw a simple robot.

Label the following parts:

• Battery.
• Controller.
• Sensor.
• Motor.
• Body.

Write one sentence explaining the function of each part.

**7. Summary**

A robot is made up of different components.

The power source supplies energy.

The controller processes instructions.

Sensors collect information.

Motors and actuators produce movement.

The frame holds the components together.`,

    architectureDetails: `TEACHER'S NOTE

For Lower Primary:
Use a toy robot or a picture of a robot. Let pupils identify its visible parts.

For Upper Primary:
Ask learners to explain how the battery, controller, and motors work together.

For JHS:
Introduce microcontrollers and explain the difference between a sensor and an actuator.

Practical Demonstration:
Use a small educational robot to identify its battery, wheels, sensors, and controller.`,

    keyPoints: [
      'Robots are made up of different components.',
      'The power source supplies energy.',
      'The controller manages the robot.',
      'Sensors collect information from the environment.',
      'Motors and actuators produce movement.',
      'The frame holds the robot components together.'
    ],

    quiz: {
      question: 'Which part of a robot collects information about its surroundings?',

      options: [
        'The battery',
        'The sensor',
        'The frame',
        'The wheel'
      ],

      correctIndex: 1,

      explanation:
        'Sensors collect information about the robot’s surroundings, such as distance, light, and temperature.'
    }
  },


  // =========================================================
  // LESSON 3: SENSORS AND HOW ROBOTS SENSE
  // =========================================================

  {
    id: 'l3',

    diagramImageBase64: 'data:image/png;base64,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',

    diagramTitle: 'HC-SR04 Ultrasonic Distance Sensor Echo Timing & Sound Propagation',

    diagramCaption: 'Physical sensor diagram illustrating how the piezo-electric transmitter (TRIG) emits 40kHz ultrasonic sound waves, bouncing off target obstacles back to the receiver (ECHO) to calculate exact distance.',

    title: 'Lesson 3: Sensors and How Robots Sense',

    category: 'Sensors',

    summary:
      'Discover how robots detect objects, light, sound, and other information from their surroundings.',

    illustrationIcon: 'eye',

    content: `**LESSON 3: SENSORS AND HOW ROBOTS SENSE**

**1. What Is a Sensor?**

A sensor is a device that detects or measures something in the environment.

Sensors help robots collect information.

Humans use their eyes, ears, skin, and other senses to understand the world.

Robots use electronic sensors to collect information.

**2. Types of Sensors**

**A. Distance Sensor**

A distance sensor measures how far away an object is.

For example, a robot may use a distance sensor to detect a wall.

If the wall is too close, the robot can stop or turn.

**B. Light Sensor**

A light sensor detects the amount of light in an environment.

A robot may use a light sensor to follow a bright or dark line.

**C. Touch Sensor**

A touch sensor detects when something touches the robot.

For example, a robot may stop when its front bumper touches an object.

**D. Temperature Sensor**

A temperature sensor measures how hot or cold something is.

A robot may use a temperature sensor to monitor the temperature of a room.

**E. Sound Sensor**

A sound sensor detects sound.

A robot may be programmed to respond when it hears a clap or another sound.

**3. How a Distance Sensor Works**

Some distance sensors send out sound waves.

The sound waves travel through the air and bounce back when they meet an object.

The sensor measures how long the sound takes to return.

The robot uses this information to estimate the distance.

**Simple Illustration**

      ROBOT                         WALL
     ┌─────┐                       │
     │  ◉  │  ───── Sound ───────► │
     │     │  ◄──── Echo ───────── │
     └─────┘                       │

The sound travels to the wall and returns to the robot.

**4. How a Robot Uses Sensor Information**

Imagine a robot moving towards a chair.

The robot has been programmed to stop when the chair is less than 20 centimetres away.

The robot follows this process:

1. The sensor measures the distance.
2. The controller receives the measurement.
3. The program checks the distance.
4. The robot stops if the chair is too close.

**5. The Sense-Think-Act Process**

Robots often follow a process called Sense-Think-Act.

**SENSE**

The robot collects information using sensors.

**THINK**

The controller processes the information and follows the program.

**ACT**

The robot performs an action.

**Diagram**

      SENSE
        ↓
      THINK
        ↓
       ACT
        ↓
   SENSE AGAIN

This process can repeat while the robot is working.

**6. Important Words**

Sensor: A device that detects information.

Distance: The space between two points.

Measurement: Finding the size, amount, or distance of something.

Feedback: Information about what is happening after an action.

**7. Classroom Activity**

Use a ruler to measure the distance between a toy robot and a book.

Move the book closer and farther away.

Discuss how a distance sensor could help a robot respond to the changing distance.

**8. Summary**

Sensors help robots collect information.

Different sensors detect different things.

A robot can use sensor information to make decisions and perform actions.

The Sense-Think-Act process helps robots respond to their surroundings.`,

    architectureDetails: `TEACHER'S NOTE

For Lower Primary:
Explain sensors as the robot's way of detecting things. Use simple examples such as a light sensor or touch sensor.

For Upper Primary:
Introduce different sensors and their uses.

For JHS:
Explain how distance sensors measure the time taken for sound to travel to an object and return.

Practical Activity:
Allow learners to test how a robot responds when an object is moved closer to or farther from its sensor.`,

    keyPoints: [
      'A sensor detects or measures information.',
      'Different sensors collect different types of information.',
      'Distance sensors help robots detect objects.',
      'Robots use sensor information to perform actions.',
      'Sense-Think-Act is an important robotics process.'
    ],

    quiz: {
      question: 'What does a distance sensor help a robot to do?',

      options: [
        'Measure how far away an object is',
        'Change the colour of the robot',
        'Charge the battery',
        'Print documents'
      ],

      correctIndex: 0,

      explanation:
        'A distance sensor measures the space between the robot and an object.'
    }
  },


  // =========================================================
  // LESSON 4: MOVEMENT AND NAVIGATION
  // =========================================================

  {
    id: 'l4',

    diagramImageBase64: 'data:image/png;base64,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',

    diagramTitle: '2-Wheel Differential Drive Robot Steering Kinematics',

    diagramCaption: 'Differential drive steering mechanics: Equal wheel speeds move the robot forward, locking one wheel causes a pivot turn, and counter-rotating left/right wheels cause the robot to spin in place.',

    title: 'Lesson 4: Robot Movement and Navigation',

    category: 'Movement',

    summary:
      'Learn how robots move forward, turn, stop, and navigate through different environments.',

    illustrationIcon: 'compass',

    content: `**LESSON 4: ROBOT MOVEMENT AND NAVIGATION**

**1. Introduction**

Robots need a way to move from one place to another.

Some robots move using wheels.

Others use legs, tracks, or robotic arms.

Navigation is the process of finding and following a route to a destination.

**2. Ways Robots Move**

**A. Wheeled Robots**

These robots use wheels to move.

Examples include delivery robots and educational robots.

**B. Walking Robots**

These robots use legs to walk.

Some walking robots are designed to move like humans or animals.

**C. Tracked Robots**

These robots use tracks instead of ordinary wheels.

Tracks help robots move across rough ground.

**D. Flying Robots**

These robots use propellers or other systems to fly.

Drones are examples of flying robots.

**3. Basic Navigation Commands**

In our robotics simulator, the robot can follow commands such as:

MOVE FORWARD

The robot moves in the direction it is facing.

TURN LEFT

The robot changes its direction to the left.

TURN RIGHT

The robot changes its direction to the right.

STOP

The robot stops moving.

**4. Understanding Directions**

There are four main directions:

             NORTH
               ↑
               |
      WEST ← ROBOT → EAST
               |
               ↓
             SOUTH

A robot must know which direction it is facing before it can move correctly.

For example, a robot facing east will move towards the right side of the screen when it receives the move-forward command.

**5. Turning and Moving**

Imagine a robot standing at the starting point.

The robot must move to a target on the right side.

The instructions may be:

1. Move forward.
2. Move forward.
3. Turn right.
4. Move forward.
5. Stop.

The robot follows the instructions in the order they are given.

**6. Understanding a Grid**

A grid is made up of rows and columns.

Robotics games often use grids to represent a map.

Each square represents a position where the robot can stand.

Example:

       START
         ↓
     [R] [ ] [ ]
     [ ] [ ] [ ]
     [ ] [ ] [T]

R = Robot

T = Target

The robot must follow instructions to reach the target.

**7. What Is an Obstacle?**

An obstacle is something that blocks the robot's path.

Examples include:

• Walls.
• Boxes.
• Chairs.
• Rocks.
• Other robots.

A robot must avoid obstacles to reach its destination safely.

**8. Planning a Route**

Before moving, a robot may need to find a safe path.

A route is the path taken from the starting point to the destination.

Good navigation requires:

1. Knowing the starting position.
2. Knowing the target position.
3. Identifying obstacles.
4. Choosing a safe route.
5. Following the correct commands.

**9. Classroom Activity**

Draw a 5×5 grid on paper.

Mark the starting point and the target.

Place three obstacles on the grid.

Write instructions that will help the robot reach the target without hitting any obstacle.

Ask a classmate to follow your instructions using a toy robot or a pencil.

**10. Summary**

Robots use different methods to move.

Navigation helps robots find and follow routes.

Movement commands must be given in the correct order.

Robots must avoid obstacles and reach their destinations safely.`,

    architectureDetails: `TEACHER'S NOTE

For Lower Primary:
Use movement games. Let pupils act as robots and follow commands from classmates.

For Upper Primary:
Introduce grid navigation, directions, and obstacle avoidance.

For JHS:
Explain how robots use maps, coordinates, and sensors to navigate.

Practical Activity:
Create a classroom obstacle course. Learners should write commands that guide a robot from a starting point to a target.`,

    keyPoints: [
      'Robots move using wheels, legs, tracks, or other systems.',
      'Navigation means finding and following a route.',
      'Robots follow movement commands.',
      'A grid can represent a robot’s environment.',
      'Obstacles are objects that block a robot’s path.',
      'Good navigation requires planning and safe movement.'
    ],

    quiz: {
      question: 'What is navigation in robotics?',

      options: [
        'Charging the robot',
        'Finding and following a route to a destination',
        'Changing the robot’s colour',
        'Switching off the controller'
      ],

      correctIndex: 1,

      explanation:
        'Navigation helps a robot find and follow a route from its starting point to its destination.'
    }
  },


  // =========================================================
  // LESSON 5: INTRODUCTION TO ROBOT PROGRAMMING
  // =========================================================

  {
    id: 'l5',

    diagramImageBase64: 'data:image/png;base64,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',

    diagramTitle: 'Autonomous Obstacle Avoidance Algorithm Flowchart',

    diagramCaption: 'State machine decision tree showing the main control loop: reading sensor distance, evaluating conditional logic (Distance < 20cm), branching to stop/pivot maneuvers, and resuming forward travel.',

    title: 'Lesson 5: Introduction to Robot Programming',

    category: 'Programming',

    summary:
      'Understand how instructions, sequences, loops, and conditions help robots perform tasks.',

    illustrationIcon: 'code',

    content: `**LESSON 5: INTRODUCTION TO ROBOT PROGRAMMING**

**1. What Is Programming?**

Programming is the process of writing instructions that tell a computer or robot what to do.

A robot cannot understand ordinary instructions in the same way humans do.

Its controller follows instructions written in a programming language or another supported format.

**2. What Is an Algorithm?**

An algorithm is a step-by-step method for solving a problem.

Before writing a robot program, we can plan the steps needed to complete a task.

**Example: Brushing Your Teeth**

1. Pick up the toothbrush.
2. Put toothpaste on the brush.
3. Brush your teeth.
4. Rinse your mouth.
5. Wash the toothbrush.

These steps form a simple algorithm.

A robot can also follow a sequence of instructions.

**3. Sequence**

A sequence is a group of instructions arranged in the correct order.

Example:

1. Move forward.
2. Turn right.
3. Move forward.
4. Stop.

If the instructions are placed in the wrong order, the robot may not reach its destination.

**4. Repetition and Loops**

Sometimes a robot needs to perform the same action several times.

Instead of writing the same instruction repeatedly, we can use a loop.

A loop repeats an instruction or group of instructions.

**Example**

Without a loop:

Move forward.

Move forward.

Move forward.

With a loop:

Repeat 3 times:
    Move forward.

Both programs can produce the same movement.

Loops help reduce repeated instructions.

**5. Conditions**

A condition allows a robot to choose an action based on information.

A condition often uses the word IF.

**Example**

IF an obstacle is ahead:
    Stop.

ELSE:
    Move forward.

The robot checks the condition before deciding what to do.

**6. Putting Instructions Together**

A robot may use a sequence, a loop, and a condition in one program.

Example:

1. Move forward.
2. Repeat moving forward 3 times.
3. Check for an obstacle.
4. If an obstacle is ahead, turn right.
5. Otherwise, continue moving forward.
6. Stop at the target.

**7. What Is Debugging?**

Debugging means finding and correcting errors in a program.

Sometimes a robot does not perform the expected action.

This may happen because:

• An instruction is missing.
• Commands are in the wrong order.
• A turn is incorrect.
• The target is unreachable.
• The program contains an error.

To debug a program, we can examine the instructions and test them again.

**8. Classroom Activity**

Write a program that helps a robot move from the classroom door to the teacher's table.

Include:

• At least three movement commands.
• One turn.
• One stop command.

Exchange programs with a classmate and test whether the instructions work.

**9. Summary**

Programming gives robots instructions.

Algorithms help us plan solutions.

Sequences arrange instructions in order.

Loops repeat instructions.

Conditions allow robots to make decisions.

Debugging helps us find and correct errors.`,

    architectureDetails: `TEACHER'S NOTE

For Lower Primary:
Introduce programming through simple movement instructions and games.

For Upper Primary:
Teach sequences, repetition, and simple conditions.

For JHS:
Introduce algorithms, pseudocode, debugging, and the relationship between commands and robot behaviour.

Practical Activity:
Use the EduEaz Robotics Simulator. Ask learners to create a program that reaches a target without hitting obstacles.`,

    keyPoints: [
      'Programming gives instructions to robots.',
      'An algorithm is a step-by-step method for solving a problem.',
      'A sequence arranges instructions in order.',
      'A loop repeats instructions.',
      'A condition allows a program to make decisions.',
      'Debugging helps us correct programming errors.'
    ],

    quiz: {
      question: 'What is the main purpose of a loop in programming?',

      options: [
        'To repeat instructions',
        'To delete the program',
        'To switch off the robot',
        'To change the robot’s colour'
      ],

      correctIndex: 0,

      explanation:
        'A loop repeats an instruction or group of instructions, reducing the need to write them repeatedly.'
    }
  },


  // =========================================================
  // LESSON 6: ROBOTICS, SCIENCE AND ENGINEERING
  // =========================================================

  {
    id: 'l6',

    diagramImageBase64: 'data:image/png;base64,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',

    diagramTitle: 'Robot Electrical Circuit Schematic & Ohm\'s Law (V = I × R)',

    diagramCaption: 'Robotic power circuit schematic demonstrating battery supply regulation, current-limiting resistors protecting LEDs/microcontrollers, and mathematical relationship V = I × R.',

    title: 'Lesson 6: Robotics, Science and Engineering',

    category: 'Engineering',

    summary:
      'Explore how mathematics, science, engineering, and technology work together in robotics.',

    illustrationIcon: 'wrench',

    content: `**LESSON 6: ROBOTICS, SCIENCE AND ENGINEERING**

**1. Introduction**

Robotics is not only about building machines.

It also involves solving problems, designing systems, testing ideas, and improving solutions.

Robotics combines different areas of learning.

**2. Robotics and Mathematics**

Mathematics helps us calculate and measure.

In robotics, mathematics is used to:

• Measure distances.
• Calculate angles.
• Count movements.
• Compare measurements.
• Plan routes.
• Calculate speed.

**Example**

A robot moves forward 2 squares and then 3 more squares.

Total distance:

2 + 3 = 5 squares.

**3. Robotics and Science**

Science helps us understand how robots work.

Physics explains movement, force, electricity, and energy.

For example, a robot needs energy to move its wheels.

The battery supplies electrical energy, and the motors convert some of that energy into movement.

**4. Robotics and Engineering**

Engineering involves designing and building solutions to problems.

Robotics engineers may design:

• Robot bodies.
• Wheels and tracks.
• Robotic arms.
• Sensor systems.
• Control systems.

They test their designs to make sure the robots work properly.

**5. Robotics and Computer Science**

Computer science helps us understand how computers process information.

Robots use programs to control their actions.

Computer science also helps us design algorithms that allow robots to solve problems.

**6. The Engineering Design Process**

When building a robot, engineers often follow these steps:

**Step 1: Identify the Problem**

What problem must the robot solve?

**Step 2: Plan a Solution**

Think about how the robot should work.

**Step 3: Design**

Draw or describe the robot.

**Step 4: Build**

Create the robot using suitable materials.

**Step 5: Test**

Check whether the robot performs the task.

**Step 6: Improve**

Correct problems and make the robot better.

**Diagram**

PROBLEM
   ↓
PLAN
   ↓
DESIGN
   ↓
BUILD
   ↓
TEST
   ↓
IMPROVE

Engineers may repeat these steps until the robot works well.

**7. Classroom Activity**

Design a robot that can help keep your classroom clean.

Draw the robot and answer these questions:

1. What problem will it solve?
2. How will it move?
3. What sensors will it need?
4. What materials could be used to build it?
5. How will you test it?

**8. Summary**

Robotics combines mathematics, science, engineering, and computer science.

These subjects help us design, build, program, test, and improve robots.

The engineering design process helps us solve problems step by step.`,

    architectureDetails: `TEACHER'S NOTE

For Lower Primary:
Let pupils draw a robot that solves a simple problem.

For Upper Primary:
Introduce the engineering design process and simple measurements.

For JHS:
Discuss the relationship between electrical energy, motors, programming, and engineering design.

Practical Activity:
Let learners work in groups to design a robot using paper, cardboard, bottle tops, and other safe materials.`,

    keyPoints: [
      'Robotics combines several areas of learning.',
      'Mathematics helps robots measure and calculate.',
      'Science explains movement, electricity, and energy.',
      'Engineering helps people design and build robots.',
      'Computer science helps us program robots.',
      'Testing and improvement are important parts of engineering.'
    ],

    quiz: {
      question: 'Which process helps engineers design, build, test, and improve a robot?',

      options: [
        'The engineering design process',
        'The process of memorising words',
        'The process of drawing only',
        'The process of switching off a computer'
      ],

      correctIndex: 0,

      explanation:
        'The engineering design process helps engineers identify problems, plan solutions, build, test, and improve their designs.'
    }
  },


  // =========================================================
  // LESSON 7: ROBOTICS IN EVERYDAY LIFE
  // =========================================================

  {
    id: 'l7',

    diagramImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAD6CAIAAADYySIZAAAEOklEQVR4nO3cMWqUYRSG0fQW2lkE7L0rCLgcwX2kdwNp3IdFFmUhTGkRmEawyOSfb3y+A2cBb/XAbe7d+48DQMzd8gUAvDlxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwj6V9wfv58AuGXiDhD0+rgvPy4A+Ju4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAME3WLcv377BbAPcQcI2ivunz5/AWgTd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcYdjPTyfXixfwlZ2jDtc0znuy5ewIXGHo4g7C+0Sd7i+c9yXL4E3Ie4w4k6PuMOIOz3iDiPu9Ig7jLjTI+4w4k6PuMOIOz3iDiPu9Ig7jLjTI+4w4k6PuMOIOz3iDiPu9Nxi3D/8fATYh7gDBO0V9+VP9AGOJu4AQeIOECTuAEHiDhAk7gBB4g4QJO4AQeIOECTuAEHiDhAk7gBB4g4QJO4AQeIOECTuAEHiDhAk7gBB4g4QJO4AQeIOECTuAEHiDhAk7gBB4g4QJO4AQeIOECTuAEHiDhAk7gBB4g4QJO4AQeIOECTuAEHiDhAk7gBB4g4QJO4AQeIOx3p4Pr1YvoSt7Bh3uKZz3JcvYUPiDkcRdxbaJe5wfee4L18Cb0LcYcSdHnGHEXd6xB1G3OkRdxhxp0fcYcSdHnGHEXd6xB1G3OkRdxhxp0fcYcSdHnGHEXd6xB1G3Om5xbj//vEOYB/iDhC0V9yXP9EHOJq4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0CQuAMEiTtAkLgDBIk7QJC4AwSJO0DQjnEH2IS4AwTtEncALiTuAEHiDhAk7gBB4g4QJO4AQeIOECTuAEE3Gven+3uAPHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAIHEHCBJ3gCBxBwgSd4AgcQcIEneAoO3iDsAlxB0gSNwBgsQdIEjcAYLEHSBI3AGCxB0gSNwBgsQdIEjcAYLEHSBI3AGCxB0gSNwBgi6NOwA3S9wBgl4TdwD+U+IOECTuAEHiDhAk7gBB4g4QJO4AQeIOEPQH8e6RiUgh3HcAAAAASUVORK5CYII=',

    diagramTitle: 'Commercial Service Robot Navigation Stack & Sensor Layers',

    diagramCaption: 'Multi-layered navigation architecture used in autonomous mobile robots (AMRs): Top-level SLAM route planning, mid-level obstacle detection, low-level motor control, and hardware E-Stop safety interlocks.',

    title: 'Lesson 7: Robotics in Everyday Life',

    category: 'Real-World Robotics',

    summary:
      'Discover how robots are used in agriculture, healthcare, education, industry, and space exploration.',

    illustrationIcon: 'globe',

    content: `**LESSON 7: ROBOTICS IN EVERYDAY LIFE**

**1. Introduction**

Robots are used in many areas of human life.

They help people perform tasks, solve problems, and explore places that may be difficult to reach.

Robotics continues to develop as technology improves.

**2. Robotics in Agriculture**

Agriculture is the practice of growing crops and rearing animals.

Robots can help farmers by:

• Planting seeds.
• Monitoring crops.
• Watering plants.
• Detecting weeds.
• Harvesting some crops.

A farming robot may use sensors to detect the condition of plants.

**3. Robotics in Healthcare**

Robots can support healthcare workers in hospitals and other medical facilities.

They may help with:

• Delivering medicine.
• Moving supplies.
• Assisting in certain medical procedures.
• Supporting rehabilitation.
• Cleaning selected areas.

Robots do not replace the knowledge and care of healthcare professionals.

**4. Robotics in Education**

Educational robots help students learn.

They can be used to teach:

• Mathematics.
• Science.
• Engineering.
• Computer programming.
• Problem-solving.

Students can program robots to move, turn, detect objects, and perform tasks.

**5. Robotics in Industry**

Industries use robots to manufacture products.

Factory robots may:

• Assemble products.
• Paint surfaces.
• Lift heavy materials.
• Package goods.
• Perform repetitive tasks.

Robots can help improve production speed and consistency.

**6. Robotics in Space Exploration**

Some places in space are difficult for humans to visit.

Scientists use robots to explore these places.

Space robots may collect information about:

• The surface of planets.
• Rocks and soil.
• Temperature.
• Weather conditions.
• Other environmental features.

Some space robots are called rovers.

A rover is a vehicle designed to move across the surface of a planet or another celestial body.

**7. Robotics in Our Communities**

Robots and automated systems can help communities in different ways.

For example:

A delivery robot may transport items.

A cleaning robot may clean floors.

A robot may help inspect dangerous areas.

An agricultural robot may support food production.

**8. Benefits of Robotics**

Robotics can:

1. Improve efficiency.
2. Reduce repetitive work.
3. Help people perform dangerous tasks.
4. Support scientific discoveries.
5. Improve some industrial processes.
6. Create opportunities for new jobs and skills.

**9. Challenges of Robotics**

Robotics also has challenges.

These include:

• The cost of building and maintaining robots.
• The need for electricity and other resources.
• The need for skilled workers.
• Safety concerns.
• The possibility of some jobs changing because of automation.

People must use robotics responsibly.

**10. The Future of Robotics**

In the future, robots may become more useful in homes, schools, farms, hospitals, and industries.

Students who learn robotics today can develop skills in programming, engineering, problem-solving, and creativity.

These skills can prepare them for many future careers.

**11. Classroom Activity**

Choose one area:

• Agriculture.
• Healthcare.
• Education.
• Industry.
• Space exploration.

Design a robot that could solve a problem in that area.

Draw the robot and explain:

1. What problem does it solve?
2. Who will use it?
3. What parts will it need?
4. How will it work?
5. What safety measures will be necessary?

**12. Summary**

Robots are used in many areas of everyday life.

They can help people work more efficiently and solve difficult problems.

Robotics also creates new opportunities for learning, creativity, and employment.

The responsible use of robotics is important for the future.`,

    architectureDetails: `TEACHER'S NOTE

For Lower Primary:
Show learners pictures of robots used in homes, schools, farms, and hospitals.

For Upper Primary:
Discuss the benefits of robots in different industries.

For JHS:
Introduce the social and economic effects of automation, including safety, employment, and responsible technology use.

Discussion Question:
How could a robot help solve a problem in your community?`,

    keyPoints: [
      'Robots are used in agriculture, healthcare, education, and industry.',
      'Robots can help people perform difficult or repetitive tasks.',
      'Space robots help scientists explore other planets.',
      'Robotics can create new opportunities and challenges.',
      'Robots should be designed and used responsibly.'
    ],

    quiz: {
      question: 'What is one important use of robotics in agriculture?',

      options: [
        'Helping farmers monitor crops',
        'Replacing all farmers immediately',
        'Making plants grow without water',
        'Changing the weather'
      ],

      correctIndex: 0,

      explanation:
        'Agricultural robots can help farmers monitor crops, plant seeds, and perform other farming tasks.'
    }
  },


  // =========================================================
  // LESSON 8: STEP-BY-STEP GUIDE TO BUILDING A SIMPLE ROBOT
  // =========================================================

  {
    id: 'l8',

    diagramImageBase64: 'data:image/png;base64,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',

    diagramTitle: 'Physical Robot Assembly & Hardware Step-by-Step Diagram',

    diagramCaption: 'Step-by-step visual assembly diagram: 1. Mount DC gear motors to acrylic chassis, 2. Attach rubber wheels & swivel caster wheel, 3. Mount L298N motor driver & Microcontroller board, 4. Wire power & digital control signals.',

    title: 'Lesson 8: Step-by-Step Guide to Building a Simple Robot',

    category: 'Hands-On Hardware',

    summary:
      'A comprehensive step-by-step tutorial for teachers and students on assembling, wiring, and testing a 2-wheeled mobile robot.',

    illustrationIcon: 'wrench',

    content: `**LESSON 8: STEP-BY-STEP GUIDE TO BUILDING A SIMPLE ROBOT**

**1. Introduction & Bill of Materials (Parts List)**

Building your very first physical (or simulated) robot is an exciting hands-on milestone!

Before assembling, let's look at the essential parts needed to build a **2-Wheel Drive (2WD) Autonomous Mobile Robot**:

🛠️ **Chassis & Structure:**
• 1x Acrylic or 3D-printed main robot chassis plate
• 1x Front swivel caster wheel (provides 3-point balance)
• Screws, nuts, and brass standoffs

⚙️ **Motors & Wheels:**
• 2x TT DC Gear Motors (3V–6V)
• 2x Rubber grip wheels

🧠 **Brain & Electronics:**
• 1x Microcontroller Board (Arduino Uno or ESP32)
• 1x L298N Dual H-Bridge Motor Driver Module
• 1x HC-SR04 Ultrasonic Distance Sensor + Mounting bracket

⚡ **Power Supply & Connections:**
• 1x 4xAA Battery Holder (6V) or 2x 18650 Li-ion Battery pack
• Male-to-Female & Male-to-Male Jumper Wires
• 1x Power Switch (optional safety disconnect)

---

**2. Step-by-Step Assembly Tutorial**

**STEP 1: Mounting the Motors & Wheels**
1. Take your two TT DC motors and place them on the left and right sides of the chassis.
2. Align the motor holes with the acrylic chassis slots and secure them using long bolts and nuts.
3. Press the two rubber wheels firmly onto the dual D-shaped motor shafts.
4. Attach the front swivel caster wheel to the nose of the chassis using screws. Your chassis can now roll smoothly on 3 points!

**STEP 2: Mounting the Electronic Modules**
1. **Motor Driver:** Screw the L298N motor driver module onto the rear center of the chassis plate.
2. **Microcontroller:** Mount your Arduino Uno (or ESP32) towards the front center using plastic standoffs so the metal pins do not touch the chassis.
3. **Ultrasonic Sensor:** Snap the HC-SR04 distance sensor into its mounting bracket and attach it to the front bumper, facing forward like eyes.
4. **Battery Holder:** Secure the battery pack under or on the upper deck of the chassis using double-sided tape or screws.

**STEP 3: Wiring the DC Motors to the Motor Driver**
1. Connect the 2 wires from the **Left DC Motor** to terminals **OUT1** and **OUT2** on the L298N driver.
2. Connect the 2 wires from the **Right DC Motor** to terminals **OUT3** and **OUT4** on the L298N driver.

**STEP 4: Wiring Control Signals to the Microcontroller**
1. Connect **L298N IN1** (Left Motor Forward) ➔ Arduino Digital Pin **5**.
2. Connect **L298N IN2** (Left Motor Reverse) ➔ Arduino Digital Pin **6**.
3. Connect **L298N IN3** (Right Motor Forward) ➔ Arduino Digital Pin **9**.
4. Connect **L298N IN4** (Right Motor Reverse) ➔ Arduino Digital Pin **10**.

**STEP 5: Power & Common Ground Connection (Critical Safety Step)**
1. Connect the **Red wire (+6V to +12V)** from the battery pack ➔ L298N **12V power terminal**.
2. Connect the **Black wire (GND)** from the battery pack ➔ L298N **GND terminal**.
3. **CRITICAL STEP:** Connect a jumper wire from **L298N GND** ➔ **Arduino GND pin**. *(Without this common ground, control signals cannot be measured correctly!)*
4. Connect **L298N 5V OUT terminal** ➔ **Arduino 5V pin** (or power Arduino via USB).

**STEP 6: Wiring the Ultrasonic Distance Sensor**
1. Sensor **VCC** ➔ Arduino **5V rail**.
2. Sensor **GND** ➔ Arduino **GND rail**.
3. Sensor **TRIG** (Trigger Pulse) ➔ Arduino Digital Pin **11**.
4. Sensor **ECHO** (Echo Receive) ➔ Arduino Digital Pin **12**.

---

**3. Pre-Flight Testing & Safety Checks**

Before turning on the main power switch:

✅ **Wheel Elevation Check:** Place your robot on top of a small block or cup so its wheels are lifted off the table. This prevents the robot from driving off the desk during its initial code test!
✅ **Polarity Check:** Verify that the Red (+) wire goes to 12V and Black (-) goes to GND.
✅ **Shared Ground Check:** Ensure Arduino GND and L298N GND are securely wired together.

**4. Summary**

By following these 6 steps, you have successfully assembled and wired a complete 2WD autonomous mobile robot!

In the code section below, you can upload a basic movement test to verify that both motors spin forward smoothly!`,

    architectureDetails: `TEACHER'S CLASSROOM & LAB GUIDE

Group Setup & Classroom Management:
• Group size: Assign 2-4 students per kit (Mechanic, Electrician, Programmer, Quality Inspector).
• Safety rules: Instruct students never to touch live motor terminals while powered and keep wire strippers away from fingers.

Troubleshooting Common Student Errors:
1. "My left wheel is spinning backwards when driving forward!"
   Solution: Swap the OUT1 and OUT2 wires on the L298N motor driver terminal block.
2. "The microcontroller keeps resetting every time the motors start!"
   Solution: Weak batteries or missing shared GND wire between motor driver and microcontroller board.
3. "The ultrasonic sensor gives random 0cm readings."
   Solution: Check if TRIG and ECHO pins are reversed on pins 11 and 12.

Classroom Extension Activity:
Have student teams measure the exact distance traveled in 3 seconds to calculate their robot's linear velocity in cm/sec!`,

    codeExample: `// =========================================================
// EduEaz Robotics Lab - Basic 2WD Robot Test Program
// =========================================================

const int IN1 = 5;  // Left Motor Forward
const int IN2 = 6;  // Left Motor Reverse
const int IN3 = 9;  // Right Motor Forward
const int IN4 = 10; // Right Motor Reverse
const int TRIG = 11;
const int ECHO = 12;

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
}

void loop() {
  // 1. Move Forward for 2 Seconds
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  delay(2000);

  // 2. Stop for 1 Second
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
  delay(1000);

  // 3. Pivot Turn Right for 1 Second
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH);
  delay(1000);

  // 4. Full Stop
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
  delay(2000);
}`,

    keyPoints: [
      'Assembling a 2WD robot involves mechanical chassis mounting, electronic module placement, and circuit wiring.',
      'Connecting a shared GND (Ground) wire between the battery, motor driver, and microcontroller is mandatory.',
      'Always elevate robot wheels off the table during first code testing to prevent accidental falls.',
      'If a motor spins in reverse, simply swap its two output wires on the L298N terminal block.'
    ],

    quiz: {
      question:
        'Why is it crucial to connect the GND (Ground) pin of the motor driver module to the GND pin of the microcontroller board?',

      options: [
        'To establish a common reference voltage so digital control signals are recognized accurately',
        'To make the robot motors spin twice as fast',
        'To change the chassis color',
        'To turn off the sensor LED light'
      ],

      correctIndex: 0,

      explanation:
        'A shared common ground provides a uniform zero-volt reference point, enabling digital signal pins (5V/0V HIGH/LOW) to operate correctly across different circuit modules.'
    }
  },

  BEGINNER_TUTORIAL_LESSON

];
